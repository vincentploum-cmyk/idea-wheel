import { NextResponse } from 'next/server';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { ensureSessionId, recordBlueprint, recordOutcome } from '../../../../lib/moat-store';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const MODELS = {
  scout: 'claude-haiku-4-5-20251001',
  designer: 'claude-sonnet-4-6',
  gtm: 'claude-sonnet-4-6',
  builder: 'claude-sonnet-4-6',
};

const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcCost(model, inp, out) {
  const p = PRICING[model] || PRICING['claude-sonnet-4-6'];
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

async function call(prompt, { model, maxTokens = 1000, webSearch = false, attempt = 0 }) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };

  if (webSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && attempt < 2) {
    const retryAfterHeader = Number(res.headers.get('retry-after') || 0);
    const retryMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 8000 * (attempt + 1);
    await sleep(retryMs);
    return call(prompt, { model, maxTokens, webSearch, attempt: attempt + 1 });
  }

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
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
    differentiator: shortText(design?.differentiator, 180),
    coreFeatures: shortList(design?.coreFeatures, 5, 100),
    userFlow: shortText(design?.userFlow, 200),
    buildSpec: shortText(design?.buildSpec, 500),
    dataMoat: shortText(design?.dataMoat, 180),
    defensibilityPlan: shortText(design?.defensibilityPlan, 180),
  };
}

function compactGtm(gtm) {
  return {
    revenueGoal: shortText(gtm?.revenueGoal, 80),
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
    buildOrder: shortText(infra?.buildOrder, 220),
  };
}

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
  "differentiator": "specific wedge, not generic AI language",
  "coreFeatures": ["feature 1","feature 2","feature 3"],
  "userFlow": "trigger to value in 2-3 sentences",
  "buildSpec": "detailed UI spec with the one magical interaction",
  "dataMoat": "what proprietary workflow memory or feedback loop compounds over time",
  "defensibilityPlan": "how this becomes harder to copy after 90 days"
}`;
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

Return ONLY JSON with the exact same schema as before.`;
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
  "persona": "specific role of ideal first customer",
  "whereToFind": "3-4 named communities (subreddits, Slack groups, LinkedIn groups)",
  "firstFiveCustomers": ["specific tactic 1 with exact place + angle","...×5"],
  "channels": [{"name":"...","tactic":"specific action","timeline":"..."}],
  "pricing": {"price":"$X/mo","rationale":"why this number","trial":"free tier structure"},
  "plan": [
    {"week":1,"theme":"...","actions":["...","...","..."]},
    {"week":2,"theme":"...","actions":["...","...","..."]},
    {"week":3,"theme":"...","actions":["...","...","..."]},
    {"week":4,"theme":"...","actions":["...","...","..."]}
  ],
  "stack": ["Next.js","Supabase","..."],
  "buildTime": "realistic solo v1 estimate",
  "whyNow": "why this wedge is timely right now"
}`;
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

Return ONLY JSON with the same schema as before.`;
}

function infraPrompt(design, gtm, comp, retrieval) {
  return `You are a senior software architect advising a solo vibe coder. Give them the exact technical setup for this product, and make the architecture reinforce the moat.

Validation package:
${JSON.stringify({ ...compactComp(comp), retrieval: compactRetrieval(retrieval) }, null, 2)}
Design: ${JSON.stringify(compactDesign(design), null, 2)}
GTM: ${JSON.stringify(compactGtm(gtm), null, 2)}

Return ONLY JSON:
{
  "services": [{"name":"...","purpose":"...","url":"https://...","freeTier":"...","setupTime":"X min","setupSteps":["Step 1...","Step 2..."]}],
  "envVars": ["VAR_NAME=your_value  # what it does"],
  "schema": "Tables in plain English: users (id, email, plan) | table2 (fields)",
  "entities": ["entity 1","entity 2","entity 3"],
  "aiWiring": "Which model, system prompt structure, agent loop pattern",
  "memoryLoop": "how the product accumulates feedback or workflow history over time",
  "deploySteps": ["1. Push to GitHub","2. Vercel → New Project → Import","3. Add env vars in Vercel Settings","4. Deploy"],
  "monthlyCost": {"dev":"$0","at100users":"$X/mo (math)","at1000users":"$Y/mo (math)"},
  "buildOrder": "Day 1: auth + schema. Day 2: core feature. Day 3: payments. Day 4: AI agent. Day 5: launch."
}`;
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

async function runJsonStage({ prompt, model, maxTokens, critiquePrompt, rewritePrompt }) {
  const primary = await call(prompt, { model, maxTokens });
  const primaryParsed = await parseJSON(primary.text, `${model} primary stage`);
  let parsed = primaryParsed.value;
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
      parsed = rewriteParsed.value;
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
  } = body;

  if (!freeformIdea && (!action || !workflow || !industry)) {
    return NextResponse.json({ error: 'Missing: action, workflow, industry (or freeformIdea)' }, { status: 400 });
  }

  const sessionId = ensureSessionId(rawSessionId);
  const agentDesc = freeformIdea || `an agent that ${action} ${workflow} ${connector} ${industry}`;
  const retrieval = comp?.retrieval || (await buildRetrievalContext({ modeName, industry, action, workflow }));

  try {
    switch (stage) {
      case 'designer': {
        const designerStage = await runJsonStage({
          prompt: designerPrompt(agentDesc, comp, retrieval),
          model: MODELS.designer,
          maxTokens: 1400,
          critiquePrompt: (draft) => designCritiquePrompt(agentDesc, comp, draft),
          rewritePrompt: (draft, critique) => designerRewritePrompt(agentDesc, comp, draft, critique),
        });

        await recordOutcome({
          sessionId,
          signal: 'designer_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: { design: designerStage.result, critique: designerStage.critique },
        });

        return NextResponse.json({
          result: designerStage.result,
          critique: designerStage.critique,
          usage: designerStage.usage,
          cost_usd: designerStage.costUsd,
          sessionId,
        });
      }

      case 'launch': {
        const launchStage = await runJsonStage({
          prompt: gtmPrompt(agentDesc, comp, design, retrieval),
          model: MODELS.gtm,
          maxTokens: 2200,
          critiquePrompt: (draft) => gtmCritiquePrompt(design, draft, comp),
          rewritePrompt: (draft, critique) => gtmRewritePrompt(agentDesc, design, draft, comp, critique),
        });

        await recordOutcome({
          sessionId,
          signal: 'launch_completed',
          modeName,
          action,
          workflow,
          industry,
          payload: { gtm: launchStage.result, critique: launchStage.critique },
        });

        return NextResponse.json({
          result: launchStage.result,
          critique: launchStage.critique,
          usage: launchStage.usage,
          cost_usd: launchStage.costUsd,
          sessionId,
        });
      }

      case 'infrastructure': {
        const infraCall = await call(infraPrompt(design, gtm, comp, retrieval), { model: MODELS.scout, maxTokens: 1800 });
        const infraParsed = await parseJSON(infraCall.text, 'infrastructure stage');
        const infraResult = infraParsed.value;

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
          usage: mergeUsage(infraCall.usage, infraParsed.usage),
          cost_usd: (infraCall.costUsd || 0) + (infraParsed.costUsd || 0),
          sessionId,
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
        });
      }

      default:
        return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`[pipeline/${stage}]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
