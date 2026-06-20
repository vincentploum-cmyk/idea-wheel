/**
 * POST /api/admin/seed-catalog
 *
 * Protected admin endpoint that runs the research + blueprint pipeline for
 * every curated idea and stores the results in Supabase.
 *
 * Authorization header: Bearer <SEED_SECRET>
 * (Set SEED_SECRET in Render env vars — use any random string.)
 *
 * Optional body: { "slugs": ["certwatch", "intakeflow"] }
 * Omit to regenerate all 6 ideas.
 *
 * Returns: { generated: [...], failed: [...] }
 */

import { getAllCatalogData, upsertCatalogIdea } from '../../../../lib/catalog-store';
import { IDEA_EXAMPLES } from '../../../../lib/idea-examples';

const KEY = process.env.ANTHROPIC_API_KEY;
const SECRET = process.env.SEED_SECRET;

// --- Anthropic helpers -----------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function call(prompt, { model = 'claude-haiku-4-5-20251001', maxTokens = 2000, webSearch = false } = {}, attempt = 0) {
  if (!KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && attempt < 3) {
    await sleep(10000 * (attempt + 1));
    return call(prompt, { model, maxTokens, webSearch }, attempt + 1);
  }
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseJSON(text) {
  const clean = text.replace(/```json\n?|```\n?/gi, '').trim();
  const start = clean.search(/[\[{]/);
  if (start === -1) throw new Error('No JSON found');
  const opening = clean[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0, inStr = false, escaped = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === opening) depth++;
    if (ch === closing) { depth--; if (depth === 0) return JSON.parse(clean.slice(start, i + 1).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); }
  }
  return JSON.parse(clean.slice(start));
}

const PROSE = `WRITING RULES — every field read by a founder:
- 8th-grade English. Short sentences. Everyday words.
- No buzzwords: synergy, leverage, robust, holistic, ecosystem, B2B SaaS, TAM, GTM, incumbent, whitespace, wedge.
- Each list item is one concrete fact/action, max 20 words.`;

// --- Research pipeline -----------------------------------------------------------

async function generateResearch(idea) {
  const agentDesc = `an agent that ${idea.action} ${idea.workflow} for ${idea.industry}`;
  const text = await call(`You are a senior market analyst writing a deep-research report for a startup founder.

The idea: ${agentDesc}
Description: ${idea.description}

Search the web for real competing products, market size signals, user complaints on Reddit/ProductHunt/forums, pricing of existing tools, and any 2024-2025 market shifts.

Return ONLY valid JSON (no fences):
{
  "marketSize": "one specific sentence about the scale of this opportunity",
  "teaserLine": "one punchy sentence (max 18 words) previewing the opportunity — shown as a teaser to non-paying users",
  "landscape": "2-3 plain sentences about the market today. Name real companies.",
  "players": [
    { "name": "...", "pricing": "...", "weakness": "one sentence on where they fall short", "coverage": "one sentence on what they do well" }
  ],
  "gap": "the specific unaddressed pain these tools leave open",
  "signals": [
    "signal 1 — a specific fact (user complaint quote, search volume stat, job posting, forum thread)",
    "signal 2",
    "signal 3",
    "signal 4",
    "signal 5"
  ],
  "risks": [
    "risk 1 — a specific reason this could be harder than it looks",
    "risk 2",
    "risk 3"
  ],
  "opportunity": "2-3 honest sentences on the real opening in this market",
  "verdict": "build | warning | avoid",
  "verdictReasoning": "2 honest sentences explaining the verdict — reference specific players"
}

List up to 5 players sorted largest to smallest. Use real company names and real pricing where you can find it.

${PROSE}`, { webSearch: true, maxTokens: 2800 });
  return parseJSON(text);
}

// --- Blueprint pipeline (3 calls in sequence — each informs the next) -----------

async function generateBlueprint(idea, research) {
  const agentDesc = `an agent that ${idea.action} ${idea.workflow} for ${idea.industry}`;

  // Stage 1 — Product design
  const designText = await call(`Design a lean, differentiated AI product for this idea.

Idea: "${agentDesc}"
Description: ${idea.description}
Market gap: ${research.gap}
Opportunity: ${research.opportunity}
Players to beat: ${(research.players || []).slice(0, 4).map(p => `${p.name} (weak: ${p.weakness})`).join(' | ')}

Return ONLY valid JSON (no fences):
{
  "name": "product name (2-3 words max)",
  "tagline": "what it does and for whom in one line",
  "differentiator": "the ONE thing that makes this harder to copy than a generic AI wrapper — be specific",
  "coreFeatures": [
    "feature 1 — one sentence, plain and concrete",
    "feature 2",
    "feature 3",
    "feature 4"
  ],
  "userFlow": "how a user goes from sign-up to their first real result, in 2-3 plain sentences",
  "wowMoment": "the single moment a prospect sees and says 'I need this now' — be specific",
  "dataMoat": "what proprietary data or workflow memory accumulates over time that competitors can't easily copy"
}

${PROSE}`, { model: 'claude-sonnet-4-6', maxTokens: 1400 });
  const design = parseJSON(designText);

  // Stage 2 — GTM strategy
  const gtmText = await call(`Go-to-market strategy. Make it feel specific and actionable, not generic.

Idea: "${agentDesc}"
Product: ${design.name} — ${design.tagline}
Market: ${research.landscape}
Opportunity: ${research.opportunity}

Return ONLY valid JSON (no fences):
{
  "persona": "the exact type of first customer — one sentence with their role and current pain",
  "revenueGoal": "first-month target with simple math (e.g. $2,400 = 8 × $300/mo)",
  "pricing": {
    "price": "$X/mo",
    "rationale": "why this price fits what this customer already pays for similar tools",
    "trial": "free trial or free tier structure"
  },
  "firstFiveCustomers": [
    "tactic 1 — name the exact community/platform + the exact pitch angle. One sentence.",
    "tactic 2",
    "tactic 3",
    "tactic 4",
    "tactic 5"
  ],
  "channels": [
    { "name": "channel", "tactic": "specific action, one sentence", "timeline": "week 1 / month 1 / ongoing" },
    { "name": "channel", "tactic": "specific action, one sentence", "timeline": "..." },
    { "name": "channel", "tactic": "specific action, one sentence", "timeline": "..." }
  ],
  "communities": ["named community (e.g. r/smallbusiness on Reddit)", "named community 2", "named community 3"],
  "whyNow": "why 2025 is a good moment to build this — a macro trend, regulation, or technology shift"
}

${PROSE}`, { model: 'claude-sonnet-4-6', maxTokens: 1800 });
  const gtm = parseJSON(gtmText);

  // Stage 3 — Infrastructure
  const infraText = await call(`Technical setup for a lean solo-built SaaS product.

Idea: "${agentDesc}"
Product: ${design.name} — ${design.tagline}
Core features: ${(design.coreFeatures || []).join(' | ')}

Return ONLY valid JSON (no fences):
{
  "stack": ["Next.js 14 (App Router)", "Supabase", "Stripe", "..."],
  "buildTime": "realistic solo v1 estimate (e.g. '5-7 days to MVP')",
  "schema": "key tables in plain English: users (id, email, plan) | table2 (fields)",
  "aiWiring": "which Claude model, what system prompt angle, what the AI actually does step by step",
  "deploySteps": [
    "step 1",
    "step 2",
    "step 3",
    "step 4"
  ],
  "monthlyCost": {
    "dev": "$0",
    "at100users": "$X/mo with breakdown",
    "at1000users": "$Y/mo with breakdown"
  },
  "buildOrder": "Day 1: auth + schema. Day 2: core AI feature. Day 3: payments. Day 4: polish. Day 5: launch.",
  "cursorPrompt": "The exact prompt to paste into Cursor or Claude Code to start building. Include: what to build, tech stack, the first screen to implement, and the core AI behavior. Write 140-180 words — enough to get started without being overwhelming."
}

${PROSE}`, { maxTokens: 1800 });
  const infra = parseJSON(infraText);

  return { design, gtm, infra };
}

// --- Route handler ---------------------------------------------------------------

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  if (!SECRET || auth.replace('Bearer ', '').trim() !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await getAllCatalogData();
  return Response.json(data);
}

export async function POST(request) {
  // Auth
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!SECRET || token !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let slugFilter = null;
  try {
    const body = await request.json().catch(() => ({}));
    slugFilter = Array.isArray(body?.slugs) ? body.slugs : null;
  } catch {}

  const ideas = IDEA_EXAMPLES.filter(i => !slugFilter || slugFilter.includes(i.slug));
  if (!ideas.length) return Response.json({ error: 'No matching ideas found' }, { status: 400 });

  const generated = [];
  const failed = [];

  for (const idea of ideas) {
    const slug = idea.slug;
    console.log(`[seed-catalog] → ${idea.title}`);
    try {
      const research = await generateResearch(idea);
      // Brief pause between research and blueprint
      await sleep(1500);
      const blueprint = await generateBlueprint(idea, research);
      await upsertCatalogIdea(slug, { research, blueprint });
      generated.push(slug);
      console.log(`[seed-catalog] ✓ ${idea.title}`);
    } catch (err) {
      console.error(`[seed-catalog] ✗ ${idea.title}:`, err.message);
      failed.push({ slug, error: err.message });
    }
    // Pause between ideas
    await sleep(2000);
  }

  return Response.json({ generated, failed });
}
