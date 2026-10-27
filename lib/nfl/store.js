// Storage for the NFL board: the shared store (lib/picks/store.js) keyed by week:
//   nfl/calendar/<season>.json                ESPN's week calendar
//   nfl/<season>/<wk>/{schedule,sheets-index,propfinder}.json, sheets/<id>.json, results/<gameId>.json
//   nfl/meta/*.json
// <wk> is w07 for a regular-season week, p1 … p4 for the postseason.
import { readJson, writeJson, listNames } from '../nhl-store';
import { makeStore } from '../picks/store';
import { todayET, weekForDate, weekByRule, shiftWeek, weekFromFileName, seasonOfDate, weekLabel } from './week';
import { fetchWeek, fetchSummary } from './espn';
import { parseCheatSheet, countByGroup } from './cheatsheet';
import { parseDetailedPages } from './cheatsheet-detailed';
import { pullWeek, propfinderConfigured } from './propfinder-nfl';
import { buildBoard, shuffleOf, actualFor, statOf, ownWindows } from './picks';
import { MARKET_KEYS, labelOf } from './markets';

export const weekKey = ({ week, type }) => (type === 3 ? `p${week}` : `w${String(week).padStart(2, '0')}`);
export const CALENDAR = (season) => `nfl/calendar/${season}.json`;
export { shiftWeek, weekByRule };

/** The week to show for a date: the stored calendar when fetched, else the kickoff rule. */
export async function resolveWeek({ date = todayET(), season = null, week = null, type = null } = {}) {
  if (week) {
    const s = Number(season) || seasonOfDate(date);
    return { season: s, week: Number(week), type: Number(type) || 2 };
  }
  const s = seasonOfDate(date);
  const cal = await readJson(CALENDAR(s));
  const w = weekForDate(date, cal?.windows || null);
  // Before kickoff the board opens on week 1; after the Super Bowl it stays on the last week.
  if (w.type === 1) return { season: s, week: 1, type: 2 };
  return { season: w.season, week: w.week, type: w.type };
}

const store = makeStore({
  sport: 'nfl',
  slateKey: (wk) => `${wk.season}/${weekKey(wk)}`,
  seasonOf: (wk) => wk.season,
  resolveSlate: resolveWeek,
  slateLabel: (wk) => weekLabel(wk),
  sameSlate: (a, b) => !!a && !!b && a.season === b.season && a.week === b.week && a.type === b.type,
  /** The week from the file's name (wk7 / week-7 / a date), else this week. */
  slateFromFileName: async (fileName) => {
    const hint = weekFromFileName(fileName);
    if (hint.week) return resolveWeek({ season: hint.season || (hint.date ? seasonOfDate(hint.date) : null), week: hint.week });
    return resolveWeek({ date: hint.date || todayET() });
  },
  fetchSchedule: async (wk) => {
    const got = await fetchWeek(wk.season, wk.week, wk.type);
    if (!got) return null;
    if (got.calendar?.length) await writeJson(CALENDAR(wk.season), { season: wk.season, fetchedAt: got.fetchedAt, windows: got.calendar });
    return { games: got.games, extra: { season: wk.season, week: wk.week, type: wk.type, byes: got.byes }, fetchedAt: got.fetchedAt };
  },
  fetchSummary,
  parseCheatSheet, countByGroup,
  parseOcrPages: parseDetailedPages,
  /** The weeks around this one, nearest first: their PropFinder pull is the roster when this week has none. */
  nearSlates: (wk) => [1, -1, 2, -2, 3, -3].map((d) => shiftWeek(wk, d)).filter(Boolean),
  pullSlate: pullWeek,
  buildBoard,
  propfinderConfigured,
  shuffleOf, actualFor, statOf, ownWindows, marketKeys: MARKET_KEYS, marketLabels: Object.fromEntries(MARKET_KEYS.map((k) => [k, labelOf(k)])),
});

export const { ensureSchedule, loadResults, listSheets, deleteSheet, rereadSheet, boardFor, shuffleFor, scorecardFor, statusFor } = store;

/** A stored week folder name (w07, p1) back to its slate. */
export function weekFromKey(season, name) {
  const m = /^(w|p)(\d{1,2})$/.exec(name || '');
  if (!m) return null;
  return { season: Number(season), week: Number(m[2]), type: m[1] === 'p' ? 3 : 2 };
}
export const pullPropfinderWeek = store.pullPropfinder;

/** Store a cheat sheet for the week given, else the one its name says, else this week. */
export async function ingestCheatSheet({ buffer, text, fileName, week = null, season = null, type = null, source = 'upload' }) {
  const slate = week ? await resolveWeek({ season, week, type }) : null;
  const r = await store.ingestCheatSheet({ buffer, text, fileName, slate, source });
  return { ...r, week: r.slate };
}

/** Which weeks hold stored data (for the week picker's dots). */
export async function weeksWithData(season) {
  const names = await listNames(`nfl/${season}`).catch(() => []);
  return names.filter((n) => /^(w\d{2}|p\d)$/.test(n)).sort();
}
