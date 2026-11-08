import { describe, expect, test, jest } from '@jest/globals';

// The NBA pull end to end against a stand-in for PropFinder's API: the priced players on the board, every rostered
// player the odds-only call leaves out kept with the extra (`rosterExtra`), the team rows whole.
const mockCalls = [];
const mockGame = { gameId: 'g1', gameDate: '2026-10-29T23:00:00Z', season: 2026, seasonType: 'REG', opposingTeamCode: 'DET', minutes: 30, points: 20, rebounds: 5, assists: 4, q1Points: 6, efficiency: 18 };
const mockTeams = [{ id: 't1', code: 'IND', stats: [{ id: 1, teamId: 't1', type: 'Opponent', position: 'PG', seasonYear: 2026, gamesPlayed: 6, points: 24.1, pointsRank: 3, fastBreakPts: 4 }] }, { id: 't2', code: 'DET', stats: [] }];
const mockPriced = [{ id: 'a', name: 'Andrew Nembhard', position: 'SG', team: { code: 'IND' }, stats: [mockGame], odds: [{ market: 'Player Points', categoryMapping: 'points', points: 17.5, price: -110, selectionLine: 'over', sportsbook: 'FanDuel', isMain: true }] }];
const mockBench = { id: 'b', name: 'Bench Guard', position: 'PG', team: { code: 'IND' }, stats: [{ ...mockGame, points: 6 }] };
// A stand-in for the Defensive Matchups answer (its real shape is not known yet): IND's PG row as the /teams table has it,
// DET's with no /teams row, a figure no spelling reads (`fantasyPoints`).
const mockDm = { refuse: false, answer: { data: [
  { team: { code: 'IND' }, position: 'PG', opposingPlayer: { name: 'Cade Cunningham' }, points: 24.1, pointsRank: 3, rebounds: { value: 5.2, rank: 11 }, fantasyPoints: 41.5 },
  { teamCode: 'DET', position: 'SG', stats: { points: 19.9, threePointsMade: 2.4 } },
] } };
jest.mock('../lib/nhl-data/propfinder-api', () => ({
  propfinderConfigured: () => true,
  pfGetJson: async (path) => {
    mockCalls.push(path);
    if (path === '/NBA/teams') return mockTeams;
    if (path.startsWith('/NBA/players')) return /withOddsOnly=true/.test(path) ? mockPriced : [...mockPriced, mockBench];
    if (path.startsWith('/NBA/v2')) return { injuryReport: JSON.stringify({ data: [] }) };
    if (path.startsWith('/NBA/defensive-matchups')) { if (mockDm.refuse) throw new Error('500'); return mockDm.answer; }
    return [];
  },
}));

const { pullSlate, defensiveMatchupsPath, readDefensiveMatchups } = require('../lib/nba/propfinder-nba');

describe('the NBA pull loads everything', () => {
  test('every rostered player on the board (the unpriced with no lines), the extra kept as well', async () => {
    const r = await pullSlate({ season: 2026, games: [{ away: 'IND', home: 'DET' }], at: '2026-11-01T13:00:00Z' });
    expect(r.ok).toBe(true);
    // 2026-11-02, IND with ten out: the players taking the minutes had no lines yet and were not on the board.
    expect(r.data.players.map((p) => p.name)).toEqual(['Andrew Nembhard', 'Bench Guard']);
    const bench = r.data.players.find((p) => p.name === 'Bench Guard');
    expect(bench.props).toEqual([]);
    expect(bench.games[0]).toMatchObject({ pts: 6 });
    expect(r.withProps).toBe(1);
    expect(mockCalls.filter((c) => c.startsWith('/NBA/players')).map((c) => /withOddsOnly/.test(c))).toEqual([true, false]);
    const ind = r.data.extra.of('IND');
    expect(ind.counts).toMatchObject({ players: 2, offBoard: 1, teamRows: 1 });
    expect(ind.players.b).toMatchObject({ name: 'Bench Guard', offBoard: true, logs: [{ pts: 6, q1Pts: 6 }] });
    expect(ind.players.a.games.g1).toEqual({ efficiency: 18 });
    expect(ind.teams.IND.rows[0]).toMatchObject({ fastBreakPts: 4, pointsRank: 3 });
    expect(r.data.extra.abbrs.sort()).toEqual(['DET', 'IND']);
    expect(r.fieldsSeen.unread).toEqual([]);
    expect(r.fieldsSeen.stored).toEqual(['efficiency']);
  });

  // Vincent, 2026-11-08: "add the endpoint to the pull" (the Defensive Matchups page's route).
  test('the Defensive Matchups route rides with the pull: stored whole, read, checked against /teams, the unread named', async () => {
    mockCalls.length = 0;
    const r = await pullSlate({ season: 2026, games: [{ away: 'IND', home: 'DET' }], at: '2026-11-08T13:00:00Z' });
    expect(r.ok).toBe(true);
    expect(mockCalls).toContain('/NBA/defensive-matchups?season=2026&lastNGames=0&since=2025-10-21&sportsbooks=betmgm&sportsbooks=draftkings&sportsbooks=fanduel&sportsbooks=prizepicks&sportsbooks=underdog');
    expect(defensiveMatchupsPath(2027)).toMatch(/^\/NBA\/defensive-matchups\?season=2027&lastNGames=0&/);
    const dm = r.data.defensiveMatchups;
    expect(dm.answer).toEqual(mockDm.answer);
    expect(dm.rows[0]).toEqual({ team: 'IND', pos: 'PG', player: 'Cade Cunningham', stats: { pts: { value: 24.1, rank: 3 }, reb: { value: 5.2, rank: 11 } } });
    expect(dm.rows[1]).toEqual({ team: 'DET', pos: 'SG', stats: { pts: { value: 19.9, rank: null }, tpm: { value: 2.4, rank: null } } });
    expect(r.defensiveMatchups).toMatchObject({ count: 2, rows: 2, teams: 2, wrapper: 'data', unread: ['fantasyPoints'], error: null });
    // IND PG points match the /teams row; IND's /teams row has no rebounds, DET has no /teams row at all.
    expect(r.defensiveMatchups.check).toEqual({ cells: 1, same: 1, off: [], noRow: ['DET SG'] });
    expect(r.defensiveMatchups.sample).toContain('Cade Cunningham');
  });

  test('a refused Defensive Matchups route never fails the pull', async () => {
    mockDm.refuse = true;
    try {
      const r = await pullSlate({ season: 2026, games: [{ away: 'IND', home: 'DET' }], at: '2026-11-08T13:00:00Z' });
      expect(r.ok).toBe(true);
      expect(r.defensiveMatchups).toMatchObject({ error: '500' });
      expect(r.data.defensiveMatchups).toBeUndefined();
      expect(r.data.players.length).toBe(2);
    } finally { mockDm.refuse = false; }
  });

  test('an answer with no list reads no rows and names its keys', () => {
    expect(readDefensiveMatchups({ message: 'nope', total: 0 })).toEqual({ rows: [], count: null, keys: ['message', 'total'], unread: [], wrapper: null });
    expect(readDefensiveMatchups([{ team: 'Indiana Pacers', pos: 'c', blocks: 1.1 }]).rows).toEqual([{ team: 'IND', pos: 'C', stats: { blk: { value: 1.1, rank: null } } }]);
  });
});
