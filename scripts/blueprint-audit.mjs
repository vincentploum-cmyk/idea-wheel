#!/usr/bin/env node
/**
 * Blueprint quality audit — Gate 1 in the launch checklist.
 *
 * Runs a fixed set of B2B + consumer ideas through the LIVE pipeline
 * (validate → deep-research → build:designer + launch + infra), then
 * scores each output against lib/audit-rubric.js. Optionally sends the
 * "reads like a hallucination?" pass to OpenAI so we catch the
 * qualitative failures the mechanical rubric can't.
 *
 * Requirements:
 *   - E2E_BASE_URL (default https://ideareels.io)
 *   - AUDIT_USER_COOKIE — a Supabase session cookie for a test user with
 *     enough credits (each blueprint costs 3 credits: 1 research + 2 build).
 *     Grab from your browser: DevTools → Application → Cookies →
 *     the `sb-auth.ideareels.io-auth-token` cookie value.
 *   - OPENAI_API_KEY — only needed for the qualitative LLM pass (skip with
 *     --no-llm).
 *
 * Usage:
 *   node scripts/blueprint-audit.mjs                # all 20 ideas, LLM on
 *   node scripts/blueprint-audit.mjs --sample 5     # first 5 ideas
 *   node scripts/blueprint-audit.mjs --no-llm       # rubric only
 *   node scripts/blueprint-audit.mjs --mode b2b     # b2b only
 *
 * Writes:
 *   audit-report-<timestamp>.json (full payload + rubric)
 *   audit-report-<timestamp>.md   (human-readable summary)
 *
 * Cost: ~$5-15 in OpenAI credits per run. Uses IdeaReels credits on the
 * target account.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { auditBlueprint } from '../lib/audit-rubric.js';

const BASE = process.env.E2E_BASE_URL || 'https://ideareels.io';
const COOKIE = process.env.AUDIT_USER_COOKIE || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

const args = new Set(process.argv.slice(2));
const argValue = (flag) => {
  const idx = process.argv.indexOf(flag);
  return idx > -1 ? process.argv[idx + 1] : null;
};
const SAMPLE = Number(argValue('--sample') || 0) || null;
const MODE_FILTER = argValue('--mode') || null; // 'b2b' | 'consumer'
const USE_LLM = !args.has('--no-llm') && !!OPENAI_KEY;

const IDEAS = [
  // B2B (10)
  { mode: 'b2b', action: 'Automates', workflow: 'certificate of insurance tracking', industry: 'Construction' },
  { mode: 'b2b', action: 'Automates', workflow: 'employee certification renewal reminders', industry: 'field-service SMBs' },
  { mode: 'b2b', action: 'Automates', workflow: 'suppressed listing corrections', industry: 'Amazon FBA and MFN sellers' },
  { mode: 'b2b', action: 'Streamlines', workflow: 'patient intake', industry: 'Dental practices' },
  { mode: 'b2b', action: 'Handles', workflow: 'churn signals', industry: 'SaaS companies' },
  { mode: 'b2b', action: 'Coordinates', workflow: 'punch list resolution', industry: 'Construction' },
  { mode: 'b2b', action: 'Automates', workflow: 'sales tax filing', industry: 'Shopify owners' },
  { mode: 'b2b', action: 'Speeds up', workflow: 'client onboarding', industry: 'Accounting firms' },
  { mode: 'b2b', action: 'Structures', workflow: 'proactive job status sms updates', industry: 'independent auto repair shops' },
  { mode: 'b2b', action: 'Handles', workflow: 'weight-based inventory deduction across variant sizes', industry: 'Shopify bulk goods sellers' },
  // Consumer (10)
  { mode: 'consumer', action: 'Optimizes', workflow: 'spending habits', industry: 'freelancers' },
  { mode: 'consumer', action: 'Improves', workflow: 'sleep', industry: 'new parents' },
  { mode: 'consumer', action: 'Coaches', workflow: 'language learning', industry: 'new immigrants' },
  { mode: 'consumer', action: 'Organizes', workflow: 'home routines', industry: 'first-time homeowners' },
  { mode: 'consumer', action: 'Structures', workflow: 'skills', industry: 'young adults' },
  { mode: 'consumer', action: 'Coaches', workflow: 'career growth', industry: 'veterans transitioning out' },
  { mode: 'consumer', action: 'Improves', workflow: 'focus & deep work', industry: 'people with ADHD' },
  { mode: 'consumer', action: 'Structures', workflow: 'daily schedule', industry: 'autistic adults' },
  { mode: 'consumer', action: 'Plans', workflow: 'personal finances', industry: 'gig economy workers' },
  { mode: 'consumer', action: 'Coaches', workflow: 'workout recovery', industry: 'healthcare workers' },
];

function log(...a) { console.log(new Date().toISOString(), '·', ...a); }

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': COOKIE,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

async function readNdjson(path, opts = {}) {
  // Server-sent NDJSON stream (validate route). Returns array of parsed lines.
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': COOKIE,
      ...(opts.headers || {}),
    },
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const lines = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) { try { lines.push(JSON.parse(line)); } catch {} }
    }
  }
  return { status: res.status, lines };
}

async function llmQualitativeCheck(payload) {
  if (!USE_LLM) return { skipped: true };
  const prompt = `You are auditing an AI-generated startup blueprint for signs of hallucination. Given the JSON below, answer YES or NO to each check, then give a one-sentence rationale.

Checks:
1. Are the competitors plausible real companies (not invented)?
2. Are the numerical market claims presented with appropriate hedging (or verified sources)?
3. Is the ICP internally consistent between validation and GTM?
4. Do the operating cost estimates look realistic for a product at this price?
5. Would a technical founder consider the runbook actually followable end-to-end?

Return strict JSON: {"c1": {"yes": bool, "why": "..."}, "c2": {...}, ...}

Blueprint:
${JSON.stringify(payload).slice(0, 30000)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) return { error: `openai ${res.status}` };
  const data = await res.json();
  try { return JSON.parse(data.choices[0].message.content); }
  catch { return { error: 'parse-failed' }; }
}

async function runOne(idea, index) {
  log(`[${index + 1}] ${idea.mode.toUpperCase()} · ${idea.action} ${idea.workflow} · ${idea.industry}`);

  // 1. Validate
  const vRes = await readNdjson('/api/pipeline/validate', {
    method: 'POST',
    body: JSON.stringify({ ...idea, modeName: idea.mode === 'b2b' ? 'B2B' : 'Consumer' }),
  });
  if (vRes.status !== 200) return { idea, error: `validate ${vRes.status}` };
  const resultLine = vRes.lines.find((l) => l.t === 'result');
  if (!resultLine?.comp) return { idea, error: 'no comp' };
  const comp = resultLine.comp;
  const sessionId = resultLine.sessionId;
  log(`  score=${comp.score} sessionId=${sessionId}`);

  if (comp.score < 60) {
    return { idea, comp, skipped: 'below_threshold' };
  }

  // 2. Deep research (optional but recommended to hit the full path)
  const drRes = await api('/api/pipeline/deep-research', {
    method: 'POST',
    body: JSON.stringify({ ...idea, modeName: idea.mode === 'b2b' ? 'B2B' : 'Consumer', comp, sessionId }),
  });
  if (drRes.status !== 200) return { idea, comp, error: `deep-research ${drRes.status}: ${JSON.stringify(drRes.body).slice(0, 200)}` };
  const deepResearch = drRes.body.research;

  // 3. Build: designer → launch → infrastructure
  const validationId = comp.validationId || null;
  const withDR = { ...comp, deepResearch };
  const dsn = await api('/api/pipeline/build', {
    method: 'POST',
    body: JSON.stringify({ ...idea, modeName: idea.mode === 'b2b' ? 'B2B' : 'Consumer', stage: 'designer', comp: withDR, sessionId, validationId, creditCost: 2 }),
  });
  if (dsn.status !== 200) return { idea, comp, error: `designer ${dsn.status}: ${JSON.stringify(dsn.body).slice(0, 200)}` };

  const chargeToken = dsn.body.chargeToken;
  const design = dsn.body.design;

  const gtm = await api('/api/pipeline/build', {
    method: 'POST',
    body: JSON.stringify({ ...idea, modeName: idea.mode === 'b2b' ? 'B2B' : 'Consumer', stage: 'launch', comp: withDR, design, sessionId, validationId, chargeToken }),
  });
  if (gtm.status !== 200) return { idea, comp, design, error: `launch ${gtm.status}` };

  const infra = await api('/api/pipeline/build', {
    method: 'POST',
    body: JSON.stringify({ ...idea, modeName: idea.mode === 'b2b' ? 'B2B' : 'Consumer', stage: 'infrastructure', comp: withDR, design, gtm: gtm.body.gtm, sessionId, validationId, chargeToken }),
  });
  if (infra.status !== 200) return { idea, comp, design, gtm: gtm.body.gtm, error: `infra ${infra.status}` };

  const payload = { comp: withDR, design, gtm: gtm.body.gtm, infra: infra.body.infra };

  // 4. Rubric
  const rubric = auditBlueprint(payload);
  // 5. Optional LLM qualitative check
  const llm = await llmQualitativeCheck(payload);

  return { idea, comp, payload, rubric, llm };
}

async function main() {
  if (!COOKIE) {
    console.error('AUDIT_USER_COOKIE not set. See top of scripts/blueprint-audit.mjs for how to obtain one.');
    process.exit(1);
  }

  let ideas = IDEAS;
  if (MODE_FILTER) ideas = ideas.filter((i) => i.mode === MODE_FILTER);
  if (SAMPLE) ideas = ideas.slice(0, SAMPLE);

  const results = [];
  for (let i = 0; i < ideas.length; i += 1) {
    try {
      const r = await runOne(ideas[i], i);
      results.push(r);
      const summary = r.error ? `ERROR: ${r.error}` : r.skipped ? `SKIPPED: ${r.skipped}` : r.rubric?.summary || '?';
      log(`  → ${summary}`);
    } catch (err) {
      results.push({ idea: ideas[i], error: err.message });
      log(`  → THREW: ${err.message}`);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = `audit-report-${ts}.json`;
  const mdPath = `audit-report-${ts}.md`;

  await writeFile(jsonPath, JSON.stringify(results, null, 2));

  const passed = results.filter((r) => r.rubric?.pass).length;
  const softFail = results.filter((r) => r.rubric && !r.rubric.pass && r.rubric.hardPass).length;
  const hardFail = results.filter((r) => r.rubric && !r.rubric.hardPass).length;
  const errored = results.filter((r) => r.error).length;
  const skipped = results.filter((r) => r.skipped).length;

  const md = [];
  md.push(`# Blueprint audit — ${ts}`);
  md.push('');
  md.push(`- Total ideas: ${results.length}`);
  md.push(`- **Passed: ${passed}**`);
  md.push(`- Soft fails: ${softFail}`);
  md.push(`- Hard fails: ${hardFail}`);
  md.push(`- Errored: ${errored}`);
  md.push(`- Skipped (below threshold): ${skipped}`);
  md.push('');
  md.push('## Per-idea');
  md.push('');
  for (const r of results) {
    const title = `${r.idea.mode.toUpperCase()} · ${r.idea.action} ${r.idea.workflow} · ${r.idea.industry}`;
    md.push(`### ${title}`);
    if (r.error) {
      md.push(`- ERROR: ${r.error}`);
    } else if (r.skipped) {
      md.push(`- SKIPPED: ${r.skipped} (score ${r.comp?.score})`);
    } else {
      md.push(`- Score: ${r.comp?.score}`);
      md.push(`- Rubric: **${r.rubric.summary}**`);
      md.push(`- softMean: ${r.rubric.softMean.toFixed(2)}`);
      if (r.rubric.notes.length) md.push(`- Notes: ${r.rubric.notes.join('; ')}`);
      if (r.llm && !r.llm.skipped && !r.llm.error) {
        for (const [k, v] of Object.entries(r.llm)) {
          md.push(`  - LLM ${k}: ${v.yes ? 'YES' : 'NO'} — ${v.why || ''}`);
        }
      }
    }
    md.push('');
  }
  await writeFile(mdPath, md.join('\n'));

  console.log('');
  console.log(`Passed: ${passed} / ${results.length}. Details in ${mdPath}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
