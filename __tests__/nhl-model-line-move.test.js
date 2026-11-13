import { describe, expect, test } from '@jest/globals';
import { lineMoveMultiplier, usualLineFromToi, projectedToiFromLineup, TOI_MOVE_EXP } from '../components/nhl/model-core';

// docs/audits/2026-11-13-nhl-formula-refit.md: 7,044 skater-games of 2026-27 with the lines posted before puck drop.
describe('shots follow the posted line\'s minutes (2026-11-13)', () => {
  test('the exponent', () => { expect(TOI_MOVE_EXP).toBe(0.8); });

  test('his usual line is the one whose mean minutes are nearest his own, defensemen on their own scale', () => {
    expect(usualLineFromToi('C', 18.5)).toBe(1);
    expect(usualLineFromToi('LW', 16.2)).toBe(2);
    expect(usualLineFromToi('RW', 14)).toBe(3);
    expect(usualLineFromToi('C', 10)).toBe(4);
    expect(usualLineFromToi('D', 22.5)).toBe(1);
    expect(usualLineFromToi('D', 19.5)).toBe(2);   // the forwards' cuts read him as a first-liner
    expect(usualLineFromToi('D', 16)).toBe(3);
  });

  test('on his usual line, without a posted line or without minutes: nothing', () => {
    expect(lineMoveMultiplier('C', 3, 14, 14, 14)).toBe(1);
    expect(lineMoveMultiplier('C', null, 14, 14, 14)).toBe(1);
    expect(lineMoveMultiplier('C', undefined, 14, 14, 14)).toBe(1);
    expect(lineMoveMultiplier('C', 1, 0, 0, 0)).toBe(1);
  });

  test('moved up: the projected minutes\' ratio to the power 0.8', () => {
    const want = Math.pow(projectedToiFromLineup('LW', 1, 14, 14, 14) / projectedToiFromLineup('LW', 3, 14, 14, 14), 0.8);
    expect(lineMoveMultiplier('LW', 1, 14, 14, 14)).toBeCloseTo(want, 6);
    expect(lineMoveMultiplier('LW', 1, 14, 14, 14)).toBeGreaterThan(1.04);
    expect(lineMoveMultiplier('LW', 1, 14, 14, 14)).toBeLessThan(1.08);
    expect(lineMoveMultiplier('LW', 2, 14, 14, 14)).toBeGreaterThan(1.02);
    expect(lineMoveMultiplier('LW', 2, 14, 14, 14)).toBeLessThan(lineMoveMultiplier('LW', 1, 14, 14, 14));
  });

  test('moved down: it lowers him (the step it replaces only lifted)', () => {
    expect(lineMoveMultiplier('C', 3, 18.5, 18.5, 18.5)).toBeLessThan(0.97);
    expect(lineMoveMultiplier('C', 3, 18.5, 18.5, 18.5)).toBeGreaterThan(0.93);
    expect(lineMoveMultiplier('C', 2, 18.5, 18.5, 18.5)).toBeLessThan(1);
  });

  test('a promoted defenseman is read (the forwards\' minute cuts left him out)', () => {
    expect(lineMoveMultiplier('D', 1, 19.5, 19.5, 19.5)).toBeGreaterThan(1.02);
    expect(lineMoveMultiplier('D', 2, 19.5, 19.5, 19.5)).toBe(1);
    expect(lineMoveMultiplier('D', 3, 19.5, 19.5, 19.5)).toBeLessThan(0.97);
    expect(lineMoveMultiplier('D', 5, 16, 16, 16)).toBe(1);        // a pair past the third reads as the third
  });

  test('held inside 0.88 – 1.14', () => {
    expect(lineMoveMultiplier('C', 1, 8, 8, 8)).toBeLessThanOrEqual(1.14);
    expect(lineMoveMultiplier('C', 4, 21, 21, 21)).toBeGreaterThanOrEqual(0.88);
  });
});
