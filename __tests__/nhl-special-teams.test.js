import { describe, expect, test } from '@jest/globals';
import { ST, PP_WEIGHTS, ppWeight, ratioOf, specialTeamsRead, splitSpecialTeams, withSpecialTeams } from '../lib/nhl-data/special-teams';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';
import { shotpropz } from './fixtures/matchup-profile-mtl-dal';

// A snapshot with a full league on the all-games boards (the fixture carries two teams; the league means need the rest).
const spz = JSON.parse(JSON.stringify(shotpropz));
for (const [board, stats] of [['offense', { ppo: 3.2, ppPct: 21, gf: 3.1, sf: 28 }], ['defense', { ppoa: 3.2, pkPct: 79, ga: 3.1, sa: 28 }]]) {
  for (const [k, v] of Object.entries(stats)) {
    const t = spz.boards[board].all.ytd[k].teams;
    for (let i = 0; i < 30; i++) t[`T${i}`] = { gp: 13, value: v, rank: 10 };
    spz.boards[board].all.ytd[k].count = 32;
  }
}
// MTL draws 3.31 and gives 3.15 a game at 75.6% on the kill; DAL draws 2.75, gives 2.5, kills 86.7%.

describe('special teams: the read', () => {
  test('power-play weights by slot: the first line and pair carry the units, the fourth line kills', () => {
    expect(ppWeight('C', 1)).toBe(PP_WEIGHTS.F[1]); expect(ppWeight('LW', 4)).toBe(PP_WEIGHTS.F[4]); expect(ppWeight('D', 1)).toBe(PP_WEIGHTS.D[1]); expect(ppWeight('D', 3)).toBe(PP_WEIGHTS.D[3]);
    expect(ppWeight('RW', null)).toBe(PP_WEIGHTS.F.null); expect(ppWeight('D', 7)).toBe(PP_WEIGHTS.D[3]); expect(ppWeight('C', 0)).toBe(PP_WEIGHTS.F[1]);
    expect(ppWeight('C', 1)).toBeGreaterThan(ppWeight('C', 2)); expect(ppWeight('C', 2)).toBeGreaterThan(ppWeight('C', 3)); expect(ppWeight('C', 3)).toBeGreaterThan(ppWeight('C', 4));
  });
  test('a team’s rate as a ratio to the league, shrunk toward 1 at gp / (gp + K)', () => {
    const r = ratioOf(spz, 'offense', 'ppo', 'MTL');
    const league = (3.31 + 2.75 + 30 * 3.2) / 32;
    expect(r.league).toBeCloseTo(league, 3);
    expect(r.raw).toBeCloseTo(3.31 / league, 3);
    expect(r.w).toBeCloseTo(13 / (13 + ST.K), 3);
    expect(r.ratio).toBeCloseTo(r.w * r.raw + (1 - r.w), 3);
    expect(r.ratio).toBeGreaterThan(1); expect(r.ratio).toBeLessThan(r.raw);
    expect(ratioOf(spz, 'offense', 'ppo', 'XXX')).toBeNull();
    expect(ratioOf(null, 'offense', 'ppo', 'MTL')).toBeNull();
  });
  test('MTL at DAL: a disciplined opponent means fewer power plays than MTL draws; the two reads of one matchup agree; the total is left alone', () => {
    const mtl = specialTeamsRead(spz, 'MTL', 'DAL');
    const dal = specialTeamsRead(spz, 'DAL', 'MTL');
    const L = mtl.ppFor.league;
    // MTL draws over the league, DAL gives under it: the expected count sits between the two reads, under MTL's own.
    expect(mtl.ppFor.expected).toBeLessThan(mtl.ppFor.usual);
    expect(mtl.ppFor.expected).toBeGreaterThan(L * 0.8);
    expect(mtl.ppFor.expected).toBeCloseTo(L * Math.pow(mtl.ppFor.own.ratio, ST.elasticity.drawn) * Math.pow(mtl.ppFor.oppGives.ratio, ST.elasticity.opponentGives), 2);
    expect(mtl.ppFor.delta).toBeCloseTo(mtl.ppFor.expected - mtl.ppFor.usual, 2);
    // MTL's kills tonight are DAL's power plays.
    expect(mtl.ppAgainst.expected).toBeCloseTo(dal.ppFor.expected, 1);
    expect(dal.ppAgainst.expected).toBeCloseTo(mtl.ppFor.expected, 1);
    // The opponent's kill: DAL kills 86.7% against the league's ~79%, leaking less than the league.
    expect(mtl.kill.pk).toBe(86.7); expect(mtl.kill.leak).toBeLessThan(1); expect(mtl.kill.w).toBeCloseTo(mtl.kill.kills / (mtl.kill.kills + ST.K_KILL), 3);
    expect(dal.kill.pk).toBe(75.6); expect(dal.kill.leak).toBeGreaterThan(1);
    // The usual is the same forecast against an average opponent, so the difference is the opponent's part alone.
    expect(mtl.ppFor.usual).toBeCloseTo(L * Math.pow(mtl.ppFor.own.ratio, ST.elasticity.drawn), 2);
    // The mechanics: a disciplined, well-killing opponent costs MTL power-play shots; middling MTL barely moves DAL's. The total is left alone (teamWeight 0, measured).
    expect(mtl.shift.shots).toBeLessThan(0); expect(Math.abs(dal.shift.shots)).toBeLessThan(0.1);
    expect(mtl.shift.shots).toBeCloseTo(mtl.ppFor.delta * ST.worth.shotsPerPP + mtl.ppAgainst.delta * ST.worth.shotsPerPK, 1);
    expect(mtl.shift.goals).toBeCloseTo(mtl.ppFor.delta * ST.conv * mtl.kill.leak, 1);
    expect(mtl.mechanical.shots).toBeLessThan(1);
    expect(Math.abs(mtl.mechanical.shots - 1)).toBeLessThan(0.05);
    expect(ST.teamWeight).toBe(0);
    expect(mtl.factor).toEqual({ shots: 1, goals: 1 }); expect(dal.factor).toEqual({ shots: 1, goals: 1 });
    expect(mtl.text).toContain('Power plays tonight: MTL should get about');
    expect(mtl.text).toContain("DAL's penalty kill: 86.7%");
    expect(mtl.text).toContain('the side\'s total untouched');
    expect(specialTeamsRead(null, 'MTL', 'DAL')).toBeNull();
    expect(specialTeamsRead({ boards: { offense: { all: { ytd: {} } }, defense: { all: { ytd: {} } } } }, 'MTL', 'DAL')).toBeNull();
  });
  test('the shift is moved to the power-play units and taken off everyone evenly: the side’s sum does not change; a team factor adds on top by weight', () => {
    const skaters = [
      { id: 1, pos: 'C', line: 1, lamS: 3.0, lamG: 0.4 }, { id: 2, pos: 'LW', line: 1, lamS: 2.5, lamG: 0.3 }, { id: 3, pos: 'RW', line: 2, lamS: 2.0, lamG: 0.25 },
      { id: 4, pos: 'C', line: 4, lamS: 1.0, lamG: 0.08 }, { id: 5, pos: 'D', line: 1, lamS: 2.2, lamG: 0.1 }, { id: 6, pos: 'D', line: 3, lamS: 0.8, lamG: 0.03 },
    ];
    const sumW = PP_WEIGHTS.F[1] * 2 + PP_WEIGHTS.F[2] + PP_WEIGHTS.F[4] + PP_WEIGHTS.D[1] + PP_WEIGHTS.D[3];
    // A redistribution alone: +0.6 shots and +0.12 goals to the units.
    const split = splitSpecialTeams(skaters, { factor: { shots: 1, goals: 1 }, shift: { shots: 0.6, goals: 0.12 } });
    const dS = [...split.values()].reduce((t, d) => t + d.dS, 0); const dG = [...split.values()].reduce((t, d) => t + d.dG, 0);
    expect(dS).toBeCloseTo(0, 2); expect(dG).toBeCloseTo(0, 2);
    expect(split.get(1).dS).toBeCloseTo(0.6 * (PP_WEIGHTS.F[1] / sumW - 1 / 6), 3);
    expect(split.get(1).dS).toBeGreaterThan(0); expect(split.get(4).dS).toBeLessThan(0); expect(split.get(6).dS).toBeLessThan(0);
    expect(split.get(5).w).toBe(PP_WEIGHTS.D[1]);
    expect([...split.values()].reduce((t, d) => t + d.share, 0)).toBeCloseTo(1, 2);
    // More kills than usual shift the other way: the units lose, the fourth line gains.
    const kills = splitSpecialTeams(skaters, { factor: { shots: 1, goals: 1 }, shift: { shots: -0.4, goals: 0 } });
    expect(kills.get(1).dS).toBeLessThan(0); expect(kills.get(4).dS).toBeGreaterThan(0); expect(kills.get(1).dG).toBe(0);
    // A team factor (teamWeight 1 would give one) adds Σ λ × (factor − 1) by weight on top.
    const withTeam = splitSpecialTeams(skaters, { factor: { shots: 1.04, goals: 1.06 }, shift: { shots: 0, goals: 0 } });
    const totS = skaters.reduce((t, s) => t + s.lamS, 0); const totG = skaters.reduce((t, s) => t + s.lamG, 0);
    expect([...withTeam.values()].reduce((t, d) => t + d.dS, 0)).toBeCloseTo(totS * 0.04, 2);
    expect([...withTeam.values()].reduce((t, d) => t + d.dG, 0)).toBeCloseTo(totG * 0.06, 2);
    expect(withTeam.get(1).share / withTeam.get(4).share).toBeCloseTo(PP_WEIGHTS.F[1] / PP_WEIGHTS.F[4], 0);
    expect(splitSpecialTeams(skaters, null).size).toBe(0);
    expect(splitSpecialTeams([], { factor: { shots: 1, goals: 1 }, shift: { shots: 1, goals: 0 } }).size).toBe(0);
  });
  test('withSpecialTeams moves λ and the tails, keeps the figures before it; nothing without a change', () => {
    const proj = { lamS: 3.0, lamG: 0.4, p2: 0.8, p3: 0.58, p4: 0.35, p1g: 0.33 };
    const out = withSpecialTeams(proj, { dS: 0.2, dG: 0.03, w: 1, share: 0.2 }, poissonAtLeast);
    expect(out.lamS).toBe(3.2); expect(out.lamG).toBe(0.43);
    expect(out.p3).toBeCloseTo(poissonAtLeast(3.2, 3), 2); expect(out.p1g).toBeCloseTo(1 - Math.exp(-0.43), 2);
    expect(out.beforeSt).toEqual({ lamS: 3.0, lamG: 0.4, p3: 0.58, p4: 0.35, p1g: 0.33 });
    expect(out.st).toEqual({ dS: 0.2, dG: 0.03, w: 1, share: 0.2 });
    expect(withSpecialTeams(proj, { dS: 0, dG: 0 }, poissonAtLeast)).toBe(proj);
    expect(withSpecialTeams(proj, undefined, poissonAtLeast)).toBe(proj);
    expect(withSpecialTeams(null, { dS: 1, dG: 0 }, poissonAtLeast)).toBeNull();
    // A cut never takes λ under the floor.
    expect(withSpecialTeams({ lamS: 0.1, lamG: 0.02 }, { dS: -1, dG: -1 }, poissonAtLeast)).toMatchObject({ lamS: 0.05, lamG: 0.01 });
  });
});
