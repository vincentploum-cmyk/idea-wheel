// The NHL shuffle, pure: a bar for shots and a bar for goals. Every skater dressing tonight is
// read at every height of the bar off his Poisson rate (λ shots / λ goals as the Best bets board
// carries them: the saved run's, or the study's when no run exists), so the chance of 3+ at the
// bar is the board's own 3+ figure and a 5+ or 6+ read is the same λ's tail further up. The
// panel keeps the skaters whose chance holds over a floor and drops the rest as the bar rises.
// "Read from" moves the λ: the board's, the run's own goal λ with the opponent in it ("Model ·
// matchup", `goalOpportunityLambda`: the published λ goals is read off the points step, so the
// opponent's goals table barely reaches it; shots stay on the board's λ), the study's, or a plain
// window of his own stored games (last 5 / last 10 / this season), the question the History tab's
// scorecard answers in numbers.
// Nothing here changes a number on the board.
import { poissonAtLeast, fairOdds } from './picks-pure';

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const NHL_BARS = [
  { market: 'sog', label: 'Shots', unit: 'SOG', min: 1, max: 8, step: 1, start: 3, floor: 0.5 },
  { market: 'g', label: 'Goals', unit: 'G', min: 1, max: 4, step: 1, start: 1, floor: 0.35 },
];
export const READ_FROM = [['model', 'Board’s λ'], ['modelOpp', 'Model · matchup'], ['study', 'Study λ'], ['l5', 'Last 5'], ['l10', 'Last 10'], ['season', 'Season']];
export const SEASON_MIN = 3;   // a season window needs this many games of its own
/** The scorecard predictor each read is (lib/nhl-data/scorecard.js PREDICTORS): the run's λ, the study's, his own windows. */
export const READ_FROM_PREDICTOR = { model: 'model', modelOpp: 'modelOpp', study: 'study', l5: 'own5', l10: 'own10', season: 'ownSeason' };   // modelOpp grades goals only: on the shots bar it has no rows and is skipped
export const BEST_MIN = 100;   // graded skater-games the scorecard needs before it ranks the reads

/**
 * Which read the History tab's scorecard says has predicted a bar best: `predictors` is the
 * scorecard's { sog, g } (summarize → predictors), `market` the bar; each read's Brier at the bar's
 * floor height (3+ SOG, 1+ goal) on the rows every predictor covers, the lowest best once `min`
 * rows are in. { best (null until then), n, scores: { model: { brier, n } … }, ranked: best first }.
 */
export function bestReadFrom(predictors, market = 'sog', { min = BEST_MIN } = {}) {
  const list = predictors?.[market]?.common?.predictors || [];
  const scores = {};
  for (const [k, pk] of Object.entries(READ_FROM_PREDICTOR)) {
    const p = list.find((x) => x.key === pk);
    if (p && p.brier != null && p.n > 0) scores[k] = { brier: p.brier, n: p.n };
  }
  const ranked = Object.entries(scores).sort((a, b) => a[1].brier - b[1].brier).map(([k]) => k);
  const n = ranked.length ? Math.min(...ranked.map((k) => scores[k].n)) : 0;
  return { best: n >= min ? ranked[0] : null, n, scores, ranked };
}

/**
 * The read the panel is on: the tab the user pressed this session, else the read the scorecard
 * rates best for the bar (`bestReadFrom`), else the board's λ. The panel follows the verdict until a tab is pressed.
 */
export function readFromOf(picked, best, fallback = 'model') {
  const isRead = (k) => READ_FROM.some(([key]) => key === k);
  if (picked && isRead(picked)) return picked;
  if (best?.best && isRead(best.best)) return best.best;
  return fallback;
}

/** The heights a bar can take. */
export function heightsOf(bar) { const out = []; for (let h = bar.min; h <= bar.max; h += bar.step) out.push(h); return out; }
export const HEIGHTS = Object.fromEntries(NHL_BARS.map((b) => [b.market, heightsOf(b)]));

/**
 * His own results: the mean shots and goals over his last 5 / 10 / 20 stored games (both seasons,
 * date order) and this season alone (three games in), and how many of his last ten and of this
 * season's games reached each height of each bar. `cur` / `prev` are this and last season's rows.
 */
export function ownOf(cur = [], prev = []) {
  const all = [...prev, ...cur].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const win = (list) => (list.length ? { sog: r2(mean(list.map((r) => r.sog || 0))), g: r2(mean(list.map((r) => r.g || 0))), n: list.length } : null);
  const last = (n) => all.slice(-n);
  const counts = (list, key) => HEIGHTS[key].map((h) => list.filter((r) => (r[key] || 0) >= h).length);
  const season = cur.length >= SEASON_MIN ? win(cur) : null;
  return {
    l5: win(last(5)), l10: win(last(10)), l20: win(last(20)), season,
    cleared: { l10: { sog: counts(last(10), 'sog'), g: counts(last(10), 'g'), n: last(10).length }, season: { sog: counts(cur, 'sog'), g: counts(cur, 'g'), n: cur.length } },
  };
}

