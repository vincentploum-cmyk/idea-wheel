// The first-touchdown picks' season record (Vincent, 2026-11-14: "the season track record for all three"): per finished
// week our First TD list of each game (the touchdown list's `pFirst`, lib/nfl/projections.js) set against who scored the
// game's first touchdown (the stored game's `firstTd`, lib/nfl/espn.js), graded and added up by lib/picks/first-results.js.
//
// LEAK-FREE. A week's list must hold nothing its games taught us, and the week's stored files do: the PropFinder pull is
// written again every morning (lib/schedule-jobs.js `nfl-morning`), the Monday and the Tuesday after the games included,
// so the pull a finished week keeps is normally the one taken AFTER its games. What each game is read on:
//   - a game that kicked off after the stored pull ran (`asOf: 'pull'`): the pull as the board had it — his logs (cut
//     before the game all the same), the pull's own statuses, its defense table and its matchup pages (the digest keyed
//     to that pull);
//   - a game the stored pull ran after (`asOf: 'replay'`, the usual case): every player's log cut before his game
//     (lib/picks/scorecard.js `asOf`); NO status or injury (the pull's are the days after: a back hurt in the game reads
//     IR); NO book line on the players; NO matchup pages (season totals holding the game, and that week's pairings are
//     gone from the week before's); the defense table and the depth chart of the WEEK BEFORE's stored pull, taken the
//     Tuesday between the two weeks (PropFinder's table going into the week), and no table at all when that pull is not
//     stored or did not run before the week's first kickoff (week 1; a week skipped).
// Either way: no stored box score in the build (the board would settle from it who played), no ESPN injury feed and no
// admin override (both read until the week's last game), the cheat sheets as uploaded (printed before the games).
// NOT reproducible, and so said on the stored week (`inputs`) and in docs/claude/nfl.md:
//   - the model is today's code and constants on that week's data, not the build that ran that morning;
//   - a replayed list knows less than the morning's board did (who was ruled out, the pages), never more: a player ruled
//     out before the game is still on it;
//   - the roster, each player's team and, for a team without a pull the week before (its bye), its depth slots are the
//     stored pull's, a day or two after the games;
//   - the book's total (the game's expected touchdowns) is what the stored schedule still carries; without one the
//     listed players' sum stands in, as on the board.
import { readJson, writeJson } from '../nhl-store';
import { asOf, etDate } from '../picks/scorecard';
import { gradeFirst, firstResultsPayload, firstNightUsable, FIRST_RESULTS_VERSION } from '../picks/first-results';
import { buildBoard, actualFor } from './picks';
import { P, loadSheets, loadResults, ensureSchedule, resolveWeek, weeksWithData, weekFromKey, shiftWeek } from './store';
import { todayET, weekLabel } from './week';

/** The replay's own version: a stored week built another way is built again. */
export const FIRST_TD_REPLAY = 1;
/** Weeks built per call at most: each reads two gzipped pulls (15 MB and up unzipped) and builds the week's board. */
export const FIRST_TD_BACKFILL = 2;
const STALE_MS = 6 * 3600 * 1000;

const ordinal = (wk) => (wk.type === 3 ? 18 + wk.week : wk.week);
/** nfl/<season>/<wk>/first-td-results.json, beside the week's schedule (the store's `P.*` folder). */
export const firstTdPath = (wk) => P.schedule(wk).replace(/schedule\.json$/, 'first-td-results.json');
const usable = (file) => firstNightUsable(file) && file.replay === FIRST_TD_REPLAY;
const preGame = (g) => ({ id: g.id, date: g.date, away: g.away, home: g.home, odds: g.odds || null, detail: g.detail || '', final: false, state: 'pre', awayScore: null, homeScore: null });

/**
 * The builds a past week is replayed with (pure): one for the games the stored pull ran before, one for the games it
 * ran after (see the head of the file). `pull` the week's stored pull, `digest` its pages' digest, `prior` the week
 * before's stored pull, `games` the week's schedule. → [{ asOf: 'pull' | 'replay', table, pages, games, pf }].
 */
export function replayInputs({ games, pull, digest = null, prior = null }) {
  if (!pull?.data?.players?.length) return [];
  const at = Date.parse(pull.at);
  const kick = (g) => Date.parse(g.date);
  const ahead = (g) => Number.isFinite(at) && Number.isFinite(kick(g)) && at < kick(g);
  const cut = asOf(pull, games);
  const out = [];
  const before = games.filter(ahead);
  if (before.length) {
    const pages = !!digest && digest.at === pull.at;
    out.push({ asOf: 'pull', table: cut.data.defense ? 'this pull' : 'none', pages, games: before.map(preGame), pf: pages ? { ...cut, matchups: digest } : cut });
  }
  const after = games.filter((g) => !ahead(g));
  if (after.length) {
    const first = Math.min(...games.map(kick).filter(Number.isFinite));
    const priorOk = !!prior?.data?.defense && Number.isFinite(Date.parse(prior.at)) && Date.parse(prior.at) < first;
    const players = cut.data.players.map((p) => ({ ...p, status: null, injury: null, injuryDetail: null, props: [] }));
    const data = { players, defense: priorOk ? prior.data.defense : null, depth: { ...(pull.data.depth || {}), ...(priorOk ? prior.data.depth || {} : {}) }, injuries: { rows: [] } };
    out.push({ asOf: 'replay', table: priorOk ? 'the week before' : 'none', pages: false, games: after.map(preGame), pf: { at: pull.at, data } });
  }
  return out;
}

