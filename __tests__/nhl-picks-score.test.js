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

describe('the board reads the λ at the weights the calibration learned', () => {
  // A slate with a run: every skater carries the run's figures, so the board's λ is the run's blended with the study's at the weights.
  const withRun = () => { const sl = slate(); sl.modelRun = { id: 'run-1', createdAt: '2026-10-31T14:00:00Z' }; for (const g of sl.games) for (const sd of g.sides) for (const p of sd.skaters) p.model = { sog: 3.2, g: 0.45, p3s: 0.62, p4s: 0.4, p1g: 0.36, gateOpen: true }; return sl; };
  const fits = { sog: {}, g: {} };
  test('the verdict’s share, the env over it, the defaults without one', () => {
    const learned = { at: '2026-10-31T06:00:00Z', from: '2026-10-08', to: '2026-10-30', rows: 5000, stats: { sog: { share: 0.5, from: 0, best: 0.5, moved: true, reason: 'test', scores: {} }, g: { share: 1, from: 1, best: 1, moved: false, reason: 'test', scores: {} } } };
    const cal = { games: 5000, weights: { w: 0.5, wG: 1 }, learned, reads: { board: fits, study: fits } };
    const board = computePicks(DATE, withRun(), rows, { withSkaters: true, spz, cal });
    expect(board.source).toBe('model');
    expect(board.boardWeights).toMatchObject({ w: 0.5, wG: 1, from: { w: 'learned', wG: 'learned' }, calibrationFits: true, learned: { rows: 5000, stats: { sog: { share: 0.5 } } } });
    expect(board.studyWeight).toBe(0.5); expect(board.studyWeightGoals).toBe(1);
    const c = board.games[0].all.find((x) => x.id === 101);
    // Half the run's 3.2 and half the study's λ for him; the goals the study's alone.
    expect(c.model.lamS).toBe(3.2);
    expect(c.lamS).toBeCloseTo((3.2 + c.study.lamS) / 2 + (c.st?.dS || 0), 1);
    expect(c.lamG).toBeCloseTo(c.study.lamG + (c.st?.dG || 0), 2);
    // The seed-shaped calibration (no verdict): the defaults, the run's shots and the study's goals.
    const plain = computePicks(DATE, withRun(), rows, { withSkaters: true, spz, cal: { games: 5000, weights: { w: 0, wG: 1 }, reads: { board: fits, study: fits } } });
    expect(plain.boardWeights).toMatchObject({ w: 0, wG: 1, from: { w: 'default', wG: 'default' } });
    expect(plain.games[0].all.find((x) => x.id === 101).lamS).toBeCloseTo(3.2 + (c.st?.dS || 0), 1);
    // A calibration learned at other weights than the env now names is another read: the chances print as stated.
    process.env.NHL_PICKS_STUDY_WEIGHT = '0.25';
    try {
      const over = computePicks(DATE, withRun(), rows, { withSkaters: true, spz, cal });
      expect(over.boardWeights).toMatchObject({ w: 0.25, wG: 1, from: { w: 'env', wG: 'learned' }, calibrationFits: false });
      expect(over.calibration).toBeNull();
    } finally { delete process.env.NHL_PICKS_STUDY_WEIGHT; }
    // Without a run the weights do not apply: the study's read alone.
    const noRun = computePicks(DATE, slate(), rows, { withSkaters: true, spz, cal });
    expect(noRun.source).toBe('study'); expect(noRun.studyWeight).toBeNull();
  });
});

describe('the board reads the edge at the book’s lines', () => {
  test('a skater with lines on the slate carries the chance at the book’s mark and for a goal against the prices; the verdict rides on the payload', () => {
    const sl = slate();
    const prop = { sog: { line: 2.5, odds: -140, underOdds: 110, book: 'DK', books: 2, lines: [{ line: 2.5, odds: -140 }] }, goal: { line: 0.5, odds: 150, book: 'DK', books: 1 } };
    sl.games[0].sides[0].skaters[0].prop = prop;
    sl.book = { at: '2026-10-31T13:00:00Z', skaters: 1, withSog: 1, withGoal: 1 };
    const edge = { at: '2026-10-31T06:00:00Z', from: '2026-10-08', to: '2026-10-30', sog: { n: 400, reliable: { step: 0.6, n: 40, hit: 0.65, implied: 0.56, ret: 0.1 } }, g: { n: 300, reliable: null } };
    const board = computePicks(DATE, sl, rows, { withSkaters: true, spz, edge });
    const c = board.games[0].all.find((x) => x.id === 101);
    // The shuffle row keeps λ, not the rungs: the chance at the mark is the board's 3+ figure, read back off the λ.
    expect(c.book.sog).toMatchObject({ line: 2.5, mark: 3, odds: -140, implied: 0.583 });
    expect(c.book.sog.p).toBeGreaterThan(0.3); expect(c.book.sog.p).toBeLessThan(0.9);
    expect(c.book.sog.edge).toBeCloseTo(c.book.sog.p - 0.583, 3);
    expect(c.book.goal).toMatchObject({ odds: 150, implied: 0.4 });
    expect(c.book.goal.p).toBeGreaterThan(0); expect(c.book.goal.edge).toBeCloseTo(c.book.goal.p - 0.4, 3);
    // The board's own row (the per-game tables) carries the same read.
    const onBoard = [...board.games[0].shots, ...board.games[0].nextShots].find((x) => x.id === 101);
    if (onBoard) { expect(onBoard.book.sog.p).toBe(onBoard.p3); expect(onBoard.book.goal.p).toBe(onBoard.p1g); }
    expect(board.games[0].all.find((x) => x.id === 102).book).toBeNull();
    expect(board.book).toEqual(sl.book);
    expect(board.reliable).toEqual({ at: edge.at, from: edge.from, to: edge.to, sog: edge.sog.reliable, g: null, n: { sog: 400, g: 300 } });
    expect(computePicks(DATE, slate(), rows, { withSkaters: false, spz }).reliable).toBeNull();
  });
});

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
