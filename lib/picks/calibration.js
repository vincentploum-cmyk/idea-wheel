// The picks boards' chances calibrated to what they have landed (Vincent, 2026-10-30, after the NHL's: "do the same
// calibration for the NBA board"). The board's math is untouched: the hit rates, the ladder's tail and its cleared-it
// half stay what they are, and only the chance the board prints moves, to the rate the same stated chance has landed
// on the season's graded nights (lib/picks/scorecard.js, the plays and the rungs as the board stated them).
//
// Two reads, each fitted per market: a play's chance (`chanceOf` in board.js: his hit rates over the line shrunk toward
// the book's price; over / yes and under / no apart, the two sides read different rates) and a rung's (`ladderOf`: his
// distribution's tail with how often he cleared it; the shuffle, the court's bar, the Tonight table and the card read
// it). The fit is the NHL's (lib/nhl-data/calibration-pure.js `fitHeight`: landed = σ(a + b · logit(stated)), a light
// pull toward the identity, 300 graded chances and 25 hits at least). No export of the site's graded nights had been
// read when this was written, so a fit checks itself before the board prints it: fitted again on the nights before the
// last CHECK_NIGHTS and scored on those nights it never saw, it is applied (`use`) only when it scores better there than
// the chances as stated (Brier, CHECK_MIN chances at least); otherwise the board prints the stated chance.
// Pure: the store learns it, the board and the shuffle apply it.
//
// The book anchor (Vincent, 2026-11-20: "I'm not hitting anything anymore"; docs/audits/2026-11-20-why-picks-miss.md):
// on five graded nights the board said 65-67% and landed 46-50%, and once the book's price was known the stated chance
// added next to nothing (its weight 0.05 beside the price's 0.95; negative on points / rebounds / assists / threes). A
// chance read on its own cannot learn that, so where a play or a rung carries a price a second fit reads both:
// landed = σ(a + wBook · logit(implied) + wModel · (logit(stated) − logit(implied))), pulled toward the book itself
// (a 0, wBook 1, wModel 0), wModel held to 0–1 (the board never bets against its own read), per market and side as the
// fits above, learned on the same graded nights and printed only after it beats the stated-only read on the last
// CHECK_NIGHTS nights it never saw. Its intercept learns the price's margin (no under prices are stored to strip it).
import { fitHeight, calibrate, CAL_MIN } from '../nhl-data/calibration-pure';
import { impliedProb } from '../nfl/odds';

export { CAL_MIN, calibrate };
export const CHECK_NIGHTS = 3;   // the newest nights held out to check a fit
export const CHECK_MIN = 100;    // graded chances the held-out nights need before the check speaks

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;
const UNDER = new Set(['under', 'no']);
const STEEP = 0.8;   // board.js STEEP_IMPLIED: a price past -400 is no play and teaches the anchor nothing

/** A play's fit key: its market, the under / no side apart. */
export const playKey = (market, side) => (UNDER.has(side) ? `${market}:under` : market);

const brier = (list, f) => list.reduce((s, x) => s + (f(x.p) - x.hit) ** 2, 0) / list.length;

/** One key's fit on its graded chances ({ slate, p, hit }), with the held-out check; null when too thin to fit. */
export function fitChecked(list, nights) {
  const fit = fitHeight(list.map((x) => [x.p, x.hit]));
  if (!fit) return null;
  const cut = nights.length > CHECK_NIGHTS ? nights[nights.length - CHECK_NIGHTS] : null;
  let check = null;
  if (cut) {
    const early = fitHeight(list.filter((x) => x.slate < cut).map((x) => [x.p, x.hit]));
    const late = list.filter((x) => x.slate >= cut);
    if (early && late.length >= CHECK_MIN) check = { from: cut, n: late.length, stated: r4(brier(late, (p) => p)), calibrated: r4(brier(late, (p) => calibrate(early, p))) };
  }
  return { ...fit, check, use: !!check && check.calibrated <= check.stated };
}

export const ANCHOR_RIDGE = 2;   // the pull toward the book's price, in units of the log-likelihood

const clampP = (p) => Math.min(0.999, Math.max(0.001, p));
const lg = (p) => { const q = clampP(p); return Math.log(q / (1 - q)); };
const sg = (z) => 1 / (1 + Math.exp(-z));
const anchorZ = (f, p, implied) => f.a + f.wBook * lg(implied) + f.wModel * (lg(p) - lg(implied));

