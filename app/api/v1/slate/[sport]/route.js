import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { slatePayload, filtersOf } from '@/lib/picks/v1';
import * as nba from '@/lib/nba/store';
import * as nfl from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const STORES = { nba, nfl };

/**
 * GET /api/v1/slate/{nba|nfl}?date=YYYY-MM-DD[&minEv=0.05&maxJuice=-200&minChance=&sort=ev|matchup|chance&marginal=1]
 * (the NFL also ?season&week&type): the games by Matchup Score and every play passing the floors, pre-ranked
 * (lib/picks/v1.js). Admin session or the sync token; cached a minute.
 */
export async function GET(request, { params }) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const sport = String(params?.sport || '').toLowerCase();
  const store = STORES[sport];
  if (!store) return Response.json({ error: 'unknown sport', sports: Object.keys(STORES) }, { status: 404 });
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const slate = sport === 'nfl'
      ? await store.resolveWeek({ date: date || undefined, season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') })
      : await store.resolveSlate({ date });
    const board = await store.boardFor(slate, { refresh: url.searchParams.get('refresh') !== '0' });
    const payload = slatePayload({ ...board, sport }, { filters: filtersOf(url.searchParams), marginal: url.searchParams.get('marginal') === '1' });
    return Response.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    console.error(`[v1] slate ${sport} failed:`, err);
    return Response.json({ error: 'slate_failed', detail: err.message }, { status: 500 });
  }
}
