// The edge over the book, and whether it has paid (Vincent, 2026-10-31: "run that edge audit for shots and goals").
// A skater's `book` read on the board: at the book's main shots line (o2.5 = 3+) the board's chance of clearing it against
// what the price implies, and his anytime-goal price against his 1+ G chance — `edge` = the board's chance minus the
// implied probability. The scorecard grades every priced skater-game the same way, with the board's chance as the board
// prints it (the λ at the board's weights through the calibration): by the edge the board saw, by what the book asked,
// and step by step up the chance, so the **reliable chance** per market — the lowest step from which `RELIABLE.min`
// priced plays at or over it landed at least their break-even (a flat stake at the book's prices did not lose) — can be
// read and shown. A price is American; `ret` is the flat-stake return per unit at the book's price. Pure.
import { poissonAtLeast } from './picks-pure';
import { calibratedChance, readsOf } from './calibration-pure';
import { impliedProb } from '../nfl/odds';

export const EDGE_BUCKETS = [
  { key: 'e_neg', label: 'no edge (0 or under)', lo: -2, hi: 0 },
  { key: 'e0', label: '0–3%', lo: 0, hi: 0.03 },
  { key: 'e3', label: '3–6%', lo: 0.03, hi: 0.06 },
  { key: 'e6', label: '6–10%', lo: 0.06, hi: 0.1 },
  { key: 'e10', label: '10% and up', lo: 0.1, hi: 2 },
];
export const IMPLIED_BUCKETS = [
  { key: 'i0', label: 'under 30%', lo: 0, hi: 0.3 },
  { key: 'i30', label: '30–40%', lo: 0.3, hi: 0.4 },
  { key: 'i40', label: '40–50%', lo: 0.4, hi: 0.5 },
  { key: 'i50', label: '50–60%', lo: 0.5, hi: 0.6 },
  { key: 'i60', label: '60% and up', lo: 0.6, hi: 1.01 },
];
export const RELIABLE = { min: 25, steps: [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8] };
export const BOOK_MARKETS = [{ key: 'sog', label: 'Shots at the book’s line', stat: 'sog' }, { key: 'g', label: 'Anytime goal', stat: 'g' }];

const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
/** The decimal price of an American one. */
export const decimalOf = (odds) => (odds == null || !Number.isFinite(odds) || odds === 0 ? null : odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds);
/** A flat stake's return per unit at the price: the profit on a hit, −1 on a miss. */
export const flatReturn = (odds, hit) => { const d = decimalOf(odds); return d == null ? null : hit ? d - 1 : -1; };
/** The height a line asks for: o2.5 = 3+. */
export const markOf = (line) => (line == null || !Number.isFinite(Number(line)) ? null : Math.floor(Number(line)) + 1);

/**
 * A skater's chance of a height on the board's read: the board's own 2+ … 4+ (and 1+ G) where it has them, else his λ
 * through the calibration's fits for the stat (`fits`), else the Poisson tail; never above the rung below.
 */
export function chanceAtHeight(proj, stat, height, fits = null) {
  if (!proj || !(height >= 1)) return null;
  if (stat === 'sog') {
    const own = { 2: proj.p2, 3: proj.p3, 4: proj.p4 }[height];
    if (own != null) return own;
    if (!(proj.lamS > 0)) return null;
    const p = fits ? calibratedChance({ sog: fits }, 'sog', proj.lamS, height) : poissonAtLeast(proj.lamS, height);
    return r3(height > 4 && proj.p4 != null ? Math.min(p, proj.p4) : p);
  }
  if (height === 1 && proj.p1g != null) return proj.p1g;
  if (!(proj.lamG > 0)) return null;
  const p = fits ? calibratedChance({ g: fits }, 'g', proj.lamG, height) : poissonAtLeast(proj.lamG, height);
  return r3(height > 1 && proj.p1g != null ? Math.min(p, proj.p1g) : p);
}

/**
 * The board's read of a skater's lines: `proj` his board row (p2 … p4, p1g, lamS, lamG), `prop` his stored lines
 * ({ sog, goal } from skater-props.js), `fits` the calibration's fits per stat ({ sog, g }) when the board prints
 * calibrated. { sog: { line, mark, odds, underOdds, implied, p, edge, book, books, lines }, goal: { odds, implied, p,
 * edge, book, books } } — each null without a line — or null without any.
 */
