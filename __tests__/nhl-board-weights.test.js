import { describe, expect, test } from '@jest/globals';
import { SHARES, DEFAULT_WEIGHTS, LEARN, SCORED, usableFor, lamAt, walkForward, learnWeights, boardWeightsOf, shareText, verdictText } from '../lib/nhl-data/board-weights-pure';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';

function rng(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const poisson = (lam, r) => { let k = 0; let p = Math.exp(-lam); let cdf = p; const u = r(); while (u > cdf && k < 20) { k += 1; p *= lam / k; cdf += p; } return k; };

/**
 * A synthetic season: `nights` nights of `perNight` skaters. The truth behind each skater's shots and goals is one of the
 * two reads (or their blend); the other read is the truth with noise on top, so the walk-forward verdict has something
 * to find. The model's shots say more than the nights do (its λ runs wide), as the real run's do.
 */
function season({ nights = 18, perNight = 200, truthS = 0, truthG = 1, seed = 3, noise = 0.45 } = {}) {
  const r = rng(seed); const rows = [];
  for (let i = 0; i < nights; i++) {
    const date = `2026-10-${String(8 + i).padStart(2, '0')}`;
    for (let j = 0; j < perNight; j++) {
      const baseS = 0.6 + 3.6 * r(); const baseG = 0.04 + 0.5 * r();
      const jitter = () => Math.exp(noise * (r() - 0.5) * 2);
      // Two reads of the shots: one is the truth (widened, as the run states it), the other the truth with noise.
      const trueS = baseS; const trueG = baseG;
      const readsS = [trueS, trueS * jitter()]; const readsG = [trueG, trueG * jitter()];
      const lamS = truthS === 0 ? readsS[0] : readsS[1]; const studyS = truthS === 0 ? readsS[1] : readsS[0];
      const lamG = truthG === 0 ? readsG[0] : readsG[1]; const studyG = truthG === 0 ? readsG[1] : readsG[0];
      rows.push({ date, lamS, studyS, lamG, studyG, sog: poisson(trueS, r), g: poisson(trueG, r) });
    }
  }
  return rows;
}

describe('the board’s weights, learned from the graded nights', () => {
  test('the candidates, the defaults and the scored heights', () => {
    expect(SHARES).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(DEFAULT_WEIGHTS).toEqual({ w: 0, wG: 1 });
    expect(SCORED).toEqual({ sog: [3, 4], g: [1, 2] });
    expect(LEARN.margin).toBeGreaterThan(0);
  });
  test('a row needs both λ for the stat; the blend is linear in the share', () => {
    const r = { date: '2026-10-08', lamS: 3, studyS: 2, lamG: 0.4, studyG: 0, sog: 2, g: 0 };
    expect(usableFor(r, 'sog')).toBe(true);
    expect(usableFor(r, 'g')).toBe(false);
    expect(lamAt(r, 'sog', 0)).toBe(3); expect(lamAt(r, 'sog', 1)).toBe(2); expect(lamAt(r, 'sog', 0.5)).toBe(2.5);
  });
  test('walked forward: the first nights warm the calibration, every night after is scored through the fit on the nights before it', () => {
    const rows = season({ nights: 10, perNight: 120 });
    const w = walkForward(rows, 'sog', 0);
    expect(w.nights).toBe(10 - LEARN.warmNights);
    expect(w.n).toBe(w.nights * 120 * SCORED.sog.length);
    expect(w.brier).toBeGreaterThan(0); expect(w.brier).toBeLessThan(0.25);
    // Before the calibration can speak (under CAL_MIN rows) the chance is the Poisson tail: the first scored night's chances are the stated ones.
    const thin = walkForward(rows.slice(0, 120 * 7), 'sog', 0, { warmNights: 1 });
    expect(thin.nights).toBe(6);
    const night2 = rows.filter((r) => r.date === '2026-10-09');
    const stated = night2.reduce((s, r) => s + SCORED.sog.reduce((t, h) => t + (poissonAtLeast(r.lamS, h) - (r.sog >= h ? 1 : 0)) ** 2, 0), 0);
    expect(walkForward(rows.slice(0, 240), 'sog', 0, { warmNights: 1 }).brier).toBeCloseTo(stated / (120 * 2), 4);
  });
  test('the verdict finds the read behind the nights: the run’s shots, the study’s goals', () => {
    const v = learnWeights(season({ truthS: 0, truthG: 1 }), { at: '2026-10-31T06:00:00Z' });
    expect(v.weights).toEqual({ w: 0, wG: 1 });
    expect(v.stats.sog).toMatchObject({ share: 0, from: 0, best: 0, moved: false });
    expect(v.stats.g).toMatchObject({ share: 1, from: 1, best: 1, moved: false });
    expect(v.stats.sog.scores[0].brier).toBeLessThan(v.stats.sog.scores[1].brier);
    expect(v.stats.g.scores[1].brier).toBeLessThan(v.stats.g.scores[0].brier);
    expect(v).toMatchObject({ at: '2026-10-31T06:00:00Z', from: '2026-10-08', to: '2026-10-25', rows: 18 * 200 });
  });
  test('… and moves the board when the other read predicts better by the margin, from wherever the board is', () => {
    // The study's shots are the truth and the run's goals are: the defaults are wrong on both.
    const v = learnWeights(season({ truthS: 1, truthG: 0, seed: 11 }));
    expect(v.weights).toEqual({ w: 1, wG: 0 });
    expect(v.stats.sog.moved).toBe(true); expect(v.stats.g.moved).toBe(true);
    expect(v.stats.sog.reason).toMatch(/beats the board’s share/);
    // From a stored verdict that already had it right, nothing moves.
    const again = learnWeights(season({ truthS: 1, truthG: 0, seed: 11 }), { defaults: { w: 1, wG: 0 } });
    expect(again.weights).toEqual({ w: 1, wG: 0 });
    expect(again.stats.sog).toMatchObject({ moved: false, reason: 'the board’s share predicts best' });
  });
  test('a tie is called for the board’s own share', () => {
    expect(learnWeights(season({ noise: 0 }), { defaults: { w: 0.25, wG: 0.75 } }).stats).toMatchObject({ sog: { best: 0.25, share: 0.25, moved: false }, g: { best: 0.75, share: 0.75, moved: false } });
  });
  test('a tie keeps the board where it is; too few nights keep the defaults and say so', () => {
    // The study's read is the run's read: every share scores the same, the board stays.
    const same = season({ noise: 0 });
    const v = learnWeights(same, { defaults: { w: 0.5, wG: 0.25 } });
    expect(v.weights).toEqual({ w: 0.5, wG: 0.25 });
    expect(v.stats.sog.moved).toBe(false);
    const thin = learnWeights(season({ nights: 9, perNight: 100 }));
    expect(thin.weights).toEqual(DEFAULT_WEIGHTS);
    expect(thin.stats.sog.best).toBeNull();
    expect(thin.stats.sog.reason).toMatch(/too few graded nights/);
    expect(learnWeights([]).weights).toEqual(DEFAULT_WEIGHTS);
  });
  test('the board reads the env over the verdict, the verdict over the defaults', () => {
    const cal = { weights: { w: 0.5, wG: 0 }, learned: { stats: { sog: {}, g: {} } } };
    expect(boardWeightsOf(cal, {})).toEqual({ w: 0.5, wG: 0, from: { w: 'learned', wG: 'learned' } });
    expect(boardWeightsOf(cal, { NHL_PICKS_STUDY_WEIGHT: '0.25' })).toEqual({ w: 0.25, wG: 0, from: { w: 'env', wG: 'learned' } });
    expect(boardWeightsOf(cal, { NHL_PICKS_STUDY_WEIGHT_GOALS: '1' })).toEqual({ w: 0.5, wG: 1, from: { w: 'learned', wG: 'env' } });
    expect(boardWeightsOf(cal, { NHL_PICKS_STUDY_WEIGHT: '', NHL_PICKS_STUDY_WEIGHT_GOALS: 'x' })).toEqual({ w: 0.5, wG: 0, from: { w: 'learned', wG: 'learned' } });
    // A calibration without a verdict (the seed): the defaults.
    expect(boardWeightsOf({ weights: { w: 0, wG: 1 } }, {})).toEqual({ w: 0, wG: 1, from: { w: 'default', wG: 'default' } });
    expect(boardWeightsOf(null, {})).toEqual({ w: 0, wG: 1, from: { w: 'default', wG: 'default' } });
  });
  test('the words on the heads', () => {
    expect(shareText(0)).toBe('the run’s λ'); expect(shareText(1)).toBe('the study’s λ'); expect(shareText(0.25)).toBe('the run’s λ blended with the study’s at 25%');
    const v = learnWeights(season({ nights: 12, perNight: 150 }));
    expect(verdictText(v, 'sog')).toMatch(/^Shots, walked forward over 6 graded nights \(1800 chances at 3\+ and 4\+ SOG/);
    expect(verdictText(v, 'g')).toMatch(/study [0-9.]+ ◀/);
    expect(verdictText(null, 'sog')).toBeNull();
  });
});
