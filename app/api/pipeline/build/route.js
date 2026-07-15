import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { CREDIT_COSTS } from '../../../../lib/credits';

// Max 5 blueprint requests per user per minute (durable, cross-instance —
// see lib/rate-limit.js).
const BUILD_RATE_LIMIT = { limit: 5, windowSeconds: 60 };
import { addCredits, deductCredits } from '../../../../lib/credits';
import { ensureSessionId, getBlueprintCharge, getValidationEligibility, recordBlueprint, recordOutcome, saveBlueprintCharge } from '../../../../lib/moat-store';
import { SCORE_POLICY } from '../../../../lib/score-policy';
import { computeCostModel, parseMoney } from '../../../../lib/cost-model';
import { getCandidateEligibility } from '../../../../lib/idea-candidates';
import { withPlainEnglish } from '../../../../lib/clarity';
import { attachBlueprint, saveBlueprintProgress } from '../../../../lib/saved-ideas';
import { checkRateLimit } from '../../../../lib/rate-limit';

const OPENAI_KEY = process.env.OPENAI_API_KEY;

const MODELS = {
  scout: 'gpt-4o-mini',
  designer: 'gpt-4o',
  gtm: 'gpt-4o',
  builder: 'gpt-4o',
};

const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o':      { input: 2.50, output: 10.00 },
};

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcCost(model, inp, out) {
  const p = PRICING[model] || PRICING['gpt-4o'];
  return (inp * p.input + out * p.output) / 1_000_000;
}

function mergeUsage(...usages) {
  return usages.reduce(
    (acc, usage) => ({
      input_tokens: acc.input_tokens + (usage?.input_tokens || 0),
      output_tokens: acc.output_tokens + (usage?.output_tokens || 0),
    }),
    { input_tokens: 0, output_tokens: 0 }
  );
}

async function call(prompt, { model, maxTokens = 1000, webSearch = false, searchUses = 8, attempt = 0 }) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');

  let res;
  if (webSearch) {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, tools: [{ type: 'web_search_preview' }], input: prompt }),
    });
  } else {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
  }

  if (res.status === 429 && attempt < 2) {
    const retryAfterHeader = Number(res.headers.get('retry-after') || 0);
    const retryMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 8000 * (attempt + 1);
    await sleep(retryMs);
    return call(prompt, { model, maxTokens, webSearch, searchUses, attempt: attempt + 1 });
  }

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();

  let text;
  if (webSearch) {
    text = (data.output || [])
      .filter(o => o.type === 'message')
      .flatMap(o => o.content || [])
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('');
  } else {
    text = data.choices?.[0]?.message?.content || '';
  }

  const usage = {
    input_tokens: data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0,
  };
  return { text, usage, model, costUsd: calcCost(model, usage.input_tokens, usage.output_tokens) };
}

function stripJsonFences(text) {
  return String(text || '').replace(/```json\n?|```\n?/gi, '').trim();
}

function extractBalancedJson(text) {
  const clean = stripJsonFences(text);
  const start = clean.search(/[\[{]/);

  if (start === -1) {
    throw new Error('No JSON in response');
  }

  const opening = clean[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < clean.length; i += 1) {
    const ch = clean[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === opening) depth += 1;
    if (ch === closing) {
      depth -= 1;
      if (depth === 0) {
        return clean.slice(start, i + 1);
      }
    }
  }

  return clean.slice(start);
}

function normalizeJsonCandidate(text) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,\s*([}\]])/g, '$1');
}

function parseJsonStrict(text) {
  return JSON.parse(normalizeJsonCandidate(extractBalancedJson(text)));
}

async function parseJSON(text, label) {
  try {
    return {
      value: parseJsonStrict(text),
      usage: { input_tokens: 0, output_tokens: 0 },
      costUsd: 0,
    };
  } catch (error) {
    let totalUsage = { input_tokens: 0, output_tokens: 0 };
    let totalCostUsd = 0;
    let lastError = error;

    const repairPrompts = [
      {
        prompt: `You repair malformed JSON emitted by another model. Return one valid JSON object only. Do not explain anything. Preserve the original meaning and keys as closely as possible.\n\nLabel: ${label}\nParse error: ${error.message}\n\nMalformed output:\n${stripJsonFences(text).slice(0, 18000)}`,
        maxTokens: 3200,
      },
      {
        prompt: `You are a fail-safe JSON normalizer. Convert the malformed output below into ONE compact valid JSON object. Keep the same top-level structure and intent, but shorten long strings and lists if needed so the JSON is guaranteed valid. Return JSON only.\n\nLabel: ${label}\nPrevious parse error: ${error.message}\n\nMalformed output:\n${stripJsonFences(text).slice(0, 18000)}`,
        maxTokens: 2600,
      },
    ];

    for (const repair of repairPrompts) {
      try {
        const repairCall = await call(repair.prompt, { model: MODELS.scout, maxTokens: repair.maxTokens });
        totalUsage = mergeUsage(totalUsage, repairCall.usage);
        totalCostUsd += repairCall.costUsd || 0;

        return {
          value: parseJsonStrict(repairCall.text),
          usage: totalUsage,
          costUsd: totalCostUsd,
        };
      } catch (repairError) {
        lastError = repairError;
      }
    }

    throw lastError;
  }
}

function extractHTML(text) {
  const i = text.indexOf('<!DOCTYPE');
  return i >= 0 ? text.slice(i) : text;
}

