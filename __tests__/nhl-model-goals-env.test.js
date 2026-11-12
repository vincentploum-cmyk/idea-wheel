/**
 * The cheat sheet's goals multiplier is a smooth ISCF/G term (2026-11-12, docs/audits/2026-11-12-nhl-shots-environment.md):
 * the Goals/G rank steps predicted nothing over a skater's rate; ISCF carried the read. The port to App.jsx is group 5 of
 * tools/port-model-core.mjs, which made this very edit to model-core.js.
 */
import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { iscfGoalMultiplier, cheatSheetMajorMultiplier } from '../components/nhl/model-core';

const ranks = (r) => ({ ranks: { goals: null, assists: null, shots: null, icf: null, iff: null, iscf: null, ...r } });

describe('the smooth ISCF goals term', () => {
  test('about +7% at rank 1, 1 in the middle, about -6.5% at rank 32, 1 without a rank', () => {
    expect(iscfGoalMultiplier(1)).toBeCloseTo(1.07, 2);
    expect(iscfGoalMultiplier(16.5)).toBe(1);
    expect(iscfGoalMultiplier(32)).toBeCloseTo(0.935, 2);
    expect(iscfGoalMultiplier(null)).toBe(1);
    expect(iscfGoalMultiplier(0)).toBe(1);
    expect(iscfGoalMultiplier(5)).toBeGreaterThan(iscfGoalMultiplier(10));
  });
  test('the goals multiplier reads ISCF only: the Goals/G rank no longer moves it', () => {
    const a = cheatSheetMajorMultiplier(ranks({ goals: 1, iscf: 20, shots: 1 }), 'goals', 'C');
    const b = cheatSheetMajorMultiplier(ranks({ goals: 32, iscf: 20, shots: 32 }), 'goals', 'C');
    expect(a).toBe(b);
    expect(a).toBeCloseTo(iscfGoalMultiplier(20), 6);
    expect(cheatSheetMajorMultiplier(ranks({ goals: 1 }), 'goals', 'C')).toBe(1);   // was 1.18 + 0.07
    expect(cheatSheetMajorMultiplier(ranks({ iscf: 1 }), 'goals', 'D')).toBeCloseTo(iscfGoalMultiplier(1) * 0.88, 6);
  });
  test('shots and points are unchanged', () => {
    expect(cheatSheetMajorMultiplier(ranks({ shots: 5, iff: 5, iscf: 5, icf: 5 }), 'shots', 'C')).toBe(1.3);   // 1 + 0.18 + 0.12 + 0.10 + 0.08, capped at 1.30
    expect(cheatSheetMajorMultiplier(ranks({ assists: 5 }), 'points', 'C')).toBeCloseTo(1.16, 6);
  });
});

describe('the port (group 5 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported', () => {
    const script = `
      import { execFileSync } from 'node:child_process';
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const g = GROUPS.find((x) => x.key === 'goalsEnv20261112');
      const before = execFileSync('git', ['show', '4c94fb9:components/nhl/model-core.js'], { encoding: 'utf8', maxBuffer: 1 << 26 });
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ status: r.status, iscf: r.text.includes('mult = iscfGoalMultiplier(iscfRank);'), steps: r.text.includes('if (open(goalRank, 10)) mult += 0.18;'), again: applyGroup(r.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ status: 'applied', iscf: true, steps: false, again: 'ported' });
  });
});
