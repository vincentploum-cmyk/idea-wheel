import { describe, test, expect } from '@jest/globals';
import { SCORE_POLICY, hasPotential, meetsCatalog, isPremium, isBlueprintEligible } from '../lib/score-policy.js';

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

// The audit's exact blueprint-eligibility matrix. This is the single predicate
// the client CTA and the server build gate both use.
describe('isBlueprintEligible — the blueprint gate', () => {
  test.each([
    [59, false],
    [60, true],
    [61, true],
    [80, true],
    [null, false],
    [undefined, false],
    [NaN, false],
    ['70', true],   // numeric string coerces
    ['high', false],
  ])('score %p → eligible %p', (score, expected) => {
    expect(isBlueprintEligible(score)).toBe(expected);
  });

  test('the blueprint gate equals the visibility gate', () => {
    for (const s of [0, 40, 59, 60, 61, 75, 80, 100]) {
      expect(isBlueprintEligible(s)).toBe(hasPotential(s));
    }
  });
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
