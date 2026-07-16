import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/health — lightweight liveness + Supabase connectivity check.
 * Use for uptime monitors (UptimeRobot, Better Uptime, etc.).
 *
 * 200 = process alive AND Supabase reachable.
 * 503 = process alive but DB unreachable — page-worthy.
 */
export const dynamic = 'force-dynamic';

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, reason: 'not_configured' };
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const start = Date.now();
    const { error } = await sb.from('web_vitals').select('id', { head: true, count: 'exact' }).limit(1);
    const ms = Date.now() - start;
    if (error) return { ok: false, reason: error.message, ms };
    return { ok: true, ms };
  } catch (err) {
    return { ok: false, reason: err?.message || 'unknown' };
  }
}

export async function GET() {
  const db = await checkSupabase();
  const payload = {
    ok: db.ok,
    service: 'ideareels',
    commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || null,
    db,
    ts: new Date().toISOString(),
  };
  return Response.json(payload, { status: db.ok ? 200 : 503 });
}
