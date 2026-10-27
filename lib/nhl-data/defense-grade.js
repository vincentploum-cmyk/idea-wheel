// The Defense tab's track record: every stored skater-game of a season replayed against the
// cheat-sheet tables as they stood that morning (only games before the date feed the table, so
// nothing leaks), then graded on the box score. For each span (Season, Last 10, Last 5)
// and each metric (shots, goals): what skaters did in the soft / mid / tough third of the
// opponent's table at their position against their own rate going in, and the same for the
// skaters who sat at a shooting side's softest spot (the read the matchup rows lead with); and the
// same by the opponent's rank at the skater's position (`ranks`: each rank's read with `top`, the
// cumulative read from rank 1 through it, so the tab can say how far down the table the soft read
// holds). Descriptive only, from the stored rows; nothing feeds the model.
//
// The tables are rebuilt incrementally (one pass over the rows) rather than through
// defenseByPosition() per date: last season's table is fixed, this season's per-team game
// lists grow a date at a time, and the per-skater figures and windows are the same arithmetic
// as seasonDefense() / computeDefense() (per skater-game; the Season span this season's games
// alone, last season's table standing in before a team's first game; L10 / L5 across the season
// boundary). The skater's own rate going in (the yardstick the lift is measured against) stays
// the study's blend of this season into last season's.
import { defenseByPosition, DEF_POS } from './defense';
import { rankDesc } from './defense-board';
import { seasonYearOf, poissonAtLeast } from './picks-pure';

const PRIOR = { sog: 18, g: 40 };
const BASE_MIN_GAMES = 10;
const ALONE_MIN_GAMES = 5;
const SPANS = ['season', 'l10', 'l5'];
const METRICS = [['sog', 3], ['g', 1]];
const WINDOW = { l10: 10, l5: 5 };
const r3 = (v) => +v.toFixed(3);
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

/** The third a rank falls in, the way the tab tints it: soft (1 = allows the most), mid, tough. */
export function thirdOf(rank, n) {
  if (!rank || !n) return null;
  return rank <= Math.ceil(n / 3) ? 'soft' : rank > n - Math.floor(n / 3) ? 'tough' : 'mid';
}

/** A skater's blended rate going into a date: this season's games (`cur`) into last season's (`prev`). Null without a base. */
function blended(cur, prev, k) {
  const n = cur.length;
  const hasBase = prev.length >= BASE_MIN_GAMES;
  if (!hasBase && n < ALONE_MIN_GAMES) return null;
  const w = hasBase ? n / (n + PRIOR[k]) : 1;
  return w * mean(cur.map((r) => Number(r[k]) || 0)) + (1 - w) * (hasBase ? mean(prev.map((r) => Number(r[k]) || 0)) : 0);
}

function bucket() { return { n: 0, actual: 0, expected: 0, hit: 0, hitExpected: 0 }; }
function add(b, actual, expected, floor) {
  b.n += 1; b.actual += actual; b.expected += expected;
  b.hit += actual >= floor ? 1 : 0; b.hitExpected += poissonAtLeast(expected, floor);
}
function finish(b) {
  if (!b.n) return { n: 0, actual: null, expected: null, lift: null, hit: null, hitExpected: null };
  const actual = b.actual / b.n; const expected = b.expected / b.n;
  return { n: b.n, actual: r3(actual), expected: r3(expected), lift: expected ? r3(actual / expected - 1) : null, hit: r3(b.hit / b.n), hitExpected: r3(b.hitExpected / b.n) };
}
/** The reads by rank, softest first, each with `top` = ranks 1 through it together (the running sums finished at each rank). */
function byRank(ranks) {
  const sum = bucket();
  return Object.keys(ranks).map(Number).sort((a, b) => a - b).map((rank) => {
    const b = ranks[rank];
    sum.n += b.n; sum.actual += b.actual; sum.expected += b.expected; sum.hit += b.hit; sum.hitExpected += b.hitExpected;
    return { rank, ...finish(b), top: finish(sum) };
  });
}

