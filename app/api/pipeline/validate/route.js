import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { ensureSessionId, recordValidation } from '../../../../lib/moat-store';

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

// Simple in-memory rate limiter: max 10 validations per user per minute.
const rateLimitMap = new Map();
function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const entry = rateLimitMap.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  rateLimitMap.set(userId, entry);
  return entry.count <= max;
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const PRICING = { input: 0.15, output: 0.60 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcCost(inp, out) {
  return (inp * PRICING.input + out * PRICING.output) / 1_000_000;
}

async function call(prompt, { maxTokens = 1800, webSearch = false, searchUses = 3, attempt = 0 } = {}) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');

  let res;
  if (webSearch) {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: MODEL, tools: [{ type: 'web_search_preview' }], input: prompt }),
    });
  } else {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
  }

  if (res.status === 429 && attempt < 2) {
    const retryAfterHeader = Number(res.headers.get('retry-after') || 0);
    const retryMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 8000 * (attempt + 1);
    await sleep(retryMs);
    return call(prompt, { maxTokens, webSearch, searchUses, attempt: attempt + 1 });
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
  if (text.length <= max) return text;
  // Cut at the last whole word so we never slice mid-word ("crowded m…").
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.!?–—-]+$/, '');
  return `${trimmed}…`;
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
    coverage: shortText(player?.coverage, 140),
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
    premiseFit: scout?.premiseFit,
    premiseNote: shortText(scout?.premiseNote, 180),
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
  "landscape": "2-3 crisp, easy-to-read sentences summarizing the state of this market",
  "players": [{"name":"...","targetCustomer":"...","pricing":"...","coverage":"one plain sentence on how this player addresses (or ignores) this exact idea","weakness":"..."}],
  "gap": "specific unaddressed pain, or 'No clear gap' if market is well-served",
  "premiseFit": "realistic | weak | nonexistent — does the named workflow/problem genuinely exist for THIS industry?",
  "premiseNote": "if weak or nonexistent: one plain sentence naming the mismatch (e.g. 'Law firms rarely run equipment-maintenance operations, so this problem barely exists for them.'). else empty string.",
  "verdict": "one punchy sentence on the opportunity or lack of it",
  "verdictType": "build if genuine whitespace. warning if competitive but a wedge exists. avoid if 3+ well-funded players dominate with no real gap.",
  "verdictReasoning": "2-3 honest sentences referencing specific players",
  "evidence": ["5 short evidence bullets referencing real products or pricing"],
  "retrievalFit": "1-2 sentences on whether the idea matches the workflow archetype from the retrieval context",
  "pivotHint": "if avoid or warning: one adjacent idea with whitespace. else empty string.",
  "plainSummary": "2-3 plain-English sentences a non-technical person fully understands: is this worth building, who already does it, and where the opening is. No jargon, no buzzwords."
}
List up to 5 players, SORTED from largest/most-established to smallest. If premiseFit is "nonexistent", you MUST set verdictType to "avoid". Default to avoid when in doubt. CRITICAL SCOPE CHECK: this product must be SOFTWARE sold to others, not a business to operate.

