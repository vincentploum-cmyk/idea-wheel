// The season's record of the 1st goal tab's own list (Vincent, 2026-11-14: "the season track record for all three";
// lib/picks/first-results.js grades and adds up, components/picks/FirstResults.jsx draws it). A night is graded once
// and kept (`data/firstgoal/results/<date>.json`).
//
// LEAK-FREE: a night's list is rebuilt from what was on file before its games, never read off today's board
// (`buildFirstGoalBoard` for a past date would read today's PropFinder tables, today's roster and Best bets' figures
// as printed now). What goes in:
//   - the skater rows strictly before the date (`loadRows`' own rule, applied here as `r.date < date`): each skater's
//     first-goal record, the opponent's first goals given up, head to head, his goals a game;
//   - the lineup captured for the game (`data/positions/<date>.json`), and only when it was read before the puck
//     drop: a game whose lineup came from a tweet posted after it is skipped, as is a game without a captured lineup;
//   - the model's 1+ goal chance from the newest run saved for the date BEFORE that game's puck drop (the run as it
//     stated it). Without such a run the board's own fallback stands in (his goals a game against the opponent's
//     stored table), as it does on the tab while no run exists.
// Left out, since neither can be had again as of a past morning: Best bets' printed 1+ goal figure (the board's read
// over the run, calibrated on results to date) and PropFinder's per-position table in the goals edge.
import { readJson, writeJson, listNames, isValidRunId, getRun, getRunResults } from '../nhl-store';
import { gradeFirst, firstResultsPayload, firstNightUsable, FIRST_RESULTS_VERSION } from '../picks/first-results';
import { loadRows } from './build';
import { gamesPath } from './ingest';
import { positionsPath } from './positions';
import { DEF_POS, playerBaselines } from './defense';
import { defenseTablesFor, opponentDefense, h2hByOpponent, h2hHot, h2hShotsHot, scoreSkater } from './slate';
import { candidate, firstGoalRecord } from './firstgoal';
import { indexModelRows } from './model-runs';
import { modelKey } from './model-key';
import { normName } from './names';
import { seasonYearOf } from './picks-pure';
import { todayET, addDays } from './util';

export const firstGoalResultsPath = (date) => `data/firstgoal/results/${date}.json`;
// Nights graded on one load of the record: a night rebuilds every table from the rows before it (a second or two each).
export const FIRST_GOAL_BACKFILL = 3;
const r2 = (v) => +v.toFixed(2);

