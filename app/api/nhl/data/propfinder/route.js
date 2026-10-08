import { authorize, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { loadPropfinder, withStoredWindows, skatersWithIds, SKATER_TABLES } from '@/lib/nhl-data/propfinder';
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
  const [pf, rows, ref] = await Promise.all([loadPropfinder(), loadRows(addDays(todayET(), 1)).catch(() => []), loadPlayers()]);
  // Recent-games windows PropFinder has not published for this season yet come from the stored box scores.
  const { teams, opponents, opponentsByPos, opponentsByPosWindow, opponentsByWindow, ...skaterTables } = withStoredWindows(pf, rows);
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