WRITING RULES (apply to marketSize, landscape, gap, verdict, verdictReasoning, premiseNote, plainSummary and every player "coverage"/"weakness"):
- Write at an 8th-grade reading level. Short, everyday words. Short sentences (aim under 18 words each).
- Each sentence must stand alone as its own clear point — these render as bullet points, so do not run ideas together with semicolons or long clauses.
- Ban these words and their cousins: "tier-1", "incumbent", "commoditized", "whitespace", "wedge" (in scout fields), "synergy", "leverage", "robust", "holistic", "ecosystem", "vertical", "horizontal", "TAM", "GTM", "B2B SaaS". If you need one of these ideas, say it in plain words (e.g. "the big players already do this", "no real opening", "an underserved group").
- Explain any company or acronym in plain terms the first time (e.g. "AppFolio (property-management software)").
- No marketing fluff. State facts a busy non-technical founder understands in one read.`;
}

// Every prose field below is shown directly to the founder, so it must read
// like advice from a person — never expose the internal pipeline roles or the
// in-house jargon the models like to reach for.
const FOUNDER_VOICE = `WRITING RULES for every prose field (it is shown to the founder):
- Write straight to the founder in plain, 8th-grade English. Short sentences.
- NEVER mention the words "scout", "skeptic", "judge", "moat advice", or any internal role/step. Do not write things like "Scout and skeptic align". Just state the conclusion.
- Do NOT use the words: wedge, whitespace, defensibility, defensible, incumbent, point solution, TAM, GTM, moat. Say them plainly instead — "a way to win", "an opening", "hard to copy", "the big players", "a single-feature tool".`;

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
  "wedgeAdvice": "If this is salvageable, name the single narrowest way it could win — in plain words.",
  "recommendation": "advance | caution | kill",
  "reasoning": "2-3 blunt sentences written straight to the founder"
}

${FOUNDER_VOICE}`;
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
  "wedge": "the single narrowest angle this could win on — in plain words, no jargon",
  "defensibility": "2-3 sentences on what would make this hard to copy",
  "mustProveNext": ["3 things the founder must prove next"],
  "reasoning": "2-3 plain sentences explaining the decision, written straight to the founder"
}

