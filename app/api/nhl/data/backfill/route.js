import { ingestGames, ingestLineups } from '@/lib/nhl-data/ingest';
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
    const [games, lineups] = await Promise.all([ingestGames(date), ingestLineups(date).catch((e) => ({ error: e.message }))]);
    return Response.json({ ok: true, result: { ...games, lineups } });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
