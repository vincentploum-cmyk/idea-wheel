// The Defense tab's rankings: what every team gives up to each position group, ranked
// from softest (1 = the most allowed) to stingiest, from a defenseByPosition() result,
// the way ShotPropz lays out its cheat sheets. Pure functions; the API hands the tab
// the season / L10 / L5 tables and the tab re-cuts them per control.

import { DEF_SLOTS } from './defense';

/** Position groupings: one table per key, each the sum of the positions it holds. */
export const GROUPS = {
  pos: { label: 'C / LW / RW / D', keys: ['C', 'LW', 'RW', 'D'], of: { C: ['C'], LW: ['LW'], RW: ['RW'], D: ['D'] } },
  cwd: { label: 'C / W / D', keys: ['C', 'W', 'D'], of: { C: ['C'], W: ['LW', 'RW'], D: ['D'] } },
  fd: { label: 'F / D', keys: ['F', 'D'], of: { F: ['LW', 'C', 'RW'], D: ['D'] } },
};

/** The group key a position falls under: LW → W under C / W / D, → F under F / D, itself under C / LW / RW / D. */
export function groupKeyFor(pos, group = 'pos') {
  const g = GROUPS[group] || GROUPS.pos;
  return g.keys.find((k) => g.of[k].includes(pos)) || null;
}

/**
 * The shooting side's skaters at a group key tonight, from the slate's lineup for that side
 * (`sides[].skaters` in the defense API's `tonight` games), the best for the metric first: by the
 * saved run's λ (shots under 'sog', goals under 'g') when a run exists, else by his stored rate a
 * game, then by line. `figureFor(p, metric)` is the number that ordered him (λ, else the rate, else
 * null). [] when the side has no lineup.
 */
export function figureFor(p, metric = 'sog') {
  const lam = metric === 'g' ? p?.lamG : p?.lamS;
  if (lam != null) return { value: lam, source: 'run' };
  const rate = metric === 'g' ? p?.g : p?.sog;
  return rate != null && p?.gp > 0 ? { value: rate, source: 'rate' } : null;
}
export function shootersAt(side, key, group = 'pos', metric = 'sog') {
  const v = (p) => figureFor(p, metric)?.value ?? -1;
  return (side?.skaters || [])
    .filter((p) => groupKeyFor(p.pos, group) === key)
    .sort((a, b) => v(b) - v(a) || (a.line ?? 9) - (b.line ?? 9) || String(a.name).localeCompare(String(b.name)));
}

/** The floor a listed shooter is graded against once his game is stored: 3+ SOG under shots, 1+ goal under goals. */
export const RESULT_FLOOR = { sog: 3, g: 1 };

/**
 * The listed shooters against the box score: `result` is the game's stored result as the defense
 * API carries it on a `tonight` game ({ score, skaters: { [id]: { sog, g } } }). Each shooter gets
 * `got` (his shots, or his goals under 'g') and `hit` (true at the floor, false under it, null when
 * the box score has no row for him: he did not play); `hits` / `graded` tally the shooters with a
 * row. Null before the game is stored.
 */
export function resultsAt(list, result, metric = 'sog') {
  if (!result?.skaters) return null;
  const stat = metric === 'g' ? 'g' : 'sog';
  const floor = RESULT_FLOOR[stat];
  let hits = 0;
  let graded = 0;
  const rows = (list || []).map((p) => {
    const r = p?.id != null ? result.skaters[p.id] : null;
    if (!r) return { ...p, got: null, hit: null };
    const got = Number(r[stat]) || 0;
    graded += 1;
    if (got >= floor) hits += 1;
    return { ...p, got, hit: got >= floor };
  });
  return { rows, hits, graded, floor, stat };
}

/** Ranks a list in place by `key`, highest first: 1 = the most. Ties share a rank (5, 5, 7). */
export function rankDesc(list, key = 'value') {
  const sorted = [...list].sort((a, b) => b[key] - a[key]);
  let rank = 0;
  sorted.forEach((r, i) => { if (i === 0 || r[key] !== sorted[i - 1][key]) rank = i + 1; r.rank = rank; });
  return sorted;
}

/**
 * One ranking table per group key: { C: { rows: [{ abbr, gp, base, value, rank }], league, n } … }
 * for `metric` ('sog' | 'g' | …) at `venue` ('ALL' | 'H' | 'A', where the defending team
 * played). The value is what the team allows PER SKATER at the group's positions a game (the
 * study's read, section 13): a group's figure weights its positions by the skaters they carry
 * (W = LW and RW together). From a seasonDefense() table `base` is last season's games when its
 * table stands in (gp 0, before the team's first game this season), else 0; from a plain
 * defenseByPosition() table (the L10 / L5 spans) it is 0. Teams with no
 * record at the venue are left out; `league` is the mean of the listed teams.
 */
