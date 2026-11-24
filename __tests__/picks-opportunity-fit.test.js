import { fitOpportunity, calibrationOf, sameCalibration } from '../lib/picks/calibration';

// Graded predictor rows: the projection (`oppBase`), the opportunity ratio and the actual figure.
const nights = Array.from({ length: 10 }, (_, i) => `2026-11-${String(10 + i).padStart(2, '0')}`);
const rowsOf = (actualOf) => nights.map((key, n) => ({ key, pred: Array.from({ length: 60 }, (_, i) => { const r = 0.8 + ((i * 7 + n) % 9) * 0.05; return { market: 'ast', oppBase: 6, oppRatio: r, actual: actualOf(r, i) }; }) }));

describe('the opportunity weight', () => {
  test('learned where the read beats the projection on both halves of the nights', () => {
    const fit = fitOpportunity(rowsOf((r) => 6 * r));
    expect(fit.ast).toMatchObject({ w: 0.6, n: 600 });
    expect(fit.ast.mae).toBeLessThan(fit.ast.mae0);
    expect(fit.ast.halves.every(([a, b]) => b < a)).toBe(true);
  });
  test('none where the read says nothing, or on too few games', () => {
    expect(fitOpportunity(rowsOf(() => 6))).toEqual({});
    expect(fitOpportunity(rowsOf((r) => 6 * r).slice(0, 5))).toEqual({});
  });
  test('rides with the calibration, and a changed weight is a changed calibration', () => {
    const a = calibrationOf(rowsOf((r) => 6 * r).map((g) => ({ ...g, plays: [], rungs: [] })));
    expect(a.opportunity.ast.w).toBe(0.6);
    expect(sameCalibration(a, { ...a, opportunity: {} })).toBe(false);
    expect(sameCalibration(a, { ...a })).toBe(true);
  });
});