/** Ridge logistic fit by Newton steps on the free coefficients (`free`), the rest held at `theta`; prior (0, 1, 0). */
function newton(rows, theta, free) {
  const prior = [0, 1, 0];
  const t = theta.slice();
  for (let it = 0; it < 60; it++) {
    const k = free.length;
    const g = new Array(k).fill(0); const H = Array.from({ length: k }, () => new Array(k).fill(0));
    free.forEach((j, i) => { g[i] += ANCHOR_RIDGE * (t[j] - prior[j]); H[i][i] += ANCHOR_RIDGE; });
    for (const x of rows) {
      const m = sg(t[0] * x[0] + t[1] * x[1] + t[2] * x[2]); const e = m - x[3]; const v = m * (1 - m);
      free.forEach((j, i) => { g[i] += e * x[j]; free.forEach((l, q) => { H[i][q] += v * x[j] * x[l]; }); });
    }
    // Solve H · d = g (Gaussian elimination; k ≤ 3).
    const A = H.map((row, i) => [...row, g[i]]);
    for (let c = 0; c < k; c++) {
      let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      if (!(Math.abs(A[c][c]) > 1e-12)) return t;
      for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= k; q++) A[r][q] -= f * A[c][q]; }
    }
    let step = 0;
    free.forEach((j, i) => { const d = A[i][k] / A[i][i]; t[j] -= d; step = Math.max(step, Math.abs(d)); });
    if (step < 1e-9) break;
  }
  return t;
}

/** The book anchor's fit on priced chances ([stated, implied, hit]); null when too thin (CAL_MIN, as the stated-only fit). */
export function fitAnchor(triples) {
  const ok = triples.filter(([p, q, y]) => Number.isFinite(p) && q > 0 && q < 1 && (y === 0 || y === 1));
  const hits = ok.reduce((s, [, , y]) => s + y, 0);
  if (ok.length < CAL_MIN.n || hits < CAL_MIN.hits) return null;
  const rows = ok.map(([p, q, y]) => [1, lg(q), lg(p) - lg(q), y]);
  // The price keeps its own weight (wBook 1): a market's few hundred chances bend it into edges on long shots that are not
  // there (replayed on 2026-11-15..19, a free wBook drifted 0.3-1.5 a market and its "edges" landed 43%). Learned: the
  // margin (a) and how much the stated chance moves off the price (wModel).
  let t = newton(rows, [0, 1, 0], [0, 2]);
  if (t[2] < 0) t = newton(rows, [0, 1, 0], [0]);   // a read that points the wrong way says nothing: the price alone
  else if (t[2] > 1) t = newton(rows, [0, 1, 1], [0]);
  return { n: ok.length, hits, a: r4(t[0]), wBook: r4(t[1]), wModel: r4(t[2]) };
}

/** A stated chance at a price through an anchor fit (null where the fit is off or there is no price to read). */
export function anchored(fit, p, implied) {
  if (p == null || !fit?.use || !(implied > 0 && implied < 1)) return null;
  return r3(sg(anchorZ(fit, p, implied)));
}

/** One key's anchor fit with the held-out check against the stated-only read (`stated`: that key's checked fit or null). */
export function anchorChecked(list, nights, stated = null) {
  const triple = (x) => [x.p, x.implied, x.hit];
  const fit = fitAnchor(list.map(triple));
  if (!fit) return null;
  const cut = nights.length > CHECK_NIGHTS ? nights[nights.length - CHECK_NIGHTS] : null;
  let check = null;
  if (cut) {
    const early = fitAnchor(list.filter((x) => x.slate < cut).map(triple));
    const earlyStated = stated?.use ? fitHeight(list.filter((x) => x.slate < cut).map((x) => [x.p, x.hit])) : null;
    const late = list.filter((x) => x.slate >= cut);
    if (early && late.length >= CHECK_MIN) {
      const b = (f) => late.reduce((s, x) => s + (f(x) - x.hit) ** 2, 0) / late.length;
      check = { from: cut, n: late.length, stated: r4(b((x) => (earlyStated ? calibrate(earlyStated, x.p) : x.p))), anchored: r4(b((x) => sg(anchorZ(early, x.p, x.implied)))) };
    }
  }
  return { ...fit, check, use: !!check && check.anchored <= check.stated };
}

/**
 * The calibration from graded slates (gradeBoard records: { key, plays, rungs }), each chance as the board stated it
 * (`raw` when the record carries one): { at, from, to, nights, plays, rungs, reads: { plays: { key: fit }, rungs: { market: fit } } }.
 */
