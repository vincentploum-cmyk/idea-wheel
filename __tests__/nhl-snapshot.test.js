import { describe, expect, test, jest } from '@jest/globals';

const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { snapshotPositions, positionsPath, slotOnSnapshot, mergeLineup, rosterKeyOf } = require('../lib/nhl-data/positions');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const { lastLineupPath } = require('../lib/nhl-data/positions');
const { PF_DEPTH_PATH } = require('../lib/nhl-data/propfinder-api');

const players = {
  1: { id: 1, name: 'Troy Terry', team: 'ANA', pos: 'RW' }, 2: { id: 2, name: 'Leo Carlsson', team: 'ANA', pos: 'C' },
  3: { id: 3, name: 'Brady Tkachuk', team: 'OTT', pos: 'LW' },
};
const depth = (date) => ({ at: `${date}T12:00:00Z`, date, teams: { ANA: { players: { 'troy terry': { name: 'Troy Terry', id: 1, pos: 'RW', line: 1 }, 'leo carlsson': { name: 'Leo Carlsson', id: 2, pos: 'C', line: 1 } } } } });
const schedule = [{ id: 1, away: 'ANA', home: 'OTT', state: 'OFF', startTimeUTC: '2026-04-18T23:00:00Z' }];

describe('a skater’s slot on the snapshot (the player card’s badge)', () => {
  test('found by id, then by name, with the team, opponent, venue and source; null off the slate', () => {
    const file = { date: '2026-10-10', games: { 1: { away: 'BUF', home: 'NYR', teams: {
      BUF: { source: 'gamedaytweets', players: { 'alex tuch': { name: 'Alex Tuch', id: 7, pos: 'LW', line: 1 }, 'tage thompson': { name: 'Tage Thompson', id: 8, pos: 'C', line: 1, inLineup: false } } },
      NYR: { source: 'lineup', players: { 'adam fox': { name: 'Adam Fox', id: 9, pos: 'D', line: 1 } } },
    } } } };
    expect(slotOnSnapshot(file, { id: 7, name: 'Alex Tuch', team: 'BUF' })).toEqual({ date: '2026-10-10', team: 'BUF', opp: 'NYR', venue: 'A', pos: 'LW', line: 1, source: 'gamedaytweets', inLineup: true, carried: false });
    expect(slotOnSnapshot(file, { id: null, name: 'Adam Fox' })).toMatchObject({ team: 'NYR', venue: 'H', pos: 'D', line: 1, source: 'lineup' });
    expect(slotOnSnapshot(file, { id: 8, name: 'Tage Thompson' }).inLineup).toBe(false);
    expect(slotOnSnapshot(file, { id: 99, name: 'Nobody' })).toBeNull();
    expect(slotOnSnapshot(null, { id: 7 })).toBeNull();
  });
  test('a skater the snapshot holds twice reads at his lineup slot, not his roster entry (Chinakhov, 2026-10-31)', () => {
    // A preview spelling the roster did not hold: the lineup's entry without an id, the roster's with the id and no line.
    const file = { date: '2026-10-31', games: { 1: { away: 'PIT', home: 'MTL', teams: {
      PIT: { source: 'lineup', players: {
        'sidney crosby': { name: 'Sidney Crosby', id: 87, pos: 'C', line: 1 },
        'egor chinakhov': { name: 'Egor Chinakhov', id: null, pos: 'LW', line: 2 },
        'yegor chinakhov': { name: 'Yegor Chinakhov', id: 59, pos: 'RW', line: null, inLineup: false },
      } },
      MTL: { source: 'lineup', players: {} },
    } } } };
    expect(slotOnSnapshot(file, { id: 59, name: 'Yegor Chinakhov', team: 'PIT' })).toMatchObject({ pos: 'LW', line: 2, inLineup: true, venue: 'A', opp: 'MTL' });
    // A player the lineup really leaves out still reads as such.
    file.games[1].teams.PIT.players['egor chinakhov'].inLineup = false;
    expect(slotOnSnapshot(file, { id: 59, name: 'Yegor Chinakhov', team: 'PIT' })).toMatchObject({ pos: 'RW', line: null, inLineup: false });
  });
});

