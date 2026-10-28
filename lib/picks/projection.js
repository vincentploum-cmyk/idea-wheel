// What a player can reach tonight, read from his own stats and the environment: his rate for
// the stat (this season's average blended with his last ten games) scaled by what the opponent
// gives up to his position against the league's average for the window picked. The opponent's
// deviation counts at ENV_WEIGHT (a defense 20% over the league moves the read 12%): the NHL
// study found the per-position environment real but smaller than the raw ratio. Colour and a
// figure only; the chance stays the hit-rate read.
export const ENV_WEIGHT = 0.6;
export const OWN_WEIGHTS = { l10: 0.35, season: 0.65 };
/**
 * The without-teammate split's weight on a read: n / (n + WITHOUT_K) with n his games without the
 * teammates out tonight (PropFinder's Injury Splits, read from the logs: lib/picks/injuries.js).
 * Vincent, 2026-10-27: the split must drive the prediction — one game a fifth of the way, two a
 * third, four halfway, eight two thirds; it moves the whole rate and the whole hit rate, not the
 * season window alone (at 8 it moved the season window only: a +8 split moved a projection a point).
 */
export const WITHOUT_K = 4;
export const withoutWeight = (n, k = WITHOUT_K) => (n > 0 ? Math.round((n / (n + k)) * 1000) / 1000 : 0);

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The standard normal's upper tail, P(Z > z) (Abramowitz–Stegun 7.1.26, error under 1.5e-7). */
export function upperTail(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  const upper = 0.5 * (1 - erf);
  return z >= 0 ? upper : 1 - upper;
}

/** The opponent's factor at a position for a stat: allowed per game over the league's average, damped. */
export function envFactor(allowed, league) {
  if (allowed == null || league == null || !(league > 0)) return null;
  return r3(1 + ENV_WEIGHT * (allowed / league - 1));
}

/**
 * The cheat sheet's tile as a factor on its own: its rank (1 = gives up the most) placed on a
 * standard spread, the most permissive defense SHEET_SPREAD / 2 over the league, the stingiest as
 * far under, damped as the table's factor. Used when PropFinder has no value to place the rank on.
 */
export const SHEET_SPREAD = 0.3;
export function sheetFactor(rank, count = 30) {
  if (rank == null || !(count > 1)) return null;
  const where = 1 - (2 * (rank - 1)) / (count - 1);   // 1 at rank 1, −1 at the last rank
  return r3(1 + ENV_WEIGHT * (SHEET_SPREAD / 2) * where);
}

/**
 * The matchup for a cell of the opponent's table ({ value, rank, sheet, sheetValue }) against the
 * league's average: the cheat sheet first, PropFinder next, both blended (Vincent, 2026-10-28: the
 * sheets say how the matchups look, PropFinder adds the player stats, everything combined into one
 * figure). The sheet's read is its tile's rank placed on PropFinder's own spread for the position
 * and stat (`sheetValue`, the value the defense of that rank allows, board.js tableOf) — a rank 3
 * tile reads as what a rank 3 defense allows — or on the standard spread without a table; PropFinder's
 * read is its value over the league. { factor, pf, sheet, from: 'blend' | 'propfinder' | 'sheet' | null }.
 */
export function matchupOf(cell, league, count = 30) {
  if (!cell) return { factor: null, pf: null, sheet: null, from: null };
  const pf = envFactor(cell.value, league);
  const sheet = cell.sheet == null ? null : cell.sheetValue != null ? envFactor(cell.sheetValue, league) : sheetFactor(cell.sheet, count);
  const factor = pf != null && sheet != null ? r3((pf + sheet) / 2) : pf ?? sheet;
  return { factor, pf, sheet, from: pf != null && sheet != null ? 'blend' : pf != null ? 'propfinder' : sheet != null ? 'sheet' : null };
}

/**
 * His own rate for a stat from his windows ({ l5, l10, season }): the season blended with his last
 * ten (threes and free throws: his attempts × his percentage, board.js volumeOf), moved toward his
 * average in the games without the teammates out tonight (`without`, over `n` games, at
 * `withoutWeight`), × `minFactor` when the windows carry one (his minutes tonight over the minutes
 * behind the rate, lib/picks/rotations.js), plus `lift` (the share of an out teammate's production
 * handed to him tonight, lib/picks/injuries.js vacatedLifts, net of the split's weight and of what
 * the minutes already give him).
 */