${FOUNDER_VOICE}`;
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
  const premiseBroken = scout.premiseFit === 'nonexistent';
  // A premise mismatch (e.g. equipment maintenance for a law firm) overrides
  // any optimistic verdict — there is no real problem to solve.
  const decision = premiseBroken ? 'avoid' : (judge.decision || scout.verdictType || 'warning');
  // Only surface the premise note when the problem genuinely barely exists for
  // this industry. When the premise is realistic, the model sometimes fills it
  // with a verdict-like sentence that just duplicates the verdict below — so
  // suppress it to avoid showing the same point twice.
  const premiseNote = (scout.premiseFit === 'weak' || scout.premiseFit === 'nonexistent')
    ? shortText(scout.premiseNote, 240)
    : '';
  // Web-search answers come back peppered with <cite index="…"> markup. Strip it
  // from every user-facing string HERE so it can never leak into the validation
  // screen or the blueprint (which renders these same comp fields).
  const cleanPlayers = (Array.isArray(scout.players) ? scout.players : []).map((p) => ({
    ...p,
    name: stripCitationNoise(p?.name),
    targetCustomer: stripCitationNoise(p?.targetCustomer),
    pricing: stripCitationNoise(p?.pricing),
    coverage: stripCitationNoise(p?.coverage),
    weakness: stripCitationNoise(p?.weakness),
  }));
  return {
    ...scout,
    marketSize: stripCitationNoise(scout.marketSize),
    landscape: stripCitationNoise(scout.landscape),
    players: cleanPlayers,
    score: premiseBroken ? Math.min(evalResult?.scores?.overall ?? 30, 35) : (evalResult?.scores?.overall || null),
    verdictType: decision,
    verdict: stripCitationNoise(scout.verdict),
    premiseFit: scout.premiseFit,
    premiseNote,
    // The UI renders premiseNote separately above the verdict, so it is left
    // out here to avoid showing the same sentence twice.
    verdictReasoning: stripCitationNoise(`${judge.reasoning} ${scout.verdictReasoning || ''}`.trim()),
    plainSummary: shortText(scout.plainSummary, 480),
    gap: stripCitationNoise(judge.wedge || scout.gap),
    moat: stripCitationNoise(judge.defensibility),
    skeptic,
    judge,
    eval: evalResult,
    retrieval,
    validationId,
    agentDesc,
  };
}

export async function POST(request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

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
  // Truncate user-supplied input to prevent prompt injection via oversized payloads
  const sanitised = freeformIdea ? String(freeformIdea).slice(0, 500) : null;
  const agentDesc = sanitised || `an agent that ${action} ${workflow} ${connector} ${industry}`;
  // Plain phrases used to make the live research log specific to THIS idea.
  const sector = (stripCitationNoise(industry) || 'this market').toLowerCase();
  const job = (stripCitationNoise(workflow) || 'this workflow').toLowerCase();

  // Stream the real pipeline as it runs (NDJSON: one JSON object per line). The
  // client renders these as a live "research log" so the wait shows the actual
  // scout → skeptic → judge → score work instead of a fake progress bar. The
  // final `result` line carries the finished comp.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`)); } catch {}
      };
      try {
        send({ t: 'stage', key: 'retrieval', label: `Framing the idea for ${sector}…` });
        const retrieval = await buildRetrievalContext({ modeName, industry, action, workflow });

        send({ t: 'stage', key: 'scout', label: `Scanning ${sector} for tools that already do this…` });
        const scoutCall = await call(scoutPrompt(agentDesc, modeName, retrieval), { webSearch: true, maxTokens: 2200 });
        const scoutParsed = await parseJSON(scoutCall.text, 'validation scout');
        const scout = scoutParsed.value;
        const players = (Array.isArray(scout.players) ? scout.players : [])
          .map((p) => stripCitationNoise(p?.name)).filter(Boolean).slice(0, 4);
        send({
          t: 'stage', key: 'scout', status: 'done',
          label: players.length ? `Found ${players.length} player${players.length > 1 ? 's' : ''} already in this space` : 'Mapped the competitive landscape',
          items: players,
        });

        send({ t: 'stage', key: 'skeptic', label: `Pressure-testing whether ${job} is a real, painful problem…` });
        const skepticCall = await call(skepticPrompt(agentDesc, retrieval, scout), { maxTokens: 1000 });
        const skepticParsed = await parseJSON(skepticCall.text, 'validation skeptic');
        const skeptic = skepticParsed.value;
        const riskN = (Array.isArray(skeptic.fatalRisks) ? skeptic.fatalRisks : []).length;
        send({
          t: 'stage', key: 'skeptic', status: 'done',
          label: riskN ? `Flagged ${riskN} risk${riskN > 1 ? 's' : ''} that could sink it` : 'Stress-tested the premise',
        });

        send({ t: 'stage', key: 'judge', label: 'Weighing the opportunity against the risks…' });
        const judgeCall = await call(judgePrompt(agentDesc, retrieval, scout, skeptic, retrieval.learning), { maxTokens: 1200 });
        const judgeParsed = await parseJSON(judgeCall.text, 'validation judge');
        const judge = judgeParsed.value;
        const decisionWord = (judge.decision || scout.verdictType || '').toString().toLowerCase();
        send({
          t: 'stage', key: 'judge', status: 'done',
          label: decisionWord ? `Verdict forming: ${decisionWord}` : 'Reconciled the verdict',
        });

        send({ t: 'stage', key: 'eval', label: 'Scoring the idea out of 100…' });
        const evalCall = await call(evalPrompt(agentDesc, scout, skeptic, judge), { maxTokens: 700 });
        const evalParsed = await parseJSON(evalCall.text, 'validation eval');
        const evalResult = evalParsed.value;

        const usage = mergeUsage(
          scoutCall.usage, scoutParsed.usage,
          skepticCall.usage, skepticParsed.usage,
          judgeCall.usage, judgeParsed.usage,
          evalCall.usage, evalParsed.usage,
        );
        const costUsd = calcCost(usage.input_tokens, usage.output_tokens);

        const validationRow = await recordValidation({
          sessionId, modeName, action, workflow, industry, agentDesc,
          retrieval, scout, skeptic, judge, eval: evalResult,
          verdictType: judge.decision || scout.verdictType || 'warning',
          usage, costUsd,
        });

        const comp = buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationRow.id);

        send({ t: 'stage', key: 'eval', status: 'done', label: 'Putting your report together…' });
        send({
          t: 'result',
          sessionId,
          comp,
          cost: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cost_usd: costUsd },
        });
      } catch (err) {
        console.error('[validate]', err?.message);
        send({ t: 'error', error: 'Market check failed. Please try again.' });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