function shortText(value, max = 220) {
  if (!value) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function shortList(values, maxItems = 5, maxLen = 120) {
  return (Array.isArray(values) ? values : [])
    .slice(0, maxItems)
    .map((value) => shortText(value, maxLen))
    .filter(Boolean);
}

function compactRetrieval(retrieval) {
  return {
    summary: retrieval?.summary,
    entities: shortList(retrieval?.entities, 6, 40),
    proofPoints: shortList(retrieval?.proofPoints, 5, 80),
    mustHaves: shortList(retrieval?.mustHaves, 5, 80),
    antiPatterns: shortList(retrieval?.antiPatterns, 4, 80),
    prototypeMoments: shortList(retrieval?.prototypeMoments, 4, 80),
    communityHints: shortList(retrieval?.communityHints, 4, 80),
    defensibility: shortText(retrieval?.defensibility, 180),
    learning: {
      exactMatchCounts: retrieval?.learning?.exactMatchCounts,
      verdictPatterns: retrieval?.learning?.verdictPatterns || [],
      topSignals: retrieval?.learning?.topSignals || [],
      proof: retrieval?.learning?.proof || {},
    },
  };
}

function compactComp(comp) {
  return {
    gap: shortText(comp?.gap, 180),
    verdict: shortText(comp?.verdict, 160),
    moat: shortText(comp?.moat, 200),
    players: (Array.isArray(comp?.players) ? comp.players : []).slice(0, 4).map((player) => ({
      name: shortText(player?.name, 60),
      targetCustomer: shortText(player?.targetCustomer, 90),
      pricing: shortText(player?.pricing, 60),
      weakness: shortText(player?.weakness, 120),
    })),
    skeptic: {
      fatalRisks: shortList(comp?.skeptic?.fatalRisks, 4, 120),
      copyability: comp?.skeptic?.copyability,
      wedgeAdvice: shortText(comp?.skeptic?.wedgeAdvice, 160),
      recommendation: comp?.skeptic?.recommendation,
      reasoning: shortText(comp?.skeptic?.reasoning, 180),
    },
    judge: {
      decision: comp?.judge?.decision,
      confidence: comp?.judge?.confidence,
      wedge: shortText(comp?.judge?.wedge, 160),
      defensibility: shortText(comp?.judge?.defensibility, 200),
      mustProveNext: shortList(comp?.judge?.mustProveNext, 3, 120),
      reasoning: shortText(comp?.judge?.reasoning, 180),
    },
    eval: comp?.eval,
  };
}

function compactDesign(design) {
  return {
    name: shortText(design?.name, 60),
    tagline: shortText(design?.tagline, 120),
    problemEvidence: shortList(design?.problemEvidence, 4, 140),
    differentiator: shortText(design?.differentiator, 180),
    coreFeatures: shortList(design?.coreFeatures, 5, 100),
    productLogic: shortText(design?.productLogic, 400),
    userFlow: shortText(design?.userFlow, 200),
    buildSpec: shortText(design?.buildSpec, 500),
    dataMoat: shortText(design?.dataMoat, 180),
    defensibilityPlan: shortText(design?.defensibilityPlan, 180),
  };
}

function compactGtm(gtm) {
  return {
    revenueGoal: shortText(gtm?.revenueGoal, 80),
    icp: gtm?.icp && typeof gtm.icp === 'object' ? {
      buyer: shortText(gtm.icp.buyer, 90),
      user: shortText(gtm.icp.user, 90),
      segment: shortText(gtm.icp.segment, 140),
      trigger: shortText(gtm.icp.trigger, 120),
      budgetAuthority: shortText(gtm.icp.budgetAuthority, 120),
      disqualifier: shortText(gtm.icp.disqualifier, 120),
    } : null,
    persona: shortText(gtm?.persona, 120),
    whereToFind: shortText(gtm?.whereToFind, 220),
    firstFiveCustomers: shortList(gtm?.firstFiveCustomers, 5, 140),
    channels: (Array.isArray(gtm?.channels) ? gtm.channels : []).slice(0, 4),
    pricing: gtm?.pricing,
    plan: (Array.isArray(gtm?.plan) ? gtm.plan : []).slice(0, 4),
    stack: shortList(gtm?.stack, 8, 40),
    buildTime: shortText(gtm?.buildTime, 80),
    whyNow: shortText(gtm?.whyNow, 180),
  };
}

function compactInfra(infra) {
  return {
    services: (Array.isArray(infra?.services) ? infra.services : []).slice(0, 5),
    envVars: shortList(infra?.envVars, 10, 80),
    schema: shortText(infra?.schema, 260),
    entities: shortList(infra?.entities, 8, 40),
    aiWiring: shortText(infra?.aiWiring, 220),
    memoryLoop: shortText(infra?.memoryLoop, 220),
    deploySteps: shortList(infra?.deploySteps, 6, 100),
    monthlyCost: infra?.monthlyCost,
    costModel: infra?.costModel,
    buildOrder: shortText(infra?.buildOrder, 220),
  };
}

// Compute the cost model IN CODE from the model's structured line items, so the
// printed total can't be a fabricated number. Each line's monthly cost is
// recomputed as quantity × unitCost (we ignore any model-supplied line total),
// then summed. Returns null if there are no usable line items.
// computeCostModel lives in lib/cost-model.js (owns provider pricing formulas,
// e.g. Stripe's %-fee, and enforces hosting/DB floors) so it can be unit-tested.

function compactSpec(spec) {
  return {
    primaryUser: spec?.primaryUser,
    records: (Array.isArray(spec?.records) ? spec.records : []).slice(0, 4),
    primaryScreen: shortText(spec?.primaryScreen, 180),
    wowMoment: spec?.wowMoment,
    secondaryInteraction: shortText(spec?.secondaryInteraction, 140),
    accentColor: spec?.accentColor,
    productType: spec?.productType,
    infraEcho: shortText(spec?.infraEcho, 160),
  };
}

// Shared readability contract for every founder-facing prose field. The screens
// render these strings as-is, so length and plainness must be enforced at the
// source — long, jargon-y output becomes an unreadable wall of text.
const PROSE_RULES = `WRITING RULES — apply to EVERY prose field a founder reads (not the cursorPrompt or code):
- 8th-grade reading level. Short, everyday words. Short sentences.
- Be brief. No single field longer than 2 short sentences unless the schema asks for a list.
- Each list item is ONE concrete action or fact in plain words, max ~20 words. Never write multi-sentence paragraphs inside a bullet.
- Ban buzzwords: synergy, leverage, robust, holistic, ecosystem, paradigm, seamless, best-in-class, "B2B SaaS". Say the plain-word version instead.
- Spell out company names/acronyms in plain terms the first time (e.g. "AppFolio (property-management software)").
- Output clean prose only — never include citation markup like <cite …> or bracketed reference numbers.
- This is a PROPOSAL for something not yet built — never state unproven capability as fact. Ban "proprietary", "guarantee(s)", "guaranteeing", "high precision", "exceptionally difficult to imitate", "cutting-edge", "revolutionize". Use hedged language instead: "proposed", "aims to", "designed to", "could", "human-reviewed". A moat is "a potential switching cost", not a fact.`;

function designerPrompt(agentDesc, comp, retrieval) {
  return `Design a lean, differentiated AI product that is harder to copy than a generic wrapper.

Idea: "${agentDesc}"
Validation package:
${JSON.stringify({
  ...compactComp(comp),
  retrieval: compactRetrieval(retrieval),
}, null, 2)}

Return ONLY JSON:
{
  "name": "product name, 2-3 words max",
  "tagline": "one-liner — what it does and for whom",
  "niche": "one sentence: the specific niche and the exact pain being solved",
  "problemEvidence": ["2-4 QUANTIFIED evidence points that prove the pain is real and worth paying to fix: how often it happens, hours or dollars it costs, how many businesses/people face it. Use a real number or a clearly-labelled estimate in each — never a vague claim like 'it's a big problem'."],
  "differentiator": "specific wedge, not generic AI language",
  "coreFeatures": ["feature 1","feature 2","feature 3"],
  "productLogic": "How the product actually DECIDES, step by step — deterministic rules FIRST (the safe, must-always-hold logic), THEN where AI classifies or drafts, THEN the human check for the risky/low-confidence cases. This is the logic, not a feature list. 3-5 short steps.",
  "userFlow": "trigger to value in 2-3 sentences",
  "buildSpec": "detailed UI spec with the one magical interaction",
  "landingAngle": "the headline + subheadline for the product's landing page — hook the visitor in 2 lines",
  "dataMoat": "what proprietary workflow memory or feedback loop compounds over time",
  "defensibilityPlan": "how this becomes harder to copy after 90 days"
}
A non-technical founder should understand every field instantly. Do not fabricate precise statistics — if you estimate, say "(estimate)".

${PROSE_RULES}`;
}

function designCritiquePrompt(agentDesc, comp, design) {
  return `You are the design critic for IdeaWheel.

Idea: ${agentDesc}
Validation: ${JSON.stringify(compactComp(comp))}
Design draft: ${JSON.stringify(compactDesign(design))}

Return ONLY JSON:
{
  "scores": {
    "wedgeSharpness": 0,
    "copyResistance": 0,
    "workflowFit": 0,
    "specificity": 0,
    "overall": 0
  },
  "needsRevision": true,
  "issues": ["up to 4 problems"],
  "rewriteBrief": "one paragraph on how to sharpen the product spec"
}
Scores must be integers from 0-100.`;
}

function designerRewritePrompt(agentDesc, comp, design, critique) {
  return `Rewrite the product design to fix the critique.

Idea: ${agentDesc}
Validation: ${JSON.stringify({ gap: comp.gap, moat: comp.moat, judge: comp.judge })}
Current design: ${JSON.stringify(design, null, 2)}
Critique: ${JSON.stringify(critique, null, 2)}

Return ONLY the corrected JSON with the schema's keys at the TOP LEVEL. Do NOT nest it under any wrapper key (no "Current design", no "result").`;
}

function gtmPrompt(agentDesc, comp, design, retrieval) {
  return `Go-to-market strategy. No generic advice. Make it feel unfair and workflow-native.

Idea: ${agentDesc}
Validation package:
${JSON.stringify({
  ...compactComp(comp),
  retrieval: compactRetrieval(retrieval),
  design: compactDesign(design),
}, null, 2)}

Return ONLY JSON:
{
  "revenueGoal": "first-month target with math e.g. $2,400 = 8 × $300/mo",
  "icp": {
    "buyer": "who approves the purchase — the exact role",
    "user": "who uses it day to day — the exact role (often NOT the buyer)",
    "segment": "the ONE narrow segment to start with, with a size band (e.g. 'US dental practices with 2-5 chairs, ~30k of them')",
    "trigger": "the event that makes them start looking for this right now",
    "budgetAuthority": "who holds the budget and roughly how much they can spend without sign-off",
    "disqualifier": "who this is explicitly NOT for — the segment to ignore so the ICP stays narrow"
  },
  "persona": "the ideal first customer's role, in ONE plain sentence",
  "whereToFind": "3-4 named communities (subreddits, Slack groups, LinkedIn groups), as a short comma-separated list — no long explanation",
  "firstFiveCustomers": ["5 tactics. Each is ONE sentence naming the exact place + the angle. Max ~22 words each."],
  "channels": [{"name":"...","tactic":"specific action, one short sentence","timeline":"..."}],
  "pricing": {"price":"$X/mo","rationale":"why this number, max 2 short sentences","trial":"free tier structure, one phrase"},
  "plan": [
    {"week":1,"theme":"...","actions":["...","...","..."]},
    {"week":2,"theme":"...","actions":["...","...","..."]},
    {"week":3,"theme":"...","actions":["...","...","..."]},
    {"week":4,"theme":"...","actions":["...","...","..."]}
  ],
  "stack": ["Next.js","Supabase","..."],
  "buildTime": "realistic solo v1 estimate",
  "whyNow": "why this wedge is timely right now — macro trend, regulation, or technology shift making this possible/urgent",
  "cursorPrompt": "The exact first prompt to paste into Cursor, Claude, or Codex to start building this product. Should include: what to build, tech stack, first screen/feature to implement, and the core AI behavior. 150-200 words."
}
${PROSE_RULES}
REALISM RULES (a pre-launch product with no customers yet):
- Pick ONE ICP segment and stay consistent — do not drift between "small", "mid-sized", and a specific employee band in the same plan.
- Week 1 must be discovery: interview real buyers and map their current workflow. Do NOT run paid ads in week 1.
- Do NOT reference case studies, testimonials, or pilot results before a pilot exists (there is none in week 1). Early weeks secure design partners and measure results; ads come only after the positioning is shown to convert.
(The cursorPrompt is the ONE exception — it may stay technical since it's pasted into a builder/AI tool.)`;
}

function gtmCritiquePrompt(design, gtm, comp) {
  return `You are the GTM critic for IdeaWheel.

Design: ${JSON.stringify(compactDesign(design))}
GTM draft: ${JSON.stringify(compactGtm(gtm))}
Validation: ${JSON.stringify(compactComp(comp))}

Return ONLY JSON:
{
  "scores": {
    "pricingRealism": 0,
    "channelSpecificity": 0,
    "customerAcquisitionCredibility": 0,
    "overall": 0
  },
  "needsRevision": true,
  "issues": ["up to 4 problems"],
  "rewriteBrief": "one paragraph describing how to sharpen pricing, channels, and first five customers"
}
Scores must be integers from 0-100.`;
}

function gtmRewritePrompt(agentDesc, design, gtm, comp, critique) {
  return `Rewrite the GTM plan to fix the critique.

Idea: ${agentDesc}
Design: ${JSON.stringify(compactDesign(design), null, 2)}
Current GTM: ${JSON.stringify(compactGtm(gtm), null, 2)}
Validation: ${JSON.stringify(compactComp(comp), null, 2)}
Critique: ${JSON.stringify(critique, null, 2)}

Return ONLY the corrected JSON with the schema's keys at the TOP LEVEL. Do NOT nest it under any wrapper key (no "Current GTM", no "result").`;
}

function infraPrompt(design, gtm, comp, retrieval) {
  return `You are a senior engineer writing the GETTING-STARTED RUNBOOK for a solo, possibly non-technical builder. They PAID for this — it must be concrete enough to actually follow and get the product live, not a summary. No hand-waving: name the exact service, the exact console section to click, and the real gotchas that block people. Use Render for hosting — never Vercel — and keep it consistent everywhere.

Validation package:
${JSON.stringify({ ...compactComp(comp), retrieval: compactRetrieval(retrieval) }, null, 2)}
Design: ${JSON.stringify(compactDesign(design), null, 2)}
GTM: ${JSON.stringify(compactGtm(gtm), null, 2)}

For EVERY service, write 5-9 concrete, correctly-SEQUENCED setupSteps a first-timer can follow — start with creating the account, then the specific configuration, and call out the gotchas that actually block people.

HARD REQUIREMENTS — when the relevant service is in your stack you MUST include these exact steps; skipping them is a failure:
- SMS (Twilio or any SMS provider): you MUST include registering an A2P 10DLC Brand, THEN a Campaign under it, and note both must be APPROVED before any SMS can be sent to US numbers — place these BEFORE the buy-a-number / messaging-service / webhook steps. A phone number alone cannot send US SMS.
- Payments (Stripe): you MUST include adding a webhook endpoint AND copying its signing secret into an env var (STRIPE_WEBHOOK_SECRET) so paid events can be verified.
- Email: you MUST include verifying the sending domain by adding the SPF/DKIM DNS records, or mail lands in spam.
- Auth: you MUST include setting the exact redirect / callback URLs. When an auth PROVIDER (Auth0/Clerk/Supabase Auth) handles login, the app MUST NOT store passwords — the users table stores the provider's user id (e.g. auth0_user_id), never a password column.
- Hosting: use Render as the host and NOTHING else — do NOT list Vercel. The hosting service card AND deploySteps must both be Render, consistently.
- FOUNDATION (always required): you MUST include a real relational DATABASE (name one, e.g. Supabase Postgres) AND, if the product stores user files/documents, an encrypted OBJECT STORAGE service (e.g. Cloudflare R2 or S3) with signed upload/download URLs. If the product reads/inspects documents, also include a document parser/OCR step and note malware scanning. Never leave the product with no database or storage.
- OPERATIONS (always required): include error monitoring (e.g. Sentry) and an audit-log entity. Note backups for the database.
Every service that needs a secret MUST have a matching entry in envVars. Name the exact console path (e.g. "Console → Messaging → Regulatory Compliance"), and put the official setup doc URL in "docsUrl" so they can follow the exact clicks (which change over time).

Return ONLY JSON:
{
  "services": [{"name":"...","purpose":"one line: what it does for THIS product","url":"https://...","docsUrl":"https://official-setup-doc...","freeTier":"...","setupTime":"X min","setupSteps":["1. Create an account at ... and verify ...","2. In <exact console path>, ...","..."]}],
  "envVars": ["VAR_NAME=your_value  # what it is + where to copy it from"],
  "schema": "The REAL data model as entities with key fields and relationships, plain English. List EVERY entity a working multi-tenant version needs — not just users. Show ownership/tenancy and links, e.g. 'organizations (id, name, plan) → members (user_id, org_id, role) → <domain entities> → audit_events (...)'. Aim for 6-12 entities. NEVER put a password column on users when an auth provider is used — store the provider id (auth0_user_id) instead. Include roles/permissions, and an audit_log entity.",
  "entities": ["one line per core entity with its key fields, 6-12 entities — include tenancy (organizations/members), roles/permissions, the core domain objects, and an audit/log entity. Users reference the auth provider id, never a password"],
  "aiWiring": "Which model (recommend a CURRENT model like GPT-4o mini or Claude Haiku — never legacy GPT-3.5-turbo), how PDFs/files become text (OCR/parser), what 'complete' means, the confidence threshold, and when a human reviews. Name the sensitive fields (tax IDs, bank data) that always need review.",
  "memoryLoop": "how the product accumulates feedback or workflow history over time",
  "deploySteps": ["1. Push your code to a GitHub repo.","2. On Render: New → Web Service → connect that repo.","3. Set the Build Command and Start Command.","4. Add every env var under Environment.","5. Click Create Web Service — Render builds and gives you a live URL.","6. Add your custom domain under Settings → Custom Domains and set the DNS records it shows you."],
  "usageAssumptions": {"customers": 100, "activeUsersPerCustomer": 4, "aiCallsPerUserPerMonth": 40, "smsPerCustomerPerMonth": 0, "storageGb": 20},
  "costItems": [{"service":"OpenAI","quantity":16000,"unit":"requests","unitCost":0.002}],
  "buildOrder": "Day 1: ... Day 2: ... (specific to this product)"
}
For usageAssumptions: pick realistic numbers for THIS product and set unused fields to 0. For costItems: ONE line per paid service at the "customers" scale above, with quantity, unit, and unitCost (real provider price). Do NOT include a monthly total — the total is calculated in code from quantity × unitCost. Include the free-tier/dev services at unitCost 0.
Every step must be specific to THIS product, not generic filler. Plain English — assume they have never used these tools. Prefer real free tiers so they can start at $0.

${PROSE_RULES}`;
}

function infraCritiquePrompt(design, infra) {
  return `You are the infrastructure critic for IdeaWheel. Judge whether this setup runbook is secure, current, affordable, and complete enough for a solo builder to actually ship on.

Product: ${JSON.stringify(compactDesign(design))}
Infra draft: ${JSON.stringify(compactInfra(infra))}

Return ONLY JSON:
{
  "scores": {
    "security": 0,
    "dataModelCompleteness": 0,
    "providerAccuracy": 0,
    "costCredibility": 0,
    "deploymentCompleteness": 0,
    "operationalReadiness": 0,
    "overall": 0
  },
  "needsRevision": true,
  "issues": ["up to 5 concrete gaps — e.g. missing multi-tenant isolation, no audit log, Stripe webhook secret missing, cost math not shown, no backups/monitoring"],
  "rewriteBrief": "one paragraph telling the next pass exactly what to add or fix"
}
Score 0-100. Mark needsRevision true when security, the data model (tenancy/roles/audit), provider accuracy, or cost credibility are weak.`;
}

function infraRewritePrompt(design, gtm, comp, infra, critique, retrieval) {
  return `Rewrite the infrastructure runbook to fix the critique. Keep the EXACT same JSON schema as before.

${infraPrompt(design, gtm, comp, retrieval)}

Current infra draft: ${JSON.stringify(infra, null, 2)}
Critique to address: ${JSON.stringify(critique, null, 2)}

Return ONLY the corrected JSON with the schema's keys at the TOP LEVEL. Do NOT nest it under any wrapper key (no "Current infra", no "result").`;
}

function protoSpecPrompt(design, gtm, comp, infra, retrieval) {
  return `You are a senior product designer. Before any code is written, plan this prototype precisely.

Validation package:
${JSON.stringify({
  ...compactComp(comp),
  retrieval: compactRetrieval(retrieval),
}, null, 2)}
Design: ${JSON.stringify(compactDesign(design), null, 2)}
GTM: ${JSON.stringify(compactGtm(gtm), null, 2)}
Infrastructure: ${JSON.stringify(compactInfra(infra), null, 2)}

Return ONLY JSON:
{
  "primaryUser": {
    "name": "realistic full name",
    "role": "exact job title or life context",
    "situation": "one sentence about their current situation that this product solves"
  },
  "records": [
    { "id": "...", "field": "real value" }
  ],
  "primaryScreen": "describe the main screen layout in 2 sentences",
  "wowMoment": {
    "buttonLabel": "exact text on the button that triggers the AI",
    "processingSteps": ["3 short status messages shown during AI processing, 700ms each"],
    "outputTitle": "the heading shown above the AI result",
    "outputContent": "the actual impressive AI output as it should appear"
  },
  "secondaryInteraction": "one more interaction showing product depth",
  "accentColor": "a hex color that fits the industry",
  "productType": "one of: dashboard | analysis | tracker | coach | marketplace | form-flow | chat",
  "infraEcho": "how the prototype should visibly reflect the infra/entity model"
}`;
}

function builderPrompt(design, gtm, infra, spec, comp, retrieval) {
  const accent = spec?.accentColor || '#6366f1';
  const user = spec?.primaryUser || { name: 'Alex Morgan', role: gtm?.persona, situation: '' };
  const records = spec?.records || [];
  const wow = spec?.wowMoment || {};
  const type = spec?.productType || 'dashboard';

  return `You are a senior frontend engineer building a product demo. This prototype will be shown to a real potential customer TODAY. If they do not say "I want this" within 10 seconds, you failed.

VALIDATION + MOAT CONTEXT
${JSON.stringify({
  ...compactComp(comp),
  retrieval: compactRetrieval(retrieval),
}, null, 2)}

DESIGN
${JSON.stringify(compactDesign(design), null, 2)}

GTM
${JSON.stringify(compactGtm(gtm), null, 2)}

INFRASTRUCTURE — this must shape the UX, data model, and language
${JSON.stringify(compactInfra(infra), null, 2)}

SPEC
${JSON.stringify(compactSpec(spec), null, 2)}

NON-NEGOTIABLE REQUIREMENTS
1. Self-contained HTML — all CSS and JS inline, zero external dependencies, zero CDN links
2. The accent color ${accent} must be used for primary actions, active states, key data
3. Typography: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui — NO Google Fonts
4. The wow moment must have 3 distinct states: idle → processing (animated) → result (staggered reveal)
5. Use the infra entities ${JSON.stringify(infra?.entities || [])} in the UI labels and information architecture
6. The prototype must visibly express the memory loop: ${infra?.memoryLoop || 'show how the system improves as it accumulates workflow history'}
7. At least one chart, progress bar, or data visualization — not just text and buttons
8. Every piece of text must be domain-specific — ZERO generic placeholders
9. Mobile-responsive — works at 375px width
10. Dark background (#0d0d10), cards at #1a1a1f, borders at #2a2a32
11. The workflow must feel like a wedge with proprietary memory, not a generic AI dashboard

Use these exact user and records:
Primary user: ${user.name}, ${user.role} — ${user.situation}
Data records: ${JSON.stringify(records, null, 2)}
Button label: ${wow.buttonLabel || 'Analyze'}
Processing states: ${(wow.processingSteps || ['Processing…', 'Analyzing data…', 'Generating insights…']).join(' | ')}
Output title: ${wow.outputTitle || 'Results'}
Output content: ${wow.outputContent || 'Detailed AI analysis here'}
Secondary interaction: ${spec?.secondaryInteraction || design.userFlow}
Primary screen: ${spec?.primaryScreen || design.buildSpec}
Infra echo: ${spec?.infraEcho || ''}

Start with <!DOCTYPE html>. No markdown, no explanation.`;
}

function prototypeEvalPrompt(design, gtm, infra, spec, prototypeHtml) {
  return `You are the final evaluator for IdeaWheel prototypes. Score whether this blueprint is sophisticated enough to feel non-generic and hard to copy.

Design: ${JSON.stringify(compactDesign(design))}
GTM: ${JSON.stringify(compactGtm(gtm))}
Infrastructure: ${JSON.stringify(compactInfra(infra))}
Spec: ${JSON.stringify(compactSpec(spec))}
Prototype preview: ${prototypeHtml.slice(0, 12000)}

Return ONLY JSON:
{
  "scores": {
    "prototypeBelievability": 0,
    "wowMoment": 0,
    "infraConsistency": 0,
    "moatExpression": 0,
    "specificity": 0,
    "overall": 0
  },
  "needsRepair": true,
  "issues": ["up to 5 problems"],
  "repairBrief": "one paragraph telling the builder exactly what to improve"
}
Scores must be integers from 0-100.`;
}

function builderRepairPrompt(design, gtm, infra, spec, evalResult, prototypeHtml) {
  return `Repair this prototype using the evaluator feedback.

Design: ${JSON.stringify(design, null, 2)}
GTM: ${JSON.stringify(gtm, null, 2)}
Infrastructure: ${JSON.stringify(infra, null, 2)}
Spec: ${JSON.stringify(spec, null, 2)}
Eval: ${JSON.stringify(evalResult, null, 2)}
Current prototype HTML:
${prototypeHtml.slice(0, 18000)}

Return improved full self-contained HTML starting with <!DOCTYPE html>. No markdown.`;
}

// Defensive: rewrite stages sometimes echo the prompt's label as a wrapper key,
// e.g. {"Current GTM": {...the real object...}}. A real stage result always has
// several top-level keys, so an object with exactly one key whose value is an
// object is that failure — unwrap it back to the inner object.
function unwrapWrapper(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const inner = obj[keys[0]];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner;
  }
  return obj;
}

