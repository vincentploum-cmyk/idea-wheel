import { ingestGames, ingestLineups } from '@/lib/nhl-data/ingest';
import { ingestPreseason } from '@/lib/nhl-data/preseason';
import { authorize, DATE_RE } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Admin-only: ingest one past date. The UI walks a date range one call at a time.
export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const date = new URL(request.url).searchParams.get('date');
  if (!DATE_RE.test(date || '')) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    if (new URL(request.url).searchParams.get('preseason') === '1') {
      return Response.json({ ok: true, result: await ingestPreseason(date) });
    }
    const force = new URL(request.url).searchParams.get('force') === '1';
    // lineups=0 skips the NHL.com preview lookup (old dates have none; a season backfill is much faster without it).
    const skipLineups = force || new URL(request.url).searchParams.get('lineups') === '0';
    const [games, lineups] = await Promise.all([ingestGames(date, { force }), skipLineups ? null : ingestLineups(date).catch((e) => ({ error: e.message }))]);
    return Response.json({ ok: true, result: { ...games, lineups } });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
