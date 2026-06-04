import { NextResponse } from 'next/server';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { ensureSessionId, recordValidation } from '../../../../lib/moat-store';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICING = { input: 1.0, output: 5.0 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcCost(inp, out) {
  return (inp * PRICING.input + out * PRICING.output) / 1_000_000;
}

async function call(prompt, { maxTokens = 1800, webSearch = false, attempt = 0 } = {}) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model: MODEL,
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
    return call(prompt, { maxTokens, webSearch, attempt: attempt + 1 });
  }

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
  return { text, usage };
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
    };
  } catch (error) {
    let totalUsage = { input_tokens: 0, output_tokens: 0 };
    let lastError = error;

    const repairPrompts = [
      {
        prompt: `You repair malformed JSON emitted by another model. Return one valid JSON object only. Do not explain anything. Preserve the original meaning and keys as closely as possible.\n\nLabel: ${label}\nParse error: ${error.message}\n\nMalformed output:\n${stripJsonFences(text).slice(0, 16000)}`,
        maxTokens: 3000,
      },
      {
        prompt: `You are a fail-safe JSON normalizer. Convert the malformed output below into ONE compact valid JSON object. Keep the same top-level structure and intent, but shorten long strings and lists if needed so the JSON is guaranteed valid. Return JSON only.\n\nLabel: ${label}\nPrevious parse error: ${error.message}\n\nMalformed output:\n${stripJsonFences(text).slice(0, 16000)}`,
        maxTokens: 2400,
      },
    ];

    for (const repair of repairPrompts) {
      try {
        const repairCall = await call(repair.prompt, { maxTokens: repair.maxTokens });
        totalUsage = mergeUsage(totalUsage, repairCall.usage);
        return {
          value: parseJsonStrict(repairCall.text),
          usage: totalUsage,
        };
      } catch (repairError) {
        lastError = repairError;
      }
    }

    throw lastError;
  }
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

function compactPlayers(players) {
  return (Array.isArray(players) ? players : []).slice(0, 4).map((player) => ({
    name: shortText(player?.name, 60),
    customer: shortText(player?.targetCustomer, 90),
    pricing: shortText(player?.pricing, 60),
    weakness: shortText(player?.weakness, 120),
  }));
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

function compactScout(scout) {
  return {
    marketSize: shortText(scout?.marketSize, 120),
    landscape: shortText(scout?.landscape, 220),
    players: compactPlayers(scout?.players),
    gap: shortText(scout?.gap, 180),
    verdict: shortText(scout?.verdict, 160),
    verdictType: scout?.verdictType,
    verdictReasoning: shortText(scout?.verdictReasoning, 220),
    evidence: shortList(scout?.evidence, 5, 120),
    retrievalFit: shortText(scout?.retrievalFit, 160),
    pivotHint: shortText(scout?.pivotHint, 140),
  };
}

function compactSkeptic(skeptic) {
  return {
    fatalRisks: shortList(skeptic?.fatalRisks, 4, 120),
    copyability: skeptic?.copyability,
    missingProof: shortList(skeptic?.missingProof, 4, 120),
    wedgeAdvice: shortText(skeptic?.wedgeAdvice, 160),
    recommendation: skeptic?.recommendation,
    reasoning: shortText(skeptic?.reasoning, 180),
  };
}

function compactJudge(judge) {
  return {
    decision: judge?.decision,
    confidence: judge?.confidence,
    wedge: shortText(judge?.wedge, 160),
    defensibility: shortText(judge?.defensibility, 200),
    mustProveNext: shortList(judge?.mustProveNext, 3, 120),
    reasoning: shortText(judge?.reasoning, 180),
  };
}

function scoutPrompt(agentDesc, modeName, retrieval) {
  return `You are a market researcher doing competitive intelligence for an AI agent startup. Tell the truth, even when the truth is "don't build this."

The agent: "${agentDesc}". Sector: ${modeName}.

PRIVATE RETRIEVAL CONTEXT
${JSON.stringify(compactRetrieval(retrieval), null, 2)}

Search the web for real competing products, SaaS tools, AI startups, and established vendors. Name specific companies. Include pricing where you can find it. Use the retrieval context to avoid generic analysis and to focus on workflow fit, proof points, and likely wedge shape.

Return ONLY a JSON object (no fences):
{
  "marketSize": "estimated addressable market or scale signal",
  "landscape": "2-3 honest sentences on market state",
  "players": [{"name":"...","targetCustomer":"...","pricing":"...","weakness":"..."}],
  "gap": "specific unaddressed pain, or 'No clear gap' if market is well-served",
  "verdict": "one punchy sentence on the opportunity or lack of it",
  "verdictType": "build if genuine whitespace. warning if competitive but a wedge exists. avoid if 3+ well-funded players dominate with no real gap.",
  "verdictReasoning": "2-3 honest sentences referencing specific players",
  "evidence": ["5 short evidence bullets referencing real products or pricing"],
  "retrievalFit": "1-2 sentences on whether the idea matches the workflow archetype from the retrieval context",
  "pivotHint": "if avoid or warning: one adjacent idea with whitespace. else empty string."
}
Up to 5 players. Default to avoid when in doubt. CRITICAL SCOPE CHECK: this product must be SOFTWARE sold to others, not a business to operate.`;
}

function skepticPrompt(agentDesc, retrieval, scout) {
  return `You are the internal skeptic for IdeaWheel. Your job is to kill weak ideas before they waste founder time.

Idea: "${agentDesc}"
PRIVATE RETRIEVAL CONTEXT:
${JSON.stringify(compactRetrieval(retrieval), null, 2)}
SCOUT FINDINGS:
${JSON.stringify(compactScout(scout), null, 2)}

Return ONLY a JSON object (no fences):
{
  "fatalRisks": ["up to 4 reasons this idea could fail or be too easy to copy"],
  "copyability": "low | medium | high",
  "missingProof": ["proof point 1", "proof point 2"],
  "wedgeAdvice": "If this is salvageable, name the narrowest defensible wedge.",
  "recommendation": "advance | caution | kill",
  "reasoning": "2-3 blunt sentences"
}`;
}

function judgePrompt(agentDesc, retrieval, scout, skeptic, learning) {
  return `You are the final judge for IdeaWheel. You reconcile the scout and skeptic and decide whether the concept should advance.

Idea: "${agentDesc}"
RETRIEVAL CONTEXT:
${JSON.stringify(compactRetrieval(retrieval), null, 2)}
LEARNING CONTEXT:
${JSON.stringify({
    exactMatchCounts: learning?.exactMatchCounts,
    verdictPatterns: learning?.verdictPatterns || [],
    topSignals: learning?.topSignals || [],
    proof: learning?.proof || {},
  }, null, 2)}
SCOUT:
${JSON.stringify(compactScout(scout), null, 2)}
SKEPTIC:
${JSON.stringify(compactSkeptic(skeptic), null, 2)}

Return ONLY a JSON object (no fences):
{
  "decision": "build | warning | avoid",
  "confidence": "low | medium | high",
  "wedge": "the actual narrow wedge to pursue",
  "defensibility": "2-3 sentences on what would make this hard to copy",
  "mustProveNext": ["3 things the founder must prove next"],
  "reasoning": "2-3 sentences balancing scout and skeptic"
}`;
}

function evalPrompt(agentDesc, scout, skeptic, judge) {
  return `You are a benchmark evaluator for IdeaWheel. Grade whether this validation is strong enough to drive a serious blueprint.

Idea: "${agentDesc}"
SCOUT: ${JSON.stringify(compactScout(scout))}
SKEPTIC: ${JSON.stringify(compactSkeptic(skeptic))}
JUDGE: ${JSON.stringify(compactJudge(judge))}

Return ONLY JSON:
{
  "scores": {
    "evidenceCoverage": 0,
    "wedgeClarity": 0,
    "defensibility": 0,
    "specificity": 0,
    "overall": 0
  },
  "shipReady": true,
  "failReasons": ["only if something is weak"],
  "improvementBrief": "one paragraph for the downstream build pipeline"
}
Scores must be integers from 0-100.`;
}

function buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationId) {
  const decision = judge.decision || scout.verdictType || 'warning';
  return {
    ...scout,
    verdictType: decision,
    verdict: scout.verdict,
    verdictReasoning: `${judge.reasoning} ${scout.verdictReasoning || ''}`.trim(),
    gap: judge.wedge || scout.gap,
    moat: judge.defensibility,
    skeptic,
    judge,
    eval: evalResult,
    retrieval,
    validationId,
    agentDesc,
  };
}