describe('the capture holds each skater once, under the roster’s key', () => {
  const roster = { 'yegor chinakhov': { name: 'Yegor Chinakhov', id: 59, pos: 'RW', line: null }, 'sidney crosby': { name: 'Sidney Crosby', id: 87, pos: 'C', line: null }, 'evgeni malkin': { name: 'Evgeni Malkin', id: 71, pos: 'C', line: null } };
  test('rosterKeyOf: the exact key, else the one player with the last name and a first name that starts alike', () => {
    expect(rosterKeyOf(roster, 'Yegor Chinakhov')).toBe('yegor chinakhov');
    expect(rosterKeyOf(roster, 'Egor Chinakhov')).toBe('yegor chinakhov');
    expect(rosterKeyOf(roster, 'Sid Crosby')).toBe('sidney crosby');
    expect(rosterKeyOf(roster, 'Nobody Here')).toBeNull();
    expect(rosterKeyOf(roster, 'Boris Malkin')).toBeNull();
  });
  test('mergeLineup: a lineup spelling the roster lacks lands on the roster entry with its id; the rest keep their roster position', () => {
    const players = mergeLineup({ 'egor chinakhov': { name: 'Egor Chinakhov', pos: 'LW', line: 2 }, 'sidney crosby': { name: 'Sidney Crosby', pos: 'C', line: 1 }, 'some rookie': { name: 'Some Rookie', pos: 'RW', line: 4 } }, roster, 'PIT');
    expect(players['egor chinakhov']).toBeUndefined();
    expect(players['yegor chinakhov']).toMatchObject({ name: 'Yegor Chinakhov', id: 59, pos: 'LW', line: 2, team: 'PIT' });
    expect(players['yegor chinakhov'].inLineup).not.toBe(false);
    expect(players['sidney crosby']).toMatchObject({ id: 87, pos: 'C', line: 1 });
    expect(players['evgeni malkin']).toMatchObject({ id: 71, pos: 'C', line: null, inLineup: false });
    // A name the roster does not know stays under its own key, without an id.
    expect(players['some rookie']).toMatchObject({ id: null, pos: 'RW', line: 4 });
    expect(Object.values(players).filter((p) => p.id === 59)).toHaveLength(1);
  });
  test("snapshotPositions: NHL.com's preview spelling a skater otherwise than the roster does not double him", async () => {
    mockStored.set(PLAYERS_PATH, { players: { ...players, 59: { id: 59, name: 'Yegor Chinakhov', team: 'ANA', pos: 'RW' } } });
    mockStored.delete(PF_DEPTH_PATH);
    mockStored.delete(lastLineupPath('ANA'));
    const nhlGame = { gameId: 1, away: 'ANA', home: 'OTT', updated: '2026-04-18T22:50:00Z', rows: ['Ducks projected lineup', 'Egor Chinakhov -- Leo Carlsson -- Troy Terry'] };
    await snapshotPositions('2026-04-18', schedule, { games: [nhlGame], gdt: {} });
    const ana = mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA;
    expect(ana.source).toBe('lineup');
    expect(ana.players['egor chinakhov']).toBeUndefined();
    expect(ana.players['yegor chinakhov']).toMatchObject({ name: 'Yegor Chinakhov', id: 59, pos: 'LW', line: 1 });
    expect(slotOnSnapshot(mockStored.get(positionsPath('2026-04-18')), { id: 59, name: 'Yegor Chinakhov', team: 'ANA' })).toMatchObject({ pos: 'LW', line: 1, inLineup: true });
  });
});

describe('position snapshot sources', () => {
  test("a warm-up tweet beats NHL.com's preview whatever the preview's updated time; an afternoon tweet does not", async () => {
    mockStored.set(PLAYERS_PATH, { players });
    mockStored.delete(PF_DEPTH_PATH);
    const nhlGame = { gameId: 1, away: 'ANA', home: 'OTT', updated: '2026-04-18T22:50:00Z', rows: ['Ducks projected lineup', 'Leo Carlsson -- Troy Terry -- X Y'] };
    const tweet = (at) => ({ ANA: { players: { 'troy terry': { name: 'Troy Terry', id: 1, pos: 'LW', line: 2 } }, meta: { at, date: '2026-04-18', handle: 'w' } } });
    // Warm-ups at T-25 (7:00 PM start): the tweet wins although NHL.com's page says it updated at T-10.
    await snapshotPositions('2026-04-18', schedule, { games: [nhlGame], gdt: tweet('2026-04-18T22:35:00Z') });
    let ana = mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA;
    expect(ana.source).toBe('gamedaytweets');
    expect(ana.players['troy terry']).toMatchObject({ pos: 'LW', line: 2 });
    // The morning skate (T-8h): NHL.com's later preview wins, as before.
    await snapshotPositions('2026-04-18', schedule, { games: [nhlGame], gdt: tweet('2026-04-18T15:00:00Z') });
    ana = mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA;
    expect(ana.source).toBe('lineup');
  });
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
