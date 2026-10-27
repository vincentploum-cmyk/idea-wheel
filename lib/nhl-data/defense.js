import { formTag } from './profile';
import { seasonYearOf } from './picks-pure';

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
// Last season's table stands in for a team without a game this season only when it had this many games.
const BASE_MIN_GAMES = 10;
/** The rows of one season (start year), or every row without a season. */
const ofSeason = (rows, season) => (season ? rows.filter((r) => seasonYearOf(r.date) === season) : rows);

/**
 * rows: rowObj() records (date, gameId, team, opp, venue, pos, g, a, sog, ...).
 * Returns { teams: { ABBR: { H|A|ALL: { LW|C|RW|D|All: { gp, g, sog, ..., skaters, per: { g, sog, ... } } } } },
 *           ranks: same shape → rank per metric (per game), league: { H|A|ALL: { pos: averages } } }.
 * `g`, `sog`, … are per game (every skater at the position added up); `per` is the same per
 * skater-game (the study's read: it does not swing with how many wingers a lineup carried) and
 * `skaters` how many skaters at the position a game. With `season` (a start year) only that
 * season's rows count: the stored rows span two seasons, and a Season table is this season's.
 */
export function defenseByPosition(rows, { lastN = 0, season = null } = {}) {
  return memoized(rows, `defense|${lastN}|${season || ''}`, () => computeDefense(ofSeason(rows, season), lastN, DEF_POS, (r) => r.pos));
}

/**
 * The same tables per line slot (LW1 … RW4, D1 … D3) instead of per position, from the
 * rows whose position came with a line: an LW3 that gets a lot of looks against a
 * team shows up apart from its LW2. Rows without a line (box-score positions, older rows)
 * are left out; `All` sums every slot.
 */
export function defenseBySlot(rows, { lastN = 0, season = null } = {}) {
  return memoized(rows, `slots|${lastN}|${season || ''}`, () => computeDefense(ofSeason(rows, season), lastN, DEF_SLOTS, (r) => (DEF_POS.includes(r.pos) && r.line ? `${r.pos}${r.line}` : null)));
}

/**
 * The Defense tab's Season span: what each team allows per skater at each position from this
 * season's stored games alone, per venue (Vincent, 2026-10-27: the Season table reads this season
 * for every sport; the games / (games + k) blend into last season's table that stood here is gone
 * from the tab — the study's λ keeps its own in picks-pure.js). Same shape as defenseByPosition(),
 * `base` 0 on a row of this season's games. A team without a game at the venue this season reads
 * last season's cell until its first (`gp` 0, `base` last season's games, `held: true`; only when
 * last season had BASE_MIN_GAMES there). A team with no record in either season is left out;
 * `ranks` are on the per-skater figures.
 */
