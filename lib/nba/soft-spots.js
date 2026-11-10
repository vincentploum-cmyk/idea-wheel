// The NBA's "Soft spots" (Vincent, 2026-11-10, of the NHL's list on Best bets — the skaters facing one of the five worst
// defenses at their position — "We should do the same with nba"): every regular whose opponent tonight ranks 1st to 5th of
// the league in what it gives up to his position for points, rebounds, assists or threes, on the season table the board
// reads (each side's `allowed` table, lib/picks/board.js sidesOf: PropFinder's season ranks, rank 1 = gives up the most;
// the cheat sheet's ranks on a night without a PropFinder table). Each row carries the board's own figures, untouched:
// his projection for the stat (`ranges[stat].exp`), the book's main line with the board's chance of the over there (the
// ladder's main rung, as the court's chip and the Cheat sheet tab read it), the price, the break-even price of that
// chance and the edge; the projection alone without a line. Once the game is final the row is graded over the line.
// The same cut flames a regular's chip on the court for the court's picked stat (components/nba/NbaCourt.jsx).
// Pure and client-safe: read off the board the page already holds, no request of its own.
import { impliedProb, fairOdds } from '../nfl/odds';
import { ordinal, SHEET_STATS } from './sheet-matchups';

/** The cut: the opponent among the league's five most permissive at the position for the stat. */
export const SOFT_TOP = 5;
/** The stats the list reads (the cheat sheet's four: points, rebounds, assists, threes). */
export const SOFT_STATS = SHEET_STATS;
/** A regular: projected for this many minutes tonight or more (the board's `minutes.tonight`). */
export const REGULAR_MIN = 24;
/** Rows before "Show all". */
export const SOFT_SHOWN = 12;

