import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/errors — recent error_events, newest first.
 * Bearer <SEED_SECRET> auth (reused so no new env var).
 *
 * Query params:
 *   ?hours=24     — window (default 24, max 168)
 *   ?scope=api:build   — filter to one scope
 *   ?limit=200    — page size (default 100, max 500)
 */

export const dynamic = 'force-dynamic';

const SECRET = process.env.SEED_SECRET;

function auth(request) {
  if (!SECRET) return { ok: false, reason: 'admin_not_configured' };
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${SECRET}`;
  return { ok: header === expected, reason: header ? 'bad_token' : 'missing_token' };
}

export async function GET(request) {
  const a = auth(request);
  if (!a.ok) return Response.json({ error: a.reason }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'db_not_configured' }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const hours = Math.min(168, Math.max(1, parseInt(params.get('hours') || '24', 10)));
  const scope = params.get('scope') || null;
  const limit = Math.min(500, Math.max(1, parseInt(params.get('limit') || '100', 10)));
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let q = sb.from('error_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
  if (scope) q = q.eq('scope', scope);
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Summary counts by scope
  const { data: counts } = await sb
    .from('error_events')
    .select('scope', { count: 'exact' })
    .gte('created_at', since);
  const byScope = {};
  for (const row of counts || []) byScope[row.scope] = (byScope[row.scope] || 0) + 1;

  return Response.json({
    windowHours: hours,
    since,
    total: data?.length || 0,
    byScope,
    events: data || [],
  });
}
