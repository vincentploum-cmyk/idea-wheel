// The goalie rows per season (data/goalie-rows/<season>.json, the game records' goalie lines indexed
// like the skater rows), written by every ingest and rebuilt from the stored games on demand
// (`POST /api/nhl/data/refresh?only=goalies`), and the loader the slate and the picks read.
import { readJson, writeJson, memoizeByInputs, listNames } from '../nhl-store';
import { seasonYearOf } from './picks-pure';
import { GOALIE_ROW_FIELDS, goalieRowsPath, goalieRowsOf, goalieRowObj } from './goalies-pure';

// The day's game file (lib/nhl-data/ingest.js's gamesPath, spelled here so the ingest can import this module).
const gamesPath = (date) => `data/games/${date}.json`;

export * from './goalies-pure';

/** Merge the games' goalie lines into their seasons' rows files (a game's rows replace its earlier ones). */
export async function writeGoalieRows(games) {
  const bySeason = {};
  for (const g of games || []) (bySeason[g.season] ||= []).push(g);
  for (const [season, list] of Object.entries(bySeason)) {
    const file = (await readJson(goalieRowsPath(season))) || { season: Number(season), fields: GOALIE_ROW_FIELDS, rows: [] };
    const ids = new Set(list.map((g) => g.id));
    const kept = (file.rows || []).filter((r) => !ids.has(r[1]));
    const added = list.flatMap(goalieRowsOf);
    const rows = [...kept, ...added].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    await writeJson(goalieRowsPath(season), { season: Number(season), fields: GOALIE_ROW_FIELDS, updatedAt: new Date().toISOString(), rows });
  }
}

/**
 * Rebuild a season's goalie rows from every stored game file of that season (the dates under
 * data/games/ from September 1 to the next August 31). Returns { season, dates, games, rows }.
 */
export async function rebuildGoalieRows({ season }) {
  const names = await listNames('data/games');
  const from = `${season}-09-01`; const to = `${season + 1}-08-31`;
  const dates = names.map((n) => n.replace(/\.json$/, '')).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= from && d <= to).sort();
  const rows = []; let games = 0;
  for (const date of dates) {
    const file = await readJson(gamesPath(date));
    for (const g of file?.games || []) { if (Number(g.season) !== Number(`${season}${season + 1}`) && seasonYearOf(g.date) !== season) continue; rows.push(...goalieRowsOf(g)); games += 1; }
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  await writeJson(goalieRowsPath(season), { season, fields: GOALIE_ROW_FIELDS, updatedAt: new Date().toISOString(), rebuiltAt: new Date().toISOString(), rows });
  return { season, dates: dates.length, games, rows: rows.length };
}

/** This season's and last season's goalie rows (objects) for a slate date; the same array while the files are unchanged. */
export const loadGoalieRows = memoizeByInputs(
  async (date) => { const y = seasonYearOf(date); return [await readJson(goalieRowsPath(y)), await readJson(goalieRowsPath(y - 1))]; },
  (cur, prev) => [...(prev?.rows || []), ...(cur?.rows || [])].map(goalieRowObj),
);
