/**
 * POST /api/admin/seed-catalog
 *
 * Protected admin endpoint. Runs research + blueprint pipeline for every
 * curated idea and stores clean, citation-free results in Supabase.
 *
 * Authorization: Bearer <SEED_SECRET>
 * Optional body: { "slugs": ["certwatch"] }   — omit to regenerate all 6
 *
 * GET /api/admin/seed-catalog   — returns current stored data for review
 */

import { getAllCatalogData, upsertCatalogIdea } from '../../../../lib/catalog-store';
import { IDEA_EXAMPLES } from '../../../../lib/idea-examples';

const KEY = process.env.ANTHROPIC_API_KEY;
const SECRET = process.env.SEED_SECRET;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Strip every form of citation markup the web-search tool emits. */
function stripCitations(value) {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/<cite\b[^>]*>.*?<\/cite>/gis, '')   // <cite ...>text</cite>
    .replace(/<cite\b[^>]*\/>/gi, '')               // <cite ... />
    .replace(/<\/?cite\b[^>]*>/gi, '')              // orphan tags
    .replace(/<\/?source\b[^>]*>/gi, '')
    .replace(/<\/?sup\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')                       // any remaining HTML
    .replace(/\bindex="[^"]*">?/gi, '')
    .replace(/\[[\d,\-\s]+\]/g, '')                 // [1], [2,3], etc.
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Recursively strip citations from every string in an object/array. */
function deepStrip(val) {
  if (typeof val === 'string') return stripCitations(val);
  if (Array.isArray(val)) return val.map(deepStrip);
  if (val && typeof val === 'object') {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, deepStrip(v)]));
  }
  return val;
}

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
  if (res.status === 429 && attempt < 3) { await sleep(12000 * (attempt + 1)); return call(prompt, { model, maxTokens, webSearch }, attempt + 1); }
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
    if (ch === closing) { depth--; if (depth === 0) return JSON.parse(clean.slice(start, i + 1).replace(/['']/g, "'").replace(/[""]/g, '"').replace(/,\s*([}\]])/g, '$1')); }
  }
  return JSON.parse(clean.slice(start));
}

// ── Research pipeline ─────────────────────────────────────────────────────────

async function generateResearch(idea) {
  const agentDesc = `${idea.action} ${idea.workflow} for ${idea.industry}`;

  const prompt = `You are writing a deep-research brief for a startup founder considering this idea.

IDEA: "${idea.title}" — ${idea.description}
WHAT IT DOES: ${agentDesc}

Search the web thoroughly. Find:
- Real, named competing products with their actual pricing
- Concrete evidence the pain exists (Reddit threads, forum posts, OSHA/regulatory data, industry stats)
- The specific gap none of the existing tools fill
- Real risk factors that could kill this startup

CRITICAL OUTPUT RULES:
1. Return ONLY valid JSON. No markdown fences.
2. NEVER include citation tags, HTML tags, <cite>, <source>, bracketed numbers like [1] or [2,3], or any markup in your output. Write plain sentences only.
3. Every string must be clean plain English — imagine printing it on a page and showing it to a customer.

JSON schema:
{
  "marketSize": "one sentence with a real number or growth stat — e.g. '$2.1B market growing 16% per year'",
  "teaserLine": "THE SINGLE MOST COMPELLING MARKET FACT you found — a specific dollar figure, penalty, stat, or user pain that makes a founder say 'this market is real'. Max 18 words. This is the first thing a non-paying visitor sees — make it land like a punch. BAD EXAMPLE: 'Stop teams from losing certifications.' GOOD EXAMPLE: 'OSHA fined US employers $185M last year — expired worker certs are the #1 trigger.'",
  "landscape": "3 punchy sentences on the market today. Name the real players, their real price points, and exactly where they stop short. No fluff.",
  "players": [
    {
      "name": "exact product/company name",
      "pricing": "real pricing — e.g. '$29/mo' or '$25k/yr enterprise'",
      "coverage": "one sentence: what they actually do well",
      "weakness": "one sentence: the specific gap they leave — the opening for this idea"
    }
  ],
  "gap": "the exact, specific pain no existing tool solves — one sharp sentence referencing real tools by name",
  "signals": [
    "A real quote or stat from Reddit/forums/industry data proving people suffer this pain today",
    "A regulatory or compliance event that makes this urgent (fine, law change, etc.)",
    "A market size or growth stat with a source name",
    "A pricing or adoption signal showing people already pay for partial solutions",
    "A competitor weakness signal — something a real user complained about publicly"
  ],
  "risks": [
    "Risk 1: one concrete reason this could fail — reference a specific competitor or market dynamic",
    "Risk 2: a distribution or pricing risk",
    "Risk 3: a technical or adoption risk"
  ],
  "opportunity": "2-3 honest sentences. Who exactly should build this, who are the first 50 customers, and what is the precise wedge. Reference real companies by name.",
  "verdict": "build",
  "verdictReasoning": "2 sentences. Name the 2 biggest players and explain exactly why neither owns this specific problem. Be blunt."
}

List up to 5 players, largest to smallest. Output plain text only — zero HTML or citation markup anywhere.`;

  const raw = await call(prompt, { webSearch: true, maxTokens: 3000 });
  return deepStrip(parseJSON(raw));
}