export async function POST(request) {
  const {
    action,
    workflow,
    industry,
    connector,
    modeName,
    sessionId: rawSessionId,
    freeformIdea,
  } = await request.json();

  if (!freeformIdea && (!action || !workflow || !industry)) {
    return NextResponse.json({ error: 'Missing: action, workflow, industry (or freeformIdea)' }, { status: 400 });
  }

  const sessionId = ensureSessionId(rawSessionId);
  const agentDesc = freeformIdea || `an agent that ${action} ${workflow} ${connector} ${industry}`;

  try {
    const retrieval = await buildRetrievalContext({ modeName, industry, action, workflow });
    const scoutCall = await call(scoutPrompt(agentDesc, modeName, retrieval), { webSearch: true, maxTokens: 2200 });
    const scoutParsed = await parseJSON(scoutCall.text, 'validation scout');
    const scout = scoutParsed.value;

    const skepticCall = await call(skepticPrompt(agentDesc, retrieval, scout), { maxTokens: 1000 });
    const skepticParsed = await parseJSON(skepticCall.text, 'validation skeptic');
    const skeptic = skepticParsed.value;

    const judgeCall = await call(judgePrompt(agentDesc, retrieval, scout, skeptic, retrieval.learning), { maxTokens: 1200 });
    const judgeParsed = await parseJSON(judgeCall.text, 'validation judge');
    const judge = judgeParsed.value;

    const evalCall = await call(evalPrompt(agentDesc, scout, skeptic, judge), { maxTokens: 700 });
    const evalParsed = await parseJSON(evalCall.text, 'validation eval');
    const evalResult = evalParsed.value;

    const usage = mergeUsage(
      scoutCall.usage,
      scoutParsed.usage,
      skepticCall.usage,
      skepticParsed.usage,
      judgeCall.usage,
      judgeParsed.usage,
      evalCall.usage,
      evalParsed.usage,
    );
    const costUsd = calcCost(usage.input_tokens, usage.output_tokens);

    const validationRow = await recordValidation({
      sessionId,
      modeName,
      action,
      workflow,
      industry,
      agentDesc,
      retrieval,
      scout,
      skeptic,
      judge,
      eval: evalResult,
      verdictType: judge.decision || scout.verdictType || 'warning',
      usage,
      costUsd,
    });

    const comp = buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationRow.id);

    return NextResponse.json({
      sessionId,
      comp,
      cost: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: costUsd,
      },
    });
  } catch (err) {
    console.error('[validate]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
