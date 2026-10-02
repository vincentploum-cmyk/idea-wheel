import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { restampPositions, gamesPath, rowsPath, rowObj, toRow, ROW_FIELDS } = require('../lib/nhl-data/ingest');
const { positionsPath } = require('../lib/nhl-data/positions');

const sk = (id, name, team, opp, venue, pos, sog) => ({ id, name, team, opp, venue, pos, toi: 15, g: 0, a: 0, sog, hits: 0, blk: 0, icf: sog, iff: sog, isf: sog, iscf: 0, ihdcf: 0, result: 'W' });

describe('restampPositions', () => {
  test('stored box scores and season rows follow a later lineup read', async () => {
    const date = '2026-10-01';
    const game = { id: 11, season: 20262027, date, away: { abbrev: 'NYR', score: 2 }, home: { abbrev: 'NJD', score: 1 }, skaters: [
      sk(1, 'Will Cuylle', 'NYR', 'NJD', 'A', 'LW', 4), sk(2, 'Adam Fox', 'NYR', 'NJD', 'A', 'D', 2), sk(3, 'Jack Hughes', 'NJD', 'NYR', 'H', 'C', 5),
    ] };
    mockStored.set(gamesPath(date), { date, games: [game] });
    mockStored.set(rowsPath(game.season), { season: game.season, fields: ROW_FIELDS, rows: game.skaters.map((s) => toRow(game, s)) });
    expect(await restampPositions('2026-09-30')).toBeNull();

    // First read: Cuylle on the third line (the morning tweet), Fox on pair 1; Hughes's team has no lineup yet.
    mockStored.set(positionsPath(date), { date, games: { 11: { away: 'NYR', home: 'NJD', teams: {
      NYR: { source: 'gamedaytweets', players: { 'will cuylle': { name: 'Will Cuylle', pos: 'LW', line: 3 }, 'adam fox': { name: 'Adam Fox', pos: 'D', line: 1 } } },
      NJD: { source: 'roster', players: { 'jack hughes': { name: 'Jack Hughes', pos: 'C', line: null, inLineup: false } } },
    } } } });
    expect(await restampPositions(date)).toMatchObject({ games: 1, covered: 1, applied: 2, changed: 3 });
    let rows = mockStored.get(rowsPath(game.season)).rows.map(rowObj);
    expect(rows.find((r) => r.playerId === 1)).toMatchObject({ pos: 'LW', line: 3, posSrc: 'lineup' });
    expect(rows.find((r) => r.playerId === 3)).toMatchObject({ pos: 'C', line: null, posSrc: 'box' });
    expect(mockStored.get(gamesPath(date)).restampedAt).toBeTruthy();

    // Nothing changed: nothing rewritten.
    const before = mockStored.get(gamesPath(date));
    expect(await restampPositions(date)).toMatchObject({ applied: 2, changed: 0 });
    expect(mockStored.get(gamesPath(date))).toBe(before);

    // Warm-ups, read after the game: Cuylle moved up to LW2, Hughes's lines arrived.
    mockStored.set(positionsPath(date), { date, games: { 11: { away: 'NYR', home: 'NJD', teams: {
      NYR: { source: 'gamedaytweets', players: { 'will cuylle': { name: 'Will Cuylle', pos: 'LW', line: 2 }, 'adam fox': { name: 'Adam Fox', pos: 'D', line: 1 } } },
      NJD: { source: 'gamedaytweets', players: { 'jack hughes': { name: 'Jack Hughes', pos: 'C', line: 1 } } },
    } } } });
    expect(await restampPositions(date)).toMatchObject({ applied: 3, changed: 2 });
    rows = mockStored.get(rowsPath(game.season)).rows.map(rowObj);
    expect(rows.find((r) => r.playerId === 1)).toMatchObject({ pos: 'LW', line: 2, boxPos: 'LW' });
    expect(rows.find((r) => r.playerId === 2)).toMatchObject({ pos: 'D', line: 1 });
    expect(rows.find((r) => r.playerId === 3)).toMatchObject({ pos: 'C', line: 1, posSrc: 'lineup' });
    expect(rows).toHaveLength(3);
    expect(mockStored.get(gamesPath(date)).games[0].skaters[0]).toMatchObject({ pos: 'LW', line: 2, posSource: 'lineup' });
  });
});
