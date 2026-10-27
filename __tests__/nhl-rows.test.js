import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { loadRows, rowsBefore } = require('../lib/nhl-data/build');
const { rowsPath, ROW_FIELDS, toRow } = require('../lib/nhl-data/ingest');
const { gameTypeOf, isPlayoffGame } = require('../lib/nhl-data/util');

const game = (date, id) => ({ date, id });
const sk = (name, sog = 2, g = 0) => ({ id: name.length, name, team: 'FLA', opp: 'WPG', venue: 'A', pos: 'C', toi: 18, g, a: 0, sog, hits: 0, blk: 0, icf: 3, iff: 3, isf: sog, iscf: 1, ihdcf: 0, result: 'W' });
const file = (season, rows) => ({ season, fields: ROW_FIELDS, updatedAt: `${season}`, rows });

describe('stored rows: last season is the regular season', () => {
  test('the game id says what kind of game it was', () => {
    expect(gameTypeOf(2026020100)).toBe(2);
    expect(gameTypeOf(2025030417)).toBe(3);
    expect(gameTypeOf(2026010012)).toBe(1);
    expect(isPlayoffGame(2025030417)).toBe(true);
    expect(isPlayoffGame('2025021300')).toBe(false);
  });
  test('last season’s playoff rows are left out, this season’s rows come whole, nothing from asOf on', () => {
    const cur = file(20262027, [toRow(game('2026-10-20', 2026020100), sk('Sam Reinhart', 4, 1)), toRow(game('2026-10-27', 2026020150), sk('Sam Reinhart', 3, 0))]);
    const prev = file(20252026, [toRow(game('2026-04-10', 2025021300), sk('Sam Reinhart', 2, 1)), toRow(game('2026-06-15', 2025030417), sk('Sam Reinhart', 5, 2))]);
    const rows = rowsBefore([cur, prev], '2026-10-27');
    expect(rows.map((r) => [r.date, r.gameId])).toEqual([['2026-04-10', 2025021300], ['2026-10-20', 2026020100]]);
    expect(rows[0]).toMatchObject({ name: 'Sam Reinhart', team: 'FLA', opp: 'WPG', pos: 'C', sog: 2, g: 1 });
    // In the spring the playoffs under way are this season's rows.
    const spring = file(20262027, [toRow(game('2027-04-25', 2026030111), sk('Sam Reinhart', 4, 1))]);
    expect(rowsBefore([spring, prev], '2027-05-01').map((r) => r.gameId)).toEqual([2025021300, 2026030111]);
    expect(rowsBefore([null, null], '2026-10-27')).toEqual([]);
  });
  test('loadRows reads the two season files for the date', async () => {
    mockStored.set(rowsPath('20262027'), file(20262027, [toRow(game('2026-10-20', 2026020100), sk('Sam Reinhart', 4, 1))]));
    mockStored.set(rowsPath('20252026'), file(20252026, [toRow(game('2026-04-10', 2025021300), sk('Sam Reinhart')), toRow(game('2026-06-15', 2025030417), sk('Sam Reinhart'))]));
    const rows = await loadRows('2026-10-27');
    expect(rows.map((r) => r.gameId)).toEqual([2025021300, 2026020100]);
  });
});
