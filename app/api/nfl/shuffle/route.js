import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveWeek, shuffleFor } from '@/lib/nfl/store';
import { SHUFFLE_MARKETS } from '@/lib/nfl/picks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The shuffle for a week and market: ?season&week[&type]&market=rec_yds (or ?date) → every player
// in the week read at every height of the bar (lib/picks/shuffle.js).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const market = url.searchParams.get('market') || SHUFFLE_MARKETS[0].market;
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  if (!SHUFFLE_MARKETS.some((m) => m.market === market)) return Response.json({ error: 'bad market', markets: SHUFFLE_MARKETS.map((m) => m.market) }, { status: 400 });
  try {
    const wk = await resolveWeek({ date: date || undefined, season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
    const out = await shuffleFor(wk, market);
    if (!out) return Response.json({ error: 'no_shuffle' }, { status: 404 });
    return Response.json({ ...wk, ...out }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nfl] shuffle failed:', err);
    return Response.json({ error: 'shuffle_failed', detail: err.message }, { status: 500 });
  }
}