export function boardTables(defense, { metric = 'sog', venue = 'ALL', group = 'pos' } = {}) {
  const g = GROUPS[group] || GROUPS.pos;
  const out = {};
  for (const key of g.keys) {
    const rows = [];
    for (const [abbr, venues] of Object.entries(defense?.teams || {})) {
      const t = venues?.[venue];
      if (!t) continue;
      // A position nobody skated at in the games counted (no skater-games) has no read.
      const parts = g.of[key].map((p) => t[p]).filter((p) => p && p.per && p.skaters > 0);
      const gp = Math.max(0, ...parts.map((p) => p.gp || 0));
      const base = Math.max(0, ...parts.map((p) => p.base || 0));
      if (!gp && !base) continue;
      const skaters = parts.reduce((s, p) => s + (p.skaters || 0), 0);
      const value = skaters ? parts.reduce((s, p) => s + (Number(p.per[metric]) || 0) * (p.skaters || 0), 0) / skaters : 0;
      rows.push({ abbr, gp, base, value: +value.toFixed(3) });
    }
    const sorted = rankDesc(rows);
    const league = sorted.length ? +(sorted.reduce((s, r) => s + r.value, 0) / sorted.length).toFixed(3) : null;
    out[key] = { rows: sorted, league, n: sorted.length };
  }
  return out;
}

/** The team overview's columns: the stored rows' totals and MoneyPuck's rates. */
export const OVERVIEW_COLS = [
  { key: 'g', label: 'GA / GP', title: 'Goals allowed per game (stored box scores)', digits: 2 },
  { key: 'sog', label: 'SA / GP', title: 'Shots on goal allowed per game (stored box scores)', digits: 1 },
  { key: 'xga60', label: 'xGA / 60', title: 'Expected goals against per 60, all situations (MoneyPuck)', digits: 2 },
  { key: 'hdsa60', label: 'HD SA / 60', title: 'High-danger shots against per 60 (MoneyPuck)', digits: 1 },
  { key: 'pace60', label: 'Pace', title: 'Shot attempts both ways per 60 (MoneyPuck)', digits: 1 },
];

/**
 * One row per team with every overview figure and its rank (1 = the most allowed) under
 * `rank`: [{ abbr, gp, g, sog, xga60, hdsa60, pace60, rank: { g, sog, … } }]. `mp` is the
 * API's per-team MoneyPuck map; a team missing a figure is unranked on it.
 */
export function overviewRows(defense, mp, { venue = 'ALL' } = {}) {
  const rows = [];
  for (const [abbr, venues] of Object.entries(defense?.teams || {})) {
    const t = venues?.[venue]?.All;
    if (!t?.gp) continue;
    const m = mp?.[abbr] || {};
    rows.push({ abbr, gp: t.gp, g: t.g, sog: t.sog, xga60: m.xga60 ?? null, hdsa60: m.hdsa60 ?? null, pace60: m.pace60 ?? null, rank: {} });
  }
  for (const c of OVERVIEW_COLS) {
    const have = rows.filter((r) => r[c.key] != null).map((r) => ({ r, value: r[c.key] }));
    rankDesc(have).forEach((x) => { x.r.rank[c.key] = x.rank; });
  }
  return rows;
}

/**
 * Tonight's matchups read off the tables: one entry per shooting side, the defender's
 * row per group key and the softest of them. [{ gameId, team, opp, venue, cells: { C: row … }, best: { key, rank } }]
 * `venue` is where the shooting side plays. With `venueMatched` the home defender is read
 * off the H table and the away defender off the A table; otherwise every read is the
 * ALL table (every game the defender played).
 */
export function matchupReads(games, tablesByVenue, { venueMatched = false } = {}) {
  const out = [];
  for (const g of games || []) {
    if (!g?.away || !g?.home) continue;
    for (const [team, opp, defVenue] of [[g.away, g.home, 'H'], [g.home, g.away, 'A']]) {
      const tables = (venueMatched ? tablesByVenue[defVenue] : null) || tablesByVenue.ALL;
      const cells = {};
      let best = null;
      for (const [key, t] of Object.entries(tables || {})) {
        const row = t.rows.find((r) => r.abbr === opp) || null;
        cells[key] = row ? { ...row, n: t.n, league: t.league } : null;
        if (row && (!best || row.rank < best.rank)) best = { key, rank: row.rank, value: row.value };
      }
      out.push({ gameId: g.id ?? null, team, opp, venue: defVenue === 'H' ? 'A' : 'H', cells, best });
    }
  }
  return out.sort((a, b) => (a.best?.rank ?? 99) - (b.best?.rank ?? 99) || a.team.localeCompare(b.team));
}

