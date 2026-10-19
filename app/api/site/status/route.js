import { authorize, todayET } from '@/lib/nhl-data/util';
import { readJson } from '@/lib/nhl-store';
import { lineupsPath } from '@/lib/nhl-data/ingest';
import { positionsPath } from '@/lib/nhl-data/positions';
import { fetchSchedule } from '@/lib/nhl-data/api';
import { resolveWeek, statusFor } from '@/lib/nfl/store';
import { weekLabel } from '@/lib/nfl/week';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The start screen's one line per sport: tonight's NHL slate, this NFL week, the NBA's state.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const today = todayET();
  const [lineups, positions, runs] = await Promise.all([readJson(lineupsPath(today)), readJson(positionsPath(today)), readJson('data/meta/last-refresh.json')]);
  let nhlGames = (lineups?.games || []).length || Object.keys(positions?.games || {}).length;
  if (!nhlGames) { try { nhlGames = (await fetchSchedule(today, { quick: true })).length; } catch {} }
  let nfl = null;
  try {
    const wk = await resolveWeek({ date: today });
    const s = await statusFor(wk);
    nfl = { week: wk, label: weekLabel(wk), games: s.schedule?.games ?? null, finals: s.schedule?.finals ?? 0, sheets: s.sheets.length, propfinder: !!s.propfinder.file, nextKickoff: s.schedule?.nextKickoff || null };
  } catch (err) { nfl = { error: err.message }; }
  return Response.json({
    date: today,
    nhl: { games: nhlGames, lineups: (lineups?.games || []).filter((g) => g.rows?.length).length, refreshedAt: runs?.at || null },
    nfl,
    nba: { ready: false },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
