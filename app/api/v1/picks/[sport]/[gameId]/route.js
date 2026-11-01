import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { gamePayload, filtersOf } from '@/lib/picks/v1';
import * as nba from '@/lib/nba/store';
import * as nfl from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const STORES = { nba, nfl };

/**
 * GET /api/v1/picks/{nba|nfl}/{gameId}?date=YYYY-MM-DD[&minEv&maxJuice&minChance] (the NFL also ?season&week&type):
 * one game's tables with the value of every row, the marginal rows beside them, both sides' players with their
 * ranges and ladders (lib/picks/v1.js). Admin session or the sync token; cached a minute.
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
    const payload = gamePayload({ ...board, sport }, params.gameId, { filters: filtersOf(url.searchParams) });
    if (!payload) return Response.json({ error: 'no such game', games: (board.games || []).map((g) => ({ id: g.id, matchup: `${g.away} @ ${g.home}` })) }, { status: 404 });
    return Response.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (err) {
    console.error(`[v1] picks ${sport} failed:`, err);
    return Response.json({ error: 'picks_failed', detail: err.message }, { status: 500 });
  }
}
