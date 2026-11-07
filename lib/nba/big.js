// The NBA's big games (Vincent, 2026-11-01: "Do the same big games study for the NBA"; docs/audits/2026-11-01-nba-big-games.md,
// tools/audit/nba_big.py): per stat the players likeliest to reach 30+ / 40+ points, 12+ / 15+ rebounds, 10+ / 12+ assists,
// 5+ / 7+ threes and 40+ / 50+ PRA tonight. The board's chance of a mark is the normal tail of his distribution tonight (the
// board's projection, `ranges[market].exp`, and his spread, the ladder's `sd`); where it beat that chance on both checks
// (2025-26 Oct–Jan → Feb–Apr, and 2025-26 → 2026-27), one context of his own moves it: how often he reached the mark over his
// last 20 games (points, rebounds 12+, assists 10+, PRA), his threes attempted over his last five (threes 5+). The rarest marks
// (rebounds 15+, assists 12+, threes 7+) read the board's chance as it is: nothing beat it, and a recalibration fitted on last
// season overstated this season's. The matchup, the opponent's rank, pace, the line, home and back-to-backs added nothing.
// Pure: the binding (lib/nba/picks.js) runs `nbaBigGames` on every built board, the page reads `board.big`.

import { countTail } from '../picks/projection';

/** Per stat: the projection floor a player needs to be read, the two marks, each mark's model (null = the board's tail as it is). */
export const NBA_BIG = {
  pts: { label: 'Points', min: 12, marks: { 30: { a: -1.1919, b: 0.5142, w: { big: 2.5267 } }, 40: { a: -1.6891, b: 0.4926, w: { big: 4.046 } } } },
  reb: { label: 'Rebounds', min: 5, marks: { 12: { a: -0.9096, b: 0.643, w: { big: 2.0036 } }, 15: null } },
  ast: { label: 'Assists', min: 4, marks: { 10: { a: -1.2101, b: 0.4533, w: { big: 2.472 } }, 12: null } },
  tpm: { label: 'Threes', min: 1.5, marks: { 5: { a: -2.2835, b: 0.3955, w: { tpa5: 0.1687 } }, 7: null } },
  pra: { label: 'PRA', min: 20, marks: { 40: { a: -1.0963, b: 0.5475, w: { big: 2.6045 } }, 50: { a: -1.1843, b: 0.5912, w: { big: 2.9412 } } } },
};
/** His own record needs this many games behind it (the study's floor). */
export const BIG_MIN_GAMES = 5;
/** A chance under this is no candidate on the tab. */
export const NBA_BIG_LIST_MIN = 0.05;

const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
/** The board's chance of reaching `mark` (a whole count: 30+ = more than 29.5) off his projection and spread. */
export function boardTail(exp, sd, mark) {
  if (exp == null || !(sd > 0)) return null;
  const z = (mark - 0.5 - exp) / sd;
  return r3(1 - 0.5 * (1 + erf(z / Math.SQRT2)));
}
/**
 * His chance of the big mark tonight: the board's tail, moved by the mark's model when it has one. The models were fitted on
 * the normal tail and keep it; a mark without one reads the board's own tail, a count's where the ladder reads one
 * (`ctx.tail` = 'count', the cocktail's countTail since 2026-11-07: docs/audits/2026-11-07-nba-outliers.md).
 */
export function nbaBigChance(exp, sd, market, mark, ctx = {}) {
  const spec = NBA_BIG[market];
  if (!spec || exp == null || exp < spec.min) return null;
  const m = spec.marks[mark];
  if (!m && ctx.tail === 'count' && sd > 0) return r3(countTail(mark - 0.5, exp, sd));
  const p0 = boardTail(exp, sd, mark);
  if (p0 == null) return null;
  if (!m) return p0;
  const q = Math.min(1 - 1e-4, Math.max(1e-4, p0));
  let z = m.a + m.b * Math.log(q / (1 - q));
  for (const [k, w] of Object.entries(m.w)) z += w * (k === 'big' ? ctx.big?.[mark] ?? 0 : ctx[k] ?? 0);
  return r3(1 / (1 + Math.exp(-z)));
}

