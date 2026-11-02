import { describe, expect, test, jest } from '@jest/globals';

// The NBA pull end to end against a stand-in for PropFinder's API: the priced players on the board, every rostered
// player the odds-only call leaves out kept with the extra (`rosterExtra`), the team rows whole.
const mockCalls = [];
const mockGame = { gameId: 'g1', gameDate: '2026-10-29T23:00:00Z', season: 2026, seasonType: 'REG', opposingTeamCode: 'DET', minutes: 30, points: 20, rebounds: 5, assists: 4, q1Points: 6, efficiency: 18 };
const mockTeams = [{ id: 't1', code: 'IND', stats: [{ id: 1, teamId: 't1', type: 'Opponent', position: 'PG', seasonYear: 2026, gamesPlayed: 6, points: 24.1, pointsRank: 3, fastBreakPts: 4 }] }, { id: 't2', code: 'DET', stats: [] }];
const mockPriced = [{ id: 'a', name: 'Andrew Nembhard', position: 'SG', team: { code: 'IND' }, stats: [mockGame], odds: [{ market: 'Player Points', categoryMapping: 'points', points: 17.5, price: -110, selectionLine: 'over', sportsbook: 'FanDuel', isMain: true }] }];
const mockBench = { id: 'b', name: 'Bench Guard', position: 'PG', team: { code: 'IND' }, stats: [{ ...mockGame, points: 6 }] };
jest.mock('../lib/nhl-data/propfinder-api', () => ({
  propfinderConfigured: () => true,
  pfGetJson: async (path) => {
    mockCalls.push(path);
    if (path === '/NBA/teams') return mockTeams;
    if (path.startsWith('/NBA/players')) return /withOddsOnly=true/.test(path) ? mockPriced : [...mockPriced, mockBench];
    if (path.startsWith('/NBA/v2')) return { injuryReport: JSON.stringify({ data: [] }) };
    return [];
  },
}));

const { pullSlate } = require('../lib/nba/propfinder-nba');

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
});