export function calibrationOf(graded, meta = {}) {
  const nights = [...new Set(graded.filter((g) => g.plays?.length || g.rungs?.length).map((g) => g.key))].sort();
  const plays = new Map(); const rungs = new Map(); const pricedPlays = new Map(); const pricedRungs = new Map();
  const add = (map, k, x) => { const list = map.get(k) || []; list.push(x); map.set(k, list); };
  let nPlays = 0; let nRungs = 0;
  for (const g of graded) {
    for (const x of g.plays || []) { const p = x.raw ?? x.p; if (!Number.isFinite(p) || (x.hit !== 0 && x.hit !== 1)) continue; add(plays, playKey(x.market, x.side), { slate: g.key, p, hit: x.hit }); nPlays++; const q = x.implied ?? null; if (q > 0 && q < STEEP) add(pricedPlays, playKey(x.market, x.side), { slate: g.key, p, implied: q, hit: x.hit }); }
    for (const r of g.rungs || []) { const p = r.raw ?? r.p; if (!Number.isFinite(p) || (r.hit !== 0 && r.hit !== 1)) continue; add(rungs, r.market, { slate: g.key, p, hit: r.hit }); nRungs++; const q = r.odds != null ? impliedProb(r.odds) : null; if (q > 0 && q < STEEP) add(pricedRungs, r.market, { slate: g.key, p, implied: q, hit: r.hit }); }
  }
  const fits = (map) => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => [k, fitChecked(list, nights)]).filter(([, f]) => f));
  const anchors = (map, stated) => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => [k, anchorChecked(list, nights, stated[k] || null)]).filter(([, f]) => f));
  const readPlays = fits(plays); const readRungs = fits(rungs);
  return { at: meta.at || new Date().toISOString(), from: meta.from ?? nights[0] ?? null, to: meta.to ?? nights[nights.length - 1] ?? null, nights: nights.length, plays: nPlays, rungs: nRungs, reads: { plays: readPlays, rungs: readRungs, anchor: { plays: anchors(pricedPlays, readPlays), rungs: anchors(pricedRungs, readRungs) } } };
}

/** A stated chance through a fit the board applies (the stated chance itself otherwise). */
export function calibrated(fit, p) {
  if (p == null || !fit?.use) return p;
  return r3(calibrate(fit, p));
}

/** A play's printed chance: the book anchor at its price where that fit holds, else its market and side's fit. */
export const playChance = (cal, market, side, p, implied = null) =>
  anchored(cal?.reads?.anchor?.plays?.[playKey(market, side)], p, implied) ?? calibrated(cal?.reads?.plays?.[playKey(market, side)], p);

/** The book anchor a market's priced rungs are printed through (ladderOf's `anchor`), or null. */
export const rungAnchor = (cal, market) => { const f = cal?.reads?.anchor?.rungs?.[market]; return f?.use ? f : null; };

/** The fit a market's rungs are printed through (ladderOf's `cal`), or null. */
export const rungFit = (cal, market) => { const f = cal?.reads?.rungs?.[market]; return f?.use ? f : null; };

/** What the board applies, for the panels' notes: the keys printed calibrated and the calibration's span. */
export function appliedOf(cal) {
  if (!cal?.reads) return null;
  const on = (reads) => Object.entries(reads || {}).filter(([, f]) => f?.use).map(([k]) => k);
  return { at: cal.at, from: cal.from, to: cal.to, nights: cal.nights, plays: on(cal.reads.plays), rungs: on(cal.reads.rungs), anchored: { plays: on(cal.reads.anchor?.plays), rungs: on(cal.reads.anchor?.rungs) }, checked: Object.values({ ...cal.reads.plays, ...cal.reads.rungs }).filter((f) => f?.check).length };
}

/** The panels' words for what the board prints calibrated (`board.calibration`, appliedOf + the fits). */
export function calibrationNote(c) {
  if (!c) return '';
  const n = (list) => list?.length || 0;
  const span = c.from && c.to ? `${c.nights} graded night${c.nights === 1 ? '' : 's'}, ${c.from} to ${c.to}` : `${c.nights} graded nights`;
  return `The chances are printed calibrated to what the same stated chance has landed on this season's ${span}: ${n(c.plays)} play market${n(c.plays) === 1 ? '' : 's'} and ${n(c.rungs)} ladder${n(c.rungs) === 1 ? '' : 's'}, each fit applied only after it beat the stated chance on the last ${CHECK_NIGHTS} nights it never saw. Hover a chance for the figure as stated.`;
}

/** The hover's words for a chance printed calibrated: the figure as the board stated it. */
export const asStated = (raw) => (raw == null ? '' : ` · ${Math.round(raw * 100)}% as the model states it, before the calibration`);

/** Whether two calibrations say the same (a stored one is never rewritten unchanged: a write drops the store's builds). */
export const sameCalibration = (a, b) => !!a && !!b && a.nights === b.nights && a.plays === b.plays && a.rungs === b.rungs && JSON.stringify(a.reads) === JSON.stringify(b.reads) && JSON.stringify(a.reliability ?? null) === JSON.stringify(b.reliability ?? null);
