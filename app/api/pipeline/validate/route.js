import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildRetrievalContext } from '../../../../lib/moat-retrieval';
import { ensureSessionId, recordValidation } from '../../../../lib/moat-store';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { classifyIdeaRisk, safetyNoticeFor } from '../../../../lib/idea-safety';
import { recordCandidate, getCachedCandidate } from '../../../../lib/idea-candidates';
import { computeDeterministicScore, legacyDimensions } from '../../../../lib/scoring';
import { verifySources, summarizeSources } from '../../../../lib/source-verify';

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

// Rate limit: max 10 validations per user per minute (durable, cross-instance —
// see lib/rate-limit.js).
const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

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
  const citations = [];
  if (webSearch) {
    const parts = (data.output || [])
      .filter(o => o.type === 'message')
      .flatMap(o => o.content || [])
      .filter(c => c.type === 'output_text');
    text = parts.map(c => c.text).join('');
    // Capture the REAL source URLs the search returned (url_citation annotations).
    // These are retrieved, not model-invented — the basis for verified sourcing.
    const seen = new Set();
    for (const part of parts) {
      for (const ann of (part.annotations || [])) {
        if (ann?.type === 'url_citation' && ann.url && !seen.has(ann.url)) {
          seen.add(ann.url);
          citations.push({ url: ann.url, title: String(ann.title || '').slice(0, 160) });
        }
      }
    }
  } else {
    text = data.choices?.[0]?.message?.content || '';
  }

  const usage = {
    input_tokens: data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0,
  };
  return { text, usage, citations };
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
  "marketSize": "a CONCRETE number with its basis — a dollar figure with year/trend if you can find one (e.g. '$1.2B in 2024, growing ~8%/yr'), OR a specific count of the buyers (e.g. 'about 30,000 US marketing agencies'). Never write 'figures not available' — always give a real number or a concrete proxy count.",
  "marketSizeSource": "the exact URL of the page this market-size figure came from — a real URL you saw in search. Omit this field if the number is your own estimate rather than from a specific source.",
  "landscape": "2-3 crisp, easy-to-read sentences summarizing the state of this market",
  "players": [{"name":"...","sourceUrl":"the real official product URL you actually saw in search — omit this field entirely if you are not certain it exists; never invent a URL","targetCustomer":"...","pricing":"...","coverage":"one plain sentence on how this player addresses (or ignores) THIS exact idea","weakness":"the SPECIFIC thing a new product could beat them on for THIS exact workflow — concrete and different for each player. Never a generic 'can be pricey' or 'complex for small teams'."}],
  "gap": "the specific unaddressed pain, named concretely (which task, which buyer), or 'No clear gap' if the market is well-served",
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
List up to 5 players, SORTED from largest/most-established to smallest. Name only REAL products you can verify from search — prefer well-known established platforms in this space over obscure names. If you are not confident a product exists, leave it out rather than guessing; do not pad the list with invented or unverifiable companies. If premiseFit is "nonexistent", you MUST set verdictType to "avoid". Default to avoid when in doubt. CRITICAL SCOPE CHECK: this product must be SOFTWARE sold to others, not a business to operate.