/**
 * The big games on a built board: per stat every active player the board projected from the stat's floor, his chance of
 * each mark, the context the model read (his big games over his last 20, his threes attempted lately), what he got once
 * the game is stored; `lists[market]` = the row ids from NBA_BIG_LIST_MIN at the first mark, the likeliest first.
 *   board: the built board; pf: the slate's pull (the players' logs, newest first); results: the stored box scores;
 *   statOf / actualFor: the binding's readers.
 */
export function nbaBigGames(board, { pf = null, results = {}, statOf, actualFor }) {
  const logsBy = new Map();
  for (const p of pf?.data?.players || []) logsBy.set(`${p.key}|${p.team}`, (p.games || []).filter((g) => (g.type || 'REG') !== 'PRE' && (Number(g.min) || 0) > 0));
  const rows = {};
  const lists = Object.fromEntries(Object.keys(NBA_BIG).map((m) => [m, []]));
  for (const g of board?.games || []) {
    const result = results?.[g.id] || null;
    for (const [team, side] of Object.entries(g.sides || {})) {
      for (const sp of side.players || []) {
        if (sp.out) continue;
        const logs = logsBy.get(`${sp.key}|${team}`) || [];
        if (logs.length < BIG_MIN_GAMES) continue;
        const last20 = logs.slice(0, 20);
        const got = result ? actualFor(result, { key: sp.key, player: sp.player, team }) : undefined;
        for (const [market, spec] of Object.entries(NBA_BIG)) {
          const exp = sp.ranges?.[market]?.exp ?? null;
          const sd = sp.ladders?.[market]?.[0]?.sd ?? null;
          if (exp == null || exp < spec.min || !(sd > 0)) continue;
          const marks = Object.keys(spec.marks).map(Number);
          const vals = last20.map((x) => statOf(x, market)).filter((v) => v != null);
          const hits = Object.fromEntries(marks.map((mk) => [mk, vals.filter((v) => v >= mk).length]));
          const big = Object.fromEntries(marks.map((mk) => [mk, vals.length ? hits[mk] / vals.length : 0]));
          const tpa5 = logs.slice(0, 5).reduce((s, x) => s + (Number(x.tpa) || 0), 0) / Math.min(5, logs.length);
          const ctx = { big, tpa5, tail: sp.ladders?.[market]?.[0]?.tail || null };
          const p = Object.fromEntries(marks.map((mk) => [mk, nbaBigChance(exp, sd, market, mk, ctx)]));
          if (p[marks[0]] == null) continue;
          const actual = got === undefined ? null : got && got.played !== false ? statOf(got, market) : null;
          const id = `${sp.key}|${team}|${market}`;
          rows[id] = {
            id, key: sp.key, player: sp.player, team, opp: side.opp, venue: side.venue || null, game: g.id, pos: sp.pos || null, market, marks, p,
            proj: Math.round(exp * 10) / 10, ctx: { hits, n: vals.length, tpa5: Math.round(tpa5 * 10) / 10 },
            health: sp.health || null, final: !!g.final, actual, got: actual == null ? null : Object.fromEntries(marks.map((mk) => [mk, actual >= mk])),
          };
          if (p[marks[0]] >= NBA_BIG_LIST_MIN) lists[market].push(id);
        }
      }
    }
  }
  for (const m of Object.keys(lists)) lists[m].sort((a, b) => rows[b].p[rows[b].marks[0]] - rows[a].p[rows[a].marks[0]] || rows[a].player.localeCompare(rows[b].player));
  return { rows, lists };
}

