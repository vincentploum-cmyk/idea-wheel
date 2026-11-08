import { describe, expect, test, jest } from '@jest/globals';

// The NBA pull end to end against a stand-in for PropFinder's API: the priced players on the board, every rostered
// player the odds-only call leaves out kept with the extra (`rosterExtra`), the team rows whole.
const mockCalls = [];
const mockGame = { gameId: 'g1', gameDate: '2026-10-29T23:00:00Z', season: 2026, seasonType: 'REG', opposingTeamCode: 'DET', minutes: 30, points: 20, rebounds: 5, assists: 4, q1Points: 6, efficiency: 18 };
const mockTeams = [{ id: 't1', code: 'IND', stats: [{ id: 1, teamId: 't1', type: 'Opponent', position: 'PG', seasonYear: 2026, gamesPlayed: 6, points: 24.1, pointsRank: 3, fastBreakPts: 4 }] }, { id: 't2', code: 'DET', stats: [] }];
const mockPriced = [{ id: 'a', name: 'Andrew Nembhard', position: 'SG', team: { code: 'IND' }, stats: [mockGame], odds: [{ market: 'Player Points', categoryMapping: 'points', points: 17.5, price: -110, selectionLine: 'over', sportsbook: 'FanDuel', isMain: true }] }];
const mockBench = { id: 'b', name: 'Bench Guard', position: 'PG', team: { code: 'IND' }, stats: [{ ...mockGame, points: 6 }] };
// The Defensive Matchups answer in the shape the pull of 2026-11-08 saw (games → sides → positions { stats, ranks, starters }):
// the IND side's PG figures are what IND's /teams row allows; the DET side's are not DET's (no /teams rows) nor IND's.
const mockDm = { refuse: false, answer: { season: 2026, since: '2025-10-21T00:00:00', lines: [{ playerId: 'a', market: 'points', line: 17.5 }], games: [
  { gameId: 'g1', gameDate: '2026-11-08T23:00:00Z', homeTeamCode: 'DET', visitorTeamCode: 'IND', sides: [
    { teamCode: 'IND', opponentTeamCode: 'DET', starterSource: 'lineup', positions: [
      { position: 'PG', stats: { points: 24.1, rebounds: 5.75, threePointsMade: 2.4, benchPoints: 0, fieldGoalsPct: 0.48 }, ranks: { points: 3, rebounds: 17, threePointsMade: 1 }, starters: [{ playerId: 'c1', name: 'Cade Cunningham' }] },
    ] },
    { teamCode: 'DET', opponentTeamCode: 'IND', starterSource: 'lineup', positions: [{ position: 'PG', stats: { points: 30 }, ranks: { points: 1 }, starters: [] }] },
  ] },
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

const { pullSlate, defensiveMatchupsPath, readDefensiveMatchups, checkDefensiveMatchups } = require('../lib/nba/propfinder-nba');

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

  // Vincent, 2026-11-08: "add the endpoint to the pull" (the Defensive Matchups page's route); the reader for the shape the
  // first pull showed, checked against /teams both ways ("compare each cell against /teams both ways").
  test('the Defensive Matchups route rides with the pull: stored whole, read side by side, checked against /teams both ways', async () => {
    mockCalls.length = 0;
    const r = await pullSlate({ season: 2026, games: [{ away: 'IND', home: 'DET' }], at: '2026-11-08T13:00:00Z' });
    expect(r.ok).toBe(true);
    expect(mockCalls).toContain('/NBA/defensive-matchups?season=2026&lastNGames=0&since=2025-10-21&sportsbooks=betmgm&sportsbooks=draftkings&sportsbooks=fanduel&sportsbooks=prizepicks&sportsbooks=underdog');
    expect(defensiveMatchupsPath(2027)).toMatch(/^\/NBA\/defensive-matchups\?season=2027&lastNGames=0&/);
    const dm = r.data.defensiveMatchups;
    expect(dm.answer).toEqual(mockDm.answer);
    expect(dm.rows[0]).toEqual({ game: 'g1', team: 'IND', opp: 'DET', pos: 'PG', stats: { pts: { value: 24.1, rank: 3 }, reb: { value: 5.75, rank: 17 }, tpm: { value: 2.4, rank: 1 } }, starters: ['Cade Cunningham'] });
    expect(dm.rows[1]).toEqual({ game: 'g1', team: 'DET', opp: 'IND', pos: 'PG', stats: { pts: { value: 30, rank: 1 } } });
    expect(r.defensiveMatchups).toMatchObject({ games: 1, rows: 2, teams: 2, season: 2026, since: '2025-10-21T00:00:00', others: ['benchPoints', 'fieldGoalsPct'], lines: { count: 1, keys: ['playerId', 'market', 'line'] }, starterKeys: ['playerId', 'name'], error: null });
    // As each side's own defense: IND PG points read the same (IND's /teams row has no rebounds or threes), DET has no row.
    // As the opponent's: the DET side's 30 points against IND's 24.1.
    expect(r.defensiveMatchups.check).toEqual({
      team: { cells: 1, same: 1, share: 1, off: [], noRow: ['DET PG'] },
      opponent: { cells: 1, same: 0, share: 0, off: ['IND PG pts: route 30, /teams 24.1'], noRow: ['DET PG'] },
      reads: 'team',
    });
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

  test('an answer without games reads no rows and names its keys; the check says which way matches, or neither', () => {
    expect(readDefensiveMatchups({ message: 'nope', total: 0 })).toEqual({ rows: [], games: null, keys: ['message', 'total'], others: [], season: null, since: null, lines: null, starterKeys: [] });
    const defense = { teams: { BOS: { C: { reb: 12.0, blk: 1.1 } }, NYK: { C: { reb: 9.0, blk: 2.0 } } } };
    const row = (team, opp, reb, blk) => ({ team, opp, pos: 'C', stats: { reb: { value: reb, rank: null }, blk: { value: blk, rank: null } } });
    // Each side carrying its opponent's table.
    expect(checkDefensiveMatchups([row('BOS', 'NYK', 9.0, 2.0), row('NYK', 'BOS', 12.05, 1.1)], defense).reads).toBe('opponent');
    // Another window: close to neither.
    expect(checkDefensiveMatchups([row('BOS', 'NYK', 10.5, 1.5), row('NYK', 'BOS', 10.5, 1.5)], defense).reads).toBe('neither');
    expect(checkDefensiveMatchups([row('LAL', 'GSW', 10, 1)], defense).reads).toBeNull();
  });
});
