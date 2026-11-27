import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { matchupIcf, ICF_ENV_EXP, ICF_ENV_MAX_SHIFT, rwShotFilterContext } from '../components/nhl/model-core';

// docs/audits/2026-11-27-nhl-icf-thresholds.md: a forward's season iCF moved by the opponent's iCF allowed to his
// position, for the gates that read his iCF (5.0 / 5.4 / 5.5 / 5.8 / 6.0 / 6.5).
const avg = { icf: 16 };
describe('the matchup moves the iCF the gates read (2026-11-27)', () => {
  test('the constants', () => {
    expect(ICF_ENV_EXP).toBe(0.73);
    expect(ICF_ENV_MAX_SHIFT).toBe(0.5);
  });

  test('a soft defense lifts him, a tough one lowers him, by his iCF times the ratio to the power 0.73', () => {
    expect(matchupIcf('C', 5.5, { icf: 16 * 1.08 }, avg)).toBeCloseTo(5.5 * Math.pow(1.08, 0.73), 3);
    expect(matchupIcf('LW', 5.5, { icf: 16 * 0.92 }, avg)).toBeCloseTo(5.5 * Math.pow(0.92, 0.73), 3);
    expect(matchupIcf('RW', 5.5, { icf: 16 }, avg)).toBe(5.5);
  });

  test('the shift is held to half an attempt either way', () => {
    expect(matchupIcf('C', 6.5, { icf: 16 * 1.3 }, avg)).toBe(7);
    expect(matchupIcf('C', 6.5, { icf: 16 * 0.7 }, avg)).toBe(6);
  });

  test('defensemen, a missing table or no iCF: his own figure', () => {
    expect(matchupIcf('D', 5.5, { icf: 16 * 1.2 }, avg)).toBe(5.5);
    expect(matchupIcf('C', 5.5, null, avg)).toBe(5.5);
    expect(matchupIcf('C', 5.5, { icf: 0 }, avg)).toBe(5.5);
    expect(matchupIcf('C', 5.5, { icf: 18 }, null)).toBe(5.5);
    expect(matchupIcf('C', 0, { icf: 18 }, avg)).toBe(0);
    expect(matchupIcf('C', undefined, { icf: 18 }, avg)).toBe(0);
  });

  test('a 6.2 iCF right winger clears the 6.5 elite-volume gate against a soft defense and not a tough one', () => {
    const skater = { shotsSeason: 3.4, iffSeason: 5, icfSeason: 6.2, iscfSeason: 2.7, goalsSeason: 0.3 };
    const ctx = (icf) => rwShotFilterContext({ skater: { ...skater, icfSeason: icf }, effectiveToi: 19.5, todayLine: 1, lineShare: 0.4 });
    expect(ctx(6.2).eliteVolume).toBe(false);
    expect(ctx(matchupIcf('RW', 6.2, { icf: 16 * 1.1 }, avg)).eliteVolume).toBe(true);
    expect(ctx(matchupIcf('RW', 6.2, { icf: 16 * 0.9 }, avg)).eliteVolume).toBe(false);
  });
});

describe('the port (group 8 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported', () => {
    // The model before the change, rebuilt from today's by undoing the group (each edit is an exact text swap).
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'icfEnv20261127');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  matchupIcf,' + nl + '  ICF_ENV_EXP,' + nl + '  ICF_ENV_MAX_SHIFT,' + nl, '');   // the site's own exports
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const before = g.edits.reduce((x, e) => x.replace(e.new, e.old), now);
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ undone: before !== now && !before.includes('matchupIcf'), status: r.status,
        same: r.text === now, again: applyGroup(r.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', same: true, again: 'ported' });
  });
});
