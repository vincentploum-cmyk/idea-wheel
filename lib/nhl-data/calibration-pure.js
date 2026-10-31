// The board's chances calibrated to what they have landed (Vincent, 2026-10-30, after the model was graded on this
// season's games — its 60%+ 3+ SOG calls said 73% and landed 57%, its 35%+ goal calls said 50% and landed 25% —: "yes
// build the calibration"). The model's math is untouched: the run's λ stays the run's, and only the chance the board
// prints is moved, height by height, to the rate the same stated chance has landed on the season's graded games.
//
// Per read (the board's: the run's λ blended with the study's at the board's weights; the study's alone, for a slate
// without a run) and per height (1+ … 8+ shots, 1+ … 3+ goals): a logistic recalibration of the stated chance on the
// season's graded games — landed = σ(a + b · logit(stated)), a and b fitted by maximum likelihood with a light pull
// toward the identity (a = 0, b = 1). On this season's runs (Oct 8–29, fitted before a date and read after it) the 3+
// and 4+ SOG odds came out at b ≈ 0.5, the same on every split: the run's tails are about twice as sure of themselves
// as its nights are, a stated 80% landing about 61%; the study's goal read came out at b ≈ 0.93, near the identity.
// Binned rates shrunk toward the stated chance were tried first and kept too much of the overstatement at the top on the
// held-out week (said 74%, landed 59%). A height with too few games keeps the stated chance. A skater's chance at a
// height is never above his chance one height lower.
// Pure: the shuffle's panel reads it too.
import { poissonAtLeast } from './picks-pure';

export const CAL_HEIGHTS = { sog: [1, 2, 3, 4, 5, 6, 7, 8], g: [1, 2, 3] };
export const CAL_MIN = { n: 300, hits: 25 };   // a height speaks from this many graded games and hits
export const CAL_RIDGE = 2;                     // the pull toward the identity, in units of the log-likelihood
const r4 = (v) => Math.round(v * 10000) / 10000;
const logit = (p) => { const q = Math.min(1 - 1e-4, Math.max(1e-4, p)); return Math.log(q / (1 - q)); };
const sigma = (z) => 1 / (1 + Math.exp(-z));

/**
 * One height's recalibration from [stated, landed (0 / 1)] pairs: { a, b, n, hits } (Newton's method on the logistic
 * likelihood of landed on logit(stated), ridge toward a = 0, b = 1); null when the height is too thin to speak.
 */
export function fitHeight(pairs) {
  const ok = pairs.filter(([p, y]) => Number.isFinite(p) && (y === 0 || y === 1));
  const hits = ok.reduce((s, [, y]) => s + y, 0);
  if (ok.length < CAL_MIN.n || hits < CAL_MIN.hits) return null;
  const xs = ok.map(([p]) => logit(p)); const ys = ok.map(([, y]) => y);
  let a = 0; let b = 1;
  for (let it = 0; it < 50; it++) {
    // Gradient and Hessian of the negative log-likelihood plus the ridge.
    let ga = CAL_RIDGE * a; let gb = CAL_RIDGE * (b - 1); let haa = CAL_RIDGE; let hab = 0; let hbb = CAL_RIDGE;
    for (let i = 0; i < xs.length; i++) {
      const m = sigma(a + b * xs[i]); const e = m - ys[i]; const v = m * (1 - m);
      ga += e; gb += e * xs[i]; haa += v; hab += v * xs[i]; hbb += v * xs[i] * xs[i];
    }
    const det = haa * hbb - hab * hab;
    if (!(Math.abs(det) > 1e-12)) break;
    const da = (hbb * ga - hab * gb) / det; const db = (haa * gb - hab * ga) / det;
    a -= da; b -= db;
    if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) break;
  }
  return { n: ok.length, hits, a: r4(a), b: r4(Math.max(0.05, b)) };
}

