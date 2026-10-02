import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { snapshotPositions, positionsPath } = require('../lib/nhl-data/positions');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const { lastLineupPath } = require('../lib/nhl-data/positions');
const { PF_DEPTH_PATH } = require('../lib/nhl-data/propfinder-api');

const players = {
  1: { id: 1, name: 'Troy Terry', team: 'ANA', pos: 'RW' }, 2: { id: 2, name: 'Leo Carlsson', team: 'ANA', pos: 'C' },
  3: { id: 3, name: 'Brady Tkachuk', team: 'OTT', pos: 'LW' },
};
const depth = (date) => ({ at: `${date}T12:00:00Z`, date, teams: { ANA: { players: { 'troy terry': { name: 'Troy Terry', id: 1, pos: 'RW', line: 1 }, 'leo carlsson': { name: 'Leo Carlsson', id: 2, pos: 'C', line: 1 } } } } });
const schedule = [{ id: 1, away: 'ANA', home: 'OTT', state: 'OFF', startTimeUTC: '2026-04-18T23:00:00Z' }];

describe('position snapshot sources', () => {
  test("PropFinder's depth chart never stands in for a game before the day it was pulled", async () => {
    mockStored.set(PLAYERS_PATH, { players });
    mockStored.set(PF_DEPTH_PATH, depth('2026-10-02'));
    await snapshotPositions('2026-04-18', schedule, { games: [], gdt: {} });
    let snap = mockStored.get(positionsPath('2026-04-18'));
    expect(snap.games[1].teams.ANA.source).toBe('roster');
    expect(snap.games[1].teams.ANA.players['troy terry']).toMatchObject({ inLineup: false, line: null });
    // Pulled the morning of the game (or earlier): it counts.
    mockStored.set(PF_DEPTH_PATH, depth('2026-04-18'));
    await snapshotPositions('2026-04-18', schedule, { games: [], gdt: {} });
    snap = mockStored.get(positionsPath('2026-04-18'));
    expect(snap.games[1].teams.ANA.source).toBe('propfinder');
    expect(snap.games[1].teams.ANA.players['troy terry']).toMatchObject({ pos: 'RW', line: 1 });
    mockStored.set(PF_DEPTH_PATH, depth('2026-04-17'));
    await snapshotPositions('2026-04-18', schedule, { games: [], gdt: {} });
    expect(mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA.source).toBe('propfinder');
  });
  test('a last known lineup is carried only when it is dated no later than the game', async () => {
    mockStored.set(PLAYERS_PATH, { players });
    mockStored.delete(PF_DEPTH_PATH);
    const last = (date) => ({ team: 'OTT', ...(date ? { date } : {}), source: 'gamedaytweets', players: { 'brady tkachuk': { name: 'Brady Tkachuk', id: 3, pos: 'LW', line: 1 } } });
    for (const [file, carried] of [[last('2026-10-01'), 0], [last(null), 0], [last('2026-04-16'), 1]]) {
      mockStored.set(lastLineupPath('OTT'), file);
      await snapshotPositions('2026-04-18', schedule, { games: [], gdt: {} });
      const t = mockStored.get(positionsPath('2026-04-18')).games[1].teams.OTT;
      expect(t.carried?.count || 0).toBe(carried);
      expect(!!t.players['brady tkachuk'].carried).toBe(carried === 1);
    }
  });
});