export function seasonDefense(rows, date) {
  const year = seasonYearOf(date);
  return memoized(rows, `season|${year}`, () => {
    const cur = defenseByPosition(rows, { season: year });
    const prev = defenseByPosition(rows, { season: year - 1 });
    const teams = {};
    for (const abbr of new Set([...Object.keys(cur.teams), ...Object.keys(prev.teams)])) {
      teams[abbr] = {};
      for (const venue of VENUES) {
        const out = {};
        for (const pos of [...DEF_POS, 'All']) {
          const c = cur.teams[abbr]?.[venue]?.[pos]; const p = prev.teams[abbr]?.[venue]?.[pos];
          if (c?.gp > 0 && c.skaters > 0) out[pos] = { ...c, base: 0 };
          else if (p?.gp >= BASE_MIN_GAMES && p.skaters > 0) out[pos] = { ...p, gp: 0, base: p.gp, held: true };
        }
        teams[abbr][venue] = out;
      }
    }
    const ranks = {}; const league = {};
    const abbrs = Object.keys(teams);
    for (const venue of VENUES) {
      league[venue] = {};
      for (const pos of [...DEF_POS, 'All']) {
        const list = abbrs.filter((a) => teams[a][venue][pos]);
        league[venue][pos] = Object.fromEntries(DEF_METRICS.map((k) => [k, list.length ? +(list.reduce((s, a) => s + teams[a][venue][pos].per[k], 0) / list.length).toFixed(3) : 0]));
        for (const k of DEF_METRICS) {
          const sorted = [...list].sort((x, y) => teams[y][venue][pos].per[k] - teams[x][venue][pos].per[k]);
          sorted.forEach((a, i) => {
            const firstEqual = sorted.findIndex((b) => teams[b][venue][pos].per[k] === teams[a][venue][pos].per[k]);
            ((ranks[a] = ranks[a] || {})[venue] = ranks[a][venue] || {})[pos] = ranks[a][venue][pos] || {};
            ranks[a][venue][pos][k] = firstEqual + 1;
          });
        }
      }
    }
    return { teams, ranks, league, teamCount: abbrs.length, season: year };
  });
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
    const acc = (g.pos[key] = g.pos[key] || { ...empty(), n: 0 });
    for (const k of DEF_METRICS) acc[k] += Number(r[k]) || 0;
    acc.n += 1;
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
        let n = 0;
        for (const g of sel) {
          const src = pos === 'All' ? keys.map((p) => g.pos[p] || empty()) : [g.pos[pos] || empty()];
          for (const s of src) { for (const k of DEF_METRICS) sum[k] += s[k]; n += s.n || 0; }
        }
        out[pos] = {
          gp: sel.length, ...Object.fromEntries(DEF_METRICS.map((k) => [k, sel.length ? r2(sum[k] / sel.length) : 0])),
          skaters: sel.length ? r2(n / sel.length) : 0, per: Object.fromEntries(DEF_METRICS.map((k) => [k, n ? +(sum[k] / n).toFixed(3) : 0])),
        };
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
 * What `def` allowed to each position in its stored games against `att` alone (head to
 * head), by where `def` played: { H|A|ALL: { LW|C|RW|D|All: { gp, g, a, sog, … per game } } }.
 * Null when the two have no stored meetings.
 */
export function defenseVsTeam(rows, def, att) {
  return memoized(rows, `h2h|${def}|${att}`, () => {
    const pair = rows.filter((r) => r.opp === def && r.team === att);
    if (!pair.length) return null;
    const t = computeDefense(pair, 0, DEF_POS, (r) => r.pos).teams[def];
    return t || null;
  });
}

/**
 * Where a per-game value sits among the league's values (one per team): 1 = the most.
 * Lets a head-to-head figure take the same colour scale as the ranked tables.
 */
export function rankAmong(value, values) {
  const list = (values || []).filter((v) => v != null && Number.isFinite(v));
  if (value == null || !list.length) return null;
  return list.filter((v) => v > value).length + 1;
}

/**
 * First goals a team gives up, by where it plays and to which position and line slot:
 * { teams: { ABBR: { H|A|ALL: { games, allowed, share, byPos: { LW: { n, share } … }, bySlot: { LW1: n … } } } },
 *   ranks: { ABBR: { venue: { pos: rank } } } (1 = gives up the most first goals to that position, by share),
 *   league: { venue: { pos: share } } }.
 * `games` counts the team-games whose first goal is on record (rows stored before the
 * column have none and are left out); `allowed` those where the opponent scored first.
 */
export function firstGoalsAllowed(rows, { lastN = 0, season = null } = {}) {
  return memoized(rows, `firstgoals|${lastN}|${season || ''}`, () => computeFirstGoals(ofSeason(rows, season), lastN));
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

/**
 * The box-score log of everything skaters did against `team`, newest game first, as the
 * team page's game log: one row per skater-game with his line slot (LW1 … RW4, D1 … D3,
 * null when the game was logged from the box score), his team's result and venue
 * (venue 'A' = he played at `team`'s rink), and the counting stats the log shows.
 */
export function gameLogAgainst(rows, team) {
  const out = [];
  for (const r of rows) {
    if (r.opp !== team || !DEF_POS.includes(r.pos)) continue;
    out.push({
      date: r.date, gameId: r.gameId, playerId: r.playerId, name: r.name, team: r.team, venue: r.venue,
      pos: r.pos, line: r.line ?? null, slot: r.line ? `${r.pos}${r.line}` : null, result: r.result || null,
      toi: r.toi, g: Number(r.g) || 0, a: Number(r.a) || 0, pts: (Number(r.g) || 0) + (Number(r.a) || 0),
      sog: Number(r.sog) || 0, hits: Number(r.hits) || 0, blk: Number(r.blk) || 0, icf: Number(r.icf) || 0, iscf: Number(r.iscf) || 0,
    });
  }
  // Newest game first; within a game the busiest skaters first.
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.gameId - a.gameId) || (b.toi - a.toi)));
  return out;
}