/** A stated chance through one height's recalibration (the stated chance itself when the height has none). */
export function calibrate(fit, p) {
  if (!fit || !Number.isFinite(fit.a) || !Number.isFinite(fit.b) || !Number.isFinite(p)) return p;
  if (p <= 0) return 0;
  return sigma(fit.a + fit.b * logit(p));
}

/** A skater's calibrated chance at a height off a λ: each height's recalibration, never above the height below it. */
export function calibratedChance(cal, stat, lam, height) {
  if (!(lam > 0)) return 0;
  let best = 1;
  for (const k of CAL_HEIGHTS[stat] || []) {
    if (k > height) break;
    best = Math.min(best, calibrate(cal?.[stat]?.[k], poissonAtLeast(lam, k)));
  }
  return CAL_HEIGHTS[stat]?.includes(height) ? best : Math.min(best, poissonAtLeast(lam, height));
}

/** The board's λ on a graded game: the run's blended with the study's at the board's weights (`board`), and the study's (`study`). */
export function readsOf(row, { w = 0, wG = 1 } = {}) {
  const mix = (a, b, k) => (k > 0 && b > 0 && a != null ? (1 - k) * a + k * b : k >= 1 && b > 0 ? b : a);
  const lamS = row.lamS > 0 ? row.lamS : null; const lamG = row.lamG >= 0 ? row.lamG : null;
  return {
    board: { sog: lamS == null ? null : mix(lamS, row.studyS, w), g: lamG == null ? null : mix(lamG, row.studyG, wG) },
    study: { sog: row.studyS > 0 ? row.studyS : null, g: row.studyG > 0 ? row.studyG : null },
  };
}

/**
 * The calibration from graded games — rows of { lamS, lamG, studyS, studyG, sog, g } (the run's λ, the study's that
 * morning, what he got) — at the board's weights: per read, stat and height, { a, b, n, hits } or null.
 */
export function calibrationOf(rows, weights = {}, meta = {}) {
  const w = Number(weights.w) || 0; const wG = weights.wG == null ? 1 : Number(weights.wG);
  const out = { at: meta.at || new Date().toISOString(), from: meta.from ?? null, to: meta.to ?? null, games: rows.length, weights: { w, wG }, reads: {} };
  for (const read of ['board', 'study']) {
    out.reads[read] = {};
    for (const stat of ['sog', 'g']) {
      out.reads[read][stat] = {};
      const list = rows.map((r) => ({ lam: readsOf(r, { w, wG })[read][stat], y: Number(r[stat]) || 0 })).filter((x) => x.lam > 0);
      for (const k of CAL_HEIGHTS[stat]) out.reads[read][stat][k] = fitHeight(list.map((x) => [poissonAtLeast(x.lam, k), x.y >= k ? 1 : 0]));
    }
  }
  return out;
}

/** Whether a stored calibration was built at the board's weights now (another blend is another read). */
export function calibrationFits(cal, { w = 0, wG = 1 } = {}) {
  return !!cal?.reads && Math.abs((cal.weights?.w ?? 0) - w) < 1e-9 && Math.abs((cal.weights?.wG ?? 1) - wG) < 1e-9;
}

/**
 * A board row's chances calibrated: 2+ / 3+ / 4+ SOG and 1+ goal off its λ through the read's recalibration, the figures the
 * row had before riding along as `raw`. The row unchanged without a calibration for the read.
 */
export function calibrateProjection(proj, cal, read) {
  const c = cal?.reads?.[read];
  if (!proj || !c) return proj;
  const at = (stat, lam, h) => Math.round(calibratedChance(c, stat, lam, h) * 100) / 100;
  return {
    ...proj,
    p2: at('sog', proj.lamS, 2), p3: at('sog', proj.lamS, 3), p4: at('sog', proj.lamS, 4), p1g: at('g', proj.lamG, 1),
    raw: { p2: proj.p2, p3: proj.p3, p4: proj.p4, p1g: proj.p1g },
    calibrated: read,
  };
}
