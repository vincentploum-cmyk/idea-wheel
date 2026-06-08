import { NextResponse } from 'next/server';
import { ensureSessionId, recordOutcome } from '../../../../lib/moat-store';
import { getBalance, deductCredits, ensureWelcomeGrant } from '../../../../lib/credits';
import { clarify } from '../../../../lib/clarity';

const DEEP_RESEARCH_COST = 1;

async function getUser() {
  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function call(prompt, { maxTokens = 2000, searchUses = 8, attempt = 0 } = {}) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      // Deep, paid research: a wider web search aimed at communities.
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: searchUses }],
    }),
  });
  if (res.status === 429 && attempt < 2) {
    await sleep(8000 * (attempt + 1));
    return call(prompt, { maxTokens, searchUses, attempt: attempt + 1 });
  }
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: data.usage || {} };
}

function extractJson(text) {
  const clean = String(text || '').replace(/```json\n?|```\n?/gi, '').trim();
  const start = clean.search(/[{]/);
  if (start === -1) throw new Error('No JSON in response');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) return clean.slice(start, i + 1); }
  }
  return clean.slice(start);
}

function parse(text) {
  return JSON.parse(
    extractJson(text)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, '$1')
  );
}

function researchPrompt(agentDesc, comp) {
  return `You are doing DEEP demand research for this product idea: "${agentDesc}".

The free scan already produced this read: ${JSON.stringify({
    score: comp?.score,
    landscape: comp?.landscape,
    gap: comp?.gap,
    verdict: comp?.verdict,
  })}

Now go deeper. Search Reddit, Hacker News, Indie Hackers, niche forums, and community threads where REAL people discuss this problem. Find evidence of genuine, painful, recurring demand — not vendor marketing. Quote the kind of thing people actually say. Look for what they currently cobble together, what they hate about it, and whether they pay for solutions.

Return ONLY a JSON object (no fences):
{
  "demandLevel": "strong | mixed | weak — how real and painful is the demand in communities?",
  "demandSignals": ["3-5 concrete findings, each citing where (e.g. 'r/smallbusiness threads repeatedly complain that…')"],
  "voiceOfCustomer": ["2-3 short paraphrased quotes of how people describe the pain"],
  "communities": ["3-5 specific subreddits/forums/communities where this audience gathers"],
  "wedge": "the sharpest wedge the community evidence points to",
  "willingnessToPay": "1-2 sentences on whether people pay for solutions today and roughly how much",
  "verdict": "2-3 sentences: does the deeper evidence strengthen or weaken this idea, and why?"
}
Be specific and honest. If the deeper search shows little real demand, say so.
Write every field in plain, jargon-free language a non-technical founder can read at a glance — short sentences, no buzzwords. If you must use a niche term, explain it in a few words.`;
}

export async function POST(request) {
  const { action, workflow, industry, connector, modeName, freeformIdea, comp, sessionId: rawSessionId } = await request.json();
  if (!freeformIdea && (!action || !workflow || !industry)) {
    return NextResponse.json({ error: 'Missing: action, workflow, industry (or freeformIdea)' }, { status: 400 });
  }
  const sessionId = ensureSessionId(rawSessionId);
  const agentDesc = freeformIdea || `an agent that ${action} ${workflow} ${connector} ${industry}`;

  // Paid step: must be signed in with at least 1 credit. We charge only AFTER
  // the research succeeds, so a failed run never costs a credit.
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.', code: 'AUTH_REQUIRED' }, { status: 401 });
  await ensureWelcomeGrant(user.id);
  const balance = await getBalance(user.id);
  if (balance < DEEP_RESEARCH_COST) {
    return NextResponse.json({ error: 'Not enough credits.', code: 'insufficient_credits', balance }, { status: 402 });
  }

  try {
    const research = await call(researchPrompt(agentDesc, comp), { maxTokens: 2000, searchUses: 8 });
    let parsed;
    try {
      parsed = parse(research.text);
    } catch {
      const repair = await call(
        `Convert the text below into ONE valid JSON object with keys demandLevel, demandSignals[], voiceOfCustomer[], communities[], wedge, willingnessToPay, verdict. JSON only.\n\n${research.text.slice(0, 12000)}`,
        { searchUses: 1, maxTokens: 1600 }
      );
      parsed = parse(repair.text);
    }

    // Additional readability check on the deep web-search outcome: attach a
    // plain-English summary + takeaways so non-technical readers can digest it.
    const clarity = await clarify({ label: 'Deep market demand research', payload: parsed });
    if (clarity) {
      parsed.plainSummary = clarity.plainSummary;
      parsed.takeaways = clarity.takeaways;
    }

    const charge = await deductCredits(user.id, DEEP_RESEARCH_COST, 'deep_research', { validationId: comp?.validationId || null });
    const newBalance = charge.ok ? charge.newBalance : balance;

    await recordOutcome({
      sessionId, signal: 'deep_research_completed', modeName, action, workflow, industry,
      payload: { demandLevel: parsed?.demandLevel },
    }).catch(() => {});

    return NextResponse.json({ sessionId, research: parsed, balance: newBalance });
  } catch (err) {
    console.error('[deep-research]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
