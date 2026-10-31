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
import { fitHeight, calibrate, CAL_MIN } from '../nhl-data/calibration-pure';

export { CAL_MIN, calibrate };
export const CHECK_NIGHTS = 3;   // the newest nights held out to check a fit
export const CHECK_MIN = 100;    // graded chances the held-out nights need before the check speaks

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;
const UNDER = new Set(['under', 'no']);

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

/**
 * The calibration from graded slates (gradeBoard records: { key, plays, rungs }), each chance as the board stated it
 * (`raw` when the record carries one): { at, from, to, nights, plays, rungs, reads: { plays: { key: fit }, rungs: { market: fit } } }.
 */
export function calibrationOf(graded, meta = {}) {
  const nights = [...new Set(graded.filter((g) => g.plays?.length || g.rungs?.length).map((g) => g.key))].sort();
  const plays = new Map(); const rungs = new Map();
  const add = (map, k, x) => { const list = map.get(k) || []; list.push(x); map.set(k, list); };
  let nPlays = 0; let nRungs = 0;
  for (const g of graded) {
    for (const x of g.plays || []) { const p = x.raw ?? x.p; if (!Number.isFinite(p) || (x.hit !== 0 && x.hit !== 1)) continue; add(plays, playKey(x.market, x.side), { slate: g.key, p, hit: x.hit }); nPlays++; }
    for (const r of g.rungs || []) { const p = r.raw ?? r.p; if (!Number.isFinite(p) || (r.hit !== 0 && r.hit !== 1)) continue; add(rungs, r.market, { slate: g.key, p, hit: r.hit }); nRungs++; }
  }
  const fits = (map) => Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => [k, fitChecked(list, nights)]).filter(([, f]) => f));
  return { at: meta.at || new Date().toISOString(), from: meta.from ?? nights[0] ?? null, to: meta.to ?? nights[nights.length - 1] ?? null, nights: nights.length, plays: nPlays, rungs: nRungs, reads: { plays: fits(plays), rungs: fits(rungs) } };
}

/** A stated chance through a fit the board applies (the stated chance itself otherwise). */
export function calibrated(fit, p) {
  if (p == null || !fit?.use) return p;
  return r3(calibrate(fit, p));
}

/** A play's printed chance: its market and side's fit. */
export const playChance = (cal, market, side, p) => calibrated(cal?.reads?.plays?.[playKey(market, side)], p);

/** The fit a market's rungs are printed through (ladderOf's `cal`), or null. */
export const rungFit = (cal, market) => { const f = cal?.reads?.rungs?.[market]; return f?.use ? f : null; };

/** What the board applies, for the panels' notes: the keys printed calibrated and the calibration's span. */
export function appliedOf(cal) {
  if (!cal?.reads) return null;
  const on = (reads) => Object.entries(reads || {}).filter(([, f]) => f?.use).map(([k]) => k);
  return { at: cal.at, from: cal.from, to: cal.to, nights: cal.nights, plays: on(cal.reads.plays), rungs: on(cal.reads.rungs), checked: Object.values({ ...cal.reads.plays, ...cal.reads.rungs }).filter((f) => f?.check).length };
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
