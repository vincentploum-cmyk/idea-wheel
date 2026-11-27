/**
 * The points environment reads the opponent's scoring chances allowed, not its assists allowed (2026-11-27,
 * docs/audits/2026-11-27-nhl-icf-thresholds.md, "Points"): the cheat sheet's points multiplier is a smooth ISCF/G rank
 * term (forwards; defensemen 1) in place of the Assists/G steps, and λ points' 0.35 reads the iSCF ratio. The port to
 * App.jsx is group 10 of tools/port-model-core.mjs.
 */
import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { iscfPointMultiplier, ISCF_POINT_PER_SD, cheatSheetMajorMultiplier } from '../components/nhl/model-core';

const ranks = (r) => ({ ranks: { goals: null, assists: null, shots: null, icf: null, iff: null, iscf: null, ...r } });

describe('the smooth ISCF points term', () => {
  test('the constant', () => { expect(ISCF_POINT_PER_SD).toBe(0.069); });

  test('about +12% at rank 1, 1 in the middle, about -11% at rank 32, 1 without a rank; defensemen 1', () => {
    expect(iscfPointMultiplier(1, 'C')).toBeCloseTo(1.123, 2);
    expect(iscfPointMultiplier(16.5, 'LW')).toBe(1);
    expect(iscfPointMultiplier(32, 'RW')).toBeCloseTo(0.89, 2);
    expect(iscfPointMultiplier(null, 'C')).toBe(1);
    expect(iscfPointMultiplier(0, 'C')).toBe(1);
    expect(iscfPointMultiplier(1, 'D')).toBe(1);
    expect(iscfPointMultiplier(5, 'C')).toBeGreaterThan(iscfPointMultiplier(10, 'C'));
  });

  test('the points multiplier reads ISCF only: the Assists/G and Shots/G ranks no longer move it', () => {
    const a = cheatSheetMajorMultiplier(ranks({ assists: 1, shots: 1, icf: 1, iff: 1, iscf: 20 }), 'points', 'C');
    const b = cheatSheetMajorMultiplier(ranks({ assists: 32, shots: 32, icf: 32, iff: 32, iscf: 20 }), 'points', 'C');
    expect(a).toBe(b);
    expect(a).toBeCloseTo(iscfPointMultiplier(20, 'C'), 6);
    expect(cheatSheetMajorMultiplier(ranks({ assists: 5 }), 'points', 'C')).toBe(1);   // was 1.16
    expect(cheatSheetMajorMultiplier(ranks({ iscf: 1, assists: 1 }), 'points', 'D')).toBe(1);
  });

  test('goals and shots are untouched', () => {
    expect(cheatSheetMajorMultiplier(ranks({ shots: 5, iff: 5, iscf: 5, icf: 5 }), 'shots', 'C')).toBe(1.3);
    expect(cheatSheetMajorMultiplier(ranks({ iscf: 1 }), 'goals', 'C')).toBeCloseTo(1.07, 2);
  });
});

describe('the port (group 10 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported; group 5 still reads ported', () => {
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'pointsEnv20261127');
      const g5 = GROUPS.find((x) => x.key === 'goalsEnv20261112');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  iscfPointMultiplier,' + nl + '  ISCF_POINT_PER_SD,' + nl, '');
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const before = g.edits.reduce((x, e) => x.replace(e.new, e.old), now);
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ undone: before !== now && !before.includes('iscfPointMultiplier') && before.includes('open(assistRank, 10)'),
        status: r.status, same: r.text === now, again: applyGroup(r.text, g).status, g5: applyGroup(r.text, g5).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', same: true, again: 'ported', g5: 'ported' });
  });
});