/**
 * One build's games graded (pure): each game's touchdown list (`lists.td`: the names the First TD column shows) with
 * the chance each was given, against the stored game's first touchdown. → { entries, skipped: [{ id, game, why }] }.
 * A game without a touchdown, without a list or without a stored result is skipped.
 */
export function gradeFirstTdGames({ wk, board, results, asOf: how = null }) {
  const pj = board?.projections;
  const entries = []; const skipped = [];
  for (const g of pj?.games || []) {
    const game = `${g.away} @ ${g.home}`;
    const result = results?.[g.id];
    if (!result) { skipped.push({ id: g.id, game, why: 'no stored result' }); continue; }
    if (!result.firstTd?.name) { skipped.push({ id: g.id, game, why: 'no touchdown' }); continue; }
    const rows = (g.lists?.td ? g.lists.td.map((id) => pj.rows[id]) : Object.values(pj.rows || {}).filter((r) => r.game === g.id && !r.backup)).filter((r) => r?.td?.pFirst != null);
    const candidates = rows.map((r) => ({ name: r.player, team: r.team, p: r.td.pFirst, hit: actualFor(result, { key: r.key, player: r.player, team: r.team })?.firstTd > 0 }));
    const entry = gradeFirst({ id: g.id, date: etDate(g.date), game, candidates, scorer: result.firstTd });
    if (!entry) { skipped.push({ id: g.id, game, why: 'no list' }); continue; }
    entries.push({ ...entry, week: ordinal(wk), label: weekLabel(wk), asOf: how });
  }
  return { entries, skipped };
}

/**
 * A finished week built from its stored files and kept at `firstTdPath(wk)`:
 * { version, replay, season, week, type, label, date (the first game's ET date), builtAt, inputs: [{ asOf, table, pages,
 *   games }], games: [entry], skipped }. A week with no pull is kept empty (it never gets one); a week whose finished
 * games are not all stored throws (the next call tries again).
 */
export async function buildFirstTdWeek(wk, { ensure = ensureSchedule, now = Date.now() } = {}) {
  const read = async () => { const s = await readJson(P.schedule(wk)); const games = s?.games || []; return { games, results: await loadResults(wk, games) }; };
  let { games, results } = await read();
  const behind = () => !games.length || games.some((g) => (g.final ? !results[g.id] : Date.parse(g.date) < now - STALE_MS));
  if (behind()) {
    try { await ensure(wk, { force: true }); } catch (err) { if (!games.length) throw err; }
    ({ games, results } = await read());
  }
  const finals = games.filter((g) => g.final);
  const label = weekLabel(wk);
  if (!finals.length) throw new Error(`${label}: no finished game stored`);
  const unstored = finals.filter((g) => !results[g.id]);
  if (unstored.length) throw new Error(`${label}: ${unstored.length} finished game${unstored.length === 1 ? '' : 's'} without a stored box score`);
  const base = { version: FIRST_RESULTS_VERSION, replay: FIRST_TD_REPLAY, season: wk.season, week: wk.week, type: wk.type, label, date: finals.map((g) => etDate(g.date)).sort()[0], builtAt: new Date(now).toISOString() };
  const pull = await readJson(P.propfinder(wk));
  let file;
  if (!pull?.data?.players?.length) file = { ...base, inputs: [], games: [], skipped: [], empty: 'no PropFinder pull stored for the week' };
  else {
    const before = shiftWeek(wk, -1);
    const [digest, prior, sheets] = await Promise.all([
      readJson(P.propfinderPagesDigest(wk)).catch(() => null),
      ordinal(before) < ordinal(wk) ? readJson(P.propfinder(before)).catch(() => null) : null,
      loadSheets(wk),
    ]);
    const entries = []; const skipped = []; const inputs = [];
    for (const b of replayInputs({ games: finals, pull, digest, prior })) {
      const board = buildBoard({ ...wk, games: b.games, sheets, pf: b.pf, results: {} });
      const got = gradeFirstTdGames({ wk, board, results, asOf: b.asOf });
      entries.push(...got.entries); skipped.push(...got.skipped);
      inputs.push({ asOf: b.asOf, table: b.table, pages: b.pages, games: b.games.length });
    }
    file = { ...base, inputs, games: entries, skipped };
  }
  await writeJson(firstTdPath(wk), file);
  return file;
}

/**
 * The season's record: the stored weeks before this one, at most `backfill` missing weeks built on the way (a failed
 * build is not fatal: the week stays `missing` and its reason goes to `errors`). → firstResultsPayload's shape.
 */
export async function firstTdResults({ backfill = FIRST_TD_BACKFILL, date = todayET(), build = buildFirstTdWeek } = {}) {
  const current = await resolveWeek({ date });
  const season = current.season;
  const weeks = (await weeksWithData(season)).map((n) => weekFromKey(season, n)).filter(Boolean).filter((wk) => ordinal(wk) < ordinal(current)).sort((a, b) => ordinal(a) - ordinal(b));
  const nights = []; const errors = [];
  let missing = 0; let built = 0;
  for (const wk of weeks) {
    let file = await readJson(firstTdPath(wk)).catch(() => null);
    if (!usable(file)) {
      file = null;
      if (built < backfill) {
        built++;
        try { file = await build(wk); } catch (err) { errors.push(`${weekLabel(wk)}: ${String(err?.message || err).replace(`${weekLabel(wk)}: `, '')}`); }
      }
    }
    if (usable(file)) nights.push({ date: file.date, week: ordinal(wk), games: file.games });
    else missing++;
  }
  return firstResultsPayload({ what: 'first touchdown', season, nights, missing, errors });
}
