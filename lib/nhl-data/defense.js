import { formTag } from './profile';

// What each team allows to each position, split by where the defending team
// plays (home / away), from the stored skater-game rows. 1 = most permissive.
export const DEF_POS = ['LW', 'C', 'RW', 'D'];
// The line slots a box score is logged under: forward lines 1-4 by wing/centre, defense pairs 1-3.
export const DEF_SLOTS = [...[1, 2, 3, 4].flatMap((line) => ['LW', 'C', 'RW'].map((pos) => `${pos}${line}`)), 'D1', 'D2', 'D3'];
export const DEF_METRICS = ['g', 'a', 'sog', 'icf', 'iff', 'iscf', 'ihdcf'];
const VENUES = ['H', 'A', 'ALL'];

const r2 = (v) => +v.toFixed(2);

// The slate asks for several tables over the same ~50k rows on every request
// (season, last 10, last 5, baselines); loadRows() hands back the same array
// while the stored seasons are unchanged, so results are kept per array. A memoised
// result is shared between requests: callers must treat it as read-only.
const memo = new WeakMap(); // rows → Map(key → result)
function memoized(rows, key, compute) {
  if (!Array.isArray(rows)) return compute();
  let table = memo.get(rows);
  if (!table) memo.set(rows, (table = new Map()));
  if (!table.has(key)) table.set(key, compute());
  return table.get(key);
}

function empty() {
  return Object.fromEntries(DEF_METRICS.map((k) => [k, 0]));
}

/**
 * rows: rowObj() records (date, gameId, team, opp, venue, pos, g, a, sog, ...).
 * Returns { teams: { ABBR: { H|A|ALL: { LW|C|RW|D|All: { gp, g, sog, ... } } } },
 *           ranks: same shape → rank per metric, league: { H|A|ALL: { pos: averages } } }.
 */
export function defenseByPosition(rows, { lastN = 0 } = {}) {
  return memoized(rows, `defense|${lastN}`, () => computeDefense(rows, lastN, DEF_POS, (r) => r.pos));
}

/**
 * The same tables per line slot (LW1 … RW4, D1 … D3) instead of per position, from the
 * rows whose position came with a line: an LW3 that gets a lot of looks against a
 * team shows up apart from its LW2. Rows without a line (box-score positions, older rows)
 * are left out; `All` sums every slot.
 */
export function defenseBySlot(rows, { lastN = 0 } = {}) {
  return memoized(rows, `slots|${lastN}`, () => computeDefense(rows, lastN, DEF_SLOTS, (r) => (DEF_POS.includes(r.pos) && r.line ? `${r.pos}${r.line}` : null)));
}

function computeDefense(rows, lastN, keys, keyOf) {
  // team-game totals allowed, keyed by defending team → gameId
  const games = {};
  for (const r of rows) {
    const key = keyOf(r);
    if (!key || !keys.includes(key)) continue;
    const def = r.opp;
    const venue = r.venue === 'A' ? 'H' : 'A'; // the shooter is away → the defense is at home
    const tg = (games[def] = games[def] || {});
    const g = (tg[r.gameId] = tg[r.gameId] || { date: r.date, venue, pos: {} });
    const acc = (g.pos[key] = g.pos[key] || empty());
    for (const k of DEF_METRICS) acc[k] += Number(r[k]) || 0;
  }

  const teams = {};
  for (const [abbr, tg] of Object.entries(games)) {
    const list = Object.values(tg).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    teams[abbr] = {};
    for (const venue of VENUES) {
      // lastN is taken per venue: the H table of a last-5 run is the team's last 5 home games.
      const atVenue = venue === 'ALL' ? list : list.filter((g) => g.venue === venue);
      const sel = lastN ? atVenue.slice(-lastN) : atVenue;
      const out = {};
      for (const pos of [...keys, 'All']) {
        const sum = empty();
        for (const g of sel) {
          const src = pos === 'All' ? keys.map((p) => g.pos[p] || empty()) : [g.pos[pos] || empty()];
          for (const s of src) for (const k of DEF_METRICS) sum[k] += s[k];
        }
        out[pos] = { gp: sel.length, ...Object.fromEntries(DEF_METRICS.map((k) => [k, sel.length ? r2(sum[k] / sel.length) : 0])) };
      }
      teams[abbr][venue] = out;
    }
  }

  // Ranks: 1 = most allowed. Teams without games at that venue are unranked.
  const ranks = {};
  const league = {};
  const abbrs = Object.keys(teams);
  for (const venue of VENUES) {
    league[venue] = {};
    for (const pos of [...keys, 'All']) {
      const list = abbrs.filter((a) => teams[a][venue][pos].gp > 0);
      league[venue][pos] = Object.fromEntries(DEF_METRICS.map((k) => [k, list.length ? r2(list.reduce((s, a) => s + teams[a][venue][pos][k], 0) / list.length) : 0]));
      for (const k of DEF_METRICS) {
        const sorted = [...list].sort((x, y) => teams[y][venue][pos][k] - teams[x][venue][pos][k]);
        sorted.forEach((a, i) => {
          const firstEqual = sorted.findIndex((b) => teams[b][venue][pos][k] === teams[a][venue][pos][k]);
          ranks[a] = ranks[a] || {};
          ranks[a][venue] = ranks[a][venue] || {};
          ranks[a][venue][pos] = ranks[a][venue][pos] || {};
          ranks[a][venue][pos][k] = firstEqual + 1 || i + 1;
        });
      }
    }
  }
  return { teams, ranks, league, teamCount: abbrs.length };
}

