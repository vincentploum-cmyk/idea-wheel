// The client-safe half of lib/nba/vs-position.js (the card filters and sums the rows it is sent): the position tabs,
// the rows at a tab, the summary for a market and line.
export const POS_TABS = ['PG', 'SG', 'SF', 'PF', 'C'];
// ESPN's box score places a player only as G / F / C: a player no pull knows shows at both positions his group covers.
export const WIDE = { G: ['PG', 'SG'], F: ['SF', 'PF'] };

/** The rows at a position tab: the players placed there, and the unplaced whose ESPN group covers it. */
export function atPosition(rows, pos) {
  return (rows || []).filter((r) => r.pos === pos || (r.posFrom === 'espn' && (WIDE[r.pos] || []).includes(pos)));
}

/**
 * The rows at a position summed up for a market: player-games, games, the average a player-game, how many cleared the line,
 * and the position's total per game (the unit of PropFinder's table). `valueOf(row)` reads the market's figure off a row.
 */
export function vsPositionSummary(rows, valueOf, line = null) {
  const vals = (rows || []).map((r) => ({ v: valueOf(r), g: r.gameId })).filter((x) => x.v != null && Number.isFinite(x.v));
  if (!vals.length) return { n: 0, games: 0, avg: null, cleared: null, perGame: null };
  const games = new Set(vals.map((x) => x.g)).size;
  const sum = vals.reduce((s, x) => s + x.v, 0);
  return {
    n: vals.length, games,
    avg: Math.round((sum / vals.length) * 10) / 10,
    cleared: line == null ? null : vals.filter((x) => x.v > line).length,
    perGame: games ? Math.round((sum / games) * 10) / 10 : null,
  };
}