/**
 * One skater's shuffle row from his Best bets candidate (`c`: lamS / lamG, oppPos, heat, actual once
 * final), the study's full projection and his stored rows.
 */
export function skaterRow(c, { study = null, cur = [], prev = [] } = {}) {
  return {
    id: c.id, name: c.name, team: c.team, opp: c.opp, venue: c.venue, pos: c.pos, line: c.line ?? null, carried: !!c.carried,
    lamS: r3(c.lamS), lamG: r3(c.lamG ?? null), lamGOpp: r3(c.lamGOpp ?? null), source: c.source || null,
    model: c.model ? { lamS: r3(c.model.lamS), lamG: r3(c.model.lamG ?? null) } : null,
    study: study ? { lamS: r3(study.lamS), lamG: r3(study.lamG ?? null) } : c.study ? { lamS: r3(c.study.lamS), lamG: r3(c.study.lamG ?? null) } : null,
    own: ownOf(cur, prev),
    oppPos: c.oppPos ? { sog: c.oppPos.sog ?? null, g: c.oppPos.g ?? null, rankSog: c.oppPos.rankSog ?? null, rankG: c.oppPos.rankG ?? null, teams: c.oppPos.teams ?? null, softSog: !!c.oppPos.softSog, softG: !!c.oppPos.softG } : null,
    heat: c.heat || null,
    ...(c.actual === undefined ? {} : { actual: c.actual }),
  };
}

/** The λ a skater is read from for a market: the board's, the run's matchup goal λ (goals only), the study's, or a window of his own; null when that source has none. */
export function lambdaOf(row, market, from = 'model') {
  const key = market === 'sog' ? 'lamS' : 'lamG';
  if (from === 'model') return row[key] ?? null;
  if (from === 'modelOpp') return market === 'g' ? row.lamGOpp ?? null : null;
  if (from === 'study') return row.study?.[key] ?? null;
  const w = row.own?.[from];
  return w ? w[market] ?? null : null;
}

/** The chance of `height` or more of the market, read from the source picked (the board's λ when the source has none). */
export function chanceAt(row, market, height, from = 'model') {
  const lam = lambdaOf(row, market, from) ?? lambdaOf(row, market, 'model');
  if (lam == null) return null;
  return r3(poissonAtLeast(lam, height));
}

/** A skater's read at a height: the chance and its break-even price, the λ it came from, how often he reached it, his figure once final. */
export function readAt(row, market, height, from = 'model') {
  const lam = lambdaOf(row, market, from);
  const used = lam ?? lambdaOf(row, market, 'model');
  if (used == null) return null;
  const p = r3(poissonAtLeast(used, height));
  const i = HEIGHTS[market].indexOf(height);
  const c10 = row.own?.cleared?.l10; const cs = row.own?.cleared?.season;
  const actual = row.actual === undefined ? undefined : row.actual === null ? null : row.actual[market] ?? 0;
  return {
    height, p, fair: fairOdds(p), lambda: used, from: lam == null ? 'model' : from, fellBack: lam == null && from !== 'model',
    cleared: c10 && i >= 0 && c10.n ? { n: c10[market][i], of: c10.n } : null,
    season: cs && i >= 0 && cs.n ? { n: cs[market][i], of: cs.n } : null,
    got: actual, hit: actual == null ? null : actual >= height,
  };
}

/** The highest height he still clears at the floor, or null. */
export function thinsAt(row, market, floor, from = 'model') {
  const hs = HEIGHTS[market];
  for (let i = hs.length - 1; i >= 0; i--) if ((chanceAt(row, market, hs[i], from) ?? 0) >= floor) return hs[i];
  return null;
}

/** The skaters whose chance at the height holds over the floor, the best chance first, then the λ. */
export function survivorsAt(rows, market, height, floor, from = 'model') {
  return rows
    .map((row) => ({ row, read: readAt(row, market, height, from) }))
    .filter((x) => x.read && x.read.p >= floor)
    .map((x) => ({ ...x, thins: thinsAt(x.row, market, floor, from) }))
    .sort((a, b) => b.read.p - a.read.p || b.read.lambda - a.read.lambda || a.row.name.localeCompare(b.row.name));
}

/** The skaters under the floor at the height, the nearest miss first. */
export function fallenAt(rows, market, height, floor, from = 'model') {
  return rows
    .map((row) => ({ row, read: readAt(row, market, height, from) }))
    .filter((x) => x.read && x.read.p < floor)
    .map((x) => ({ ...x, thins: thinsAt(x.row, market, floor, from) }))
    .sort((a, b) => b.read.p - a.read.p);
}

/** How many skaters clear each height at the floor. */
export function curveOf(rows, market, floor, from = 'model') {
  return HEIGHTS[market].map((height) => ({ height, n: rows.filter((row) => (chanceAt(row, market, height, from) ?? 0) >= floor).length }));
}
