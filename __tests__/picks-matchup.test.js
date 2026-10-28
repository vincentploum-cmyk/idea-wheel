import { describe, expect, test } from '@jest/globals';
import { envFactor, sheetFactor, matchupOf, SHEET_SPREAD, ENV_WEIGHT } from '../lib/picks/projection';

describe('the matchup: the cheat sheet first, PropFinder next, blended', () => {
  test('the sheet’s tile on the standard spread', () => {
    expect(SHEET_SPREAD).toBe(0.3);
    expect(sheetFactor(1, 30)).toBeCloseTo(1 + ENV_WEIGHT * 0.15, 3);   // the most permissive: × 1.09
    expect(sheetFactor(30, 30)).toBeCloseTo(1 - ENV_WEIGHT * 0.15, 3);  // the stingiest: × 0.91
    expect(sheetFactor(15.5, 30)).toBe(1);
    expect(sheetFactor(null, 30)).toBeNull();
    expect(sheetFactor(3, 1)).toBeNull();
  });
  test('both reads blend half and half; one alone stands; the tile on PropFinder’s spread when it has a value there', () => {
    expect(matchupOf({ value: 24, rank: 1 }, 22)).toEqual({ factor: 1.055, pf: 1.055, sheet: null, from: 'propfinder' });
    expect(matchupOf({ rank: 3, sheet: 3 }, null)).toEqual({ factor: 1.078, pf: null, sheet: 1.078, from: 'sheet' });
    expect(matchupOf({ value: 24, rank: 1, sheet: 30, sheetValue: 20 }, 22)).toEqual({ factor: 1, pf: 1.055, sheet: 0.945, from: 'blend' });
    // Without a value for the tile's rank, the standard spread stands in beside PropFinder's value.
    expect(matchupOf({ value: 24, rank: 1, sheet: 1 }, 22, 30)).toEqual({ factor: 1.073, pf: 1.055, sheet: 1.09, from: 'blend' });
    expect(matchupOf(null, 22)).toEqual({ factor: null, pf: null, sheet: null, from: null });
    expect(matchupOf({ value: null, rank: null }, 22)).toEqual({ factor: null, pf: null, sheet: null, from: null });
    expect(envFactor(24, 22)).toBe(1.055);
  });
});
