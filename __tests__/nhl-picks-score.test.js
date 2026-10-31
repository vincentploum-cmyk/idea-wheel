import { describe, expect, test } from '@jest/globals';
import { computePicks } from '../lib/nhl-data/picks';
import { rowObj, ROW_FIELDS } from '../lib/nhl-data/ingest';
import { shotpropz } from './fixtures/matchup-profile-mtl-dal';

// A snapshot with a full league on the all-games boards (the fixture carries MTL and DAL; the league means need the rest).
const spz = JSON.parse(JSON.stringify(shotpropz));
for (const [board, stats] of [['offense', { ppo: 3.2, ppPct: 21, gf: 3.1, sf: 28 }], ['defense', { ppoa: 3.2, pkPct: 79, ga: 3.1, sa: 28 }]]) {
  for (const [k, v] of Object.entries(stats)) {
    const t = spz.boards[board].all.ytd[k].teams;
    for (let i = 0; i < 30; i++) t[`T${i}`] = { gp: 13, value: v, rank: 10 };
    spz.boards[board].all.ytd[k].count = 32;
  }
}

const DATE = '2026-10-31';
const row = (over) => rowObj(ROW_FIELDS.map((k) => ({ date: '2026-10-20', gameId: 2026020100, playerId: 1, name: 'A', team: 'MTL', opp: 'BOS', venue: 'A', pos: 'C', toi: 17, g: 0, a: 0, sog: 3, hits: 0, blk: 0, icf: 5, iff: 4, isf: 3, iscf: 2, ihdcf: 1, result: 'W', posSrc: 'lineup', boxPos: 'C', line: 1, fg: 0, ...over }[k])));
// Six skaters a side (three first-line forwards, a first pair, a fourth-line centre), each with six games this season.
const lineup = (team, base) => [
  { id: base + 1, pos: 'C', line: 1, sog: 3.5, g: 0.5 }, { id: base + 2, pos: 'LW', line: 1, sog: 3, g: 0.4 }, { id: base + 3, pos: 'RW', line: 1, sog: 2.5, g: 0.3 },
  { id: base + 4, pos: 'D', line: 1, sog: 2.2, g: 0.1 }, { id: base + 5, pos: 'D', line: 2, sog: 1.2, g: 0.05 }, { id: base + 6, pos: 'C', line: 4, sog: 1.0, g: 0.08 },
].map((p) => ({ ...p, name: `${team} ${p.id}`, team }));
const mtl = lineup('MTL', 100); const dal = lineup('DAL', 200);
const rows = [];
const opps = ['BOS', 'TOR', 'NYR', 'PIT', 'OTT', 'BUF'];
for (const [team, list] of [['MTL', mtl], ['DAL', dal]]) {
  list.forEach((p) => opps.forEach((opp, i) => rows.push(row({ date: `2026-10-${String(8 + i * 2).padStart(2, '0')}`, gameId: 2026020000 + (team === 'MTL' ? 10 : 50) + i, playerId: p.id, name: p.name, team, opp, pos: p.pos, line: p.line, sog: p.sog, icf: p.sog * 1.8, iscf: p.sog * 0.6, g: p.g, boxPos: p.pos }))));
}
const side = (list, team, opp, venue) => ({ team, opp, venue, source: 'lineup', skaters: list.map((p) => ({ id: p.id, name: p.name, team, opp, venue, pos: p.pos, line: p.line, inLineup: true, model: null })), propfinder: null, defense: null });
const game = (log = null) => ({ id: 2026020200, away: 'MTL', home: 'DAL', startTimeUTC: '2026-11-01T00:00:00Z', sides: [side(mtl, 'MTL', 'DAL', 'A'), side(dal, 'DAL', 'MTL', 'H')], total: { expected: { away: 3.1, home: 2.9, total: 6.0 } }, log });
const slate = (log) => ({ date: DATE, games: [game(log)], modelRun: null, gamesStored: 12 });