export function bookRead(proj, prop, fits = null) {
  if (!prop || (!prop.sog && !prop.goal)) return null;
  let sog = null; let goal = null;
  if (prop.sog?.line != null && prop.sog.odds != null) {
    const mark = markOf(prop.sog.line);
    const p = chanceAtHeight(proj, 'sog', mark, fits?.sog || null);
    const implied = r3(impliedProb(prop.sog.odds));
    sog = { line: prop.sog.line, mark, odds: prop.sog.odds, underOdds: prop.sog.underOdds ?? null, implied, p, edge: p != null && implied != null ? r3(p - implied) : null, book: prop.sog.book || null, books: prop.sog.books ?? null, lines: prop.sog.lines || null };
  }
  if (prop.goal?.odds != null) {
    const p = chanceAtHeight(proj, 'g', 1, fits?.g || null);
    const implied = r3(impliedProb(prop.goal.odds));
    goal = { odds: prop.goal.odds, implied, p, edge: p != null && implied != null ? r3(p - implied) : null, book: prop.goal.book || null, books: prop.goal.books ?? null };
  }
  return sog || goal ? { sog, goal } : null;
}

/**
 * The scorecard's book record for a graded row: the board's chance as the board prints it — his λ at the board's weights
 * (`readsOf` on the row's run and study λ) through the calibration (`cal.reads.board`) — at the book's mark and for a goal,
 * beside the run's own stated figure (`raw`). `row` carries { lamS, lamG, studyS, studyG, p3s, p4s, p5s, p1g }, `prop`
 * his stored lines. Null without lines.
 */
export function bookRecord(row, prop, cal = null, weights = { w: 0, wG: 1 }) {
  if (!prop || (!prop.sog && !prop.goal)) return null;
  const lam = readsOf(row, weights).board;
  const fits = cal?.reads?.board || null;
  const proj = { lamS: lam.sog, lamG: lam.g };
  const read = bookRead(proj, prop, fits);
  if (!read) return null;
  const rawAt = (mark) => ({ 3: row.p3s, 4: row.p4s, 5: row.p5s }[mark] ?? (row.lamS > 0 ? r3(poissonAtLeast(row.lamS, mark)) : null));
  return {
    sog: read.sog ? { ...read.sog, lines: undefined, raw: rawAt(read.sog.mark) } : null,
    goal: read.goal ? { ...read.goal, raw: row.p1g ?? null } : null,
  };
}

function scoreList(list) {
  if (!list.length) return { n: 0, said: null, implied: null, hit: null, diff: null, ret: null, raw: null };
  const said = mean(list.map((c) => c.p)); const hit = mean(list.map((c) => c.hit));
  return { n: list.length, said: r3(said), implied: r3(mean(list.map((c) => c.implied))), hit: r3(hit), diff: r3(hit - said), ret: r3(mean(list.map((c) => c.ret))), raw: r3(mean(list.map((c) => c.raw ?? c.p))) };
}

/**
 * The edge, graded, per market: every priced skater-game ({ p, raw, implied, odds, edge, hit }) → overall; the board's
 * plays (an edge over 0); by the edge the board saw; by what the book asked; step by step up the board's chance (the
 * plays at or over each step) with the reliable threshold: the lowest step from which `min` plays landed at least the
 * break-even their prices asked. Rows carry `book` as `bookRecord` builds it and `actual`.
 */
export function edgeReport(rows, { min = RELIABLE.min, steps = RELIABLE.steps } = {}) {
  const out = {};
  for (const m of BOOK_MARKETS) {
    const list = [];
    for (const r of rows || []) {
      const b = r.book?.[m.key === 'sog' ? 'sog' : 'goal'];
      if (!b || b.p == null || b.implied == null || b.odds == null || !r.actual) continue;
      const height = m.key === 'sog' ? b.mark : 1;
      const hit = (Number(r.actual[m.stat]) || 0) >= height ? 1 : 0;
      list.push({ p: b.p, raw: b.raw ?? b.p, implied: b.implied, odds: b.odds, edge: b.edge ?? r3(b.p - b.implied), hit, ret: flatReturn(b.odds, hit) });
    }
    const bySteps = steps.map((step) => { const at = list.filter((c) => c.p >= step); const s = scoreList(at); return { step, ...s, ok: s.n >= min && s.hit != null && s.hit >= s.implied }; });
    const reliable = bySteps.find((s) => s.ok) || null;
    out[m.key] = {
      ...m,
      ...scoreList(list),
      plays: scoreList(list.filter((c) => c.edge > 0)),
      byEdge: EDGE_BUCKETS.map((b) => ({ ...b, ...scoreList(list.filter((c) => c.edge >= b.lo && c.edge < b.hi)) })),
      byImplied: IMPLIED_BUCKETS.map((b) => ({ ...b, ...scoreList(list.filter((c) => c.implied >= b.lo && c.implied < b.hi)) })),
      steps: bySteps,
      reliable: reliable ? { step: reliable.step, n: reliable.n, hit: reliable.hit, implied: reliable.implied, ret: reliable.ret } : null,
      min,
    };
  }
  return out;
}

/** The reliable thresholds alone, for the board's head and the Book cells: { sog: { step, n, hit, implied, ret } | null, g }. */
export function reliableOf(report) {
  if (!report) return null;
  return Object.fromEntries(BOOK_MARKETS.map((m) => [m.key, report[m.key]?.reliable || null]));
}