WRITING RULES (apply to marketSize, landscape, gap, verdict, verdictReasoning, premiseNote, plainSummary and every player "coverage"/"weakness"):
- Write at an 8th-grade reading level. Short, everyday words. Short sentences (aim under 18 words each).
- Each sentence must stand alone as its own clear point — these render as bullet points, so do not run ideas together with semicolons or long clauses.
- Ban these words and their cousins: "tier-1", "incumbent", "commoditized", "whitespace", "wedge" (in scout fields), "synergy", "leverage", "robust", "holistic", "ecosystem", "vertical", "horizontal", "TAM", "GTM", "B2B SaaS". If you need one of these ideas, say it in plain words (e.g. "the big players already do this", "no real opening", "an underserved group").
- Explain any company or acronym in plain terms the first time (e.g. "AppFolio (property-management software)").
- marketSize MUST contain a real number — a market value (with a year) or a count of the buyers. If no published figure exists, estimate the number of buyers and label it an estimate. Never "not readily available", "unknown", or "hard to size".
- Each competitor "weakness" must be specific to THIS idea and different from the others — name the exact task or buyer they under-serve, not a generic complaint.
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
  return `You are a benchmark evaluator for IdeaWheel. Do NOT invent an overall score — that is computed downstream. Your job is to EXTRACT evidence into fixed-weight components and to flag hard gates. Be strict: award points only for what the scout/skeptic/judge actually support. When evidence is thin, score low.

Idea: "${agentDesc}"
SCOUT: ${JSON.stringify(compactScout(scout))}
SKEPTIC: ${JSON.stringify(compactSkeptic(skeptic))}
JUDGE: ${JSON.stringify(compactJudge(judge))}

Return ONLY JSON:
{
  "components": {
    "evidenceStrength": 0,       // 0-20: how real/verifiable is the demand evidence (named products, quotes, figures)?
    "painFrequency": 0,          // 0-15: how often and how badly does this pain bite the buyer?
    "willingnessToPay": 0,       // 0-15: is there evidence anyone will actually pay (existing budgets/tools)?
    "marketSpecificity": 0,      // 0-10: is the buyer/user specific and named (not "everyone")?
    "competitiveOpening": 0,     // 0-15: is there a genuine gap the incumbents leave open?
    "customerReachability": 0,   // 0-10: can a founder realistically get in front of these buyers?
    "retention": 0,              // 0-10: repeat use / staying power once adopted?
    "feasibility": 0             // 0-5: build + regulatory feasibility for a small team
  },
  "gates": {
    "insufficientEvidence": false,      // true if there is no real evidence of demand
    "noIdentifiableBuyer": false,       // true if no specific person/role would buy or use it
    "illegalOrExploitative": false,     // true if the concept is illegal or exploitative
    "fabricatedOrContradictory": false  // true if the findings are made up or contradict each other
  },
  "shipReady": true,
  "failReasons": ["only if something is weak"],
  "improvementBrief": "one paragraph for the downstream build pipeline"
}
Each component is an integer within its stated range. Do not exceed the max for any component.`;
}

