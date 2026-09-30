import { authorize } from '@/lib/nhl-data/util';
import { loadPropfinder, skatersWithIds, SKATER_TABLES } from '@/lib/nhl-data/propfinder';
import { loadPlayers } from '@/lib/nhl-data/rosters';
import { SKATER_COLS, TEAM_COLS } from '@/lib/nhl-data/propfinder-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: PropFinder season stats — skater per-game rates (with NHL ids), team
// stats (for) and opponent stats (against) with PropFinder's league ranks, from
// the newest imported (or bundled) exports.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const [{ teams, opponents, opponentsByPos, opponentsByPosWindow, opponentsByWindow, ...skaterTables }, ref] = await Promise.all([loadPropfinder(), loadPlayers()]);
  return Response.json({
    source: 'PropFinder',
    skaterCols: SKATER_COLS,
    teamCols: TEAM_COLS,
    ...Object.fromEntries(Object.keys(SKATER_TABLES).map((k) => [k, skatersWithIds(skaterTables[k], ref.players)])),
    teams,
    opponents,
    opponentsByPos,
    opponentsByPosWindow,
    opponentsByWindow,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