async function runJsonStage({ prompt, model, maxTokens, critiquePrompt, rewritePrompt }) {
  const primary = await call(prompt, { model, maxTokens });
  const primaryParsed = await parseJSON(primary.text, `${model} primary stage`);
  let parsed = unwrapWrapper(primaryParsed.value);
  let totalUsage = mergeUsage(primary.usage, primaryParsed.usage);
  let totalCostUsd = primary.costUsd || 0;
  totalCostUsd += primaryParsed.costUsd || 0;
  let critique = null;

  if (critiquePrompt) {
    const critiqueCall = await call(critiquePrompt(parsed), { model: MODELS.scout, maxTokens: 800 });
    const critiqueParsed = await parseJSON(critiqueCall.text, `${model} critique stage`);
    critique = critiqueParsed.value;
    totalUsage = mergeUsage(totalUsage, critiqueCall.usage, critiqueParsed.usage);
    totalCostUsd += critiqueCall.costUsd || 0;
    totalCostUsd += critiqueParsed.costUsd || 0;

    if (critique.needsRevision || (critique.scores?.overall || 100) < 78) {
      const rewriteCall = await call(rewritePrompt(parsed, critique), { model, maxTokens });
      const rewriteParsed = await parseJSON(rewriteCall.text, `${model} rewrite stage`);
      parsed = unwrapWrapper(rewriteParsed.value);
      totalUsage = mergeUsage(totalUsage, rewriteCall.usage, rewriteParsed.usage);
      totalCostUsd += rewriteCall.costUsd || 0;
      totalCostUsd += rewriteParsed.costUsd || 0;
    }
  }

  return { result: parsed, critique, usage: totalUsage, costUsd: totalCostUsd };
}

