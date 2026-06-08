import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { addCredits, deductCredits } from '../../../../lib/credits';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { ensureSessionId, readValidationCache, recordValidation, writeValidationCache } from '../../../../lib/moat-store';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const PRICING = { input: 1.0, output: 5.0 };
const PRECHECK_CACHE_MS = 72 * 60 * 60 * 1000;
const DEEP_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const DEEP_SCAN_CREDIT_COST = 1;

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

function parseJsonCheap(text) {
  try {
    return parseJsonStrict(text);
  } catch (error) {
    const stripped = stripJsonFences(text);
    try {
      return JSON.parse(normalizeJsonCandidate(stripped));
    } catch {
      throw error;
    }
  }
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

function stripCitationNoise(value) {
  return String(value || '')
    .replace(/<\/?cite\b[^>]*>/gi, ' ')
    .replace(/<\/?source\b[^>]*>/gi, ' ')
    .replace(/<\/?sup\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\bindex="[^"]*">?/gi, ' ')
    .replace(/\[(?:\d+[\d,\-\s]*)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortText(value, max = 220) {
  if (!value) return '';
  const text = stripCitationNoise(value);
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

function precheckPrompt(agentDesc, modeName, retrieval) {
  return `You are the cheap first-pass triage analyst for IdeaWheel. This is a FREE pre-check, not a deep market scan.

Idea: "${agentDesc}"
Sector: ${modeName}
PRIVATE RETRIEVAL CONTEXT:
${JSON.stringify(compactRetrieval(retrieval), null, 2)}

Rules:
- Do NOT use web search.
- Be decisive and concise.
- Calibrate hard. 80+ should be rare.
- Favor clear, narrow, workflow-native ideas over broad AI wrappers.
- If the wedge is weak or crowded, say so.

Return ONLY a JSON object (no fences):
{
  "marketSize": "1 short sentence on likely demand or market pull",
  "verdict": "1 punchy sentence",
  "verdictType": "build | warning | avoid",
  "verdictReasoning": "2 short honest sentences",
  "gap": "specific wedge to test first, or empty string",
  "pivotHint": "one adjacent pivot with better odds, or empty string",
  "retrievalFit": "1 sentence on fit with the workflow/archetype",
  "confidence": "low | medium | high",
  "mustProveNext": ["3 short proof points"],
  "moat": "1 short sentence on what could make it defensible, or empty string",
  "scores": {
    "evidenceCoverage": 0,
    "wedgeClarity": 0,
    "defensibility": 0,
    "specificity": 0,
    "overall": 0
  }
}`;
}

function normalizeScore(value, fallback = 55) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizePrecheck(precheck = {}) {
  const overall = normalizeScore(precheck?.scores?.overall, 55);
  const verdictType = ['build', 'warning', 'avoid'].includes(precheck?.verdictType) ? precheck.verdictType : (overall >= 74 ? 'build' : overall >= 58 ? 'warning' : 'avoid');
  return {
    marketSize: shortText(precheck.marketSize, 160),
    verdict: shortText(precheck.verdict, 160),
    verdictType,
    verdictReasoning: shortText(precheck.verdictReasoning, 240),
    gap: shortText(precheck.gap, 180),
    pivotHint: shortText(precheck.pivotHint, 160),
    retrievalFit: shortText(precheck.retrievalFit, 160),
    confidence: ['low', 'medium', 'high'].includes(precheck?.confidence) ? precheck.confidence : 'medium',
    mustProveNext: shortList(precheck.mustProveNext, 3, 100),
    moat: shortText(precheck.moat, 180),
    scores: {
      evidenceCoverage: normalizeScore(precheck?.scores?.evidenceCoverage, Math.max(35, overall - 12)),
      wedgeClarity: normalizeScore(precheck?.scores?.wedgeClarity, overall),
      defensibility: normalizeScore(precheck?.scores?.defensibility, Math.max(30, overall - 8)),
      specificity: normalizeScore(precheck?.scores?.specificity, overall),
      overall,
    },
  };
}

function buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationId, validationTier = 'deep') {
  const decision = judge.decision || scout.verdictType || 'warning';
  return {
    ...scout,
    score: evalResult?.scores?.overall || null,
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
    validationTier,
    agentDesc,
  };
}

function buildPrecheckArtifacts(agentDesc, precheck, retrieval, validationId) {
  const scout = {
    marketSize: precheck.marketSize,
    landscape: precheck.retrievalFit || precheck.verdictReasoning,
    players: [],
    gap: precheck.gap,
    verdict: precheck.verdict,
    verdictType: precheck.verdictType,
    verdictReasoning: precheck.verdictReasoning,
    evidence: precheck.mustProveNext,
    retrievalFit: precheck.retrievalFit,
    pivotHint: precheck.pivotHint,
  };
  const judge = {
    decision: precheck.verdictType,
    confidence: precheck.confidence,
    wedge: precheck.gap,
    defensibility: precheck.moat,
    mustProveNext: precheck.mustProveNext,
    reasoning: precheck.verdictReasoning,
  };
  const evalResult = {
    scores: precheck.scores,
    shipReady: precheck.verdictType !== 'avoid' && precheck.scores.overall >= 65,
    failReasons: precheck.verdictType === 'avoid' ? ['Failed free pre-check'] : [],
    improvementBrief: precheck.mustProveNext.join(' · '),
  };

  return {
    scout,
    judge,
    evalResult,
    comp: {
      ...scout,
      score: precheck.scores.overall,
      moat: precheck.moat,
      judge,
      skeptic: null,
      eval: evalResult,
      retrieval,
      validationId,
      validationTier: 'precheck',
      agentDesc,
    },
  };
}

function normalizeIdea(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildCacheKey({ tier, modeName, action, workflow, industry, freeformIdea }) {
  const normalized = {
    version: 'v2',
    tier,
    modeName: normalizeIdea(modeName),
    action: normalizeIdea(action),
    workflow: normalizeIdea(workflow),
    industry: normalizeIdea(industry),
    freeformIdea: normalizeIdea(freeformIdea),
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function cachedResponse(response, sessionId) {
  return {
    sessionId,
    comp: { ...(response?.comp || {}), cached: true },
    cost: response?.cost || null,
    tier: response?.tier || response?.comp?.validationTier || 'deep',
    cached: true,
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
    tier: requestedTier,
  } = await request.json();

  if (!freeformIdea && (!action || !workflow || !industry)) {
    return NextResponse.json({ error: 'Missing: action, workflow, industry (or freeformIdea)' }, { status: 400 });
  }

  const validationTier = requestedTier === 'precheck' ? 'precheck' : 'deep';
  const sessionId = ensureSessionId(rawSessionId);
  const agentDesc = freeformIdea || `an agent that ${action} ${workflow} ${connector} ${industry}`;
  const cacheKey = buildCacheKey({ tier: validationTier, modeName, action, workflow, industry, freeformIdea: agentDesc });
  let chargedUser = null;
  let charged = false;
  let balance = null;

  try {
    const cached = await readValidationCache(cacheKey, validationTier === 'precheck' ? PRECHECK_CACHE_MS : DEEP_CACHE_MS);
    if (cached) {
      return NextResponse.json(cachedResponse(cached, sessionId));
    }

    if (validationTier === 'deep') {
      chargedUser = await getUser();
      if (!chargedUser) {
        return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
      }

      const debit = await deductCredits(chargedUser.id, DEEP_SCAN_CREDIT_COST, 'deep_scan_started', {
        sessionId,
        modeName,
        action,
        workflow,
        industry,
      });

      if (!debit.ok) {
        return NextResponse.json({
          error: debit.reason === 'insufficient_credits' ? 'Not enough credits for a deep market scan.' : 'Unable to charge credits for this deep market scan.',
          balance: debit.balance ?? null,
        }, { status: debit.reason === 'insufficient_credits' ? 402 : 400 });
      }

      charged = true;
      balance = debit.newBalance ?? null;
    }

    const retrieval = await buildRetrievalContext({ modeName, industry, action, workflow });

    if (validationTier === 'precheck') {
      const precheckCall = await call(precheckPrompt(agentDesc, modeName, retrieval), { maxTokens: 900 });
      const precheck = normalizePrecheck(parseJsonCheap(precheckCall.text));
      const usage = precheckCall.usage || { input_tokens: 0, output_tokens: 0 };
      const costUsd = calcCost(usage.input_tokens, usage.output_tokens);
      const { scout, judge, evalResult } = buildPrecheckArtifacts(agentDesc, precheck, retrieval, 'pending');

      const validationRow = await recordValidation({
        sessionId,
        modeName,
        action,
        workflow,
        industry,
        agentDesc,
        validationTier,
        retrieval,
        scout,
        skeptic: null,
        judge,
        eval: evalResult,
        verdictType: precheck.verdictType,
        usage,
        costUsd,
      });

      const { comp } = buildPrecheckArtifacts(agentDesc, precheck, retrieval, validationRow.id);
      const response = {
        comp,
        cost: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cost_usd: costUsd,
        },
        tier: validationTier,
      };

      await writeValidationCache(cacheKey, response, { tier: validationTier, modeName, action, workflow, industry });
      return NextResponse.json({ sessionId, ...response, cached: false, balance });
    }

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
      validationTier,
      retrieval,
      scout,
      skeptic,
      judge,
      eval: evalResult,
      verdictType: judge.decision || scout.verdictType || 'warning',
      usage,
      costUsd,
    });

    const comp = buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationRow.id, validationTier);
    const response = {
      comp,
      cost: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: costUsd,
      },
      tier: validationTier,
    };

    await writeValidationCache(cacheKey, response, { tier: validationTier, modeName, action, workflow, industry });

    return NextResponse.json({ sessionId, ...response, cached: false, balance });
  } catch (err) {
    if (charged && chargedUser) {
      try {
        const refund = await addCredits(chargedUser.id, DEEP_SCAN_CREDIT_COST, 'deep_scan_refund', {
          sessionId,
          modeName,
          action,
          workflow,
          industry,
          error: err.message,
        });
        balance = refund?.newBalance ?? balance;
      } catch (refundErr) {
        console.error('[validate/refund]', refundErr.message);
      }
    }
    console.error('[validate]', err.message);
    return NextResponse.json({ error: err.message, balance }, { status: 500 });
  }
}
