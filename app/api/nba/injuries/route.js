import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, loadOverrides, setOverride } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The admin's word over PropFinder's injury report for a slate (lib/picks/injuries.js applyOverrides):
// GET ?date= lists the overrides; POST ?date= with { team, key, status: 'Active' | 'Out' | null, detail, name }
// marks a player playing or out by hand (null clears it). The board, the shuffle and the card read the
// pull through the overrides at once.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const date = new URL(request.url).searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  const slate = await resolveSlate({ date });
  return Response.json({ date: slate.date, ...(await loadOverrides(slate)) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const date = new URL(request.url).searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad body' }, { status: 400 }); }
  const team = String(body?.team || '').toUpperCase().slice(0, 5);
  const key = String(body?.key || '').slice(0, 80);
  const status = body?.status == null || body.status === '' ? null : String(body.status).slice(0, 20);
  if (!team || !key) return Response.json({ error: 'team and key are required' }, { status: 400 });
  if (status && !['Active', 'Out'].includes(status)) return Response.json({ error: 'status must be Active, Out or null' }, { status: 400 });
  try {
    const slate = await resolveSlate({ date });
    const saved = await setOverride(slate, { team, key, status, detail: body?.detail ? String(body.detail).slice(0, 120) : null, name: body?.name ? String(body.name).slice(0, 80) : null });
    return Response.json({ ok: true, date: slate.date, ...saved }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nba] injury override failed:', err);
    return Response.json({ error: 'override_failed', detail: err.message }, { status: 500 });
  }
}