// ---- The outliers (Vincent, 2026-11-07: "build the outliers list on the big games tab"; the 10-rebound nights from a 4–5
// projection, "where the money is … the big players are nuked in odds anyways"; docs/audits/2026-11-07-nba-outliers.md,
// section 6): per stat the night's likeliest to reach double his projection and at least `add` over it — a mark relative to
// the player, not to the stars' marks above. The chance is the board's own tail at the mark (the ladder's centre and spread;
// a count's for rebounds, assists and threes) through a fit on 2025-26's replayed board at that mark, σ(a + b · logit):
// the raw tail ran high at its top (rebounds said 10.4% for the night's top ten, 8.0% landed); threes landed on it as it is.
// From `minMinutes` tonight and the stat's projection floor `min`. Where the book's ladder prices the mark, its price and the
// edge ride along.

/** Per stat: the add over his projection, the projection floor, the fit on the tail (null = the tail as it is). */
export const NBA_OUTLIERS = {
  reb: { label: 'Rebounds', add: 4, min: 2.5, cal: { a: -0.8273, b: 0.7428 } },
  tpm: { label: 'Threes', add: 2, min: 0.8, cal: null },
  ast: { label: 'Assists', add: 4, min: 1.5, cal: { a: -1.1561, b: 0.6354 } },
  pts: { label: 'Points', add: 10, min: 6, cal: { a: -1.0284, b: 0.5661 } },
};
/** His minutes tonight needs this many to be read (a bench big at 16 is the list's subject; the plays' gate is 20). */
export const OUTLIER_MIN_MINUTES = 12;
/** A chance under this is no candidate on the list. */
export const OUTLIER_LIST_MIN = 0.03;

/** The outlier mark: double his projection and `add` over it, a whole count (4.4 rebounds → 9+). */
export function outlierMark(exp, market) {
  const spec = NBA_OUTLIERS[market];
  if (!spec || exp == null) return null;
  return Math.max(Math.ceil(2 * exp - 1e-9), Math.ceil(exp + spec.add - 1e-9), 1);
}

/** His chance of the outlier mark tonight: { mark, p, raw } — the board's tail there (`tail` 'count' or the normal), fitted. */
export function outlierChance(exp, sd, market, tail = null) {
  const spec = NBA_OUTLIERS[market];
  if (!spec || exp == null || exp < spec.min || !(sd > 0)) return null;
  const mark = outlierMark(exp, market);
  const raw = tail === 'count' ? r3(countTail(mark - 0.5, exp, sd)) : boardTail(exp, sd, mark);
  if (raw == null) return null;
  if (!spec.cal) return { mark, p: raw, raw };
  const q = Math.min(1 - 1e-4, Math.max(1e-4, raw));
  const z = spec.cal.a + spec.cal.b * Math.log(q / (1 - q));
  return { mark, p: r3(1 / (1 + Math.exp(-z))), raw };
}

const decimalOf = (o) => (o == null || !Number.isFinite(Number(o)) || Number(o) === 0 ? null : Number(o) > 0 ? Number(o) / 100 + 1 : 100 / Math.abs(Number(o)) + 1);

/**
 * The outliers on a built board: per stat every active player from the stat's floor and OUTLIER_MIN_MINUTES, his mark and
 * chance, why (a start off the bench tonight, the teammates out, his nights at the mark this season and last, his minutes),
 * the book's price at the mark when its ladder has the rung, what he got once the game is stored; `lists[market]` = the row
 * ids from OUTLIER_LIST_MIN, the likeliest first.
 *
 * The chance is the ladder's own at the mark when the ladder has the rung (the card's number for that line: Vincent,
 * 2026-11-07, the list said 18% for McCollum's 4+ threes where his card's o3.5 said 16%; `from: 'ladder'`), the fitted
 * tail above where it does not (`from: 'fit'`). His record at the mark is this season's games, then last season's to make
 * 20 (`record` { season, last }: the note read "4+ in 5 of his last 20" off last season's games for a player with none
 * this season; Vincent: "we should look at threes per game not across games").
 */
