// Storage for the NBA board: the shared store (lib/picks/store.js) keyed by the slate date (ET):
//   nba/<date>/{schedule,sheets-index,propfinder}.json, sheets/<id>.json, results/<gameId>.json
//   nba/meta/*.json
import { listNames } from '../nhl-store';
import { todayET, DATE_RE, addDays } from '../nhl-data/util';
import { makeStore } from '../picks/store';
import { fetchDay, fetchSummary, seasonOfDate } from './espn';
import { parseCheatSheet, countByGroup } from './cheatsheet';
import { parseNbaPages } from './cheatsheet-ocr';
import { pullSlate, propfinderConfigured } from './propfinder-nba';
import { buildBoard, shuffleOf, actualFor, statOf, ownWindows } from './picks';
import { MARKET_KEYS, labelOf } from './markets';

export { seasonOfDate };

/** The slate for a date: { date } (today in ET when none is given). */
export async function resolveSlate({ date = null } = {}) {
  return { date: date && DATE_RE.test(date) ? date : todayET() };
}

/** A date in the file's name ("props-2026-10-21.csv", "slate_20261021.xlsx"), else today. */
export function dateFromFileName(name) {
  const d = String(name || '').match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  return d ? `${d[1]}-${d[2]}-${d[3]}` : null;
}

const store = makeStore({
  sport: 'nba',
  slateKey: (s) => s.date,
  seasonOf: (s) => seasonOfDate(s.date),
  resolveSlate,
  slateLabel: (s) => s.date,
  sameSlate: (a, b) => !!a && !!b && a.date === b.date,
  slateFromFileName: async (fileName) => resolveSlate({ date: dateFromFileName(fileName) }),
  parseOcrPages: parseNbaPages,
  /** The nights around this one, nearest first: their PropFinder pull is the roster when this night has none. */
  nearSlates: (s) => [-1, 1, -2, 2, -3, 3].map((d) => ({ date: addDays(s.date, d) })),
  fetchSchedule: async (s) => {
    const got = await fetchDay(s.date);
    if (!got) return null;
    return { games: got.games, extra: { date: s.date, seasonYear: got.seasonYear }, fetchedAt: got.fetchedAt };
  },
  fetchSummary,
  parseCheatSheet, countByGroup,
  pullSlate,
  buildBoard,
  propfinderConfigured,
  shuffleOf, actualFor, statOf, ownWindows, marketKeys: MARKET_KEYS, marketLabels: Object.fromEntries(MARKET_KEYS.map((k) => [k, labelOf(k)])),
});

export const { ensureSchedule, loadResults, listSheets, deleteSheet, rereadSheet, playerFor, boardFor, shuffleFor, scorecardFor, statusFor, publicRefreshAllowed } = store;
export const pullPropfinderSlate = store.pullPropfinder;

/** Store a cheat sheet for the date given, else the one its name says, else today. */
export async function ingestCheatSheet({ buffer, text, fileName, date = null, source = 'upload' }) {
  const slate = date ? await resolveSlate({ date }) : null;
  return store.ingestCheatSheet({ buffer, text, fileName, slate, source });
}

/** Which dates hold stored data. */
export async function datesWithData() {
  const names = await listNames('nba').catch(() => []);
  return names.filter((n) => DATE_RE.test(n)).sort();
}
