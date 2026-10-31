import { authorize, todayET, syncTokenInfo } from '@/lib/nhl-data/util';
import { readJson, listNames } from '@/lib/nhl-store';
import { loadPlayers, TEAMS_PATH } from '@/lib/nhl-data/rosters';
import { mediaTodo } from '@/lib/nhl-data/media';
import { rowsPath, lineupsPath } from '@/lib/nhl-data/ingest';
import { positionsPath } from '@/lib/nhl-data/positions';
import { slateMetaPath } from '@/lib/nhl-data/matchups';
import { STANDINGS_PATH } from '@/lib/nhl-data/league';
import { fetchSchedule } from '@/lib/nhl-data/api';
import { loadMoneyPuck } from '@/lib/nhl-data/moneypuck';
import { loadShotpropz } from '@/lib/nhl-data/shotpropz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 3600 * 1000;

function seasons(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return { current: `${y}${y + 1}`, previous: `${y - 1}${y}`, startYear: y };
}

// Admin: where the stored data stands (rosters, media, game history, league,
// MoneyPuck, today's lineups and PropFinder files), shown as the "Stored data"
// health rows under Best bets → Data sources.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const today = todayET();
  const { current, previous, startYear } = seasons();
  const [teamsFile, ref, lastRoster, media, curRows, prevRows, standings, lineups, positions, slate, token, refresh, mp, spz] = await Promise.all([
    readJson(TEAMS_PATH), loadPlayers(), readJson('data/meta/last-roster-update.json'), mediaTodo().catch(() => null),
    readJson(rowsPath(current)), readJson(rowsPath(previous)), readJson(STANDINGS_PATH),
    readJson(lineupsPath(today)), readJson(positionsPath(today)), readJson(slateMetaPath(today)), syncTokenInfo(),
    readJson('data/meta/last-refresh.json'),
    loadMoneyPuck().catch(() => ({ teams: null, games: null })),
    loadShotpropz().catch(() => null),
  ]);

  // 1. Rosters
  const players = Object.values(ref.players).filter((p) => p.onRoster && !p.excluded);
  const teams = teamsFile?.teams || [];
  const incomplete = teams.filter((t) => {
    const mine = players.filter((p) => p.team === t.abbrev);
    return mine.filter((p) => ['C', 'LW', 'RW'].includes(p.pos)).length < 12 || mine.filter((p) => p.pos === 'D').length < 6 || mine.filter((p) => p.pos === 'G').length < 2;
  }).map((t) => t.abbrev);
  const failed = lastRoster?.failed || [];

  // 3. Game history
  const count = (f) => new Set((f?.rows || []).map((r) => r[1])).size;
  const last = (f) => (f?.rows || []).reduce((m, r) => (r[0] > m ? r[0] : m), '');
  const prevGames = count(prevRows);
  const curGames = count(curRows);

  // 5-6. Today
  // Today's game count: the stored lineup / position files answer instantly;
  // the NHL is only asked (briefly) when neither exists yet.
  let gamesToday = (lineups?.games || []).length || Object.keys(positions?.games || {}).length;
  if (!gamesToday) {
    try { gamesToday = (await fetchSchedule(today, { quick: true })).length; } catch {}
  }
  const withLineup = (lineups?.games || []).filter((g) => g.rows?.length).length;
  const captured = Object.keys(positions?.games || {}).length;

  const steps = {
    rosters: {
      done: teams.length >= 32 && incomplete.length === 0 && failed.length === 0,
      teams: teams.length, players: players.length, incomplete, failed, at: lastRoster?.at || null,
    },
    media: {
      done: !!media && media.todo.length === 0,
      remaining: media ? media.todo.length : null,
      logos: media ? Object.keys(media.index.logos || {}).length : 0,
      headshots: media ? Object.keys(media.index.headshots || {}).length : 0,
    },
    history: {
      // A full previous season is ~1,312 games; anything over 1,000 counts as loaded.
      done: prevGames >= 1000,
      previous: { season: previous, games: prevGames, last: last(prevRows), from: `${startYear - 1}-10-01`, to: `${startYear}-06-30` },
      current: { season: current, games: curGames, last: last(curRows), from: `${startYear}-10-01`, to: today },
    },
    league: {
      done: !!standings?.updatedAt && Date.now() - Date.parse(standings.updatedAt) < DAY,
      updatedAt: standings?.updatedAt || null, teams: (standings?.rows || []).length,
    },
    moneypuck: {
      done: !!mp.teams?.updatedAt && Date.now() - Date.parse(mp.teams.updatedAt) < 3 * DAY && (mp.teams.teams || 0) >= 30,
      updatedAt: mp.teams?.updatedAt || null, teams: mp.teams?.teams || 0, year: mp.teams?.year || null,
      splits: mp.games ? { updatedAt: mp.games.updatedAt, rows: mp.games.rows, failed: mp.games.failed || [] } : null,
    },
    shotpropz: {
      // The team boards behind the matchup profile's power play / penalty kill rows and venue splits; pulled by the morning refresh.
      done: !!spz?.updatedAt && Date.now() - Date.parse(spz.updatedAt) < 3 * DAY && (spz.boards?.offense?.all?.ytd?.gf?.count || 0) >= 30,
      updatedAt: spz?.updatedAt || null, pageUpdated: spz?.pageUpdated || null, year: spz?.year || null,
      teams: spz?.boards?.offense?.all?.ytd?.gf?.count || 0, pages: spz?.pages || 0, failed: spz?.failed || [], optional: true,
    },
    today: {
      done: gamesToday === 0 || (withLineup === gamesToday && withLineup > 0),
      games: gamesToday, withLineup, captured, capturedAt: positions?.updatedAt || null, lastRefresh: refresh?.ranAt || null,
    },
    propfinder: {
      done: gamesToday === 0 || !!(slate?.files?.season && slate?.files?.l5),
      games: gamesToday, season: slate?.files?.season || null, l5: slate?.files?.l5 || null,
    },
    sync: { done: !!token, createdAt: token?.createdAt || null, optional: true },
  };
  const required = Object.entries(steps).filter(([, s]) => !s.optional);
  return Response.json({
    today,
    complete: required.every(([, s]) => s.done),
    remaining: required.filter(([, s]) => !s.done).map(([k]) => k),
    steps,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
