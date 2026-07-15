import { describe, test, expect } from '@jest/globals';
import { SCORE_POLICY, hasPotential, meetsCatalog, isPremium } from '../lib/score-policy.js';

// The audit's exact boundary matrix: 59 out, 60 in, 61 in, null/NaN never in.
describe('hasPotential — visibility boundary (>= 60)', () => {
  test('59 is not visible', () => { expect(hasPotential(59)).toBe(false); });
  test('60 is visible (inclusive)', () => { expect(hasPotential(60)).toBe(true); });
  test('61 is visible', () => { expect(hasPotential(61)).toBe(true); });
  test('null is never visible', () => { expect(hasPotential(null)).toBe(false); });
  test('undefined is never visible', () => { expect(hasPotential(undefined)).toBe(false); });
  test('NaN is never visible', () => { expect(hasPotential(NaN)).toBe(false); });
  test('non-numeric string is never visible', () => { expect(hasPotential('high')).toBe(false); });
});

describe('catalog and premium thresholds', () => {
  test('74 does not meet catalog, 75 does', () => {
    expect(meetsCatalog(74)).toBe(false);
    expect(meetsCatalog(75)).toBe(true);
  });
  test('79 is not premium, 80 is', () => {
    expect(isPremium(79)).toBe(false);
    expect(isPremium(80)).toBe(true);
  });
  test('thresholds are ordered visible < catalog < premium', () => {
    expect(SCORE_POLICY.visibleMin).toBeLessThan(SCORE_POLICY.catalogMin);
    expect(SCORE_POLICY.catalogMin).toBeLessThan(SCORE_POLICY.premiumMin);
  });
});