function buildFinalComp(agentDesc, scout, skeptic, judge, evalResult, retrieval, validationId) {
  const premiseBroken = scout.premiseFit === 'nonexistent';
  const det = evalResult?.deterministic || null;
  // A premise mismatch (e.g. equipment maintenance for a law firm) OR a hard
  // rubric gate (no evidence, no buyer, illegal, fabricated) overrides any
  // optimistic verdict — there is no viable idea to advance.
  const decision = (premiseBroken || det?.gated) ? 'avoid' : (judge.decision || scout.verdictType || 'warning');
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
    sourceUrl: (typeof p?.sourceUrl === 'string' && /^https?:\/\//.test(p.sourceUrl)) ? p.sourceUrl : '',
  }));
  return {
    ...scout,
    marketSize: stripCitationNoise(scout.marketSize),
    landscape: stripCitationNoise(scout.landscape),
    players: cleanPlayers,
    score: premiseBroken ? Math.min(evalResult?.scores?.overall ?? 30, 35) : (evalResult?.scores?.overall ?? null),
    scoreBreakdown: det?.breakdown || null,
    scoreGates: det?.gatesTriggered || [],
    scoreVersion: det?.rubricVersion || null,
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
  if (!(await checkRateLimit(`validate:${user.id}`, RATE_LIMIT))) {
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
        // Cache short-circuit: if this exact canonical idea (workflow+industry,
        // action folded into copy) was already validated under the current score
        // version and is still fresh, reuse it and skip the paid pipeline. Only
        // for structured combos — a freeform idea has no canonical key.
        if (!sanitised && action && workflow && industry) {
          const cached = await getCachedCandidate(modeName, workflow, industry);
          if (cached?.comp) {
            send({ t: 'stage', key: 'retrieval', label: `Found a recent market check for this exact idea — reusing it…` });
            send({ t: 'stage', key: 'eval', status: 'done', label: 'Putting your report together…' });
            // Bump popularity; no re-score (same version, same result).
            recordCandidate({
              mode: modeName, action, workflow, industry,
              score: cached.comp.score, safetyLevel: cached.comp.safety?.level || 'standard',
              title: cached.comp.title, summary: cached.comp.plainSummary || cached.comp.verdict, gap: cached.comp.gap,
              comp: cached.comp, agentDesc: cached.comp.agentDesc,
            }).catch(() => {});
            send({ t: 'result', sessionId, comp: cached.comp, cached: true, cost: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } });
            return;
          }
        }

        send({ t: 'stage', key: 'retrieval', label: `Framing the idea for ${sector}…` });
        const retrieval = await buildRetrievalContext({ modeName, industry, action, workflow });

        send({ t: 'stage', key: 'scout', label: `Scanning ${sector} for tools that already do this…` });
        const scoutCall = await call(scoutPrompt(agentDesc, modeName, retrieval), { webSearch: true, maxTokens: 2200 });
        const scoutParsed = await parseJSON(scoutCall.text, 'validation scout');
        const scout = scoutParsed.value;
        // Verify every real URL — search citations, each competitor's own page, and
        // the market-size source — by actually fetching them. A link that doesn't
        // resolve is marked unverified in code, not taken on the model's word.
        // Never blocks the run.
        let sources = [];
        let verifiedMap = new Map();
        try {
          const isUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);
          const playersArr = Array.isArray(scout.players) ? scout.players : [];
          const extraUrls = [scout.marketSizeSource, ...playersArr.map((p) => p?.sourceUrl)]
            .filter(isUrl).map((url) => ({ url, title: '' }));
          const verified = await verifySources([...(scoutCall.citations || []), ...extraUrls], { limit: 16, timeoutMs: 4000 });
          verifiedMap = new Map(verified.map((s) => [s.url, s.verified]));
          // Real sources for the Sources section = the search citations that resolved.
          const citationUrls = new Set((scoutCall.citations || []).map((c) => c.url));
          sources = verified.filter((s) => citationUrls.has(s.url));
          // Mark each competitor: verified only if its own page actually resolves.
          for (const p of playersArr) {
            if (p && typeof p === 'object') p.sourceVerified = isUrl(p.sourceUrl) ? !!verifiedMap.get(p.sourceUrl) : false;
          }
        } catch {}
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

        // Deterministic overall: the model extracted components; the score is
        // computed here so it is reproducible and the hard gates are enforced
        // in code, not left to the model's discretion.
        const det = computeDeterministicScore(evalResult.components, evalResult.gates);
        evalResult.deterministic = det;
        // Overwrite scores with the code-derived overall + legacy dimensions the
        // adaptive generator reads (getOverallScore / dimensionLift).
        evalResult.scores = { ...legacyDimensions(det.breakdown), overall: det.overall };

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
        comp.sources = sources;
        comp.sourceSummary = summarizeSources(sources);
        // Bind the market-size number to its source: keep the link only if it
        // actually resolves, else flag the figure as an unverified estimate.
        comp.marketSizeVerified = scout.marketSizeSource ? !!verifiedMap.get(scout.marketSizeSource) : false;
        comp.marketSizeSource = comp.marketSizeVerified ? scout.marketSizeSource : '';

        // Safety runs on a separate axis from the score — a strong market read
        // never clears a clinical/health-sensitive concern. Attach the notice so
        // the validation screen and the blueprint surface it.
        const safety = classifyIdeaRisk({ action, workflow, industry, freeformIdea: sanitised, modeName });
        if (safety.level !== 'standard') {
          comp.safety = { level: safety.level, reasons: safety.reasons, notice: safetyNoticeFor(safety.level) };
        }

        // Feed the canonical pre-scored pool (Option C). Only structured combos
        // qualify — a freeform idea has no canonical workflow/industry to key on.
        // Fire-and-forget so a pool write never blocks or fails the response.
        if (action && workflow && industry) {
          recordCandidate({
            mode: modeName, action, workflow, industry,
            score: comp.score, safetyLevel: safety.level,
            title: comp.title, summary: comp.plainSummary || comp.verdict, gap: comp.gap,
            comp, agentDesc,
          }).catch(() => {});
        }

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
