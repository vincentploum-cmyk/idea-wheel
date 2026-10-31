// The night's best cheat-sheet matchups, per game (Vincent, 2026-10-31: "create a new view with best cheat sheet matchups
// per game"): the cheat sheet's rank tiles — what each team's opponent gives up to each position for points, rebounds,
// assists and threes, rank 1 = the most of the 30 — read off the board payload (every cell of a side's `allowed` table
// carries its tile as `sheet`, lib/picks/board.js sidesOf), the soft ones ranked across both sides of a game, each with
// the side's active players at that spot (the board's `envPos`: the depth chart's slot, else his position), his projection
// for the stat, the book's main line with the board's chance and edge there, and whether it made the night's best bets.
// Pure and client-safe: the tab reads the board it already has, no request of its own.
import { impliedProb } from '../nfl/odds';

export const SHEET_STATS = ['pts', 'reb', 'ast', 'tpm'];
export const SHEET_POS = ['PG', 'SG', 'SF', 'PF', 'C'];
/** A tile in the soft third of the sheet's 30 teams is a matchup worth a look. */
export const SHEET_SOFT = 10;
export const SHEET_TEAMS = 30;
/** Players shown at a spot, the highest projection first. */
export const PER_SPOT = 3;

const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const thirdOf = (rank, count) => { if (!rank || !count) return null; const t = Math.ceil(count / 3); return rank <= t ? 'soft' : rank > count - t ? 'tough' : 'mid'; };

/** Whether the board's game has a cheat-sheet tile on either side. */
export const hasSheet = (g) => Object.values(g?.sides || {}).some((s) => Object.values(s?.allowed?.rows || {}).some((row) => Object.values(row || {}).some((c) => c?.sheet != null)));

/**
 * The game's soft cheat-sheet tiles, both sides, the softest first (the sheet's rank, then PropFinder's), each:
 * { team, opp, venue, pos, stat, sheet, pfRank, count, value, league, agree ('soft' when PropFinder's table puts the
 * cell in its soft third too, 'mid' / 'tough' when it does not, null without a rank), players: [{ key, player, slot,
 * depth, health, exp, floor, ceiling, line, p, raw, odds, implied, edge, bet, entry }] }. `best` = the board's best bets
 * (the row's `bet` when one is his for the stat in this game). `soft` = the last rank kept (null keeps every tile).
 */
export function sheetMatchups(g, { best = [], soft = SHEET_SOFT, perSpot = PER_SPOT } = {}) {
  const rows = [];
  for (const team of [g?.away, g?.home]) {
    const side = g?.sides?.[team];
    if (!side?.allowed?.rows) continue;
    const count = side.allowed.count || SHEET_TEAMS;
    for (const pos of SHEET_POS) {
      for (const stat of SHEET_STATS) {
        const cell = side.allowed.rows[pos]?.[stat];
        if (cell?.sheet == null || (soft != null && cell.sheet > soft)) continue;
        const players = (side.players || [])
          .filter((p) => !p.out && p.envPos === pos && p.ranges?.[stat]?.exp != null)
          .map((p) => {
            const r = p.ranges[stat];
            const main = (p.ladders?.[stat] || []).find((x) => x.main) || null;
            const odds = main?.odds ?? r.odds ?? null;
            const pr = main?.p ?? r.p ?? null;
            const implied = odds == null ? null : impliedProb(odds);
            const bet = (best || []).find((b) => b.game === g.id && b.key === p.key && b.market === stat) || null;
            return {
              key: p.key, player: p.player, slot: p.slot || null, depth: p.depth || null, health: p.health || null,
              exp: r.exp, floor: r.floor ?? null, ceiling: r.ceiling ?? null,
              line: main?.line ?? r.line ?? null, p: pr, raw: main?.raw ?? r.raw ?? null, odds, implied: r3(implied),
              edge: pr != null && implied != null ? r3(pr - implied) : null,
              bet: bet ? { side: bet.side, line: bet.line, p: bet.p, odds: bet.odds, edge: bet.edge } : null,
              entry: p,
            };
          })
          .sort((a, b) => b.exp - a.exp || a.player.localeCompare(b.player))
          .slice(0, perSpot);
        rows.push({
          team, opp: side.opp, venue: side.venue, pos, stat, sheet: cell.sheet, pfRank: cell.rank ?? null, count,
          value: cell.value ?? null, league: side.allowed.league?.[pos]?.[stat] ?? null,
          agree: cell.rank == null ? null : thirdOf(cell.rank, count), players,
        });
      }
    }
  }
  return rows.sort((a, b) => a.sheet - b.sheet || (a.agree === 'soft' ? 0 : 1) - (b.agree === 'soft' ? 0 : 1) || (a.pfRank ?? 99) - (b.pfRank ?? 99) || b.players.length - a.players.length);
}

/** "2nd", "11th", "23rd". */
export const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
