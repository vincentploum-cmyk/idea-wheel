import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { buildPace, toBuffer } = require('../lib/nhl-data/build');
const { MP_TEAMS, mpYear } = require('../lib/nhl-data/moneypuck');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const { parsePaceWorkbook } = require('../components/nhl/model-core');

describe('pace from MoneyPuck', () => {
  test('the built workbook parses into one pace per team, the ratio to the league kept', async () => {
    expect(await buildPace('2026-10-02')).toBeNull();
    mockStored.set(MP_TEAMS(mpYear()), { updatedAt: '2026-10-02T06:00:00Z', year: mpYear(), situations: { all: {
      NYR: { cf60: 62, ca60: 60, pace60: 122 }, NJD: { cf60: 50, ca60: 48, pace60: 98 }, BOS: { cf60: 55, ca60: 55 }, // BOS: an older snapshot without the pace column
    } } });
    mockStored.set(PLAYERS_PATH, { players: {
      1: { id: 1, name: 'Artemi Panarin', team: 'NYR', pos: 'LW' }, 2: { id: 2, name: 'Adam Fox', team: 'NYR', pos: 'D' }, 3: { id: 3, name: 'Igor Shesterkin', team: 'NYR', pos: 'G' },
      4: { id: 4, name: 'Jack Hughes', team: 'NJD', pos: 'C' }, 5: { id: 5, name: 'Nico Hischier', team: 'NJD', pos: 'C' },
      6: { id: 6, name: 'David Pastrnak', team: 'BOS', pos: 'RW' },
    } });
    const built = await buildPace('2026-10-02');
    expect(built).toMatchObject({ teams: 3, name: 'NHL Pace Stats 2026-10-02.xlsx', updatedAt: '2026-10-02T06:00:00Z' });
    // Parsed exactly like an uploaded pace export, against the matchup workbook's team blocks.
    const games = [{ skaterBlocks: [
      { team: 'Rangers', players: [{ name: 'Artemi Panarin' }, { name: 'Adam Fox' }] },
      { team: 'Devils', players: [{ name: 'Jack Hughes' }, { name: 'Nico Hischier' }] },
    ] }];
    const pace = parsePaceWorkbook(toBuffer(built.wb).toString('binary'), games);
    expect(pace.teamMap.Rangers).toBeCloseTo(61, 5);
    expect(pace.teamMap.Devils).toBeCloseTo(49, 5);
    expect(pace.teamMap.Bruins).toBeUndefined(); // not in tonight's matchup workbook
    expect(pace.players['david pastrnak'].paceBlend).toBe(55); // from CF/60 + CA/60 when the column is missing
    expect(pace.players['igor shesterkin']).toBeUndefined(); // goalies are left out
    // The league average is over the written players; the ratio is what the model uses.
    expect(pace.teamMap.Rangers / pace.leagueAvg).toBeGreaterThan(1.05);
    expect(pace.teamMap.Devils / pace.leagueAvg).toBeLessThan(0.95);
  });
});