/** The line slots in the By line table's order, under their line: forward lines 1–4 (LW · C · RW), then the pairs. */
export const SLOT_LINES = [['Line 1', ['LW1', 'C1', 'RW1']], ['Line 2', ['LW2', 'C2', 'RW2']], ['Line 3', ['LW3', 'C3', 'RW3']], ['Line 4', ['LW4', 'C4', 'RW4']], ['Pairs', ['D1', 'D2', 'D3']]];

/**
 * What every team gives up to each line slot (Vincent, 2026-10-30: "against which line a team allows the most goals /
 * shots, LW1, LW2 …"), from a defenseBySlot() table: per skater at the slot a game at `venue`, a cell kept from
 * `minSkaterGames` skater-games, ranked per slot over the teams with a cell (1 = the most allowed, ties shared) with the
 * league's mean and the cell's ratio to it. Each team's `softest` is its best-ranked slot, a tie going to the one
 * furthest over the league's mean: a team's highest raw figure is nearly always its first line (the first line shoots
 * the most everywhere), the rank says where this team leaks against the rest of the league. `most` is the slot with the
 * highest raw figure, the one that takes the most shots or goals off the team whatever the league does there (Vincent,
 * 2026-10-31, of PIT: 2.9 shots a game to the C1 and "leaks most to the C3" on a #7 rank at 1.8 — the head line now
 * says rank and names the raw leader beside it).
 * { slots, teams: [{ abbr, gp, cells: { LW1: { value, n, rank, of, ratio } | null }, softest, most }], league: { LW1: mean } }.
 */
export function slotBoard(slots, { metric = 'sog', venue = 'ALL', minSkaterGames = 3 } = {}) {
  const teams = [];
  for (const [abbr, venues] of Object.entries(slots?.teams || {})) {
    const t = venues?.[venue];
    if (!t?.All?.gp) continue;
    const cells = {};
    for (const slot of DEF_SLOTS) {
      const c = t[slot];
      const n = c ? Math.round((c.skaters || 0) * (c.gp || 0)) : 0;
      cells[slot] = n >= minSkaterGames ? { value: Number(c.per?.[metric]) || 0, n } : null;
    }
    teams.push({ abbr, gp: t.All.gp, cells });
  }
  const league = {};
  for (const slot of DEF_SLOTS) {
    const list = teams.filter((t) => t.cells[slot]).map((t) => ({ cell: t.cells[slot], value: t.cells[slot].value }));
    const mean = list.length ? list.reduce((s, x) => s + x.value, 0) / list.length : null;
    league[slot] = mean == null ? null : +mean.toFixed(3);
    for (const x of rankDesc(list)) Object.assign(x.cell, { rank: x.rank, of: list.length, ratio: mean ? +(x.value / mean).toFixed(3) : null });
  }
  for (const t of teams) {
    let best = null;
    let most = null;
    for (const slot of DEF_SLOTS) {
      const c = t.cells[slot];
      if (!c) continue;
      if (!best || c.rank < best.rank || (c.rank === best.rank && (c.ratio ?? 0) > (best.ratio ?? 0))) best = { slot, ...c };
      if (!most || c.value > most.value) most = { slot, ...c };
    }
    t.softest = best;
    t.most = most;
  }
  return { slots: DEF_SLOTS, teams, league };
}

/**
 * One defending team's by-line read for the rink (Vincent, 2026-10-31, of the Defense tab's slot badges LW1 · C2 · D2:
 * "How can we make this visible on the matchup view?"): per metric its cells from slotBoard() keyed by slot, its
 * softest slot, the slot it gives the most to and the league's mean per slot; null for a team without a row. `boards` =
 * { sog, g } from slotBoard(). { sog: { gp, cells: { LW1: { value, n, rank, of, ratio } | null }, softest, most, league }, g: { … } }.
 */
export function linesOf(boards, abbr) {
  const out = {};
  for (const metric of ['sog', 'g']) {
    const b = boards?.[metric];
    const t = b?.teams?.find((x) => x.abbr === abbr);
    if (!t) continue;
    out[metric] = { gp: t.gp, cells: t.cells, softest: t.softest, most: t.most || null, league: b.league };
  }
  return Object.keys(out).length ? out : null;
}

/** The skater the defending team faces at a slot tonight: the opponent's lineup at that position and line, or null. */
export function facingAt(games, abbr, slot) {
  const g = (games || []).find((x) => x.away === abbr || x.home === abbr);
  const side = g?.sides?.find((x) => x.team !== abbr) || null;
  return side?.skaters?.find((p) => `${p.pos}${p.line || ''}` === slot) || null;
}
