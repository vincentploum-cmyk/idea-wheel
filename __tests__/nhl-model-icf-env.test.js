import { execFileSync } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { matchupIcf, ICF_ENV_EXP, ICF_ENV_EXP_D, ICF_ENV_MAX_SHIFT, rwShotFilterContext, matchupIscf, goalGateSkaterOf, ISCF_ENV_EXP, ISCF_ENV_MAX_SHIFT, playerGoalFloorProfile, scorerTierInfo } from '../components/nhl/model-core';

// docs/audits/2026-11-27-nhl-icf-thresholds.md: a forward's season iCF moved by the opponent's iCF allowed to his
// position, for the gates that read his iCF (5.0 / 5.4 / 5.5 / 5.8 / 6.0 / 6.5).
const avg = { icf: 16 };
describe('the matchup moves the iCF the gates read (2026-11-27)', () => {
  test('the constants', () => {
    expect(ICF_ENV_EXP).toBe(0.73);
    expect(ICF_ENV_EXP_D).toBe(0.65);
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

  test('defensemen move too, at their own 0.65 (later the same day), held to the same half attempt', () => {
    expect(matchupIcf('D', 5, { icf: 16 * 1.1 }, avg)).toBeCloseTo(5 * Math.pow(1.1, 0.65), 3);
    expect(matchupIcf('D', 5, { icf: 16 * 0.9 }, avg)).toBeCloseTo(5 * Math.pow(0.9, 0.65), 3);
    expect(matchupIcf('D', 5, { icf: 16 * 1.1 }, avg)).toBeLessThan(matchupIcf('C', 5, { icf: 16 * 1.1 }, avg));
    expect(matchupIcf('D', 6.5, { icf: 16 * 1.4 }, avg)).toBe(7);
    expect(matchupIcf('D', 5, null, avg)).toBe(5);
  });

  test('a missing table or no iCF: his own figure', () => {
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

describe('the ports (groups 8 and 11 of tools/port-model-core.mjs)', () => {
  test('applied in order to the model before them, they give today\'s; group 8 still reads ported once group 11 revised it', () => {
    // The model before the changes, rebuilt from today's by undoing group 11, then group 8 (each edit is an exact text swap).
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'icfEnv20261127');
      const d = GROUPS.find((x) => x.key === 'icfEnvD20261127');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  matchupIcf,' + nl + '  ICF_ENV_EXP,' + nl + '  ICF_ENV_EXP_D,' + nl + '  ICF_ENV_MAX_SHIFT,' + nl, '');   // the site's own exports
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const undo = (t, grp) => grp.edits.reduce((x, e) => x.replace(e.new, e.old), t);
      const mid = undo(now, d);
      const before = undo(mid, g);
      const r = applyGroup(before, g);
      const r2 = applyGroup(r.text, d);
      console.log(JSON.stringify({ undone: mid !== now && before !== mid && !before.includes('matchupIcf') && !mid.includes('ICF_ENV_EXP_D'),
        status: r.status, mid: r.text === mid, again: applyGroup(r.text, g).status,
        status11: r2.status, same: r2.text === now, again11: applyGroup(r2.text, d).status, g8after11: applyGroup(r2.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', mid: true, again: 'ported', status11: 'applied', same: true, again11: 'ported', g8after11: 'ported' });
  });
});

// The same for goals: a forward's season iSCF moved by the opponent's iSCF allowed to his position, for the goal
// gates that test his own iSCF (docs/audits/2026-11-27-nhl-icf-thresholds.md, "Goals").
describe('the matchup moves the iSCF the goal gates read (2026-11-27)', () => {
  const iavg = { iscf: 8 };
  test('the constants', () => {
    expect(ISCF_ENV_EXP).toBe(0.74);
    expect(ISCF_ENV_MAX_SHIFT).toBe(0.25);
  });

  test('his iSCF times the ratio to the power 0.74, held to a quarter of a chance either way', () => {
    expect(matchupIscf('C', 2.4, { iscf: 8 * 1.1 }, iavg)).toBeCloseTo(2.4 * Math.pow(1.1, 0.74), 3);
    expect(matchupIscf('LW', 2.4, { iscf: 8 * 0.9 }, iavg)).toBeCloseTo(2.4 * Math.pow(0.9, 0.74), 3);
    expect(matchupIscf('RW', 3.5, { iscf: 8 * 1.3 }, iavg)).toBe(3.75);
    expect(matchupIscf('RW', 3.5, { iscf: 8 * 0.7 }, iavg)).toBe(3.25);
  });

  test('defensemen, a missing table or no iSCF: his own figure', () => {
    expect(matchupIscf('D', 1.2, { iscf: 8 * 1.2 }, iavg)).toBe(1.2);
    expect(matchupIscf('C', 2, null, iavg)).toBe(2);
    expect(matchupIscf('C', 2, { iscf: 0 }, iavg)).toBe(2);
    expect(matchupIscf('C', 0, { iscf: 9 }, iavg)).toBe(0);
  });

  test('the goal gates\' skater: season moved, last 5 by the same ratio, untouched when nothing moves', () => {
    const sk = { iscfSeason: 2, iscfL5: 3, goalsSeason: 0.3 };
    expect(goalGateSkaterOf(sk, 2)).toBe(sk);
    expect(goalGateSkaterOf(sk, 2.2)).toEqual({ iscfSeason: 2.2, iscfL5: 3.3, goalsSeason: 0.3 });
    expect(goalGateSkaterOf({ iscfSeason: 2 }, 2.2)).toEqual({ iscfSeason: 2.2, iscfL5: undefined });
    expect(goalGateSkaterOf({ iscfSeason: 0 }, 0)).toEqual({ iscfSeason: 0 });
  });

  test('a forward near the cut is a level up on the goal floor against a soft defense, not a tough one', () => {
    const sk = { goalsSeason: 0.3, goalsL5: 0.3, shotsSeason: 2.6, shotsL5: 2.6, iscfSeason: 2.3, iscfL5: 2.3, toiSeason: 18, toiL5: 18 };
    const level = (s) => playerGoalFloorProfile(s, 'C', 2, 18).score;
    const soft = goalGateSkaterOf(sk, matchupIscf('C', 2.3, { iscf: 8 * 1.12 }, iavg));
    const tough = goalGateSkaterOf(sk, matchupIscf('C', 2.3, { iscf: 8 * 0.88 }, iavg));
    expect(level(soft)).toBeGreaterThan(level(sk));
    expect(level(tough)).toBeLessThan(level(sk));
    expect(scorerTierInfo(soft, 2, 18, 'C').score).toBeGreaterThan(scorerTierInfo(sk, 2, 18, 'C').score);
  });
});

describe('the port (group 9 of tools/port-model-core.mjs)', () => {
  test('applied to the model before the change, it gives the change; applied again, it reports ported', () => {
    const script = `
      const { GROUPS, applyGroup } = await import('./tools/port-model-core.mjs');
      const { readFileSync } = await import('node:fs');
      const g = GROUPS.find((x) => x.key === 'iscfEnv20261127');
      const nl = String.fromCharCode(10);
      const strip = (t) => t.replace('  matchupIscf,' + nl + '  goalGateSkaterOf,' + nl + '  ISCF_ENV_EXP,' + nl + '  ISCF_ENV_MAX_SHIFT,' + nl, '');
      const now = strip(readFileSync('components/nhl/model-core.js', 'utf8'));
      const before = g.edits.reduce((x, e) => x.replace(e.new, e.old), now);
      const r = applyGroup(before, g);
      console.log(JSON.stringify({ undone: before !== now && !before.includes('matchupIscf') && before.includes('matchupIcf'),
        status: r.status, same: r.text === now, again: applyGroup(r.text, g).status }));`;
    const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
    expect(out).toEqual({ undone: true, status: 'applied', same: true, again: 'ported' });
  });
});
