// Storage for the NBA board: the shared store (lib/picks/store.js) keyed by the slate date (ET):
//   nba/<date>/{schedule,sheets-index,propfinder}.json, sheets/<id>.json, results/<gameId>.json
//   nba/meta/*.json
import { listNames, readJson, writeJson, pathRevision } from '../nhl-store';
import { todayET, DATE_RE, addDays } from '../nhl-data/util';
import { normName } from '../nhl-data/names';
import { makeStore } from '../picks/store';
import { fetchDay, fetchSummary, fetchInjuries, seasonOfDate } from './espn';
import { fetchLineups } from './rotowire';
import { parseCheatSheet, countByGroup } from './cheatsheet';
import { parseNbaPages } from './cheatsheet-ocr';
import { pullSlate, propfinderConfigured } from './propfinder-nba';
import { buildBoard, shuffleOf, actualFor, statOf, ownWindows } from './picks';
import { MARKET_KEYS, labelOf } from './markets';
import { firstBasketRecord, buildFirstBasketBoard } from './firstbasket';
import { positionBook, vsPositionRows, seasonProfiles, likeHim, POS_TABS } from './vs-position';

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
  /** RotoWire's starting lineups ("Expected" until confirmed), today's night alone: read until every game has started. */
  fetchLineups: () => fetchLineups(),
  lineupsLive: (s, schedule) => s.date === todayET() && !(schedule?.games?.length && schedule.games.every((g) => g.final || (g.state && g.state !== 'pre'))),
  parseCheatSheet, countByGroup,
  pullSlate,
  buildBoard,
  propfinderConfigured,
  shuffleOf, actualFor, statOf, ownWindows, calibrate: true, marketKeys: MARKET_KEYS, marketLabels: Object.fromEntries(MARKET_KEYS.map((k) => [k, labelOf(k)])),
});

export const { ensureSchedule, ensureInjuries, ensureLineups, loadResults, listSheets, deleteSheet, rereadSheet, boardFor, shuffleFor, scorecardFor, statusFor, publicRefreshAllowed, loadOverrides, setOverride, extraFor, defensiveMatchupsFor } = store;

/**
 * One player's card (lib/picks/store.js playerFor). What other players at each position did against tonight's opponent
 * comes in its own request (vsPositionCard below), so the card opens on its logs while the season is read.
 */
export async function playerFor(slate, key) {
  return store.playerFor(slate, key);
}

/**
 * What other players at each position did against the card's opponent this season (`vsPosition`, lib/nba/vs-position.js;
 * Vincent, 2026-10-31: "on the individual player card, I need to see what other players in the same position did"): the
 * opponent's stored games before the slate, every opposing player who played with his line, placed by the stored
 * PropFinder pulls of those nights (the depth chart's slot, else the roster position) — ESPN's box score knows only
 * G / F / C — and the card filters by position tab. The card asks for it beside its own payload
 * (`/api/nba/player?part=vs`): the season's box scores took some 150 reads, one after the other, and held the whole
 * card for seconds (2026-11-05). { vsPosition } (null when the read fails), or null without the player on the pull.
 */
export async function vsPositionCard(slate, key) {
  const [pf, schedule] = await Promise.all([readJson(store.P.propfinder(slate)), readJson(store.P.schedule(slate))]);
  const p = (pf?.data?.players || []).find((x) => x.key === key) || null;
  if (!p) return null;
  const g = (schedule?.games || []).find((x) => x.away === p.team || x.home === p.team) || null;
  const opp = g ? (g.away === p.team ? g.home : g.away) : null;
  if (!opp) return { vsPosition: null };
  try { return { vsPosition: await vsPositionFor(slate, opp, { key: p.key, name: p.name }) }; } catch (err) { console.warn('[nba] player card: the opponent’s games could not be read:', err.message); return { vsPosition: null }; }
}

