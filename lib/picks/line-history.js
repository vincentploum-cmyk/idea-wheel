// The lines across a slate's pulls (Vincent, 2026-11-24: beat the books with PropFinder's data). Each pull replaces the last,
// so before this every line the board graded was the night's last price and nothing said where the market opened or which
// way it moved. `carryForward` runs when a pull is stored, against the copy it replaces:
//  - every prop row keeps `open`: the line and prices of the slate's first pull that listed it (its own on the first pull),
//    so the board can say how the line moved and the scorecard can grade a play against the price it was found at and
//    the last price before tip (closing line value);
//  - a player whose game had started when the pull ran keeps the previous pull's lines when the new one lacks them (the
//    books pull a game's props at tip, and a pull near the late tips must not empty the early games' boards).
import { normName } from '../nhl-data/names';

const keyOf = (p) => p?.key || normName(p?.name || '');
const openOf = (row, at) => ({ line: row.line ?? null, odds: row.odds ?? null, underOdds: row.underOdds ?? null, ...(row.fair != null ? { fair: row.fair } : {}), at });

/**
 * prev / next: { at, data: { players: [{ key, team, props: [{ market, line, odds, underOdds, fair }] }] } } (the stored pull,
 * the one about to be stored); games: the slate's schedule ({ away, home, date }); now: the pull's time (ISO).
 * Returns next with its players' props carrying `open` and the started games' players kept; `carried` counts what moved.
 */
export function carryForward(prev, next, { games = [], now = next?.at || new Date().toISOString() } = {}) {
  const players = next?.data?.players;
  if (!Array.isArray(players)) return { pull: next, carried: { opened: 0, kept: 0, keptPlayers: 0 } };
  const at = next.at || now;
  const before = new Map();
  for (const p of prev?.data?.players || []) before.set(keyOf(p), p);
  const t = Date.parse(now);
  const started = new Set();
  for (const g of games || []) if (g?.date && Number.isFinite(Date.parse(g.date)) && Date.parse(g.date) <= t) { if (g.away) started.add(g.away); if (g.home) started.add(g.home); }
  let opened = 0; let kept = 0; let keptPlayers = 0;
  const seen = new Set();
  const out = players.map((p) => {
    const k = keyOf(p); seen.add(k);
    const old = before.get(k);
    const oldBy = new Map((old?.props || []).map((r) => [r.market, r]));
    let props = (p.props || []).map((r) => {
      const o = oldBy.get(r.market);
      const open = o ? (o.open || openOf(o, prev?.at || at)) : openOf(r, at);
      if (o) opened++;
      return { ...r, open };
    });
    // A started game's lines gone from the new pull: the previous pull's stand, as they were before tip.
    if (started.has(p.team) && old?.props?.length) {
      const have = new Set(props.map((r) => r.market));
      const add = old.props.filter((r) => !have.has(r.market)).map((r) => ({ ...r, open: r.open || openOf(r, prev?.at || at) }));
      if (add.length) { props = [...props, ...add]; kept += add.length; }
    }
    return { ...p, props };
  });
  // A started game's player the new pull left out entirely (an odds-only call lists no one whose props are down).
  for (const [k, p] of before) {
    if (seen.has(k) || !started.has(p.team) || !p.props?.length) continue;
    out.push({ ...p, props: p.props.map((r) => ({ ...r, open: r.open || openOf(r, prev?.at || at) })), carried: prev?.at || null });
    keptPlayers++;
  }
  return { pull: { ...next, data: { ...next.data, players: out } }, carried: { opened, kept, keptPlayers } };
}

/**
 * How the market moved on a side between the open and the last price: the side's implied chance now less at the open
 * (positive: the price shortened toward the side, the market came to it). The line moving counts too: a point of line
 * toward the side is read as the move it is. null without both prices on the same line.
 */
export function moveOf(row, side, implied) {
  const o = row?.open;
  if (!o || o.line == null || row.line == null) return null;
  const now = side === 'under' ? row.underOdds : row.odds;
  const then = side === 'under' ? o.underOdds : o.odds;
  const line = row.line - o.line;
  if (line !== 0) return { line: Math.round(line * 10) / 10, price: null };
  if (now == null || then == null) return { line: 0, price: null };
  const a = implied(now); const b = implied(then);
  return a == null || b == null ? { line: 0, price: null } : { line: 0, price: Math.round((a - b) * 1000) / 1000 };
}
