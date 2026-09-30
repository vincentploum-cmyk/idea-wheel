// Pulls finished games and projected lineups from the NHL API into Supabase
// Storage (bucket nhl-model, prefix data/).
import { fetchSchedule, fetchBoxscore, fetchPlayByPlay, fetchPreview, isFinal } from './api';
import { buildGameRecord } from './game';
import { lineupRows } from './lineups';
import { fetchTeamLines } from './gamedaytweets';
import { addDays } from './util';
import { readJson, writeJson } from '../nhl-store';
import { updateRosters, loadPlayers } from './rosters';
import { ingestPreseason } from './preseason';
import { snapshotPositions, applyFrozenPositions, snapshotFromPreview, positionsPath } from './positions';
import { refreshLeague } from './league';
import { syncMedia } from './media';
import { refreshMoneyPuck } from './moneypuck';

// posSrc (last, so older rows still parse): 'lineup' = frozen pre-game position, 'box' = box-score roster code.
export const ROW_FIELDS = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'pos', 'toi', 'g', 'a', 'sog', 'hits', 'blk', 'icf', 'iff', 'isf', 'iscf', 'ihdcf', 'result', 'posSrc', 'boxPos'];

export const gamesPath = (date) => `data/games/${date}.json`;
export const lineupsPath = (date) => `data/lineups/${date}.json`;
export const rowsPath = (season) => `data/rows/${season}.json`;
export const SEEN_PATH = 'data/reference/seen-players.json';

export function toRow(game, s) {
  return [game.date, game.id, s.id, s.name, s.team, s.opp, s.venue, s.pos, s.toi, s.g, s.a, s.sog, s.hits, s.blk, s.icf, s.iff, s.isf, s.iscf, s.ihdcf, s.result, s.posSource || 'box', s.boxPos ?? s.pos];
}