export function ownRate(own) {
  if (!own) return null;
  const blend = (w) => (w?.l10 != null && w?.season != null ? OWN_WEIGHTS.l10 * w.l10 + OWN_WEIGHTS.season * w.season : w?.season ?? w?.l10 ?? w?.l5 ?? null);
  let base = blend(own);
  const att = own.volume?.pct != null ? blend(own.volume.att) : null;
  if (att != null && att > 0) base = att * own.volume.pct;
  if (base == null) return null;
  if (own.without != null && own.n > 0) { const w = withoutWeight(own.n); base = w * own.without + (1 - w) * base; }
  return r1(base * (own.minFactor || 1) + (own.lift || 0));
}

/** The projection: his rate × the environment (1 without a table). */
export function projectionOf(own, factor) {
  const rate = typeof own === 'number' ? own : ownRate(own);
  if (rate == null) return null;
  return r1(rate * (factor ?? 1));
}

/**
 * The board's projection for a side player and stat, with its arithmetic, as every view shows it:
 * `ranges[stat]` on the player (lib/picks/board.js sidesOf: rate × matchup × team = exp, `env`
 * their product, the season table behind the matchup), else the same read off his windows and the
 * season table (`projectFor`) for a stat without a ladder. `pos` is the spot his environment is
 * read at (the court's envPos, the card's). The season table's cell at his spot rides along for
 * the hover (allowed, rank, league, count, held = last season's alone so far).
 */
export function boardRead(p, stat, seasonAllowed, pos) {
  const row = seasonAllowed?.rows?.[pos] || null;
  const cell = row?.[stat] || null;
  const league = seasonAllowed?.league?.[pos]?.[stat] ?? null;
  const spot = { pos, allowed: cell?.value ?? null, rank: cell?.rank ?? null, sheetRank: cell?.sheet ?? null, rankBlend: cell?.rankBlend ?? cell?.rank ?? null, league, count: seasonAllowed?.count || null, held: !!row?.held, matchupFrom: matchupOf(cell, league, seasonAllowed?.count || 30) };
  const r = p?.ranges?.[stat];
  if (r?.exp != null) return { value: r.exp, rate: r.rate ?? null, matchup: r.matchup ?? null, team: r.team ?? null, env: r.env ?? null, floor: r.floor ?? null, ceiling: r.ceiling ?? null, lift: r.lift ?? null, liftFrom: r.liftFrom || null, minutes: r.minutes || null, volume: r.volume || null, from: 'board', ...spot, ...(r.matchupFrom ? { matchupFrom: r.matchupFrom } : {}) };
  const f = projectFor(p?.own?.[stat], seasonAllowed, pos, stat, p?.scale || null);
  const env = f.factor == null && f.team == null ? null : r3((f.factor ?? 1) * (f.team ?? 1));
  return { value: f.value, rate: f.rate, matchup: f.factor, team: f.team, env, floor: null, ceiling: null, lift: p?.own?.[stat]?.lift ?? null, liftFrom: p?.own?.[stat]?.liftFrom || null, minutes: p?.minutes || null, volume: p?.own?.[stat]?.volume ? { att: ownRate(p.own[stat].volume.att), pct: p.own[stat].volume.pct } : null, from: 'own', ...spot };
}

/**
 * What a picked window of the opponent's table would read in place of the season table, for the
 * hover beside the board's figure (the window tints and fills the table, it moves no figure): its
 * cell and factor at his spot, his rate × that × the side's factor; null without a cell or a rate.
 */
export function windowRead(read, allowed, stat) {
  if (read?.rate == null) return null;
  const cell = allowed?.rows?.[read.pos]?.[stat];
  const league = allowed?.league?.[read.pos]?.[stat];
  const factor = matchupOf(cell, league, allowed?.count || 30).factor;
  if (factor == null) return null;
  return { value: r1(read.rate * factor * (read.team ?? 1)), factor, allowed: cell.value, rank: cell?.rank ?? null, league };
}

/** Both at once for a player, position and stat against a side's allowed table ({ rows, league }). */
export function projectFor(own, allowed, pos, stat, scale = null) {
  const cell = allowed?.rows?.[pos]?.[stat];
  const league = allowed?.league?.[pos]?.[stat];
  const factor = matchupOf(cell, league, allowed?.count || 30).factor;
  const rate = ownRate(own);
  const team = scale?.[stat] ?? null;   // the side's factor so its projections add up to the team's expected total
  return { rate, factor, team, value: projectionOf(rate, (factor ?? 1) * (team ?? 1)), allowed: cell?.value ?? null, league: league ?? null, rank: cell?.rank ?? null };
}