/**
 * The per-skater figure of a (team, position) for each span, from the team's game list `list`
 * ([{ pos: { C: { sog, g, n } … } }] in date order, last season's games first, every game the team
 * defended whether or not the position skated) with `curFrom` = the index where this season's games
 * start, and last season's cell `base` ({ gp, skaters, per }) when it had 10+ games.
 */
function reads(list, curFrom, base, pos, metric) {
  const out = {};
  const cur = list.slice(curFrom);
  const tot = (xs) => { let s = 0; let n = 0; for (const x of xs) { const c = x.pos[pos]; if (c) { s += c[metric]; n += c.n; } } return n ? s / n : null; };
  // the same rounding steps as computeDefense(): per-skater figures to 3 decimals; this season's
  // games alone, last season's figure (a 10-game base) standing in until the team's first game
  const raw = tot(cur); const curPer = raw == null ? null : r3(raw);
  out.season = curPer ?? (base ? base.per[metric] : null);
  for (const s of ['l10', 'l5']) { const v = list.length ? tot(list.slice(-WINDOW[s])) : null; out[s] = v == null ? null : r3(v); }
  return out;
}

/**
 * rows: rowObj() records of two seasons (the season under test and the one before, its base).
 * Grades every stored skater-game of `season` (start year) dated in [from, to] (inclusive, both
 * optional). Returns { season, from, to, dates, games, skaterGames, spans: { season | l10 | l5:
 * { sog | g: { thirds: { soft, mid, tough }, best, all } } } } where each cell is
 * { n, actual, expected, lift, hit, hitExpected }: actual = mean shots (goals) per skater-game,
 * expected = the mean of the skaters' own blended rates going in, lift = actual / expected - 1,
 * hit = the share at 3+ SOG (1+ goal), hitExpected = the same from the Poisson of the own rate.
 * `best` = the skaters lined up at a shooting side's softest spot by that span's table; `all` =
 * every graded skater-game. A skater without a rate (no 10-game base and under 5 games this
 * season) is not graded; an opponent with no table that morning puts its skaters in no third.
 * `trace(date, boards)` (tests) receives each date's ranked tables: boards[span][metric][pos] =
 * { n, rank: { ABBR: rank } }.
 */
