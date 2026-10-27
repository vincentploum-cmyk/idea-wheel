import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, shuffleFor } from '@/lib/nba/store';
import { SHUFFLE_MARKETS } from '@/lib/nba/picks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The shuffle for a date and market: ?date=YYYY-MM-DD&market=pts → every player on the slate read
// at every height of the bar (lib/picks/shuffle.js). One request per market; the panel moves the bar locally.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const market = url.searchParams.get('market') || SHUFFLE_MARKETS[0].market;
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  if (!SHUFFLE_MARKETS.some((m) => m.market === market)) return Response.json({ error: 'bad market', markets: SHUFFLE_MARKETS.map((m) => m.market) }, { status: 400 });
  try {
    const slate = await resolveSlate({ date });
    const out = await shuffleFor(slate, market);
    if (!out) return Response.json({ error: 'no_shuffle' }, { status: 404 });
    return Response.json({ date: slate.date, ...out }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] shuffle failed:', err);
    return Response.json({ error: 'shuffle_failed', detail: err.message }, { status: 500 });
  }
}
