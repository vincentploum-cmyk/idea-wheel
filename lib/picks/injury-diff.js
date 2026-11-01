// What a fresh read of the injury feed changed on a built board (pure, client-safe): who moved between In / DTD / Out and
// which projections moved with them. The NFL's "Pull injuries" button (POST /api/nfl/refresh?only=injuries) reports it.
// Vincent, 2026-11-01: "a button for NFL to pull the latest injury news and adjust the predictions".

const HEALTH_ORDER = { In: 0, DTD: 1, Out: 2 };
const YARD_MARKETS = ['pass_yds', 'rush_yds', 'rec_yds', 'receptions'];

/** Every side player on the board by team|key: { name, team, pos, health, injury, detail }. */
function playersOf(board) {
  const out = new Map();
  for (const g of board?.games || []) {
    if (g.final) continue;   // a played game's statuses come off the box score, not the feed
    for (const side of Object.values(g.sides || {})) {
      for (const p of side.players || []) {
        out.set(`${side.team}|${p.key}`, { name: p.player, team: side.team, pos: p.pos || null, health: p.health || 'In', injury: p.injury || null, detail: p.injuryDetail || null });
      }
    }
  }
  return out;
}

/**
 * before / after: two builds of the same slate's board. → { status: [{ name, team, pos, from, to, injury, detail }],
 * moved: [{ name, team, pos, market, from, to }] (a projection that moved by 0.5 of its unit or more, a TD chance by a
 * point or more), counts }. The status changes the worse first (newly out, then newly doubtful, then back in).
 */
export function injuryChanges(before, after) {
  const a = playersOf(before);
  const b = playersOf(after);
  const status = [];
  for (const [k, p] of b) {
    const was = a.get(k);
    if (!was || was.health === p.health) continue;
    status.push({ name: p.name, team: p.team, pos: p.pos, from: was.health, to: p.health, injury: p.injury, detail: p.detail });
  }
  status.sort((x, y) => (HEALTH_ORDER[y.to] - HEALTH_ORDER[x.to]) || (HEALTH_ORDER[x.from] - HEALTH_ORDER[y.from]) || String(x.team).localeCompare(String(y.team)) || String(x.name).localeCompare(String(y.name)));

  const moved = [];
  const ra = before?.projections?.rows || {};
  const rb = after?.projections?.rows || {};
  for (const [id, r] of Object.entries(rb)) {
    const o = ra[id];
    if (!o || r.final) continue;
    for (const m of YARD_MARKETS) {
      const x = o.yards?.[m]?.proj;
      const y = r.yards?.[m]?.proj;
      if (x == null || y == null) continue;
      if (Math.abs(y - x) >= 0.5) moved.push({ name: r.player, team: r.team, pos: r.pos || null, market: m, from: x, to: y });
    }
    const x = o.td?.p;
    const y = r.td?.p;
    if (x != null && y != null && Math.abs(y - x) >= 0.01) moved.push({ name: r.player, team: r.team, pos: r.pos || null, market: 'anytime_td', from: x, to: y });
  }
  moved.sort((x, y) => Math.abs(rel(y)) - Math.abs(rel(x)));

  return { status, moved, counts: { status: status.length, out: status.filter((s) => s.to === 'Out').length, dtd: status.filter((s) => s.to === 'DTD').length, back: status.filter((s) => s.to === 'In').length, moved: moved.length } };
}

// A move as a share of where it started, so a 3-point TD swing and a 12-yard swing sort together.
function rel(m) { return m.from ? (m.to - m.from) / m.from : m.to; }