// The opponent's games, the position book and the season's profiles, kept ten minutes per opponent and date; two cards
// opened together against one opponent share the read under way.
const vsMemo = new Map();
const VS_TTL_MS = 10 * 60 * 1000;
const profilesMemo = new WeakMap();   // the season's results (seasonResults' array) → every player's profile
async function vsBase(slate, opp) {
  const memoKey = `${slate.date}|${opp}`;
  const hit = vsMemo.get(memoKey);
  if (hit && (hit.pending || Date.now() - hit.at < VS_TTL_MS)) return hit.value;
  const value = (async () => {
    const season = seasonOfDate(slate.date);
    const dates = (await datesWithData()).filter((d) => d < slate.date && seasonOfDate(d) === season);
    const all = await seasonResults(dates);
    // Every player's averages this season before tonight, the card's own and the opposing players' alike (the purple rows).
    let profiles = profilesMemo.get(all);
    if (!profiles) { profiles = seasonProfiles(all, { through: slate.date }); profilesMemo.set(all, profiles); }
    const results = all.filter((r) => r.final && (r.away === opp || r.home === opp));
    const pullDates = [...new Set([slate.date, ...results.map((r) => r.date)])];
    const pulls = (await Promise.all(pullDates.map((d) => positionsOfNight(d, slate.date).catch(() => null)))).filter(Boolean);
    return { results, book: positionBook(pulls), profiles, pulls: pulls.length };
  })();
  vsMemo.set(memoKey, { pending: true, value });
  try {
    const got = await value;
    vsMemo.set(memoKey, { at: Date.now(), value: got });
    return got;
  } catch (err) { vsMemo.delete(memoKey); throw err; }
}
async function vsPositionFor(slate, opp, player) {
  const base = await vsBase(slate, opp);
  const rows = vsPositionRows(base.results, { opp, through: slate.date, book: base.book, mine: { key: player?.key || null } });
  const me = base.profiles?.[player?.key] || (player?.name ? base.profiles?.[normName(player.name)] : null) || null;
  return { opp, through: slate.date, games: new Set(rows.map((r) => r.gameId)).size, rows, positions: POS_TABS, pulls: base.pulls, like: likeHim(rows, base.profiles || {}, me) };
}

/**
 * A night's PropFinder pull cut to what places a player (the roster positions, the depth chart): a past night's is kept
 * (NIGHT_TTL_MS, until a write under its date) instead of a pull of megabytes read again for a dozen keys a night.
 */
const pullMemo = new Map();   // date → { at, rev, value }
async function positionsOfNight(date, slateDate) {
  const rev = pathRevision(`nba/${date}`);
  const hit = pullMemo.get(date);
  if (hit && hit.rev === rev && Date.now() - hit.at < NIGHT_TTL_MS) return hit.value;
  const pull = await readJson(store.P.propfinder({ date }));
  const value = pull ? { data: { players: (pull.data?.players || []).map((x) => ({ key: x?.key, pos: x?.pos })), depth: pull.data?.depth || {} } } : null;
  if (pull && date < slateDate) pullMemo.set(date, { at: Date.now(), rev, value });
  return value;
}
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

export const MAX_BACKFILL = 12;

/**
 * The stored results of a season's nights (the first-basket record, the card's games against the opponent), in date
 * order. The nights are read a few at a time and each night's games together (one after the other they were some 150
 * reads and seconds of waiting, 2026-11-05). A past night whose games are all final and stored no longer changes, so
 * it is kept (NIGHT_TTL_MS) until a write under its date (the first-basket backfill rewriting a result) drops it; the
 * array is the same while every night is, so what is read off it can be kept on it.
 */
const NIGHT_TTL_MS = 6 * 60 * 60 * 1000;
const nightMemo = new Map();   // date → { at, rev, value }
let seasonMemo = null;         // { key, nights, value }

async function resultsOfNight(date) {
  const rev = pathRevision(`nba/${date}`);
  const hit = nightMemo.get(date);
  if (hit && hit.rev === rev && Date.now() - hit.at < NIGHT_TTL_MS) return hit.value;
  const sched = await readJson(store.P.schedule({ date }));
  const games = sched?.games || [];
  const finals = games.filter((x) => x.final);
  const read = await Promise.all(finals.map((g) => readJson(store.P.result({ date }, g.id))));
  const value = read.filter(Boolean).map((r) => ({ date, ...r }));
  if (date < todayET() && games.length && finals.length === games.length && value.length === finals.length) nightMemo.set(date, { at: Date.now(), rev, value });
  return value;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

async function seasonResults(dates) {
  const nights = await mapLimit(dates, 6, resultsOfNight);
  const key = dates.join(',');
  if (seasonMemo && seasonMemo.key === key && seasonMemo.nights.every((n, i) => n === nights[i])) return seasonMemo.value;
  const value = nights.flat();
  seasonMemo = { key, nights, value };
  return value;
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
  if (refetched) results = await seasonResults(dates);   // the writes dropped the nights they touched
  const record = firstBasketRecord(results);
  const [schedule, pf] = await Promise.all([readJson(store.P.schedule(slate)), store.pfFor(slate)]);
  const games = schedule?.games || [];
  const todays = await store.loadResults(slate, games);
  const board = buildFirstBasketBoard({ slate, games, pf, results: todays, record });
  return { ...board, season, slates: dates.length, missing: Math.max(0, missing.length - refetched), refetched, errors };
}