export function nbaOutliers(board, { pf = null, results = {}, statOf, actualFor, season = null }) {
  const logsBy = new Map();
  for (const p of pf?.data?.players || []) logsBy.set(`${p.key}|${p.team}`, (p.games || []).filter((g) => (g.type || 'REG') !== 'PRE' && (Number(g.min) || 0) > 0));
  const rows = {};
  const lists = Object.fromEntries(Object.keys(NBA_OUTLIERS).map((m) => [m, []]));
  for (const g of board?.games || []) {
    const result = results?.[g.id] || null;
    for (const [team, side] of Object.entries(g.sides || {})) {
      for (const sp of side.players || []) {
        if (sp.out) continue;
        const minutes = sp.minutes?.tonight ?? null;
        if (minutes == null || minutes < OUTLIER_MIN_MINUTES) continue;
        const logs = logsBy.get(`${sp.key}|${team}`) || [];
        if (logs.length < BIG_MIN_GAMES) continue;
        const got = result ? actualFor(result, { key: sp.key, player: sp.player, team }) : undefined;
        // This season's regular-season games and last season's behind them, newest first (the season: the board's, else his newest log's).
        const reg = logs.filter((x) => (x.type || 'REG') === 'REG');
        const thisSeason = season ?? reg.reduce((m, x) => (x.season != null && x.season > m ? x.season : m), -Infinity);
        const mine = reg.filter((x) => x.season === thisSeason).slice(0, 20);
        const before = reg.filter((x) => x.season === thisSeason - 1).slice(0, Math.max(0, 20 - mine.length));
        for (const market of Object.keys(NBA_OUTLIERS)) {
          const range = sp.ranges?.[market]; const ladder = sp.ladders?.[market] || [];
          const fit = outlierChance(range?.exp ?? null, ladder[0]?.sd ?? null, market, ladder[0]?.tail || null);
          if (!fit) continue;
          // The ladder's rung at the mark, his card's number for that line, when the ladder has it.
          const rungAt = ladder.find((r) => r.line === fit.mark - 0.5 && r.p != null) || null;
          const c = rungAt ? { mark: fit.mark, p: rungAt.p, raw: rungAt.raw ?? rungAt.p, from: 'ladder' } : { ...fit, from: 'fit' };
          const vals = logs.slice(0, 20).map((x) => statOf(x, market)).filter((v) => v != null);
          const recordOf = (list) => { const v = list.map((x) => statOf(x, market)).filter((x) => x != null); return { hits: v.filter((x) => x >= c.mark).length, n: v.length }; };
          const rung = ladder.find((r) => r.line === fit.mark - 0.5 && r.odds != null) || null;
          const dec = rung ? decimalOf(rung.odds) : null;
          const book = rung && dec ? { line: rung.line, odds: rung.odds, implied: r3(1 / dec), edge: r3(c.p - 1 / dec), ev: r3(c.p * (dec - 1) - (1 - c.p)) } : null;
          const actual = got === undefined ? null : got && got.played !== false ? statOf(got, market) : null;
          const id = `${sp.key}|${team}|${market}`;
          rows[id] = {
            id, key: sp.key, player: sp.player, team, opp: side.opp, venue: side.venue || null, game: g.id, pos: sp.pos || null, market,
            mark: c.mark, p: c.p, raw: c.raw, from: c.from, proj: Math.round(range.exp * 10) / 10, line: range.line ?? null, minutes,
            hits: vals.filter((v) => v >= c.mark).length, n: vals.length, record: { season: recordOf(mine), last: recordOf(before) },
            role: sp.lineup?.role === 'promoted' || sp.lineup?.role === 'demoted' ? sp.lineup.role : null,
            outFrom: range.outFrom?.length ? range.outFrom : null, book,
            health: sp.health || null, final: !!g.final, actual, hit: actual == null ? null : actual >= c.mark,
          };
          if (c.p >= OUTLIER_LIST_MIN) lists[market].push(id);
        }
      }
    }
  }
  for (const m of Object.keys(lists)) lists[m].sort((a, b) => rows[b].p - rows[a].p || rows[a].player.localeCompare(rows[b].player));
  return { rows, lists };
}
