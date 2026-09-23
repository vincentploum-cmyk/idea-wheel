// Pulls finished games and projected lineups from the NHL API into Supabase
// Storage (bucket nhl-model, prefix data/).
import { fetchSchedule, fetchBoxscore, fetchPlayByPlay, fetchPreview, isFinal } from './api';
import { buildGameRecord } from './game';
import { lineupRows } from './lineups';
import { readJson, writeJson } from '../nhl-store';
import { updateRosters } from './rosters';

export const ROW_FIELDS = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'pos', 'toi', 'g', 'a', 'sog', 'hits', 'blk', 'icf', 'iff', 'isf', 'iscf', 'ihdcf', 'result'];

export const gamesPath = (date) => `data/games/${date}.json`;
export const lineupsPath = (date) => `data/lineups/${date}.json`;
export const rowsPath = (season) => `data/rows/${season}.json`;
export const SEEN_PATH = 'data/reference/seen-players.json';

export function toRow(game, s) {
  return [game.date, game.id, s.id, s.name, s.team, s.opp, s.venue, s.pos, s.toi, s.g, s.a, s.sog, s.hits, s.blk, s.icf, s.iff, s.isf, s.iscf, s.ihdcf, s.result];
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

  return { date, scheduled: schedule.length, ingested: fresh.length, total: games.length, pending };
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
  if (schedule.length) await writeJson(lineupsPath(date), { date, fetchedAt: new Date().toISOString(), games });
  return { date, scheduled: schedule.length, withLineups: found };
}

/** Everything the daily job does: yesterday's results + today's lineups. */
export async function dailyRefresh(today) {
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  const [games, gamesToday, lineups] = await Promise.all([
    ingestGames(yesterday),
    ingestGames(today),
    ingestLineups(today),
  ]);
  // Rosters change slowly: refresh them at most once every 20 hours.
  let rosters = null;
  const lastRoster = await readJson('data/meta/last-roster-update.json');
  if (!lastRoster?.at || Date.now() - Date.parse(lastRoster.at) > 20 * 3600 * 1000) {
    try { rosters = await updateRosters(); } catch (err) { rosters = { error: err.message }; }
  }
  const summary = { ranAt: new Date().toISOString(), today, yesterday: games, todayGames: gamesToday, lineups, rosters };
  await writeJson('data/meta/last-refresh.json', summary);
  return summary;
}
