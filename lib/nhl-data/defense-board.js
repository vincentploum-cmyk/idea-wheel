// The Defense tab's rankings: what every team gives up to each position group, ranked
// from softest (1 = the most allowed) to stingiest, from a defenseByPosition() result,
// the way ShotPropz lays out its cheat sheets. Pure functions; the API hands the tab
// the season / L10 / L5 tables and the tab re-cuts them per control.

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
 * (W = LW and RW together). From a blendedDefense() table `base` is last season's games in the
 * blend; from a plain defenseByPosition() table (the L10 / L5 spans) it is 0. Teams with no
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