// ── Blueprint pipeline ────────────────────────────────────────────────────────

async function generateBlueprint(idea, research) {
  const agentDesc = `${idea.action} ${idea.workflow} for ${idea.industry}`;

  // Stage 1 — Product design
  const designText = await call(`You are designing a lean, hard-to-copy AI product. Be specific. No generic advice.

IDEA: "${idea.title}" — ${idea.description}
MARKET GAP: ${research.gap}
OPPORTUNITY: ${research.opportunity}
PLAYERS TO BEAT: ${(research.players || []).slice(0, 4).map(p => `${p.name} (weakness: ${p.weakness})`).join(' | ')}

CRITICAL: No citation tags, no HTML, no markup. Plain English only. Return ONLY valid JSON:
{
  "name": "product name (2-3 words)",
  "tagline": "one line: what it does and who it's for",
  "differentiator": "the ONE thing that makes this hard to copy — specific mechanism, not vague AI language",
  "coreFeatures": [
    "feature 1 — one concrete sentence describing exactly what it does",
    "feature 2",
    "feature 3",
    "feature 4"
  ],
  "userFlow": "sign-up to first real value in 2-3 plain sentences — name the actual screens",
  "wowMoment": "the exact moment a prospect sees the product and says 'I need this' — name the specific trigger and the specific output",
  "dataMoat": "what compound data or workflow memory builds up over time that a copycat can never replicate from day one"
}`, { model: 'claude-sonnet-4-6', maxTokens: 1400 });
  const design = deepStrip(parseJSON(designText));

  // Stage 2 — GTM strategy
  const gtmText = await call(`Go-to-market plan. Every answer must be specific enough to execute tomorrow.

PRODUCT: "${design.name}" — ${design.tagline}
IDEA: ${idea.description}
MARKET: ${research.landscape}
OPPORTUNITY: ${research.opportunity}
GAP: ${research.gap}

CRITICAL: No citation tags, no HTML. Plain English only. Return ONLY valid JSON:
{
  "persona": "exact first-customer profile: their job title, company size, and the specific pain they wake up thinking about",
  "revenueGoal": "month-one target with arithmetic — e.g. '$2,800 = 7 customers × $400/mo'",
  "pricing": {
    "price": "$X/mo or $X/user/mo",
    "rationale": "what comparable tools they already pay for and at what price — anchor to something real",
    "trial": "exact trial structure — length, what's included, what's gated"
  },
  "firstFiveCustomers": [
    "tactic 1: exact platform name + exact search term or post type + exact pitch angle. One sentence.",
    "tactic 2",
    "tactic 3",
    "tactic 4",
    "tactic 5"
  ],
  "channels": [
    { "name": "channel name", "tactic": "the exact action — post where, say what, link where", "timeline": "week 1 / month 1 / ongoing" },
    { "name": "channel name", "tactic": "...", "timeline": "..." },
    { "name": "channel name", "tactic": "...", "timeline": "..." }
  ],
  "communities": [
    "exact community name and platform — e.g. 'HVAC-Talk forum, Business section'",
    "exact community 2",
    "exact community 3",
    "exact community 4"
  ],
  "whyNow": "one specific macro event, regulation, or technology shift in 2024-2025 that makes this urgent right now — not generic AI hype"
}`, { model: 'claude-sonnet-4-6', maxTokens: 2000 });
  const gtm = deepStrip(parseJSON(gtmText));

  // Stage 3 — Infrastructure
  const infraText = await call(`Technical blueprint for a solo founder building this as a lean SaaS.

PRODUCT: "${design.name}" — ${design.tagline}
CORE FEATURES: ${(design.coreFeatures || []).join(' | ')}
AI BEHAVIOR: ${design.differentiator}

CRITICAL: No citation tags, no HTML. Plain English only. Return ONLY valid JSON:
{
  "stack": ["specific tool 1 with version or variant", "specific tool 2", "..."],
  "buildTime": "realistic estimate with day breakdown — e.g. '8 days: 2 days schema, 3 days core AI, 2 days payments, 1 day polish'",
  "schema": "every key table with fields — e.g. 'users (id, email, org_id, plan) | jobs (id, user_id, status, ai_output)'",
  "aiWiring": "exactly which Claude model, the system prompt direction, and the 3-5 step AI loop that makes the core feature work",
  "deploySteps": [
    "step 1: what exactly to do and why",
    "step 2",
    "step 3",
    "step 4",
    "step 5"
  ],
  "monthlyCost": {
    "dev": "$0 or near-zero breakdown",
    "at100users": "$X/mo — line by line: Supabase $X, Anthropic API $X, etc.",
    "at1000users": "$Y/mo — line by line"
  },
  "buildOrder": "Day-by-day plan. Day 1: what specifically. Day 2: what specifically. Through launch day.",
  "cursorPrompt": "The exact prompt to paste into Cursor or Claude Code to start building. Must include: product name and what it does, tech stack, the first two screens to build, and step-by-step description of the core AI feature. 150-180 words. Technical and precise — this goes straight into an AI code editor."
}`, { maxTokens: 2000 });
  const infra = deepStrip(parseJSON(infraText));

  return { design, gtm, infra };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  if (!SECRET || auth.replace('Bearer ', '').trim() !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await getAllCatalogData();
  return Response.json(data);
}

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  if (!SECRET || auth.replace('Bearer ', '').trim() !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const slugFilter = Array.isArray(body?.slugs) ? body.slugs : null;
  const ideas = IDEA_EXAMPLES.filter(i => !slugFilter || slugFilter.includes(i.slug));
  if (!ideas.length) return Response.json({ error: 'No matching ideas found' }, { status: 400 });

  const generated = [];
  const failed = [];

  for (const idea of ideas) {
    console.log(`[seed-catalog] → ${idea.title}`);
    try {
      const research = await generateResearch(idea);
      await sleep(2000);
      const blueprint = await generateBlueprint(idea, research);
      await upsertCatalogIdea(idea.slug, { research, blueprint });
      generated.push(idea.slug);
      console.log(`[seed-catalog] ✓ ${idea.title}`);
    } catch (err) {
      console.error(`[seed-catalog] ✗ ${idea.title}:`, err.message);
      failed.push({ slug: idea.slug, error: err.message });
    }
    await sleep(3000);
  }

  return Response.json({ generated, failed });
}
