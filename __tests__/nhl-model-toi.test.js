import { describe, expect, test } from '@jest/globals';
import { projectedToiFromLineup, TOI_FIT } from '../components/nhl/model-core';

// docs/audits/2026-11-07-nhl-toi.md: refitted on 8,501 skater-games of 2026-27 with the lines posted before puck drop.
describe('projected minutes: the line\'s constant + 0.345 · last 5 + 0.442 · season (2026-11-07)', () => {
  test('the fit', () => {
    expect(TOI_FIT.l5).toBe(0.345);
    expect(TOI_FIT.season).toBe(0.442);
    expect(TOI_FIT.line).toEqual({ F1: 4.05, F2: 3.6, F3: 3.07, F4: 2.16, D1: 5.04, D2: 4.26, D3: 2.98 });
  });

  test('a first-liner at the line\'s minutes reads about them', () => {
    expect(projectedToiFromLineup('C', 1, 18.2, 18.2, 18.2)).toBeCloseTo(4.05 + 0.787 * 18.2, 2);
    expect(projectedToiFromLineup('D', 1, 22, 22, 22)).toBeCloseTo(5.04 + 0.787 * 22, 2);
  });

  test('the line moves him both ways (the old floor only lifted)', () => {
    const up = projectedToiFromLineup('LW', 1, 14, 14, 14);
    const stay = projectedToiFromLineup('LW', 3, 14, 14, 14);
    const down = projectedToiFromLineup('LW', 4, 14, 14, 14);
    expect(up).toBeGreaterThan(stay);
    expect(down).toBeLessThan(stay);
    expect(down).toBeLessThan(14);            // a demoted skater reads under his own minutes
    expect(up).toBeLessThan(18.5);            // the old rule put him at the floor
  });

  test('last 5 and season weigh apart; three arguments read the one figure for both', () => {
    expect(projectedToiFromLineup('RW', 2, 17, 17, 15)).toBeCloseTo(3.6 + 0.345 * 17 + 0.442 * 15, 2);
    expect(projectedToiFromLineup('RW', 2, 16)).toBeCloseTo(3.6 + 0.787 * 16, 2);
    expect(projectedToiFromLineup('RW', 2, 16, 0, 15)).toBeCloseTo(3.6 + 0.345 * 16 + 0.442 * 15, 2); // no last 5: the figure passed
  });

  test('no minutes on record: the line\'s mean; lines past the last read as the last', () => {
    expect(projectedToiFromLineup('C', 2, 0)).toBe(TOI_FIT.mean.F2);
    expect(projectedToiFromLineup('D', 3, 0)).toBe(TOI_FIT.mean.D3);
    expect(projectedToiFromLineup('D', 4, 0)).toBe(TOI_FIT.mean.D3);
    expect(projectedToiFromLineup('C', 6, 0)).toBe(TOI_FIT.mean.F4);
    expect(projectedToiFromLineup('C', null, 0)).toBe(TOI_FIT.mean.F4);
  });
});
