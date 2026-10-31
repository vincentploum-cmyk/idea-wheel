// Storage for the NBA board: the shared store (lib/picks/store.js) keyed by the slate date (ET):
//   nba/<date>/{schedule,sheets-index,propfinder}.json, sheets/<id>.json, results/<gameId>.json
//   nba/meta/*.json
import { listNames, readJson, writeJson } from '../nhl-store';
import { todayET, DATE_RE, addDays } from '../nhl-data/util';
import { makeStore } from '../picks/store';
import { fetchDay, fetchSummary, fetchInjuries, seasonOfDate } from './espn';
import { parseCheatSheet, countByGroup } from './cheatsheet';
import { parseNbaPages } from './cheatsheet-ocr';
import { pullSlate, propfinderConfigured } from './propfinder-nba';
import { buildBoard, shuffleOf, actualFor, statOf, ownWindows } from './picks';
import { MARKET_KEYS, labelOf } from './markets';
import { firstBasketRecord, buildFirstBasketBoard } from './firstbasket';

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
  /** ESPN's league injury feed, the second word on who plays (lib/picks/injuries.js applyEspnInjuries); read while the slate is today or later. */
  fetchInjuries: () => fetchInjuries(),
  injuriesLive: (s, schedule) => s.date >= todayET() && !(schedule?.games?.length && schedule.games.every((g) => g.final)),
  parseCheatSheet, countByGroup,
  pullSlate,
  buildBoard,
  propfinderConfigured,
  shuffleOf, actualFor, statOf, ownWindows, calibrate: true, marketKeys: MARKET_KEYS, marketLabels: Object.fromEntries(MARKET_KEYS.map((k) => [k, labelOf(k)])),
});

export const { ensureSchedule, ensureInjuries, loadResults, listSheets, deleteSheet, rereadSheet, playerFor, boardFor, shuffleFor, scorecardFor, statusFor, publicRefreshAllowed, loadOverrides, setOverride } = store;
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

/** The season to date graded and the board's calibration stored from it (the scorecard route's default range). */
let relearning = null;
export function relearnCalibration(to = todayET()) {
  if (relearning) return relearning;
  const from = `${seasonOfDate(to)}-10-01`;
  relearning = datesWithData()
    .then((dates) => scorecardFor(dates.filter((d) => d >= from && d <= to).slice(-200).map((date) => ({ date })), { from, to }, { save: true }))
    .then((report) => report.calibration || null)
    .finally(() => { relearning = null; });
  return relearning;
}

/** The stored results of a season's nights with an opening on record, for the first-basket record (lib/nba/firstbasket.js); ten minutes a cache per set of dates. */
const openingsMemo = new Map();
const OPENINGS_TTL_MS = 10 * 60 * 1000;
export const MAX_BACKFILL = 12;

async function seasonResults(dates) {
  const key = dates.join(',');
  const hit = openingsMemo.get(key);
  if (hit && Date.now() - hit.at < OPENINGS_TTL_MS) return hit.value;
  const out = [];
  for (const date of dates) {
    const sched = await readJson(store.P.schedule({ date }));
    for (const g of (sched?.games || []).filter((x) => x.final)) { const r = await readJson(store.P.result({ date }, g.id)); if (r) out.push({ date, ...r }); }
  }
  openingsMemo.set(key, { at: Date.now(), value: out });
  return out;
}

/**
 * The night's first-basket board (lib/nba/firstbasket.js): the season's stored results make the
 * record (tips, first baskets, first shots, starts), the slate's pull (through the injury overrides)
 * the starters and the prices. A stored result without an `opening` (stored before the opening
 * plays were parsed, or fetched before the plays were posted) is read from ESPN again, `backfill`
 * at a time, so the record fills over a few loads; `missing` says how many remain.
 */
export async function firstBasketFor(slate, { backfill = MAX_BACKFILL } = {}) {
  const season = seasonOfDate(slate.date);
  const dates = (await datesWithData()).filter((d) => d <= slate.date && seasonOfDate(d) === season);
  let results = await seasonResults(dates);
  const missing = results.filter((r) => r.final && !r.opening);
  let refetched = 0; const errors = [];
  for (const r of missing.slice(0, Math.max(0, backfill))) {
    try {
      const again = await fetchSummary(r.id);
      if (again?.final && again.players?.length) { await writeJson(store.P.result({ date: r.date }, r.id), { ...again, storedAt: new Date().toISOString(), openingAt: new Date().toISOString() }); refetched++; }
      else if (again && !again.opening) { await writeJson(store.P.result({ date: r.date }, r.id), { ...r, opening: null, openingAt: new Date().toISOString(), openingMissing: true }); }
    } catch (err) { errors.push(`${r.id}: ${err.message}`); }
  }
  if (refetched) { openingsMemo.clear(); results = await seasonResults(dates); }
  const record = firstBasketRecord(results);
  const [schedule, pf] = await Promise.all([readJson(store.P.schedule(slate)), store.pfFor(slate)]);
  const games = schedule?.games || [];
  const todays = await store.loadResults(slate, games);
  const board = buildFirstBasketBoard({ slate, games, pf, results: todays, record });
  return { ...board, season, slates: dates.length, missing: Math.max(0, missing.length - refetched), refetched, errors };
}
