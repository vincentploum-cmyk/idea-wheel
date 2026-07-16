import { createClient } from '@supabase/supabase-js';

/**
 * Pipeline-stage timing. Wrap a stage in `await timed('stage_name', () => ...)`
 * and get durations logged for later p50/p95 aggregation.
 *
 * SAFE: never throws, never blocks; DB write is fire-and-forget after the value
 * returns (or after the error is rethrown).
 */

let cached = null;
function client() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}

function commitSha() {
  return (process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_COMMIT_SHA || '').slice(0, 12) || null;
}

async function record(stage, ms, status, ctx) {
  const sb = client();
  if (!sb) return;
  try {
    await sb.from('pipeline_stage_timings').insert({
      stage,
      duration_ms: Math.max(0, Math.round(ms)),
      status,
      user_id: ctx?.userId || null,
      session_id: ctx?.sessionId || null,
      commit_sha: commitSha(),
      meta: ctx?.meta && typeof ctx.meta === 'object' ? ctx.meta : {},
    });
  } catch {
    // silent — measurement must never break the request
  }
}

/**
 * Time an async function and record the result.
 * @template T
 * @param {string} stage
 * @param {() => Promise<T>} fn
 * @param {{userId?: string, sessionId?: string, meta?: object}} [ctx]
 * @returns {Promise<T>}
 */
export async function timed(stage, fn, ctx = {}) {
  const start = Date.now();
  try {
    const result = await fn();
    // don't await — return the caller's value immediately
    record(stage, Date.now() - start, 'ok', ctx);
    return result;
  } catch (err) {
    record(stage, Date.now() - start, 'error', {
      ...ctx,
      meta: { ...(ctx.meta || {}), errorMessage: err?.message?.slice(0, 200) },
    });
    throw err;
  }
}

/**
 * Manual start/stop when you can't wrap in a callback (streaming stages).
 * Usage:
 *   const t = markStart('validate');
 *   ... work ...
 *   markEnd(t, { userId, sessionId });
 */
export function markStart(stage) {
  return { stage, start: Date.now() };
}
export function markEnd(mark, ctx = {}, status = 'ok') {
  if (!mark || typeof mark.start !== 'number') return;
  record(mark.stage, Date.now() - mark.start, status, ctx);
}

/**
 * Percentile helper — pure, used by /api/admin/metrics.
 */
export function percentile(sortedNumbers, p) {
  if (!sortedNumbers.length) return null;
  const clamped = Math.max(0, Math.min(1, p));
  const idx = Math.min(sortedNumbers.length - 1, Math.floor(clamped * sortedNumbers.length));
  return sortedNumbers[idx];
}
