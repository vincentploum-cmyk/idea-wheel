/**
 * Single source of truth for which OpenAI models and tools this service calls,
 * plus a classifier that turns an upstream failure into something actionable.
 *
 * WHY THIS EXISTS
 * The model id used to be hardcoded in seven places (validate, build,
 * deep-research, clarity, the opportunity-scan cron, seed-catalog, the audit
 * script). When OpenAI retires a model, every AI feature dies at once and the
 * only fix is a code change plus a deploy. Here the ids are env-overridable, so
 * a retirement is a Render env var edit and a restart.
 *
 * Nothing in here performs I/O — it is pure config + string classification, so
 * it is cheap to unit-test and safe to import anywhere.
 */

/**
 * Model tiers, not model names. Call sites ask for the tier they need; which
 * concrete model backs a tier is an operational decision.
 *
 *   OPENAI_MODEL_FAST — high-volume, cheap: scouting, sweeps, repairs, clarity
 *   OPENAI_MODEL_DEEP — the paid deliverables: design, GTM, builder
 */
export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST || 'gpt-4o-mini',
  deep: process.env.OPENAI_MODEL_DEEP || 'gpt-4o',
};

/** Per-1M-token USD rates for models we know. Used for internal cost telemetry. */
const KNOWN_PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
};

/**
 * Pricing for a model. An overridden model won't be in the table; fall back to
 * the most expensive known rate so cost telemetry over-reports rather than
 * under-reports. Users are charged flat credits, so this only affects our own
 * accounting — never a customer's bill.
 */
export function pricingFor(model) {
  return KNOWN_PRICING[model] || KNOWN_PRICING['gpt-4o'];
}

/**
 * Web-search tool names to try, in order.
 *
 * `web_search_preview` is the legacy name this codebase has always shipped;
 * `web_search` is the current one OpenAI recommends for new integrations.
 *
 * ORDER IS DELIBERATE, and it is the conservative choice rather than the modern
 * one. The fallback below only triggers on a clean "tool not supported" 400, so
 * leading with a name this account has never been observed to use could
 * introduce a NEW failure (different tier requirements, different annotation
 * shape) while trying to fix an unrelated one. Leading with the name already in
 * production means: behaviour is unchanged if the preview tool still works, and
 * the pipeline self-heals to `web_search` the moment it stops working.
 *
 * The cost of that safety is one wasted round trip per call in the
 * preview-is-dead case. Once `scripts/openai-doctor.mjs` confirms `web_search`
 * works on this account, set OPENAI_WEB_SEARCH_TOOL=web_search to pin it and
 * drop the probing — that is the intended path off the deprecated alias.
 */
export const WEB_SEARCH_TOOL_TYPES = process.env.OPENAI_WEB_SEARCH_TOOL
  ? [process.env.OPENAI_WEB_SEARCH_TOOL]
  : ['web_search_preview', 'web_search'];

/**
 * Classify an OpenAI failure.
 *
 * The point is to separate "wait and retry" from "retrying will never help".
 * The old code retried every 429 twice with 8s and 16s backoffs — including
 * `insufficient_quota`, which is a billing state, not congestion. That burned
 * 24 seconds per request to arrive at the same failure.
 *
 * @param {number} status  HTTP status from the OpenAI response
 * @param {string} body    Raw response body
 * @returns {{kind: string, retryable: boolean, operator: string, user: string}}
 */
export function classifyOpenAiError(status, body) {
  const text = String(body || '');
  const lower = text.toLowerCase();

  let code = '';
  try {
    code = String(JSON.parse(text)?.error?.code || '').toLowerCase();
  } catch {
    /* body isn't JSON — fall back to substring matching below */
  }

  const says = (...needles) => needles.some((n) => lower.includes(n) || code === n);

  if (status === 401 || says('invalid_api_key', 'incorrect api key')) {
    return {
      kind: 'invalid_api_key',
      retryable: false,
      operator: 'OPENAI_API_KEY is rejected by OpenAI. Rotate the key in the Render dashboard.',
      user: 'Our AI is temporarily unavailable. Please try again shortly.',
    };
  }

  if (says('insufficient_quota', 'exceeded your current quota', 'billing_hard_limit_reached', 'billing_not_active')) {
    return {
      kind: 'insufficient_quota',
      retryable: false,
      operator: 'OpenAI account is out of quota or credit. Top up billing — no code change will fix this.',
      user: 'Our AI is temporarily unavailable. Please try again shortly.',
    };
  }

  if (status === 404 || says('model_not_found', 'does not exist', 'has been deprecated', 'do not have access to the model')) {
    return {
      kind: 'model_not_found',
      retryable: false,
      operator: `The requested model was rejected. Set OPENAI_MODEL_FAST / OPENAI_MODEL_DEEP to a current model. Response: ${text.slice(0, 300)}`,
      user: 'Our AI is temporarily unavailable. Please try again shortly.',
    };
  }

  // A rejected tool name looks like an ordinary 400, so match on the tool
  // vocabulary rather than the status.
  if (status === 400 && says('web_search', 'unsupported tool', 'unknown tool', 'invalid tool')) {
    return {
      kind: 'tool_unsupported',
      retryable: false,
      operator: `The web-search tool name was rejected. Pin OPENAI_WEB_SEARCH_TOOL to a supported value. Response: ${text.slice(0, 300)}`,
      user: 'Our AI is temporarily unavailable. Please try again shortly.',
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limited',
      retryable: true,
      operator: 'Rate limited by OpenAI. Transient — backoff applies.',
      user: 'Our AI is busy right now. Please try again in a minute.',
    };
  }

  if (status >= 500) {
    return {
      kind: 'server_error',
      retryable: true,
      operator: `OpenAI returned ${status}. Upstream incident — check status.openai.com.`,
      user: 'Our AI is having a moment. Please try again in a minute.',
    };
  }

  return {
    kind: 'unknown',
    retryable: false,
    operator: `Unhandled OpenAI ${status}: ${text.slice(0, 300)}`,
    user: 'Market check failed. Please try again.',
  };
}

/** True when the failure means "this tool name is not accepted" — retry under the next name. */
export function isToolNameRejected(status, body) {
  return classifyOpenAiError(status, body).kind === 'tool_unsupported';
}

/**
 * Build the error thrown on an unrecoverable upstream failure. The message
 * keeps the raw status and body (it lands in error_events, operators only) and
 * carries the classification as properties so callers can branch without
 * re-parsing strings.
 */
export function openAiError(status, body) {
  const info = classifyOpenAiError(status, body);
  const err = new Error(`OpenAI ${status} [${info.kind}]: ${String(body || '').slice(0, 500)}`);
  err.openai = info;
  err.status = status;
  return err;
}
