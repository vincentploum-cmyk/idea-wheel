import { createClient } from '@supabase/supabase-js';

/**
 * Central error/incident log. Every server-side unhandled exception,
 * every deliberate `logError()`, and unhandled client errors (via
 * app/global-error.js + /api/errors) land in the `error_events` table.
 *
 * SAFE TO CALL ANYWHERE — no-ops silently when SERVICE_ROLE_KEY is
 * missing. Never throws.
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

function truncate(s, n) {
  if (typeof s !== 'string') return null;
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function commitSha() {
  return (process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_COMMIT_SHA || '').slice(0, 12) || null;
}

/**
 * @param {Object} opts
 * @param {string} opts.scope - e.g. 'api:build', 'client:global'
 * @param {Error|string} [opts.error] - Error object or message string
 * @param {'error'|'warning'|'info'} [opts.severity]
 * @param {string} [opts.userId]
 * @param {string} [opts.route]
 * @param {string} [opts.requestId]
 * @param {Object} [opts.meta] - Any extra JSON-serializable context
 */
export async function logError(opts = {}) {
  const {
    scope = 'unknown',
    error,
    severity = 'error',
    userId = null,
    route = null,
    requestId = null,
    meta = {},
  } = opts;

  const message = typeof error === 'string'
    ? error
    : (error?.message || 'Unknown error');
  const stack = error?.stack || null;

  // Always mirror to stderr — Render captures container logs even without Supabase.
  const tag = `[${severity}][${scope}]`;
  if (severity === 'error') {
    console.error(tag, message, stack || '');
  } else if (severity === 'warning') {
    console.warn(tag, message);
  } else {
    console.log(tag, message);
  }

  const sb = client();
  if (!sb) return; // no service key → console-only, done.

  try {
    await sb.from('error_events').insert({
      scope: truncate(scope, 200),
      severity,
      message: truncate(message, 2000) || 'Unknown error',
      stack: truncate(stack, 8000),
      user_id: userId,
      request_id: requestId,
      route: truncate(route, 200),
      meta: meta && typeof meta === 'object' ? meta : {},
      commit_sha: commitSha(),
    });
  } catch (writeErr) {
    // Deliberately swallow — logError must NEVER be the reason a request fails.
    console.error('[error-log] failed to persist:', writeErr?.message);
  }
}

/**
 * Wrap a Next.js API route handler so any uncaught throw is logged and returns 500.
 * Use sparingly — many routes already have granular try/catch. This is for the ones
 * that don't.
 */
export function withErrorLog(scope, handler) {
  return async function wrapped(request, ctx) {
    try {
      return await handler(request, ctx);
    } catch (err) {
      await logError({ scope, error: err, route: new URL(request.url).pathname });
      return Response.json({ error: 'internal_error' }, { status: 500 });
    }
  };
}