const STAT_WORD = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', stl: 'steals', blk: 'blocks' };
const STAT_SHORT = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', stl: 'STL', blk: 'BLK' };
const ZONE_OF = { PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C', G: 'SG', F: 'SF' };
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

export const statWord = (stat) => STAT_WORD[stat] || stat;
export const statShort = (stat) => STAT_SHORT[stat] || String(stat || '').toUpperCase();

/** His spot on the opponent's table: the board's `envPos` (the depth chart's slot, else his position; G → SG, F → SF). */
export const spotPos = (p) => p?.envPos || ZONE_OF[String(p?.slot || p?.pos || '').toUpperCase()] || ZONE_OF[String(p?.pos || '').toUpperCase()] || null;

/**
 * A regular, as the board lists him: not out, not flagged idle (`idle`, the board's gate for the players not expected to
 * play) nor thin (`thin`, projected under the value floor's 20 minutes), with a projection for the stat, and projected for
 * `REGULAR_MIN` minutes or more tonight (`minutes.tonight`, the rotation's or the starting five's read); a board without a
 * minutes read for him counts the depth chart's starter (depth 1) or a player in tonight's five (`lineup.role`).
 */
export function isRegular(p, stat = null) {
  if (!p || p.out || p.idle || p.thin) return false;
  if (stat && p.ranges?.[stat]?.exp == null) return false;
  const min = p.minutes?.tonight;
  if (min != null) return min >= REGULAR_MIN;
  return p.depth === 1 || p.lineup?.role === 'starter' || p.lineup?.role === 'promoted';
}

/**
 * The opponent's cell at the position for the stat when it ranks in the top `top` (rank 1 = gives up the most), else null:
 * { pos, stat, rank, count, value, league, sheet, held }. `allowed` = the side's season table (`side.allowed`).
 */
export function topSpot(allowed, pos, stat, top = SOFT_TOP) {
  const cell = pos && stat ? allowed?.rows?.[pos]?.[stat] : null;
  const rank = cell?.rank;
  if (!(rank >= 1) || rank > top) return null;
  return {
    pos, stat, rank, count: allowed.count || null, value: cell.value ?? null, league: allowed.league?.[pos]?.[stat] ?? null,
    sheet: cell.sheet ?? null, held: !!allowed.rows[pos]?.held, from: allowed.from || null,
  };
}

/** The hover's sentence: "Soft spot: BOS allows the 2nd most points to SG this season (24.1 a game, #2 of 30, the league 20.3)". */
export function topSpotText(spot, opp) {
  if (!spot) return '';
  const fig = [spot.value != null ? `${Number(spot.value).toFixed(1)} a game` : null, `#${spot.rank}${spot.count ? ` of ${spot.count}` : ''}`, spot.league != null ? `the league ${Number(spot.league).toFixed(1)}` : null].filter(Boolean).join(', ');
  const when = spot.held ? 'last season (no game this season yet)' : 'this season';
  const sheet = spot.sheet != null && spot.from !== 'sheet' ? `; the cheat sheet's tile #${spot.sheet}` : '';
  return `Soft spot: ${opp} allows the ${ordinal(spot.rank)} most ${statWord(spot.stat)} to ${spot.pos} ${when} (${fig}${sheet})`;
}

/** The player's top-five spot for a stat on his side's table, if he is a regular: the court's flame. */
export function playerTopSpot(p, allowed, stat, top = SOFT_TOP) {
  if (!isRegular(p, stat)) return null;
  return topSpot(allowed, spotPos(p), stat, top);
}

/**
 * The night's soft spots: one row per regular and stat where tonight's opponent ranks in the top `top` at his spot, every
 * game of `board` (cut it to one game first for the head's dropdown). Rows:
 * { id, game, key, player, espnId, team, opp, venue, pos, slot, depth, health, minutes, market, stat, rank, count, value,
 *   league, sheet, held, exp, floor, ceiling, line, p, raw, odds, implied, fair, edge, bet, start, final, actual, hit }.
 * Ordered: the priced lines by the edge, then the lines without a price by the chance, then the projections alone by the
 * rank (then the projection).
 */
export function softSpots(board, { top = SOFT_TOP, stats = SOFT_STATS } = {}) {
  const rows = [];
  const best = board?.best || [];
  for (const g of board?.games || []) {
    for (const team of [g.away, g.home]) {
      const side = g.sides?.[team];
      if (!side?.allowed?.rows) continue;
      for (const p of side.players || []) {
        const pos = spotPos(p);
        for (const stat of stats) {
          if (!isRegular(p, stat)) continue;
          const spot = topSpot(side.allowed, pos, stat, top);
          if (!spot) continue;
          const r = p.ranges[stat];
          const main = (p.ladders?.[stat] || []).find((x) => x.main) || null;
          const line = main?.line ?? r.line ?? null;
          const pr = line == null ? null : main?.p ?? r.p ?? null;
          const odds = line == null ? null : main?.odds ?? r.odds ?? null;
          const implied = odds == null ? null : impliedProb(odds);
          // Graded off his plays for the stat once the box score is in (`actual`: the figure, null = did not play).
          const graded = (p.plays || []).find((x) => x.market === stat && x.actual !== undefined) || null;
          const actual = g.final && graded ? graded.actual : undefined;
          const bet = best.find((b) => b.game === g.id && b.key === p.key && b.market === stat) || null;
          rows.push({
            id: `${g.id}|${p.key}|${stat}`, game: g.id, key: p.key, player: p.player, espnId: p.espnId || null, team, opp: side.opp, venue: side.venue,
            pos, slot: p.slot || null, depth: p.depth || null, health: p.health || null, minutes: p.minutes?.tonight ?? null,
            market: stat, stat, rank: spot.rank, count: spot.count, value: spot.value, league: spot.league, sheet: spot.sheet, held: spot.held, from: spot.from,
            exp: r.exp, floor: r.floor ?? null, ceiling: r.ceiling ?? null,
            line, p: pr, raw: line == null ? null : main?.raw ?? r.raw ?? null, odds, implied: r3(implied), fair: pr == null ? null : fairOdds(pr),
            edge: pr != null && implied != null ? r3(pr - implied) : null,
            bet: bet ? { side: bet.side, line: bet.line, p: bet.p, odds: bet.odds, edge: bet.edge } : null,
            start: g.date || null, final: !!g.final, actual, hit: actual == null || line == null ? null : actual > line,
          });
        }
      }
    }
  }
  const tier = (x) => (x.edge != null ? 0 : x.p != null ? 1 : 2);
  return rows.sort((a, b) => tier(a) - tier(b)
    || (tier(a) === 0 ? b.edge - a.edge : 0)
    || (tier(a) <= 1 ? (b.p ?? 0) - (a.p ?? 0) : 0)
    || a.rank - b.rank || b.exp - a.exp || a.player.localeCompare(b.player));
}