/** The runs saved for a slate date (manifests with results), oldest first. Run ids start with their UTC stamp. */
async function runsFor(date) {
  const days = new Set([addDays(date, -1), date, addDays(date, 1)].map((d) => d.replace(/-/g, '')));
  const ids = (await listNames('runs')).filter((id) => isValidRunId(id) && days.has(id.slice(0, 8)));
  const manifests = await Promise.all(ids.map((id) => getRun(id).catch(() => null)));
  return manifests.filter((m) => m?.slateDate === date && m.hasResults && Number.isFinite(Date.parse(m.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The newest of `runs` (oldest first) saved before `startTimeUTC`; null without a start time (nothing proves it pre-game). */
export function runBefore(runs, startTimeUTC) {
  const start = Date.parse(startTimeUTC || '');
  if (!Number.isFinite(start)) return null;
  return [...(runs || [])].reverse().find((m) => Date.parse(m.createdAt) < start) || null;
}

/** A side's lineup was read after the puck drop (a tweet during the game standing as the final word). */
const lateLineup = (team, start) => team?.source === 'gamedaytweets' && Number.isFinite(start) && Date.parse(team.meta?.gdtAt || '') > start;

/**
 * One game's candidates as of its morning, the board's own rows (`candidate` in firstgoal.js) with a chance on each:
 * the board gives a 0–100 score, not a chance, so `p` is the candidate's score over the game's total (the list sums
 * to 1: somebody on it scores the first goal). `rows` = the rows before the date; `players` = the pre-game run's, or null.
 */
export function candidatesAsOf({ game, rows, date, players = null }) {
  const season = seasonYearOf(date);
  const tables = defenseTablesFor(rows, null, { season });
  const record = firstGoalRecord(rows);
  const baselines = playerBaselines(rows);
  const h2h = h2hByOpponent(rows);
  const idByName = {};
  for (const [id, b] of Object.entries(baselines)) idByName[`${b.team}|${normName(b.name)}`] = Number(id);
  const list = [[game.away, game.home, 'A'], [game.home, game.away, 'H']].flatMap(([team, opp, venue]) => {
    const defVenue = venue === 'A' ? 'H' : 'A';
    const side = { defense: opponentDefense(opp, defVenue, tables) };
    return Object.values(game.teams?.[team]?.players || {}).filter((p) => DEF_POS.includes(p.pos)).map((p) => {
      const id = p.id ?? idByName[`${team}|${normName(p.name)}`] ?? null;
      const vs = id != null ? h2h[`${id}|${opp}`] || null : null;
      // The goals edge off the stored table at the venue (the tab's reads PropFinder's table first: not kept by date).
      const t = tables.season.teams[opp]?.[defVenue]?.[p.pos]; const lg = tables.season.league[defVenue]?.[p.pos]?.g;
      const oppG = t?.gp && lg ? { ratio: r2(t.g / lg) } : null;
      return candidate({
        id, name: p.name, team, opp, venue, pos: p.pos, line: p.line ?? null, inLineup: p.inLineup !== false,
        h2h: vs ? { gp: vs.gp, g: vs.g, sog: vs.sog, gpg: r2(vs.g / vs.gp), spg: r2(vs.sog / vs.gp), hot: h2hHot(vs), shotsHot: h2hShotsHot(vs) } : null,
        model: players?.[modelKey(team, p.name)] || null,
        ...(scoreSkater(id != null ? baselines[id] : null, venue, null, oppG, null) || {}),
      }, side, record);
    }).filter(Boolean);
  }).sort((a, b) => b.score - a.score);
  const total = list.reduce((s, c) => s + c.score, 0);
  return total > 0 ? list.map((c) => ({ ...c, p: c.score / total })) : [];
}

/**
 * A past date graded: { version, date, builtAt, games: [gradeFirst entries], slateGames, withRun (games read with a
 * pre-game model run), skipped: [{ id, game, why }] }. Null when the date has no stored game; throws while a stored
 * game has no first goal stamped yet (the next load tries again). `rows`: rows that hold the date's season (the
 * season function passes today's), cut here to the ones before the date; without it they are loaded for the date.
 */
export async function gradeFirstGoalNight(date, { rows = null, today = todayET() } = {}) {
  if (!(date < today)) throw new Error('not a past date');
  const [file, snap] = await Promise.all([readJson(gamesPath(date)), readJson(positionsPath(date))]);
  const stored = file?.games || [];
  if (!stored.length) return null;
  if (stored.some((g) => g.firstGoal === undefined)) throw new Error('first goals not stamped yet');
  const before = rows ? rows.filter((r) => r.date < date) : await loadRows(date);
  const runs = await runsFor(date).catch(() => []);
  const playersOf = new Map();
  const runPlayers = async (run) => {
    if (!run) return null;
    if (!playersOf.has(run.id)) playersOf.set(run.id, await getRunResults(run.id).then((res) => indexModelRows(Array.isArray(res) ? res : [])).catch(() => null));
    return playersOf.get(run.id);
  };
  const games = []; const skipped = []; let withRun = 0;
  for (const rec of stored) {
    const away = rec.away?.abbrev; const home = rec.home?.abbrev; const label = `${away} @ ${home}`;
    const skip = (why) => skipped.push({ id: rec.id, game: label, why });
    const fg = rec.firstGoal;
    if (!fg?.playerId) { skip('no first goal'); continue; }
    const g = snap?.games?.[rec.id];
    if (!g?.teams?.[away]?.players || !g.teams[home]?.players) { skip('no lineup captured'); continue; }
    const start = Date.parse(g.startTimeUTC || '');
    if (lateLineup(g.teams[away], start) || lateLineup(g.teams[home], start)) { skip('lineup read after the puck drop'); continue; }
    const players = await runPlayers(runBefore(runs, g.startTimeUTC));
    const scorerName = fg.name || rec.skaters?.find((s) => s.id === fg.playerId)?.name || null;
    const candidates = candidatesAsOf({ game: { away, home, teams: g.teams }, rows: before, date, players })
      .map((c) => ({ name: c.name, team: c.team, p: c.p, hit: c.id != null ? c.id === fg.playerId : !!scorerName && c.team === fg.team && normName(c.name) === normName(scorerName) }));
    const entry = gradeFirst({ id: rec.id, date, game: label, candidates, scorer: scorerName ? { name: scorerName, team: fg.team || null } : null });
    if (!entry) { skip(candidates.length ? 'scorer unknown' : 'nobody dressed on the lineup'); continue; }
    if (players) withRun += 1;
    games.push(entry);
  }
  return { version: FIRST_RESULTS_VERSION, date, builtAt: new Date().toISOString(), slateGames: stored.length, withRun, skipped, games };
}

/**
 * The season's record: every date before `today` with stored games, the graded nights read from the store, at most
 * `backfill` missing nights graded and stored on this call (the newest first; a night that fails is left for a later
 * load and named in `errors`), the rest counted in `missing`.
 */
export async function firstGoalResults({ backfill = FIRST_GOAL_BACKFILL, today = todayET() } = {}) {
  const season = seasonYearOf(today);
  const rows = await loadRows(today);
  const dates = [...new Set(rows.map((r) => r.date))].filter((d) => d < today && seasonYearOf(d) === season).sort();
  const stored = [];
  for (let i = 0; i < dates.length; i += 8) stored.push(...await Promise.all(dates.slice(i, i + 8).map((d) => readJson(firstGoalResultsPath(d)).catch(() => null))));
  const nights = []; const todo = [];
  dates.forEach((d, i) => (firstNightUsable(stored[i]) ? nights.push(stored[i]) : todo.push(d)));
  const errors = []; let built = 0;
  for (const d of todo.reverse()) {
    if (built >= backfill || errors.length >= Math.max(backfill, 1) * 2) break;
    try {
      const night = await gradeFirstGoalNight(d, { rows, today });
      if (!night) continue;
      await writeJson(firstGoalResultsPath(d), night);
      nights.push(night); built += 1;
    } catch (err) { errors.push(`${d}: ${err?.message || err}`); }
  }
  const payload = firstResultsPayload({ what: 'first goal', season, nights, missing: Math.max(0, todo.length - built), errors });
  const sum = (k) => nights.reduce((s, n) => s + (Number(n[k]) || 0), 0);
  return { ...payload, built, withRun: sum('withRun'), skipped: nights.reduce((s, n) => s + (n.skipped?.length || 0), 0) };
}