export function rowObj(r) {
  const o = {};
  ROW_FIELDS.forEach((k, i) => { o[k] = r[i]; });
  return o;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Ingest every finished game on `date`. Re-running is safe (idempotent). */
export async function ingestGames(date, { force = false } = {}) {
  const schedule = await fetchSchedule(date);
  const existing = (await readJson(gamesPath(date))) || { date, games: [] };
  const have = new Set(existing.games.map((g) => g.id));
  const todo = schedule.filter((g) => isFinal(g.state) && (force || !have.has(g.id)));
  const pending = schedule.filter((g) => !isFinal(g.state)).map((g) => g.id);

  const fetched = await mapLimit(todo, 4, async (g) => {
    const [box, pbp] = await Promise.all([fetchBoxscore(g.id), fetchPlayByPlay(g.id)]);
    return buildGameRecord(box, pbp);
  });
  const fresh = fetched.filter(Boolean);
  // Skaters keep the position they were frozen at before the game. Games the
  // snapshot never covered get their projected lineup from the NHL.com preview.
  let positions = { lineup: 0, preview: 0, box: 0 };
  if (fresh.length) {
    const snap = await readJson(positionsPath(date));
    const covered = fresh.filter((g) => snap?.games?.[g.id]);
    positions.lineup = applyFrozenPositions(covered, snap, 'lineup');
    const uncovered = fresh.filter((g) => !snap?.games?.[g.id]);
    const previews = await mapLimit(uncovered, 4, (g) => snapshotFromPreview(g));
    uncovered.forEach((g, i) => { if (previews[i]) positions.preview += applyFrozenPositions([g], previews[i], 'lineup'); });
    positions.box = fresh.reduce((n, g) => n + g.skaters.filter((s) => (s.posSource || 'box') === 'box').length, 0);
    for (const g of fresh) for (const s of g.skaters) if (!s.posSource) s.posSource = 'box';
  }
  if (!fresh.length && !force) {
    return { date, scheduled: schedule.length, ingested: 0, total: existing.games.length, pending };
  }

  const byId = new Map(existing.games.map((g) => [g.id, g]));
  for (const g of fresh) byId.set(g.id, g);
  const games = [...byId.values()].sort((a, b) => a.id - b.id);
  await writeJson(gamesPath(date), { date, fetchedAt: new Date().toISOString(), games });

  // Update the per-season row index used by the aggregate workbooks.
  const bySeason = {};
  for (const g of games) (bySeason[g.season] = bySeason[g.season] || []).push(g);
  for (const [season, list] of Object.entries(bySeason)) {
    const file = (await readJson(rowsPath(season))) || { season: Number(season), fields: ROW_FIELDS, rows: [] };
    const ids = new Set(list.map((g) => g.id));
    const kept = file.rows.filter((r) => !ids.has(r[1]));
    const added = list.flatMap((g) => g.skaters.map((s) => toRow(g, s)));
    const rows = [...kept, ...added].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    await writeJson(rowsPath(season), { season: Number(season), fields: ROW_FIELDS, updatedAt: new Date().toISOString(), rows });
  }

  // Every skater who has played gets a row in the player database, even if
  // they're no longer on a current roster.
  const seen = (await readJson(SEEN_PATH)) || { players: {} };
  for (const g of fresh) {
    for (const sk of [...g.skaters, ...g.goalies.map((x) => ({ ...x, pos: 'G' }))]) {
      const prev = seen.players[sk.id];
      if (!prev || prev.lastGame <= g.date) seen.players[sk.id] = { id: sk.id, name: sk.name, team: sk.team, pos: sk.pos, lastGame: g.date };
    }
  }
  seen.updatedAt = new Date().toISOString();
  await writeJson(SEEN_PATH, seen);

  return { date, scheduled: schedule.length, ingested: fresh.length, total: games.length, pending, positions };
}

/** Pull NHL.com projected lineups for every game on `date`. */
export async function ingestLineups(date) {
  const schedule = await fetchSchedule(date);
  const games = await mapLimit(schedule, 4, async (g) => {
    try {
      const p = await fetchPreview(g.id);
      return { gameId: g.id, away: g.away, home: g.home, slug: p?.slug || null, updated: p?.updated || null, rows: p ? lineupRows(p.markdown) : [] };
    } catch (err) {
      return { gameId: g.id, away: g.away, home: g.home, error: String(err.message || err), rows: [] };
    }
  });
  const found = games.filter((g) => g.rows.length).length;
  // Teams whose game has no NHL.com lineup yet get the beat writers' lines instead.
  const gdt = await fetchGdtLines(date, schedule);
  const lineups = { date, fetchedAt: new Date().toISOString(), games, gdt };
  if (schedule.length) await writeJson(lineupsPath(date), lineups);
  const positions = schedule.length ? await snapshotPositions(date, schedule, lineups) : null;
  return { date, scheduled: schedule.length, withLineups: found, gamedaytweets: Object.keys(gdt).length, positions };
}

/**
 * GameDayTweets lines for every team on the slate. Fetched even when NHL.com has
 * a projected lineup: a game-day tweet (morning skate, warm-ups) is newer than
 * the preview and wins in the position snapshot.
 */
async function fetchGdtLines(date, schedule) {
  const teams = [...new Set(schedule.flatMap((g) => [g.away, g.home]))];
  if (!teams.length) return {};
  const ref = await loadPlayers();
  const since = addDays(date, -1); // practice lines from the day before still count
  const out = {};
  await mapLimit(teams, 3, async (abbr) => {
    const roster = Object.values(ref.players).filter((p) => p.team === abbr && !p.excluded);
    try {
      const lines = await fetchTeamLines(abbr, roster, { since });
      if (lines) out[abbr] = lines;
    } catch (err) {
      out[abbr] = { error: String(err.message || err) };
    }
  });
  return out;
}

/** Everything the daily job does: yesterday's results + today's lineups. */
export async function dailyRefresh(today) {
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  // Sequential on purpose: both calls rewrite the same season index file.
  const games = await ingestGames(yesterday);
  const gamesToday = await ingestGames(today);
  const lineups = await ingestLineups(today);
  // Preseason games (September/early October) show who is actually dressing.
  let preseason = null;
  try { preseason = [await ingestPreseason(yesterday), await ingestPreseason(today)]; } catch (err) { preseason = { error: err.message }; }
  // Rosters change slowly: refresh them at most once every 20 hours.
  let rosters = null;
  const lastRoster = await readJson('data/meta/last-roster-update.json');
  if (!lastRoster?.at || Date.now() - Date.parse(lastRoster.at) > 20 * 3600 * 1000) {
    try { rosters = await updateRosters(); } catch (err) { rosters = { error: err.message }; }
  }
  // League tables and any logos / headshots still missing.
  let league = null;
  try { league = await refreshLeague(); } catch (err) { league = { error: err.message }; }
  let media = null;
  try { media = await syncMedia({ limit: 200 }); } catch (err) { media = { error: err.message }; }
  // MoneyPuck: the season summary every day, the 32 game logs (home/away splits) once a week.
  let moneypuck = null;
  try { moneypuck = await refreshMoneyPuck({ games: new Date().getUTCDay() === 0 }); } catch (err) { moneypuck = { error: err.message }; }
  const summary = { ranAt: new Date().toISOString(), today, yesterday: games, todayGames: gamesToday, lineups, preseason, rosters, league, media, moneypuck };
  await writeJson('data/meta/last-refresh.json', summary);
  return summary;
}