describe('the picks board carries the special teams and the predicted score', () => {
  test('every candidate’s λ moves by his power-play slot, the side adding up to the team factor; the game gets a projected score', () => {
    const board = computePicks(DATE, slate(), rows, { withSkaters: true, spz });
    const g = board.games[0];
    expect(g.skaters).toBe(12);
    const cands = [...g.shots, ...g.nextShots, ...g.goals, ...g.nextGoals];
    const byId = Object.fromEntries(g.all.map((c) => [c.id, c]));
    // Every row carries the side's read; the first units carry their share of it (a fourth-liner's can round to nothing).
    for (const c of g.all) expect(c.stTeam).toMatchObject({ factor: { shots: expect.any(Number), goals: expect.any(Number) } });
    for (const id of [101, 102, 103, 104, 201, 202, 203, 204]) expect(byId[id].st).toMatchObject({ dS: expect.any(Number), dG: expect.any(Number), share: expect.any(Number) });
    expect(cands.length).toBeGreaterThan(0);
    // MTL at DAL: DAL is disciplined and kills well, so MTL gets fewer power plays than usual — its first unit loses a little and
    // its fourth line gains it back; the side's sum of λ is untouched (the opponent's penalties are in the shots it allows).
    expect(byId[101].stTeam.shift.shots).toBeLessThan(0); expect(byId[101].stTeam.factor).toEqual({ shots: 1, goals: 1 });
    expect(byId[101].st.dS).toBeLessThan(0); expect(byId[106].st?.dS ?? 0).toBeGreaterThanOrEqual(0);
    const sideSum = (team, key) => g.all.filter((c) => c.team === team).reduce((t, c) => t + c[key], 0);
    const before = (team, key) => g.all.filter((c) => c.team === team).reduce((t, c) => t + (c.beforeSt ? c.beforeSt[key] : c[key]), 0);
    expect(sideSum('MTL', 'lamS')).toBeCloseTo(before('MTL', 'lamS'), 1); expect(sideSum('MTL', 'lamG')).toBeCloseTo(before('MTL', 'lamG'), 1);
    // The first-line centre's share of the units; the shares of a side add to one.
    expect(byId[201].st.share).toBeCloseTo(1 / (1 + 1 + 1 + 0.8 + 0.35 + 0.05), 2);
    expect(g.all.filter((c) => c.team === 'DAL' && c.st).reduce((t, c) => t + c.st.share, 0)).toBeCloseTo(1, 1);
    // The projected score: both sides, the total, the chances, MoneyPuck's figure on the hover, no final yet.
    expect(g.projected).toMatchObject({ away: 'MTL', home: 'DAL', final: null, stored: null });
    expect(g.projected.exp.MTL).toBeGreaterThan(1); expect(g.projected.exp.DAL).toBeGreaterThan(1);
    expect(g.projected.total).toBeCloseTo(g.projected.exp.MTL + g.projected.exp.DAL, 1);
    expect(g.projected.win.MTL + g.projected.win.DAL).toBeCloseTo(1, 3);
    expect(g.projected.title).toContain("MoneyPuck's expected goals read MTL 3.1 – 2.9 DAL (6.0)");
    // The team reads came from ShotPropz's boards; six skaters a side had a read, none filled.
    expect(g.projected.parts.MTL.own).toMatchObject({ gf: 3.15, gp: 13, from: 'shotpropz' });
    expect(g.projected.parts.MTL.opp).toMatchObject({ ga: 2.5, gp: 12, from: 'shotpropz' });
    expect(g.projected.parts.MTL.skaters).toMatchObject({ n: 6, read: 6, filled: 0 });
    expect(g.projected.parts.MTL.st).toMatchObject({ shots: 1, goals: 1, oppGives: expect.any(Number), killLeak: expect.any(Number) });
    // The shuffle rows carry the read too.
    expect(board.games[0].all[0].st).toBeTruthy();
  });
  test('without a ShotPropz snapshot nothing moves and the score reads the stored team rates', () => {
    const board = computePicks(DATE, slate(), rows, { withSkaters: true, spz: null });
    const g = board.games[0];
    for (const c of g.all) { expect(c.st ?? null).toBeNull(); expect(c.stTeam ?? null).toBeNull(); expect(c.beforeSt).toBeUndefined(); }
    expect(g.projected.parts.MTL.own).toMatchObject({ from: 'stored', gp: 6 });
    expect(g.projected.parts.MTL.st).toBeNull();
    expect(g.projected.exp.MTL).toBeGreaterThan(0.5);
  });
  test('a final game: the live projection is graded, the stored pre-game one stands beside it with its own grade', () => {
    const log = { score: { away: 2, home: 4 }, skaters: [...mtl, ...dal].map((p) => ({ id: p.id, name: p.name, team: p.team, sog: 2, g: p.id === 201 ? 2 : 0 })) };
    const stored = { games: { 2026020200: { at: '2026-10-31T20:00:00Z', exp: { MTL: 2.8, DAL: 3.3 }, total: 6.1, win: { MTL: 0.42, DAL: 0.58 }, headline: 'MTL 2.8 – 3.3 DAL', title: 'stored' } } };
    const board = computePicks(DATE, slate(log), rows, { withSkaters: false, spz, storedScores: stored });
    const g = board.games[0];
    expect(g.final).toBe(true);
    expect(g.projected.final).toMatchObject({ score: { MTL: 2, DAL: 4 }, total: 6, winner: 'DAL' });
    expect(g.projected.stored).toMatchObject({ at: '2026-10-31T20:00:00Z', exp: { MTL: 2.8, DAL: 3.3 }, total: 6.1, final: { err: { MTL: 0.8, DAL: -0.7, total: 0.1 }, winner: 'DAL', picked: 'DAL', called: true } });
  });
});
