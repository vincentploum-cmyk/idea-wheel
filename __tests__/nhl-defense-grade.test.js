import { describe, expect, test } from '@jest/globals';
import { gradeDefenseReads, thirdOf } from '../lib/nhl-data/defense-grade';
import { blendedDefense, defenseByPosition } from '../lib/nhl-data/defense';
import { boardTables } from '../lib/nhl-data/defense-board';

// Last season: 12 games where NJD gives centres 4 shots and 1 goal, BOS gives centres 1 shot and 0 goals,
// NYR gives centres 2 and 0.3; every centre shoots 2 a game. This season: three dates to grade.
const row = (date, gameId, playerId, team, opp, venue, pos, sog, g) => ({ date, gameId, playerId, name: `P${playerId}`, team, opp, venue, pos, sog, g, a: 0, icf: sog, iff: sog, iscf: 0, ihdcf: 0 });
const prev = [];
let gid = 100;
for (let i = 0; i < 12; i++) {
  const d = `2025-11-${String(i + 1).padStart(2, '0')}`;
  prev.push(row(d, gid, 1, 'BOS', 'NJD', 'A', 'C', 4, 1), row(d, gid, 2, 'NJD', 'BOS', 'H', 'C', 1, 0)); gid += 1;
  prev.push(row(d, gid, 3, 'NYR', 'NJD', 'H', 'C', 4, 1), row(d, gid, 1, 'NJD', 'NYR', 'A', 'C', 2, 0)); gid += 1;
  prev.push(row(d, gid, 2, 'BOS', 'NYR', 'A', 'C', 2, 0), row(d, gid, 3, 'NYR', 'BOS', 'H', 'C', 1, 0)); gid += 1;
}
const cur = [
  // Oct 1: player 1 (BOS C, base 3 SOG/g) at NJD, the soft spot; player 2 (NJD C, base 1.5) at BOS, the tough one.
  row('2026-10-01', 1, 1, 'BOS', 'NJD', 'A', 'C', 5, 1), row('2026-10-01', 1, 2, 'NJD', 'BOS', 'H', 'C', 1, 0),
  // Oct 3: player 3 (NYR C, base 2.5) at NJD; player 1 at NYR (mid).
  row('2026-10-03', 2, 3, 'NYR', 'NJD', 'A', 'C', 4, 0), row('2026-10-03', 2, 1, 'NJD', 'NYR', 'H', 'C', 3, 0),
];

describe('the defense tab graded', () => {
  test('thirds follow the tab’s tint: rank 1 of 3 soft, 2 mid, 3 tough', () => {
    expect([1, 2, 3].map((r) => thirdOf(r, 3))).toEqual(['soft', 'mid', 'tough']);
    expect(thirdOf(null, 3)).toBeNull();
  });
  test('every stored skater-game is graded against the tables as they stood that morning', () => {
    const g = gradeDefenseReads([...prev, ...cur], { season: 2026 });
    expect(g).toMatchObject({ season: 2026, from: '2026-10-01', to: '2026-10-03', dates: 2, games: 2, skaterGames: 4 });
    const s = g.spans.season.sog;
    // Oct 1: NJD is the soft third for centres (4 a game last season), BOS the tough one; player 1 shot 5 against a 3.0 rate.
    expect(s.thirds.soft.n).toBe(2); // player 1 on Oct 1 and player 3 on Oct 3, both at NJD
    expect(s.thirds.soft.actual).toBe(4.5);
    expect(s.thirds.soft.expected).toBeCloseTo((3 + 2.5) / 2, 2);
    expect(s.thirds.soft.lift).toBeCloseTo(4.5 / 2.75 - 1, 2);
    expect(s.thirds.soft.hit).toBe(1); // both reached 3+
    expect(s.thirds.tough).toMatchObject({ n: 1, actual: 1, expected: 1.5, hit: 0 });
    // Every side here dresses one position, so its softest spot is that position whatever its rank: all four skater-games.
    expect(s.best.n).toBe(4);
    expect(s.all.n).toBe(4);
    expect(s.all.hitExpected).toBeGreaterThan(0);
    // Goals: NJD leaks a goal a game to centres last season; the blend at 0 games this season is last season's table.
    const gg = g.spans.season.g;
    expect(gg.thirds.soft.n).toBe(2);
    expect(gg.thirds.soft.actual).toBe(0.5);
    // L5 / L10 tables exist for every span and grade the same rows.
    expect(g.spans.l10.sog.all.n).toBe(4);
    expect(g.spans.l5.g.all.n).toBe(4);
  });
  test('a date window and a skater without a rate', () => {
    const g = gradeDefenseReads([...prev, ...cur, row('2026-10-03', 2, 9, 'NYR', 'NJD', 'A', 'C', 6, 2)], { season: 2026, from: '2026-10-03' });
    expect(g).toMatchObject({ dates: 1, games: 1, skaterGames: 2 }); // player 9 has no base and no games: not graded
    expect(g.spans.season.sog.all.n).toBe(2);
  });
});

describe('the grader rebuilds the tab’s tables exactly', () => {
  test('each date’s ranked boards equal blendedDefense / defenseByPosition on the rows before it', () => {
    // Four teams, four positions, two skaters a position; 14 games last season, 4 dates this season, with some noise.
    const teams = ['NJD', 'BOS', 'NYR', 'TOR']; const pos = ['C', 'LW', 'RW', 'D'];
    let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const rows = []; let gid = 1;
    const game = (date, home, away) => {
      for (const [team, opp, venue] of [[home, away, 'H'], [away, home, 'A']]) {
        for (const p of pos) for (let k = 0; k < 2; k++) rows.push({ date, gameId: gid, playerId: Number(`${teams.indexOf(team)}${pos.indexOf(p)}${k}`) + 1, name: 'x', team, opp, venue, pos: p, sog: Math.floor(rnd() * 5), g: rnd() < 0.2 ? 1 : 0, a: 0, icf: 0, iff: 0, iscf: 0, ihdcf: 0 });
      }
      gid += 1;
    };
    for (let i = 0; i < 14; i++) { const d = `2025-12-${String(i + 1).padStart(2, '0')}`; game(d, teams[i % 4], teams[(i + 1) % 4]); game(d, teams[(i + 2) % 4], teams[(i + 3) % 4]); }
    const dates = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07'];
    dates.forEach((d, i) => { game(d, teams[i % 4], teams[(i + 2) % 4]); game(d, teams[(i + 1) % 4], teams[(i + 3) % 4]); });
    const seen = {};
    gradeDefenseReads(rows, { season: 2026, trace: (date, boards) => { seen[date] = boards; } });
    expect(Object.keys(seen)).toEqual(dates);
    for (const date of dates) {
      const prior = rows.filter((r) => r.date < date);
      const ref = { season: blendedDefense(prior, date), l10: defenseByPosition(prior, { lastN: 10 }), l5: defenseByPosition(prior, { lastN: 5 }) };
      for (const span of ['season', 'l10', 'l5']) for (const metric of ['sog', 'g']) {
        const t = boardTables(ref[span], { metric, venue: 'ALL', group: 'pos' });
        for (const p of pos) {
          const want = Object.fromEntries(t[p].rows.map((r) => [r.abbr, r.rank]));
          expect(seen[date][span][metric][p]).toEqual({ n: t[p].n, rank: want });
        }
      }
    }
  });
});
