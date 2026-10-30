import SEED from '../lib/nhl-data/seed/calibration.json';
import { fitHeight, calibrate, calibratedChance, calibrationOf, calibrationFits, calibrateProjection, readsOf, CAL_MIN } from '../lib/nhl-data/calibration-pure';
import { chanceAt, readAt } from '../lib/nhl-data/shuffle-pure';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';

const logit = (p) => Math.log(p / (1 - p));
const sigma = (z) => 1 / (1 + Math.exp(-z));
// A seeded generator, so the synthetic seasons are the same every run.
function rng(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

describe('calibration: the fit', () => {
  test('a height recovers an overconfident read: landed = σ(a + b · logit(stated))', () => {
    const r = rng(); const pairs = [];
    for (let i = 0; i < 6000; i++) {
      const stated = 0.05 + 0.9 * r();
      pairs.push([stated, r() < sigma(-0.3 + 0.55 * logit(stated)) ? 1 : 0]);
    }
    const fit = fitHeight(pairs);
    expect(fit.n).toBe(6000);
    expect(fit.a).toBeCloseTo(-0.3, 1);
    expect(fit.b).toBeCloseTo(0.55, 1);
    // A stated 80% lands about 61%.
    expect(calibrate(fit, 0.8)).toBeCloseTo(sigma(-0.3 + 0.55 * logit(0.8)), 1);
  });

  test('an honest read stays where it is; a thin height keeps the stated chance', () => {
    const r = rng(11); const pairs = [];
    for (let i = 0; i < 4000; i++) { const p = 0.05 + 0.9 * r(); pairs.push([p, r() < p ? 1 : 0]); }
    const fit = fitHeight(pairs);
    // within the sampling noise of 4,000 games (b's standard error is about 0.06)
    expect(Math.abs(fit.a)).toBeLessThan(0.15); expect(Math.abs(fit.b - 1)).toBeLessThan(0.15);
    expect(fitHeight(pairs.slice(0, CAL_MIN.n - 1))).toBeNull();
    expect(calibrate(null, 0.42)).toBe(0.42);
  });

  test('a skater’s calibrated chance never rises with the height', () => {
    const cal = { sog: { 1: { a: 0.6, b: 0.6 }, 2: { a: 0.1, b: 0.56 }, 3: { a: -0.28, b: 0.55 }, 4: { a: -0.7, b: 0.52 } } };
    for (const lam of [0.8, 2, 3.5, 5]) {
      const ladder = [1, 2, 3, 4, 5, 6].map((h) => calibratedChance(cal, 'sog', lam, h));
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeLessThanOrEqual(ladder[i - 1]);
      // a height without a fit reads its Poisson tail, never above the calibrated one below it
      expect(ladder[4]).toBeLessThanOrEqual(poissonAtLeast(lam, 5));
    }
  });

  test('the board’s read: the run’s λ blended with the study’s at the board’s weights', () => {
    const row = { lamS: 3, lamG: 0.5, studyS: 2, studyG: 0.3 };
    expect(readsOf(row, { w: 0, wG: 1 }).board).toEqual({ sog: 3, g: 0.3 });
    expect(readsOf(row, { w: 0.5, wG: 0 }).board).toEqual({ sog: 2.5, g: 0.5 });
    expect(readsOf({ lamS: 3, lamG: 0.5 }, { w: 0, wG: 1 }).board.g).toBe(0.5);   // no study: the run's, as the board shows it
    expect(readsOf(row).study).toEqual({ sog: 2, g: 0.3 });
  });

  test('calibrationOf fits every read and height, and says which weights it was learned at', () => {
    const r = rng(3); const rows = [];
    for (let i = 0; i < 3000; i++) {
      const lamS = 0.5 + 4 * r(); const lamG = 0.05 + 0.5 * r();
      // Nights that run flatter than the λ says: the truth is the λ pulled toward 2 shots.
      const truth = 2 + 0.5 * (lamS - 2);
      let sog = 0; let p = Math.exp(-truth); let u = r(); let cdf = p;
      while (u > cdf) { sog += 1; p *= truth / sog; cdf += p; }
      rows.push({ lamS, lamG, studyS: lamS, studyG: lamG, sog, g: r() < 1 - Math.exp(-lamG) ? 1 : 0 });
    }
    const cal = calibrationOf(rows, { w: 0, wG: 1 }, { from: '2026-10-08', to: '2026-10-29' });
    expect(cal.weights).toEqual({ w: 0, wG: 1 });
    expect(cal.reads.board.sog[3].b).toBeLessThan(0.9);   // overconfident tails are pulled in
    expect(calibrationFits(cal, { w: 0, wG: 1 })).toBe(true);
    expect(calibrationFits(cal, { w: 0.5, wG: 1 })).toBe(false);
  });
});

describe('calibration: on the board and the shuffle', () => {
  const cal = { weights: { w: 0, wG: 1 }, reads: { board: { sog: { 2: { a: 0.07, b: 0.56 }, 3: { a: -0.28, b: 0.55 }, 4: { a: -0.7, b: 0.52 } }, g: { 1: { a: -0.1, b: 0.9 } } } } };

  test('a board row prints calibrated chances, the stated ones riding along', () => {
    const proj = { lamS: 4.2, lamG: 0.6, p2: 0.92, p3: 0.79, p4: 0.6, p1g: 0.45 };
    const out = calibrateProjection(proj, cal, 'board');
    expect(out.raw).toEqual({ p2: 0.92, p3: 0.79, p4: 0.6, p1g: 0.45 });
    expect(out.p3).toBeLessThan(0.79);
    expect(out.p3).toBeLessThanOrEqual(out.p2);
    expect(out.p4).toBeLessThanOrEqual(out.p3);
    expect(out.calibrated).toBe('board');
    expect(calibrateProjection(proj, cal, 'study')).toBe(proj);   // no fit for the read: the row as it was
  });

  test('the shuffle prints the board’s read calibrated and every other read as its tail', () => {
    const row = { lamS: 4.2, lamG: 0.6, cal: cal.reads.board, own: { own5: { sog: 4.2, g: 0.6 } } };
    const board = chanceAt(row, 'sog', 3, 'model');
    expect(board).toBeCloseTo(calibratedChance(cal.reads.board, 'sog', 4.2, 3), 3);
    expect(board).toBeLessThan(poissonAtLeast(4.2, 3));
    const read = readAt(row, 'sog', 3, 'model');
    expect(read.p).toBe(board);
    expect(read.raw).toBeCloseTo(poissonAtLeast(4.2, 3), 3);
    expect(chanceAt({ ...row, cal: null }, 'sog', 3, 'model')).toBeCloseTo(poissonAtLeast(4.2, 3), 3);
  });
});

describe('calibration: the seed', () => {
  test('the shipped seed was learned from the graded runs and pulls the shot tails in', () => {
    expect(SEED.reads.board.sog['3'].b).toBeGreaterThan(0.3);
    expect(SEED.reads.board.sog['3'].b).toBeLessThan(0.8);
    expect(SEED.reads.study.g['1']).toBeTruthy();
    expect(calibrationFits(SEED, { w: 0, wG: 1 })).toBe(true);
    // the model's stated 80% at 3+ SOG prints about 62%
    expect(calibrate(SEED.reads.board.sog['3'], 0.8)).toBeGreaterThan(0.55);
    expect(calibrate(SEED.reads.board.sog['3'], 0.8)).toBeLessThan(0.7);
  });
});