/**
 * First goals a team gives up, by where it plays and to which position and line slot:
 * { teams: { ABBR: { H|A|ALL: { games, allowed, share, byPos: { LW: { n, share } … }, bySlot: { LW1: n … } } } },
 *   ranks: { ABBR: { venue: { pos: rank } } } (1 = gives up the most first goals to that position, by share),
 *   league: { venue: { pos: share } } }.
 * `games` counts the team-games whose first goal is on record (rows stored before the
 * column have none and are left out); `allowed` those where the opponent scored first.
 */
export function firstGoalsAllowed(rows, { lastN = 0 } = {}) {
  return memoized(rows, `firstgoals|${lastN}`, () => computeFirstGoals(rows, lastN));
}

function computeFirstGoals(rows, lastN) {
  // Games whose first goal is on record: any row of the game flagged fg = 1.
  const known = new Set();
  for (const r of rows) if (Number(r.fg) === 1) known.add(r.gameId);
  // Per defending team → gameId: venue, date, and the scorer's position / slot when the opponent scored first.
  const games = {};
  for (const r of rows) {
    if (!known.has(r.gameId) || !DEF_POS.includes(r.pos)) continue;
    const tg = (games[r.opp] = games[r.opp] || {});
    const g = (tg[r.gameId] = tg[r.gameId] || { date: r.date, venue: r.venue === 'A' ? 'H' : 'A', pos: null, slot: null });
    if (Number(r.fg) === 1) { g.pos = r.pos; g.slot = r.line ? `${r.pos}${r.line}` : null; }
  }
  const teams = {};
  for (const [abbr, tg] of Object.entries(games)) {
    const list = Object.values(tg).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    teams[abbr] = {};
    for (const venue of VENUES) {
      const atVenue = venue === 'ALL' ? list : list.filter((g) => g.venue === venue);
      const sel = lastN ? atVenue.slice(-lastN) : atVenue;
      const byPos = Object.fromEntries(DEF_POS.map((p) => [p, { n: 0, share: 0 }]));
      const bySlot = {};
      let allowed = 0;
      for (const g of sel) {
        if (!g.pos) continue;
        allowed += 1;
        byPos[g.pos].n += 1;
        if (g.slot) bySlot[g.slot] = (bySlot[g.slot] || 0) + 1;
      }
      for (const p of DEF_POS) byPos[p].share = sel.length ? r2(byPos[p].n / sel.length) : 0;
      teams[abbr][venue] = { games: sel.length, allowed, share: sel.length ? r2(allowed / sel.length) : 0, byPos, bySlot };
    }
  }
  const ranks = {};
  const league = {};
  const abbrs = Object.keys(teams);
  for (const venue of VENUES) {
    league[venue] = {};
    const list = abbrs.filter((a) => teams[a][venue].games > 0);
    for (const pos of [...DEF_POS, 'All']) {
      const val = (a) => (pos === 'All' ? teams[a][venue].share : teams[a][venue].byPos[pos].share);
      league[venue][pos] = list.length ? r2(list.reduce((s, a) => s + val(a), 0) / list.length) : 0;
      const sorted = [...list].sort((x, y) => val(y) - val(x));
      sorted.forEach((a, i) => {
        ranks[a] = ranks[a] || {};
        ranks[a][venue] = ranks[a][venue] || {};
        ranks[a][venue][pos] = sorted.findIndex((b) => val(b) === val(a)) + 1 || i + 1;
      });
    }
  }
  return { teams, ranks, league, teamCount: abbrs.length };
}

/** Per-player baselines from their most recent games (all / home / away). */
export function playerBaselines(rows, { window = 20 } = {}) {
  return memoized(rows, `baselines|${window}`, () => computeBaselines(rows, window));
}

function computeBaselines(rows, window) {
  const byPlayer = {};
  for (const r of rows) (byPlayer[r.playerId] = byPlayer[r.playerId] || []).push(r);
  const out = {};
  const avg = (list) => ({
    gp: list.length,
    ...Object.fromEntries(['g', 'a', 'sog', 'icf', 'iff', 'iscf', 'ihdcf', 'toi'].map((k) => [k, list.length ? r2(list.reduce((s, x) => s + (Number(x[k]) || 0), 0) / list.length) : 0])),
  });
  for (const [id, list] of Object.entries(byPlayer)) {
    list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    const recent = list.slice(-window);
    out[id] = {
      name: recent[recent.length - 1].name,
      team: recent[recent.length - 1].team,
      lastPos: recent[recent.length - 1].pos,
      all: avg(recent),
      H: avg(recent.filter((x) => x.venue === 'H')),
      A: avg(recent.filter((x) => x.venue === 'A')),
      l5: avg(recent.slice(-5)),
      form: formTag(recent.slice(-5), recent),
      // Hit rates over the window: 2+/3+ shots, a goal.
      hit: {
        s2: recent.length ? r2(recent.filter((x) => x.sog >= 2).length / recent.length) : 0,
        s3: recent.length ? r2(recent.filter((x) => x.sog >= 3).length / recent.length) : 0,
        g1: recent.length ? r2(recent.filter((x) => x.g >= 1).length / recent.length) : 0,
      },
    };
  }
  return out;
}