export async function POST(request) {
  const body = await request.json();
  const {
    action,
    workflow,
    industry,
    connector,
    modeName,
    stage,
    comp,
    design,
    gtm,
    infra,
    sessionId: rawSessionId,
    validationId,
    freeformIdea,
    chargeToken,
    creditCost,
  } = body;

  if (!freeformIdea && (!action || !workflow || !industry)) {
    return NextResponse.json({ error: 'Missing: action, workflow, industry (or freeformIdea)' }, { status: 400 });
  }

  const sessionId = ensureSessionId(rawSessionId);
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  if (!(await checkRateLimit(`build:${user.id}`, BUILD_RATE_LIMIT))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const agentDesc = freeformIdea ? String(freeformIdea).slice(0, 500) : `an agent that ${action} ${workflow} ${connector} ${industry}`;
  const retrieval = comp?.retrieval || (await buildRetrievalContext({ modeName, industry, action, workflow }));
  // Server-side cost — never trust client-supplied creditCost
  const blueprintCost = CREDIT_COSTS.blueprint;
  let charge = null;

  try {
    if (stage === 'designer') {
      if (!Number.isFinite(blueprintCost) || blueprintCost < 1) {
        return NextResponse.json({ error: 'Invalid blueprint credit cost' }, { status: 400 });
      }

      // Server-side qualification gate. The blueprint may only be built for an
      // idea that has an eligible, current-version score of >= 60 — verified from
      // the STORED validation record, never the client-supplied comp. This is the
      // authoritative enforcement of "only qualified ideas get a blueprint"; the
      // client CTA is a courtesy. Runs BEFORE any credit is charged, and only at
      // the designer stage (later stages continue an already-authorized charge).
      let eligibility = await getValidationEligibility(validationId, {
        minScore: SCORE_POLICY.blueprintMin,
        requiredVersion: SCORE_POLICY.version,
      });
      // Durable fallback: if the per-validation record can't be found (cache hit,
      // or pipeline_validations not durably stored / wiped on redeploy), fall back
      // to the idea_candidates pool, which durably holds the canonical score,
      // version, and eligibility. Only for structured ideas (freeform has no combo).
      if (!eligibility.eligible && eligibility.reason === 'validation_not_found' && action && workflow && industry) {
        const fromPool = await getCandidateEligibility(modeName, workflow, industry, {
          minScore: SCORE_POLICY.blueprintMin,
          requiredVersion: SCORE_POLICY.version,
        });
        if (fromPool.found) eligibility = fromPool;
      }
      if (!eligibility.eligible) {
        return NextResponse.json({
          error: 'idea_not_eligible',
          reason: eligibility.reason,
          score: eligibility.score,
          minimumRequired: SCORE_POLICY.blueprintMin,
        }, { status: eligibility.reason.includes('not_found') ? 404 : 422 });
      }

      const debit = await deductCredits(user.id, blueprintCost, 'blueprint_started', {
        validationId,
        sessionId,
        modeName,
        action,
        workflow,
        industry,
      });

      if (!debit.ok) {
        return NextResponse.json({
          error: debit.reason === 'insufficient_credits' ? 'Not enough credits for this blueprint.' : 'Unable to charge credits for this blueprint.',
          balance: debit.balance ?? null,
        }, { status: debit.reason === 'insufficient_credits' ? 402 : 400 });
      }

      charge = await saveBlueprintCharge({
        id: crypto.randomUUID(),
        userId: user.id,
        sessionId,
        validationId,
        modeName,
        action,
        workflow,
        industry,
        amount: blueprintCost,
        status: 'authorized',
        balanceAfter: debit.newBalance ?? null,
      });
    } else {
      if (!chargeToken) {
        return NextResponse.json({ error: 'Missing blueprint charge token' }, { status: 400 });
      }
      charge = await getBlueprintCharge(chargeToken);
      if (!charge || charge.userId !== user.id) {
        return NextResponse.json({ error: 'Invalid blueprint charge token' }, { status: 403 });
      }
      if (charge.status === 'refunded') {
        return NextResponse.json({ error: 'This blueprint charge was already refunded. Start again.' }, { status: 409 });
      }
      if (charge.status === 'consumed') {
        return NextResponse.json({ error: 'This blueprint charge was already used. Start again.' }, { status: 409 });
      }
    }

    switch (stage) {
      case 'designer': {
        // Deep web research feeds the paid blueprint. Defensive: if it fails or
        // times out, we still design from the retrieval/validation context.
        let deepResearch = '';
        try {
          const today = new Date().toISOString().slice(0, 10);
          const research = await call(
            `Do fresh competitive research before we design this product: "${agentDesc}".
Search for the most current information available as of ${today}. Prioritise developments from the last 18 months. Find direct competitors, their pricing, recent launches, and any market shifts. Return 6-10 tight bullet points of concrete, specific facts — real names, prices and numbers. No preamble, bullets only.`,
            { model: MODELS.scout, maxTokens: 1200, webSearch: true, searchUses: 8 }
          );
          deepResearch = (research.text || '').trim().slice(0, 2500);
        } catch {
          deepResearch = '';
        }

        const designerStage = await runJsonStage({
          prompt: designerPrompt(agentDesc, comp, retrieval)
            + (deepResearch ? `\n\nFRESH WEB RESEARCH (use to sharpen specificity and pricing):\n${deepResearch}` : ''),
          model: MODELS.designer,
          maxTokens: 1400,
          critiquePrompt: (draft) => designCritiquePrompt(agentDesc, comp, draft),
          rewritePrompt: (draft, critique) => designerRewritePrompt(agentDesc, comp, draft, critique),
        });

        // Plain-English readability check on this paid deliverable.
        const designerResult = await withPlainEnglish('Product design', designerStage.result);

        // Persist progress so the idea is already in the user's shortlist and
        // resumable even if they navigate away now. The credit (charged at this
        // stage) is recorded here; later stages reuse the same charge token.
        await saveBlueprintProgress({
          userId: user.id,
          validationId,
          idea: { action, workflow, industry, connector, modeName, sessionId, title: comp?.title },
          comp,
          blueprint: { design: designerResult, chargeToken: charge.id },
          status: 'generating',
          creditsToAdd: blueprintCost,
        }).catch(() => {});

        await recordOutcome({
          sessionId,
          signal: 'designer_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: { design: designerResult, critique: designerStage.critique },
        });

        return NextResponse.json({
          result: designerResult,
          critique: designerStage.critique,
          usage: designerStage.usage,
          cost_usd: designerStage.costUsd,
          sessionId,
          chargeToken: charge.id,
          balance: charge.balanceAfter ?? null,
        });
      }

      case 'launch': {
        const launchStage = await runJsonStage({
          prompt: gtmPrompt(agentDesc, comp, design, retrieval),
          model: MODELS.gtm,
          maxTokens: 3200,
          critiquePrompt: (draft) => gtmCritiquePrompt(design, draft, comp),
          rewritePrompt: (draft, critique) => gtmRewritePrompt(agentDesc, design, draft, comp, critique),
        });

        // Plain-English readability check on this paid deliverable.
        const launchResult = await withPlainEnglish('Launch & go-to-market plan', launchStage.result);

        await saveBlueprintProgress({
          userId: user.id,
          validationId,
          idea: { action, workflow, industry, connector, modeName, sessionId, title: comp?.title },
          comp,
          blueprint: { design, gtm: launchResult, chargeToken: charge.id },
          status: 'generating',
        }).catch(() => {});

        await recordOutcome({
          sessionId,
          signal: 'launch_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: { gtm: launchResult, critique: launchStage.critique },
        });

        return NextResponse.json({
          result: launchResult,
          critique: launchStage.critique,
          usage: launchStage.usage,
          cost_usd: launchStage.costUsd,
          sessionId,
          chargeToken: charge.id,
        });
      }

      case 'infrastructure': {
        // Infra now gets the same critic-and-rewrite loop as design/GTM — an
        // independent pass on security, data-model completeness, provider
        // accuracy, and cost credibility, with a rewrite when it falls short.
        const infraStage = await runJsonStage({
          prompt: infraPrompt(design, gtm, comp, retrieval),
          model: MODELS.scout,
          maxTokens: 3500,
          critiquePrompt: (draft) => infraCritiquePrompt(design, draft),
          rewritePrompt: (draft, critique) => infraRewritePrompt(design, gtm, comp, draft, critique, retrieval),
        });
        // Plain-English readability check on this (most technical) paid deliverable.
        const infraResult = await withPlainEnglish('Infrastructure & tech setup', infraStage.result);
        // Recompute the cost total in code from the structured line items so the
        // printed figure is arithmetic, not a number the model made up.
        const costModel = computeCostModel(infraStage.result, { monthlyPrice: parseMoney(gtm?.pricing?.price) });
        if (costModel) infraResult.costModel = costModel;

        await saveBlueprintProgress({
          userId: user.id,
          validationId,
          idea: { action, workflow, industry, connector, modeName, sessionId, title: comp?.title },
          comp,
          blueprint: { design, gtm, infra: infraResult, chargeToken: charge.id },
          status: 'generating',
        }).catch(() => {});

        await recordOutcome({
          sessionId,
          signal: 'infra_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: { infra: infraResult },
        });

        return NextResponse.json({
          result: infraResult,
          critique: infraStage.critique,
          usage: infraStage.usage,
          cost_usd: infraStage.costUsd,
          sessionId,
          chargeToken: charge.id,
        });
      }

      case 'builder': {
        let spec = null;
        let specUsage = null;
        const specCall = await call(protoSpecPrompt(design, gtm, comp, infra, retrieval), { model: MODELS.scout, maxTokens: 1400 });
        const specParsed = await parseJSON(specCall.text, 'prototype spec stage');
        spec = specParsed.value;
        specUsage = mergeUsage(specCall.usage, specParsed.usage);

        let builderCall = await call(builderPrompt(design, gtm, infra, spec, comp, retrieval), {
          model: MODELS.builder,
          maxTokens: 6500,
        });
        let prototypeHtml = extractHTML(builderCall.text);

        let evalCall = await call(prototypeEvalPrompt(design, gtm, infra, spec, prototypeHtml), {
          model: MODELS.scout,
          maxTokens: 900,
        });
        let evalParsed = await parseJSON(evalCall.text, 'prototype eval stage');
        let prototypeEval = evalParsed.value;

        let totalUsage = mergeUsage(specUsage, builderCall.usage, evalCall.usage, evalParsed.usage);
        let totalCostUsd = (specCall.costUsd || 0) + (specParsed.costUsd || 0) + (builderCall.costUsd || 0) + (evalCall.costUsd || 0) + (evalParsed.costUsd || 0);

        if (prototypeEval.needsRepair || (prototypeEval.scores?.overall || 100) < 80) {
          const repairCall = await call(builderRepairPrompt(design, gtm, infra, spec, prototypeEval, prototypeHtml), {
            model: MODELS.builder,
            maxTokens: 5500,
          });
          prototypeHtml = extractHTML(repairCall.text);
          const repairedEvalCall = await call(prototypeEvalPrompt(design, gtm, infra, spec, prototypeHtml), {
            model: MODELS.scout,
            maxTokens: 900,
          });
          const repairedEvalParsed = await parseJSON(repairedEvalCall.text, 'prototype repaired eval stage');
          prototypeEval = repairedEvalParsed.value;
          totalUsage = mergeUsage(totalUsage, repairCall.usage, repairedEvalCall.usage, repairedEvalParsed.usage);
          totalCostUsd += (repairCall.costUsd || 0) + (repairedEvalCall.costUsd || 0);
          totalCostUsd += repairedEvalParsed.costUsd || 0;
        }

        const blueprintRow = await recordBlueprint({
          sessionId,
          validationId,
          modeName,
          action,
          workflow,
          industry,
          agentDesc,
          retrieval,
          comp,
          design,
          gtm,
          infra,
          protoSpec: spec,
          eval: prototypeEval,
          prototypeHtml,
          usage: totalUsage,
          costUsd: totalCostUsd,
        });

        await saveBlueprintCharge({
          ...charge,
          status: 'consumed',
          blueprintId: blueprintRow.id,
          totalCostUsd,
        });

        // Attach the finished blueprint to the user's saved idea (creating the
        // row if extended research was skipped). Resilient: never blocks the build.
        await attachBlueprint({
          userId: user.id,
          validationId,
          idea: { action, workflow, industry, connector, modeName, title: comp?.title },
          comp,
          blueprint: {
            design,
            gtm,
            infra,
            protoSpec: spec,
            eval: prototypeEval,
            prototypeHtml: typeof prototypeHtml === 'string' ? prototypeHtml.slice(0, 100000) : '',
          },
          // Credit was already recorded at the designer stage (saveBlueprintProgress);
          // don't count it again here.
          creditsSpent: 0,
        }).catch(() => {});

        await recordOutcome({
          sessionId,
          signal: 'blueprint_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: {
            validationId,
            blueprintId: blueprintRow.id,
            eval: prototypeEval,
            pricing: gtm?.pricing?.price,
          },
        });

        return NextResponse.json({
          result: prototypeHtml,
          protoSpec: spec,
          eval: prototypeEval,
          blueprintId: blueprintRow.id,
          usage: totalUsage,
          cost_usd: totalCostUsd,
          sessionId,
          chargeToken: charge.id,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
    }
  } catch (err) {
    if (charge?.status === 'authorized') {
      try {
        await addCredits(user.id, charge.amount, 'blueprint_refund', {
          chargeToken: charge.id,
          validationId,
          sessionId,
          stage,
          error: err.message,
        });
        await saveBlueprintCharge({
          ...charge,
          status: 'refunded',
          error: err.message,
        });
      } catch (refundErr) {
        console.error('[pipeline/build/refund]', refundErr.message);
      }
    }
    console.error(`[pipeline/${stage}]`, err.message);
    return NextResponse.json({ error: 'Blueprint generation failed. Please try again.' }, { status: 500 });
  }
}
