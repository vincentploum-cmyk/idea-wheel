/**
 * scripts/seed-catalog.mjs
 *
 * Generates pre-computed deep research + blueprint data for each curated idea
 * in lib/idea-examples.js and writes the output to lib/catalog-data.js.
 *
 * Run once (needs ANTHROPIC_API_KEY):
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/seed-catalog.mjs
 *
 * The output is a static JS file imported by the ideas page — zero runtime
 * AI calls, instant load, curated and version-controlled content.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

const IDEAS = [
  {
    slug: 'certwatch',
    title: 'CertWatch',
    tag: 'B2B · Field service',
    description: 'Tracks employee certifications, safety cards, and IDs — auto-sends reminders before expiry so field-service teams stop drowning in spreadsheets.',
    score: 78,
    action: 'Automate',
    workflow: 'certification tracking',
    industry: 'field services',
  },
  {
    slug: 'shopping',
    title: 'ShopPing',
    tag: 'B2B · Auto repair',
    description: 'Auto-sends "waiting on part", "in progress", "ready for pickup" SMS updates for independent auto repair shops — cuts incoming calls by half.',
    score: 82,
    action: 'Automate',
    workflow: 'customer SMS updates',
    industry: 'auto repair',
  },
  {
    slug: 'listing_suppression_decoder',
    title: 'Listing Suppression Decoder',
    tag: 'B2B · Amazon sellers',
    description: "Scans a seller's full Amazon catalog, decodes why each listing is suppressed, and outputs the exact attribute fix — no more guessing at vague rejection codes.",
    score: 75,
    action: 'Decode',
    workflow: 'listing suppression',
    industry: 'Amazon sellers',
  },
  {
    slug: 'punchai',
    title: 'PunchAI',
    tag: 'B2B · Construction',
    description: 'Turns site walkthrough notes into formatted punch lists, assigns them to the right subcontractor, and tracks sign-off — replacing the clipboard-and-spreadsheet workflow.',
    score: 80,
    action: 'Convert',
    workflow: 'punch list generation',
    industry: 'construction',
  },
  {
    slug: 'intakeflow',
    title: 'IntakeFlow',
    tag: 'B2B · Dental practices',
    description: 'Sends patients a pre-appointment link that collects insurance details, medical history, and consent forms — so the front desk spends zero time on paperwork at check-in.',
    score: 85,
    action: 'Automate',
    workflow: 'patient intake',
    industry: 'dental practices',
  },
  {
    slug: 'churnsignal',
    title: 'ChurnSignal',
    tag: 'B2B · SaaS companies',
    description: 'Monitors product usage patterns across your customer base and flags accounts showing disengagement signals before they reach the cancellation screen.',
    score: 88,
    action: 'Predict',
    workflow: 'churn detection',
    industry: 'SaaS companies',
  },
];

const PROSE_RULES = `WRITING RULES — apply to every field:
- 8th-grade reading level. Short sentences. Everyday words.
- No buzzwords: synergy, leverage, robust, holistic, ecosystem, B2B SaaS, TAM, GTM, incumbent, whitespace, wedge. Say these in plain words.
- Each list item is one concrete fact or action, max 20 words.
- Write directly to a non-technical founder.`;

async function call(prompt, { model = 'claude-haiku-4-5-20251001', maxTokens = 2000, webSearch = false } = {}) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (webSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }];
  }

  let attempt = 0;
  while (attempt < 3) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      const wait = 10000 * (attempt + 1);
      console.log(`  Rate limited, waiting ${wait / 1000}s…`);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
      continue;
    }
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return text;
  }
  throw new Error('Too many retries');
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
  return JSON.parse(clean.slice(start).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'));
}

async function generateResearch(idea) {
  const agentDesc = `an agent that ${idea.action} ${idea.workflow} for ${idea.industry}`;
  const prompt = `You are a senior market analyst writing a deep-research report for a startup founder.

The idea: ${agentDesc}
Description: ${idea.description}

Search the web for:
1. Real competing products, SaaS tools, or apps that do this (names, pricing, funding)
2. Market size estimates or proxy signals (forum threads, job postings, industry stats)
3. User complaints or pain points mentioned in Reddit, ProductHunt, or forums
4. What existing tools miss or do poorly
5. Why this specific moment is good to enter this market

Return ONLY valid JSON:
{
  "marketSize": "a short, specific sentence about the size of this opportunity",
  "teaserLine": "one punchy sentence (max 20 words) previewing the market opportunity — will be shown to non-paying users as a teaser",
  "landscape": "2-3 sentences about the current state of this market. Be specific — name companies.",
  "players": [
    { "name": "...", "pricing": "...", "weakness": "...", "coverage": "one sentence on what they do well and where they fall short" }
  ],
  "gap": "the specific unaddressed problem these tools leave open",
  "signals": [
    "signal 1 — a specific fact (user complaint, search volume, job posting, etc.)",
    "signal 2",
    "signal 3",
    "signal 4",
    "signal 5"
  ],
  "risks": [
    "risk 1 — a specific reason this could fail",
    "risk 2",
    "risk 3"
  ],
  "opportunity": "2-3 sentences on the real opening. Specific and honest.",
  "verdict": "build | warning | avoid",
  "verdictReasoning": "2 honest sentences explaining the verdict"
}

Include up to 5 players, sorted largest to smallest. Name real companies.

${PROSE_RULES}`;

  const text = await call(prompt, { webSearch: true, maxTokens: 2500 });
  return parseJSON(text);
}

async function generateBlueprint(idea, research) {
  const agentDesc = `an agent that ${idea.action} ${idea.workflow} for ${idea.industry}`;

  const designPrompt = `Design a lean, differentiated AI product for this idea.

Idea: "${agentDesc}"
Description: ${idea.description}
Market gap: ${research.gap}
Key risks: ${research.risks.join(' | ')}
Players to beat: ${research.players.map(p => `${p.name} (weakness: ${p.weakness})`).join(', ')}

Return ONLY valid JSON:
{
  "name": "product name (2-3 words max)",
  "tagline": "what it does and for whom in one line",
  "differentiator": "the ONE thing that makes this harder to copy than a generic AI wrapper",
  "coreFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "userFlow": "how a user goes from sign-up to value in 2-3 sentences",
  "wowMoment": "the single moment that makes a prospect say 'I need this'",
  "dataMoat": "what data or workflow memory this product accumulates that compounds over time"
}

${PROSE_RULES}`;

  const gtmPrompt = `Go-to-market strategy for a lean SaaS product.

Idea: "${agentDesc}"
Description: ${idea.description}
Market: ${research.landscape}
Opportunity: ${research.opportunity}

Return ONLY valid JSON:
{
  "persona": "the exact type of first customer — one plain sentence with their job title and situation",
  "revenueGoal": "first-month target with simple math (e.g. $2,400 = 8 × $300/mo)",
  "pricing": { "price": "$X/mo", "rationale": "why this number fits what customers pay for similar tools", "trial": "free tier or trial structure" },
  "firstFiveCustomers": [
    "tactic 1 — name the exact place and the exact angle. One sentence.",
    "tactic 2",
    "tactic 3",
    "tactic 4",
    "tactic 5"
  ],
  "channels": [
    { "name": "channel name", "tactic": "specific action, one sentence", "timeline": "week 1 / month 1 / ongoing" }
  ],
  "communities": ["named community 1 (e.g. r/fieldservice)", "named community 2", "named community 3"],
  "whyNow": "why this specific moment is a good time to build this — a macro trend, regulation, or technology shift"
}

${PROSE_RULES}`;

  const infraPrompt = `Technical setup for a lean SaaS product. Write for a solo builder.

Idea: "${agentDesc}"
Description: ${idea.description}

Return ONLY valid JSON:
{
  "stack": ["Next.js", "Supabase", "..."],
  "buildTime": "realistic solo v1 estimate in days",
  "schema": "key tables in plain English: users (id, email, plan) | table2 (fields)",
  "aiWiring": "which model, what it does, system prompt direction",
  "deploySteps": ["step 1", "step 2", "step 3", "step 4"],
  "monthlyCost": { "dev": "$0", "at100users": "$X/mo", "at1000users": "$Y/mo" },
  "buildOrder": "Day 1: auth + schema. Day 2: core feature. Day 3: payments. Day 4: AI logic. Day 5: launch.",
  "cursorPrompt": "The exact prompt to paste into Cursor or Claude to start building. Include: what to build, tech stack, first screen, core AI behavior. 120-180 words."
}

${PROSE_RULES}`;

  const [designText, gtmText, infraText] = await Promise.all([
    call(designPrompt, { model: 'claude-sonnet-4-6', maxTokens: 1400 }),
    call(gtmPrompt, { model: 'claude-sonnet-4-6', maxTokens: 1800 }),
    call(infraPrompt, { maxTokens: 1600 }),
  ]);

  return {
    design: parseJSON(designText),
    gtm: parseJSON(gtmText),
    infra: parseJSON(infraText),
  };
}

async function processIdea(idea) {
  console.log(`\n→ ${idea.title}`);
  console.log('  Generating deep research…');
  const research = await generateResearch(idea);
  console.log(`  ✓ Research done (verdict: ${research.verdict})`);

  console.log('  Generating blueprint (design + GTM + infra in parallel)…');
  const blueprint = await generateBlueprint(idea, research);
  console.log('  ✓ Blueprint done');

  return { slug: idea.slug, research, blueprint };
}

async function main() {
  console.log('Seeding catalog data for all 6 ideas…\n');
  const results = {};

  for (const idea of IDEAS) {
    try {
      const { slug, research, blueprint } = await processIdea(idea);
      results[slug] = { research, blueprint };
    } catch (err) {
      console.error(`  ✗ Failed for ${idea.title}:`, err.message);
      results[idea.slug] = null;
    }
    // Brief pause between ideas to be respectful of rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  const outputPath = resolve(__dirname, '../lib/catalog-data.js');
  const output = `// AUTO-GENERATED by scripts/seed-catalog.mjs — do not edit manually.
// Re-run the script to regenerate: ANTHROPIC_API_KEY=sk-ant-... node scripts/seed-catalog.mjs

export const CATALOG_DATA = ${JSON.stringify(results, null, 2)};
`;

  writeFileSync(outputPath, output, 'utf8');
  console.log(`\n✓ Written to lib/catalog-data.js`);
  console.log('\nIdeas with data:');
  for (const [slug, data] of Object.entries(results)) {
    console.log(`  ${data ? '✓' : '✗'} ${slug}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
