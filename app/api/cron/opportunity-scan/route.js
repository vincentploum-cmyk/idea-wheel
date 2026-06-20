import { NextResponse } from 'next/server';
import { syncOpportunityBankToSupabase } from '@/lib/opportunity-bank';
import { DEFAULT_MODE_CONFIGS } from '@/lib/generator-config';

const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Vocabulary exposed to Claude so it only picks valid bank values
const B2B_ACTIONS    = DEFAULT_MODE_CONFIGS.b2b.banks[0];
const B2B_WORKFLOWS  = DEFAULT_MODE_CONFIGS.b2b.banks[1];
const B2B_INDUSTRIES = DEFAULT_MODE_CONFIGS.b2b.banks[2];

const SYSTEM_PROMPT = `You are a startup opportunity analyst.
Your job is to identify high-signal B2B agent ideas by combining values from the exact vocabulary lists provided.
You MUST only use values that appear verbatim in those lists — never invent new ones.
Respond with a JSON array only. No markdown, no prose, no code fences.`;

function buildUserPrompt(date) {
  return `Today is ${date}. Identify 12 high-signal B2B agent opportunities that are timely and commercially strong right now.

Pick combinations from these exact lists:

ACTIONS (column 1 — pick the exact string):
${JSON.stringify(B2B_ACTIONS)}

WORKFLOWS (column 2 — pick the exact string):
${JSON.stringify(B2B_WORKFLOWS)}

INDUSTRIES (column 3 — pick the exact string):
${JSON.stringify(B2B_INDUSTRIES)}

For each opportunity return a JSON object with these fields:
{
  "action": "<exact value from ACTIONS>",
  "workflow": "<exact value from WORKFLOWS>",
  "industry": "<exact value from INDUSTRIES>",
  "title": "<product name, 3-6 words>",
  "one_liner": "<one punchy sentence describing the product>",
  "pain_signal": "<the specific pain this solves, 1-2 sentences>",
  "why_now": "<why this is urgent or timely right now, 1 sentence>",
  "score": <integer 15-30, higher = stronger signal>
}

Prioritise combinations where:
- The workflow is genuinely painful in that industry (manual, error-prone, time-consuming)
- The industry is large enough to sustain a SaaS business
- AI automation adds clear, measurable value
- There is evidence of growing demand

Return a JSON array of 12 objects. Nothing else.`;
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseSeeds(raw, date) {
  let parsed;
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Claude returned non-JSON output');
  }

  if (!Array.isArray(parsed)) throw new Error('Expected JSON array from Claude');

  return parsed
    .filter((item) => {
      // Validate all three values exist in the banks
      return (
        item.action && item.workflow && item.industry &&
        B2B_ACTIONS.includes(item.action) &&
        B2B_WORKFLOWS.includes(item.workflow) &&
        B2B_INDUSTRIES.includes(item.industry)
      );
    })
    .map((item) => ({
      key: `cron::b2b::${item.action}::${item.workflow}::${item.industry}`,
      mode: 'b2b',
      action: item.action,
      workflow: item.workflow,
      industry: item.industry,
      title: String(item.title || '').trim(),
      one_liner: String(item.one_liner || '').trim(),
      pain_signal: String(item.pain_signal || '').trim(),
      why_now: String(item.why_now || '').trim(),
      score: Math.min(30, Math.max(0, Number(item.score) || 15)),
      source: 'opportunity_scan',
      source_url: '',
      first_seen_at: date,
      last_seen_at: date,
      times_seen: 1,
    }));
}

export async function POST(request) {
  // Verify cron secret
  const auth = request.headers.get('authorization') || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!OPENAI_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const date = new Date().toISOString();

  try {
    const raw = await callOpenAI(buildUserPrompt(date.slice(0, 10)));
    const seeds = parseSeeds(raw, date);

    if (!seeds.length) {
      return NextResponse.json({ ok: false, error: 'No valid seeds parsed', raw: raw.slice(0, 500) }, { status: 422 });
    }

    const result = await syncOpportunityBankToSupabase(seeds);
    console.log(`[opportunity-scan] synced ${result.count} seeds`);

    return NextResponse.json({ ok: true, count: result.count, seeds });
  } catch (err) {
    console.error('[opportunity-scan]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