export function gradeDefenseReads(rows, { season, from = null, to = null, trace = null } = {}) {
  const year = season ?? Math.max(...rows.map((r) => seasonYearOf(r.date)));
  const sorted = [...rows].filter((r) => r.playerId != null && DEF_POS.includes(r.pos) && r.opp && r.gameId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const prevRows = sorted.filter((r) => seasonYearOf(r.date) === year - 1);
  const prevTable = defenseByPosition(prevRows).teams;
  const baseOf = (team, pos) => { const c = prevTable[team]?.ALL?.[pos]; return c && c.gp >= BASE_MIN_GAMES && c.skaters > 0 ? c : null; };
  // per defending team: the game list across the seasons (one entry per game, per-position totals inside),
  // and where this season's games start
  const lists = {}; const curFrom = {};
  const listOf = (team) => (lists[team] = lists[team] || []);
  const dates = [...new Set(sorted.filter((r) => seasonYearOf(r.date) === year && (!from || r.date >= from) && (!to || r.date <= to)).map((r) => r.date))];
  const out = {};
  for (const s of SPANS) { out[s] = {}; for (const [m] of METRICS) out[s][m] = { thirds: { soft: bucket(), mid: bucket(), tough: bucket() }, best: bucket(), all: bucket(), ranks: {} }; }
  const hist = {}; // playerId -> { cur: rows this season, prev: rows last season }
  let i = 0; let games = 0; let skaterGames = 0;
  const absorb = (upTo) => {
    // rows strictly before `upTo` join the player histories and the (team, pos) game lists
    const perGame = {};
    while (i < sorted.length && sorted[i].date < upTo) {
      const r = sorted[i]; i += 1;
      const h = (hist[r.playerId] = hist[r.playerId] || { cur: [], prev: [] });
      const thisSeason = seasonYearOf(r.date) === year;
      (thisSeason ? h.cur : h.prev).push(r);
      const key = `${r.opp}|${r.gameId}`;
      if (!perGame[key]) { perGame[key] = { pos: {} }; const l = listOf(r.opp); l.push(perGame[key]); if (thisSeason && curFrom[r.opp] == null) curFrom[r.opp] = l.length - 1; }
      const c = (perGame[key].pos[r.pos] = perGame[key].pos[r.pos] || { sog: 0, g: 0, n: 0 });
      c.sog += Number(r.sog) || 0; c.g += Number(r.g) || 0; c.n += 1;
    }
  };
  for (const date of dates) {
    absorb(date);
    // 1) the tables that morning: per span and metric, each position's ranked list of teams
    const boards = {};
    for (const pos of DEF_POS) {
      const cells = {};
      for (const team of Object.keys(lists)) {
        const l = lists[team]; const start = curFrom[team] ?? l.length; const base = baseOf(team, pos);
        cells[team] = { sog: reads(l, start, base, pos, 'sog'), g: reads(l, start, base, pos, 'g') };
      }
      for (const s of SPANS) {
        for (const [m] of METRICS) {
          const list = Object.entries(cells).filter(([, c]) => c[m][s] != null).map(([abbr, c]) => ({ abbr, value: +c[m][s].toFixed(3) }));
          rankDesc(list);
          ((boards[s] = boards[s] || {})[m] = boards[s][m] || {})[pos] = { n: list.length, rank: Object.fromEntries(list.map((x) => [x.abbr, x.rank])) };
        }
      }
    }
    if (trace) trace(date, boards);
    // 2) the day's rows
    const day = []; let j = i;
    while (j < sorted.length && sorted[j].date === date) { day.push(sorted[j]); j += 1; }
    games += new Set(day.map((r) => r.gameId)).size;
    const bestOf = {};
    for (const r of day) {
      const key = `${r.gameId}|${r.team}`;
      if (bestOf[key]) continue;
      bestOf[key] = {};
      for (const s of SPANS) {
        bestOf[key][s] = {};
        for (const [m] of METRICS) {
          let best = null;
          for (const pos of DEF_POS) {
            const rank = boards[s][m][pos].rank[r.opp];
            if (rank && (!best || rank < best.rank)) best = { pos, rank };
          }
          bestOf[key][s][m] = best?.pos || null;
        }
      }
    }
    for (const r of day) {
      const h = hist[r.playerId] || { cur: [], prev: [] };
      const rate = { sog: blended(h.cur, h.prev, 'sog'), g: blended(h.cur, h.prev, 'g') };
      if (rate.sog == null || rate.g == null) continue;
      skaterGames += 1;
      for (const s of SPANS) {
        for (const [m, floor] of METRICS) {
          const cell = out[s][m]; const actual = Number(r[m]) || 0;
          add(cell.all, actual, rate[m], floor);
          const t = boards[s][m][r.pos]; const rank = t.rank[r.opp]; const third = thirdOf(rank, t.n);
          if (third) add(cell.thirds[third], actual, rate[m], floor);
          if (rank) add((cell.ranks[rank] = cell.ranks[rank] || bucket()), actual, rate[m], floor);
          if (bestOf[`${r.gameId}|${r.team}`]?.[s]?.[m] === r.pos) add(cell.best, actual, rate[m], floor);
        }
      }
    }
  }
  const spans = {};
  for (const s of SPANS) {
    spans[s] = {};
    for (const [m] of METRICS) {
      const c = out[s][m];
      spans[s][m] = { thirds: { soft: finish(c.thirds.soft), mid: finish(c.thirds.mid), tough: finish(c.thirds.tough) }, best: finish(c.best), all: finish(c.all), ranks: byRank(c.ranks) };
    }
  }
  return { season: year, from: dates[0] || from, to: dates[dates.length - 1] || to, dates: dates.length, games, skaterGames, spans };
}
