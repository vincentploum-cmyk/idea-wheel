import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { opponentShotMult, DEF_CUT_SHARE } from '../components/nhl/model-core';

// docs/audits/2026-11-27-nhl-team-shots.md: λ shots' opponent read (defMult) lifts by (raw − 1) × defDamp and, since
// 2026-11-27, cuts by (1 − raw) × defDamp × DEF_CUT_SHARE (it cut at 0.94 to 1.03 of the raw cut before).
describe('a tough opponent cuts λ shots a quarter as hard as a soft one lifts them (2026-11-27)', () => {
  test('the constant', () => { expect(DEF_CUT_SHARE).toBe(0.25); });

  test('the lift is unchanged: (raw − 1) × defDamp', () => {
    expect(opponentShotMult(1.3, 1.0)).toBeCloseTo(1.3, 6);
    expect(opponentShotMult(1.3, 0.48)).toBeCloseTo(1 + 0.3 * 0.48, 6);
    expect(opponentShotMult(1, 0.64)).toBe(1);
  });

  test('the cut is (1 − raw) × defDamp × 0.25: a depth skater against the toughest defense loses 5%, not 31%', () => {
    expect(opponentShotMult(0.7, 1.0)).toBeCloseTo(1 - 0.3 * 0.25, 6);
    expect(opponentShotMult(0.7, 0.48)).toBeCloseTo(1 - 0.3 * 0.48 * 0.25, 6);
    // the cut as it was
    expect(1 - 0.3 * Math.max(0.9, 1.12 - 0.18 * 0.48)).toBeCloseTo(0.69, 2);
  });
});

describe('the port (group 10 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported', () => {
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'defCut20261127');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  opponentShotMult,' + nl + '  DEF_CUT_SHARE,' + nl, '');   // the site's own exports
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const before = g.edits.reduce((x, e) => x.replace(e.new, e.old), now);
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ undone: before !== now && !before.includes('opponentShotMult'), status: r.status,
        same: r.text === now, again: applyGroup(r.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', same: true, again: 'ported' });
  });
});
