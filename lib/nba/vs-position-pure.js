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

/**
 * Players like the card's (Vincent, 2026-10-31: "mark the players in purple when they are similar to the player on the
 * player's card"; the NHL card's violet wash, `similarProfile` in lib/nhl-data/profile.js): a profile is a player's
 * averages a game this season before tonight from the stored box scores — minutes, points, rebounds, assists, threes,
 * games he played (`n`). Another player is like him when every figure sits inside the band of his (the larger of the
 * share and the floor, so a 1.2-assist player is not held to a tenth of an assist) and the profile is read off
 * LIKE_MIN_GAMES at least.
 */
export const LIKE_BAND = { min: { pct: 0.2, min: 4 }, pts: { pct: 0.25, min: 3 }, reb: { pct: 0.35, min: 1.5 }, ast: { pct: 0.35, min: 1.5 }, tpm: { pct: 0.4, min: 0.8 } };
export const LIKE_MIN_GAMES = 3;

/** True when profile b sits inside every band of profile a, b read off LIKE_MIN_GAMES games at least. */
export function similarLine(a, b) {
  if (!a || !b || !(b.n >= LIKE_MIN_GAMES) || !(a.n >= 1)) return false;
  return Object.entries(LIKE_BAND).every(([k, band]) => a[k] != null && b[k] != null && Math.abs(a[k] - b[k]) <= Math.max(band.min, band.pct * a[k]));
}

/** A profile in words: "31 min · 14.2 PTS · 6.1 REB · 2.4 AST · 1.3 3PM a game over 6 games". */
export function profileText(p) {
  if (!p) return '';
  const f = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1));
  return `${Math.round(p.min ?? 0)} min · ${f(p.pts)} PTS · ${f(p.reb)} REB · ${f(p.ast)} AST · ${f(p.tpm)} 3PM a game over ${p.n} game${p.n === 1 ? '' : 's'}`;
}

/** The bands in words, for the hover. */
export const LIKE_RULE = `Players like him: his averages this season before tonight from the stored box scores, each within the band of his — minutes ±20% (4 at least), points ±25% (3), rebounds and assists ±35% (1.5), threes ±40% (0.8) — read off ${LIKE_MIN_GAMES} games at least.`;
