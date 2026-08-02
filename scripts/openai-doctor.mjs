#!/usr/bin/env node
/**
 * OpenAI doctor — answers "why is the AI pipeline erroring?" in one command.
 *
 *   OPENAI_API_KEY=sk-... node scripts/openai-doctor.mjs
 *
 * Runs the same four calls the market-research pipeline depends on and reports
 * which one breaks, so you never have to guess between "model retired",
 * "web-search tool renamed" and "the account is out of credit" again.
 *
 * Safe to run against production credentials: it sends four tiny prompts
 * (a few hundred tokens total) and writes nothing.
 *
 * Exit code 0 = everything the pipeline needs works. 1 = something is broken.
 */

const KEY = process.env.OPENAI_API_KEY;
const FAST = process.env.OPENAI_MODEL_FAST || 'gpt-4o-mini';
const DEEP = process.env.OPENAI_MODEL_DEEP || 'gpt-4o';
// Same order the runtime tries (lib/openai-config.js).
const TOOL_NAMES = ['web_search_preview', 'web_search'];
// Overridable so the script can be exercised against a mock (and so it works
// behind an Azure/proxy base URL).
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`;

if (!KEY) {
  console.error(bad('OPENAI_API_KEY is not set. Export it and re-run.'));
  process.exit(1);
}

const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };
const findings = [];

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

function reason(text) {
  try {
    const e = JSON.parse(text)?.error;
    return e?.code ? `${e.code}: ${e.message}` : e?.message || text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

// 1 — Is the key valid at all?
console.log('\nChecking OpenAI…\n');
const models = await fetch(`${BASE}/v1/models`, { headers: auth });
if (models.status === 401) {
  console.log(bad('API key rejected (401). The key is wrong, revoked, or from another org.'));
  console.log('\n  → Rotate OPENAI_API_KEY in the Render dashboard.\n');
  process.exit(1);
}
if (!models.ok) {
  console.log(bad(`GET /v1/models returned ${models.status}: ${reason(await models.text())}`));
  process.exit(1);
}
console.log(ok('API key is valid'));

// 2 — Do the configured models still exist on this account?
const available = new Set((await models.json()).data?.map((m) => m.id) || []);
for (const [tier, id] of [['OPENAI_MODEL_FAST', FAST], ['OPENAI_MODEL_DEEP', DEEP]]) {
  if (available.has(id)) {
    console.log(ok(`${tier} = ${id} — available`));
  } else {
    console.log(bad(`${tier} = ${id} — NOT available to this account`));
    findings.push(`${id} is not in your account's model list. Set ${tier} on Render to a model that is.`);
  }
}

// 3 — Can we actually complete? (catches quota/billing, which /v1/models does not)
const chat = await post(`${BASE}/v1/chat/completions`, {
  model: FAST,
  max_tokens: 5,
  messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
});
if (chat.ok) {
  console.log(ok(`chat/completions works on ${FAST}`));
} else {
  console.log(bad(`chat/completions failed (${chat.status}): ${reason(chat.text)}`));
  const t = chat.text.toLowerCase();
  if (t.includes('insufficient_quota') || t.includes('exceeded your current quota')) {
    findings.push('ACCOUNT IS OUT OF CREDIT. No code change fixes this — top up OpenAI billing.');
  } else if (t.includes('model_not_found') || t.includes('does not exist') || t.includes('deprecated')) {
    findings.push(`${FAST} was rejected as a model. Set OPENAI_MODEL_FAST on Render to a current model.`);
  } else {
    findings.push(`chat/completions is failing: ${reason(chat.text)}`);
  }
}

// 4 — Which web-search tool name does the Responses API accept?
//     This is the first call basic market research makes, so it is the one that
//     takes the whole feature down.
const accepted = [];
// A quota / model / auth failure rejects EVERY tool name. Blaming the tool then
// would send you chasing the wrong cause, so track why each one was refused and
// only fault the name when the name is genuinely what was refused.
let blockedByOtherCause = false;
for (const tool of TOOL_NAMES) {
  const res = await post(`${BASE}/v1/responses`, {
    model: FAST,
    tools: [{ type: tool }],
    input: 'Reply with the single word: ok',
  });
  if (res.ok) {
    accepted.push(tool);
    console.log(ok(`web-search tool "${tool}" accepted`));
    continue;
  }
  const t = res.text.toLowerCase();
  const nameRejected = t.includes('tool') || t.includes('web_search');
  const otherCause = t.includes('insufficient_quota') || t.includes('exceeded your current quota')
    || t.includes('model_not_found') || t.includes('does not exist') || t.includes('deprecated')
    || res.status === 401;
  if (otherCause) blockedByOtherCause = true;
  console.log(warn(`web-search tool "${tool}" rejected (${res.status}): ${reason(res.text)}`));
  if (!nameRejected && !otherCause) blockedByOtherCause = true; // unknown cause — don't blame the name
}
if (accepted.length === 0 && blockedByOtherCause) {
  console.log(warn('Web-search could not be tested — the failure above blocks every tool name.'));
  console.log('  Fix that first, then re-run; the tool name is probably fine.');
} else if (accepted.length === 0) {
  console.log(bad('NEITHER web-search tool name works — basic market research cannot run.'));
  findings.push('No web-search tool name is accepted. Check the current name in OpenAI\'s web-search guide, then set OPENAI_WEB_SEARCH_TOOL on Render.');
} else if (!accepted.includes(TOOL_NAMES[0])) {
  findings.push(`"${TOOL_NAMES[0]}" is rejected but "${accepted[0]}" works. The pipeline falls back automatically, so it is NOT broken — but pin OPENAI_WEB_SEARCH_TOOL=${accepted[0]} on Render to drop a wasted round trip per call.`);
} else if (accepted.includes("web_search") && TOOL_NAMES[0] !== "web_search") {
  console.log(warn('Both names work. "web_search" is the current one — pin OPENAI_WEB_SEARCH_TOOL=web_search when convenient.'));
}

console.log('');
if (findings.length === 0) {
  console.log(ok('Everything the market-research pipeline needs is working.'));
  console.log('  If it is still failing in production, the cause is not OpenAI —');
  console.log('  check /api/admin/errors?scope=api:validate for the real exception.\n');
  process.exit(0);
}

console.log('\x1b[1mWhat to do:\x1b[0m');
for (const f of findings) console.log(`  → ${f}`);
console.log('');
process.exit(1);
