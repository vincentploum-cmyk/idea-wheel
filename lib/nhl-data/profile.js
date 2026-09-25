// One player's PropFinder-style profile from the stored skater-game rows:
// per-game history, split averages, hit rates per market and line, and a
// hot / cold read for shots and goals.
export const MARKETS = {
  goals: { label: 'Goals', key: 'g', lines: [0.5, 1.5], defaultLine: 0.5 },
  shots: { label: 'Shots on goal', key: 'sog', lines: [1.5, 2.5, 3.5, 4.5], defaultLine: 2.5 },
  points: { label: 'Points', key: 'pts', lines: [0.5, 1.5], defaultLine: 0.5 },
  assists: { label: 'Assists', key: 'a', lines: [0.5, 1.5], defaultLine: 0.5 },
};
const STAT_KEYS = ['toi', 'g', 'a', 'pts', 'sog', 'icf', 'iff', 'iscf', 'ihdcf'];
const r2 = (v) => +v.toFixed(2);

function avg(list) {
  const out = { gp: list.length };
  for (const k of STAT_KEYS) out[k] = list.length ? r2(list.reduce((s, x) => s + (Number(x[k]) || 0), 0) / list.length) : 0;
  return out;
}

/** { hits, gp, rate } for a market line over a list of games. */
export function hitRate(list, key, line) {
  const hits = list.filter((g) => (Number(g[key]) || 0) > line).length;
  return { hits, gp: list.length, rate: list.length ? r2(hits / list.length) : null };
}

/**
 * Hot / cold for shots follows the model's recent-form rule (3+/4+/5+ rates over
 * the last games); goals use the goal-in-game rate against the player's own base.
 */
export function formTag(recent, base) {
  const n = recent.length;
  const rate = (fn) => (n ? recent.filter(fn).length / n : 0);
  const s3 = rate((g) => g.sog >= 3);
  const s4 = rate((g) => g.sog >= 4);
  const s5 = rate((g) => g.sog >= 5);
  let shots = 'Neutral';
  if (n >= 4) {
    if (s4 >= 0.5 || s5 >= 0.3 || (s3 >= 0.7 && s4 >= 0.4)) shots = 'Hot';
    else if (s4 < 0.3 && s3 < 0.5) shots = 'Cold';
  }
  const g1 = rate((g) => g.g >= 1);
  const baseG1 = base.length ? base.filter((g) => g.g >= 1).length / base.length : 0;
  let goals = 'Neutral';
  if (n >= 4) {
    if (g1 >= 0.6 || (g1 >= 0.4 && g1 >= baseG1 + 0.15)) goals = 'Hot';
    else if (g1 === 0 || g1 <= Math.max(0, baseG1 - 0.2)) goals = 'Cold';
  }
  return { shots, goals, s3: r2(s3), s4: r2(s4), g1: r2(g1) };
}

/**
 * rows: rowObj() records for one player (any order). opp/venue describe tonight,
 * for the head-to-head and venue splits.
 */
export function playerProfile(rows, { opp = null, venue = null, history = 40 } = {}) {
  const all = [...rows].map((r) => ({ ...r, pts: (Number(r.g) || 0) + (Number(r.a) || 0) })).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const l20 = all.slice(-20);
  const l10 = all.slice(-10);
  const l5 = all.slice(-5);
  const home = all.filter((g) => g.venue === 'H');
  const away = all.filter((g) => g.venue === 'A');
  const h2h = opp ? all.filter((g) => g.opp === opp) : [];
  const tonight = venue === 'H' ? home : venue === 'A' ? away : [];
  const splits = { season: all, l20, l10, l5, home, away, h2h, tonight };

  const stats = Object.fromEntries(Object.entries(splits).map(([k, list]) => [k, avg(list)]));
  const hits = {};
  for (const [m, def] of Object.entries(MARKETS)) {
    hits[m] = {};
    for (const line of def.lines) {
      hits[m][line] = Object.fromEntries(Object.entries(splits).map(([k, list]) => [k, hitRate(list, def.key, line)]));
    }
  }
  return {
    gp: all.length,
    games: all.slice(-history).map((g) => ({ date: g.date, gameId: g.gameId, opp: g.opp, venue: g.venue, pos: g.pos, toi: g.toi, g: g.g, a: g.a, pts: g.pts, sog: g.sog, icf: g.icf, iff: g.iff, iscf: g.iscf, ihdcf: g.ihdcf })),
    stats,
    hits,
    form: formTag(l5, l20),
    last: all[all.length - 1] || null,
  };
}
