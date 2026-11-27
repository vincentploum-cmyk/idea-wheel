import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { shotSpreadLambda, SHOT_SPREAD_A, SHOT_SPREAD_B, opponentShotMult } from '../components/nhl/model-core';
import { lambdaSNow, fitRow } from '../lib/nhl-data/calibration';

// docs/audits/2026-11-27-nhl-shot-spread.md: the published λ shots = 1.30 · λ^0.611 (the shot ladder reads the λ before it).
describe('the published λ shots pulled toward the middle (2026-11-27)', () => {
  test('the constants', () => { expect(SHOT_SPREAD_A).toBe(1.3); expect(SHOT_SPREAD_B).toBe(0.611); });

  test('low reads go up, high reads come down, about 1.96 stays', () => {
    expect(shotSpreadLambda(0.36)).toBeCloseTo(1.3 * Math.pow(0.36, 0.611), 6);
    expect(shotSpreadLambda(0.36)).toBeGreaterThan(0.69);
    expect(shotSpreadLambda(4.2)).toBeCloseTo(3.12, 2);
    expect(shotSpreadLambda(1.96)).toBeCloseTo(1.96, 1);
    expect(shotSpreadLambda(0)).toBe(0);
    expect(shotSpreadLambda(2.5)).toBeLessThan(shotSpreadLambda(2.6)); // the order is kept
  });
});

describe('the calibration reads a run saved before the change as the model makes it now', () => {
  test('a new run (lambdaSRaw on the row) is read as it is', () => {
    expect(lambdaSNow({ lambdaS: 2.4, lambdaSRaw: 2.9, defMult: 0.8, shotLevel: 'weak' }, '2026-11-20')).toBe(2.4);
  });
  test('an old run: the spread, and before 11-27 the softer cut from its defMult and tier', () => {
    expect(lambdaSNow({ lambdaS: 3, defMult: 1.1, shotLevel: 'good' }, '2026-11-20')).toBeCloseTo(shotSpreadLambda(3), 3);
    // a weak-tier skater cut to 0.69 by the old cut (raw 0.7): the new cut is 1 − 0.3 × 0.48 × 0.25
    const d = 1 - 0.3 * Math.max(0.9, 1.12 - 0.18 * 0.48);
    const lam = 0.6;
    expect(lambdaSNow({ lambdaS: lam, defMult: d, shotLevel: 'weak' }, '2026-11-20')).toBeCloseTo(shotSpreadLambda(lam * opponentShotMult(0.7, 0.48) / d), 3);
    // on the slate of the change the cut is already the new one
    expect(lambdaSNow({ lambdaS: lam, defMult: d, shotLevel: 'weak' }, '2026-11-27')).toBeCloseTo(shotSpreadLambda(lam), 3);
    expect(lambdaSNow({ lambdaS: null }, '2026-11-20')).toBeNull();
  });
  test('fitRow uses it', () => {
    expect(fitRow({ date: '2026-11-20', m: { lambdaS: 3, lambdaG: 0.3, defMult: 1, shotLevel: 'elite' }, actual: { sog: 2, g: 0 } }).lamS).toBeCloseTo(shotSpreadLambda(3), 3);
  });
});

describe('the port (group 12 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported', () => {
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'shotSpread20261127');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  shotSpreadLambda,' + nl + '  SHOT_SPREAD_A,' + nl + '  SHOT_SPREAD_B,' + nl, '');   // the site's own exports
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const before = [...g.edits].reverse().reduce((x, e) => x.replace(e.new, e.old), now);
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ undone: before !== now && !before.includes('shotSpreadLambda'), status: r.status,
        same: r.text === now, again: applyGroup(r.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', same: true, again: 'ported' });
  });
});
