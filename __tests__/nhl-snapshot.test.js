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
    // The morning skate (T-8h): the tweet wins over a preview whose "updated" stamp moved but whose lines did not.
    await snapshotPositions('2026-04-18', schedule, { games: [nhlGame], gdt: tweet('2026-04-18T15:00:00Z') });
    ana = mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA;
    expect(ana.source).toBe('gamedaytweets');
    // NHL.com revised the Ducks' lines after the morning skate: the preview wins, and says when.
    await snapshotPositions('2026-04-18', schedule, { games: [{ ...nhlGame, revisedAt: { ANA: '2026-04-18T20:00:00Z' } }], gdt: tweet('2026-04-18T15:00:00Z') });
    ana = mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA;
    expect(ana.source).toBe('lineup');
    expect(ana.meta.nhlRevised).toBe('2026-04-18T20:00:00Z');
    // A revision before the tweet does not count against it.
    await snapshotPositions('2026-04-18', schedule, { games: [{ ...nhlGame, revisedAt: { ANA: '2026-04-18T14:00:00Z' } }], gdt: tweet('2026-04-18T15:00:00Z') });
    expect(mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA.source).toBe('gamedaytweets');
  });
  test("a tweet from the day before loses to the preview's lines first seen later; wins over lines older than it", async () => {
    mockStored.set(PLAYERS_PATH, { players });
    mockStored.delete(PF_DEPTH_PATH);
    const nhlGame = { gameId: 1, away: 'ANA', home: 'OTT', updated: '2026-04-18T22:50:00Z', rows: ['Ducks projected lineup', 'Leo Carlsson -- Troy Terry -- X Y'] };
    const tweet = { ANA: { players: { 'troy terry': { name: 'Troy Terry', id: 1, pos: 'LW', line: 2 } }, meta: { at: '2026-04-17T18:00:00Z', date: '2026-04-17', handle: 'w' } } };
    await snapshotPositions('2026-04-18', schedule, { games: [{ ...nhlGame, linesAt: { ANA: '2026-04-18T16:00:00Z' } }], gdt: tweet });
    expect(mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA.source).toBe('lineup');
    await snapshotPositions('2026-04-18', schedule, { games: [{ ...nhlGame, linesAt: { ANA: '2026-04-16T16:00:00Z' } }], gdt: tweet });
    expect(mockStored.get(positionsPath('2026-04-18')).games[1].teams.ANA.source).toBe('gamedaytweets');
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

// Vincent, 2026-11-14: Carolina's first line, listed "Carrier - Aho - Svechnikov" by two writers and "Svechnikov - Aho -
// Carrier" by the third, put Svechnikov at LW1 from the warm-up tweet on; the line had not changed.
describe('an unchanged line listed the other way round keeps its sides', () => {
  const { keepWingSides } = require('../lib/nhl-data/positions');
  const P = (name, pos, line, extra = {}) => ({ name, pos, line, ...extra });
  const last = { date: '2026-11-12', players: { carrier: P('Carrier', 'LW', 1), aho: P('Aho', 'C', 1), svechnikov: P('Svechnikov', 'RW', 1), ehlers: P('Ehlers', 'LW', 2), stankoven: P('Stankoven', 'C', 2), blake: P('Blake', 'RW', 2) } };
  test('the same centre between the same two wingers, mirrored: the sides on file stand', () => {
    const now = { svechnikov: P('Svechnikov', 'LW', 1), aho: P('Aho', 'C', 1), carrier: P('Carrier', 'RW', 1), ehlers: P('Ehlers', 'LW', 2), stankoven: P('Stankoven', 'C', 2), blake: P('Blake', 'RW', 2) };
    const r = keepWingSides(now, last);
    expect(r.kept).toBe(1);
    expect(r.players.svechnikov).toMatchObject({ pos: 'RW', line: 1, sideKept: true });
    expect(r.players.carrier).toMatchObject({ pos: 'LW', line: 1, sideKept: true });
    expect(r.players.ehlers).toEqual(now.ehlers);          // the second line was listed as before: untouched
    expect(now.svechnikov.pos).toBe('LW');                 // pure
  });
  test('a real change is left alone: a new linemate, a new centre, a trio moved to another line with its sides, a carried slot', () => {
    const swap = { svechnikov: P('Svechnikov', 'LW', 1), aho: P('Aho', 'C', 1), blake: P('Blake', 'RW', 1) };
    expect(keepWingSides(swap, last).kept).toBe(0);
    const centre = { svechnikov: P('Svechnikov', 'LW', 1), stankoven: P('Stankoven', 'C', 1), carrier: P('Carrier', 'RW', 1) };
    expect(keepWingSides(centre, last).kept).toBe(0);
    const moved = { carrier: P('Carrier', 'LW', 2), aho: P('Aho', 'C', 2), svechnikov: P('Svechnikov', 'RW', 2) };
    expect(keepWingSides(moved, last)).toEqual({ players: moved, kept: 0 });
    // the trio dropped to the second line and listed the other way round: still the same trio, the sides stand
    const movedMirrored = { svechnikov: P('Svechnikov', 'LW', 2), aho: P('Aho', 'C', 2), carrier: P('Carrier', 'RW', 2) };
    expect(keepWingSides(movedMirrored, last).players.svechnikov).toMatchObject({ pos: 'RW', line: 2 });
    const carriedLast = { ...last, players: { ...last.players, carrier: P('Carrier', 'LW', 1, { carried: true }) } };
    expect(keepWingSides({ svechnikov: P('Svechnikov', 'LW', 1), aho: P('Aho', 'C', 1), carrier: P('Carrier', 'RW', 1) }, carriedLast).kept).toBe(0);
    expect(keepWingSides(swap, null)).toEqual({ players: swap, kept: 0 });
  });
  test('the snapshot: the warm-up tweet listed the other way round does not move the wingers; the hover says so', async () => {
    const DATE = '2026-11-14';
    const roster = { 11: { id: 11, name: 'Will Carrier', team: 'CAR', pos: 'LW' }, 12: { id: 12, name: 'Sebastian Aho', team: 'CAR', pos: 'C' }, 13: { id: 13, name: 'Andrei Svechnikov', team: 'CAR', pos: 'RW' } };
    mockStored.clear();
    mockStored.set(PLAYERS_PATH, { players: roster });
    mockStored.set(lastLineupPath('CAR'), { date: '2026-11-12', gameId: 1, source: 'gamedaytweets', players: { 'will carrier': { name: 'Will Carrier', id: 11, pos: 'LW', line: 1 }, 'sebastian aho': { name: 'Sebastian Aho', id: 12, pos: 'C', line: 1 }, 'andrei svechnikov': { name: 'Andrei Svechnikov', id: 13, pos: 'RW', line: 1 } } });
    const tweet = { players: { 'andrei svechnikov': { name: 'Andrei Svechnikov', id: 13, pos: 'LW', line: 1 }, 'sebastian aho': { name: 'Sebastian Aho', id: 12, pos: 'C', line: 1 }, 'will carrier': { name: 'Will Carrier', id: 11, pos: 'RW', line: 1 } }, meta: { handle: 'RyanHenkel_', at: '2026-11-14T17:38:24Z', date: DATE } };
    await snapshotPositions(DATE, [{ id: 21, away: 'SEA', home: 'CAR', state: 'FUT', startTimeUTC: '2026-11-14T18:00:00Z' }], { date: DATE, games: [], gdt: { CAR: tweet } });
    const car = mockStored.get(positionsPath(DATE)).games[21].teams.CAR;
    expect(car.source).toBe('gamedaytweets');
    expect(car.players['andrei svechnikov']).toMatchObject({ pos: 'RW', line: 1 });
    expect(car.players['will carrier']).toMatchObject({ pos: 'LW', line: 1 });
    expect(car.meta.sidesKept).toBe(1);
    const { lineupRead } = require('../lib/nhl-data/lineup-read');
    expect(lineupRead({ source: car.source, sourceMeta: car.meta, carried: null }, '2026-11-14T18:00:00Z').title).toMatch(/listed the other way round.*sides on file were kept/);
  });
});

// Vincent, 2026-11-14: Edmonton's rink before EDM @ TOR — Kapanen LW2, Hyman C2, nobody at RW2, no Nugent-Hopkins.
describe('Edmonton, 2026-11-14: a nickname, a misspelt name and a line read short', () => {
  const { keepKnownSlots } = require('../lib/nhl-data/positions');
  const { parseLineTweet, linesToPlayers, rosterMatcher, editDistance } = require('../lib/nhl-data/gamedaytweets');
  const roster = [
    ['Vasily Podkolzin', 'RW'], ['Connor McDavid', 'C'], ['Leon Draisaitl', 'C'], ['Kasperi Kapanen', 'RW'], ['Ryan Nugent-Hopkins', 'C'], ['Zach Hyman', 'LW'],
    ['Colton Dach', 'C'], ['Jason Dickinson', 'C'], ['Trent Frederic', 'C'], ['Alex Formenton', 'LW'], ['Owen Michaels', 'RW'], ['Mathieu Joseph', 'RW'], ['Max Jones', 'LW'], ['Filip Hallander', 'C'],
    ['Mattias Ekholm', 'D'], ['Evan Bouchard', 'D'], ['Ryan Shea', 'D'], ['Connor Murphy', 'D'], ['Shakir Mukhamadullin', 'D'], ['Ty Emberson', 'D'], ['Jake Walman', 'D'],
  ].map(([name, pos], i) => ({ id: 100 + i, name, pos, team: 'EDM' }));
  const TWEET = 'The @EdmontonOilers practice in Toronto:\nPodkolzin-McDavid-Draisaitl\nKapanen-RNH-Hyman\nDach-Dickinson-Frederic\nFormenton-Michaels-Joseph\nJones-Hallander\nEkholm-Bouchard\nShea-Murphy\nMuhkamudillin-Emberson\nWalman-Howard*\nLevi\nJarry';

  test('"RNH" is Ryan Nugent-Hopkins and "Muhkamudillin" is Mukhamadullin; a short or shared nickname is nobody', () => {
    const match = rosterMatcher(roster);
    expect(match('RNH', 'F')).toMatchObject({ name: 'Ryan Nugent-Hopkins' });
    expect(match('Muhkamudillin', 'D')).toMatchObject({ name: 'Shakir Mukhamadullin' });
    expect(editDistance('muhkamudillin', 'mukhamadullin')).toBe(3);
    expect(match('CM', 'F')).toBeNull();          // two letters: McDavid or Murphy, never guessed
    expect(match('XYZ', 'F')).toBeNull();
    expect(match('Hymen', 'F')).toBeNull();       // five letters: too short to mend
    expect(match('Hyman', 'F')).toMatchObject({ name: 'Zach Hyman' });
    const two = rosterMatcher([...roster, { id: 999, name: 'Rasmus Nilsson-Hall', pos: 'C', team: 'EDM' }]);
    expect(two('RNH', 'F')).toBeNull();           // two players with those initials
  });
  test('the practice tweet reads whole: Kapanen - Nugent-Hopkins - Hyman', () => {
    const players = Object.values(linesToPlayers(parseLineTweet(TWEET, roster)));
    const at = (pos, line) => players.filter((p) => p.pos === pos && p.line === line).map((p) => p.name);
    expect(at('LW', 2)).toEqual(['Kasperi Kapanen']);
    expect(at('C', 2)).toEqual(['Ryan Nugent-Hopkins']);
    expect(at('RW', 2)).toEqual(['Zach Hyman']);
    expect(players.find((p) => p.name === 'Shakir Mukhamadullin')).toMatchObject({ pos: 'D', line: 3 });
    expect(players.filter((p) => p.id == null)).toEqual([]);
  });
  test('a line read short of its centre: the two wingers keep their slots, they are not placed by their order', () => {
    const P = (name, pos, line, extra = {}) => ({ name, pos, line, ...extra });
    const last = { date: '2026-11-13', players: { kapanen: P('Kapanen', 'LW', 2), rnh: P('Nugent-Hopkins', 'C', 2), hyman: P('Hyman', 'RW', 2), mcdavid: P('McDavid', 'C', 1) } };
    const read = { kapanen: P('Kapanen', 'LW', 2), hyman: P('Hyman', 'C', 2), mcdavid: P('McDavid', 'C', 1) };   // the graphic's "Kapanen Hyman"
    const r = keepKnownSlots(read, last);
    expect(r.kept).toBe(1);
    expect(r.players.hyman).toMatchObject({ pos: 'RW', line: 2, slotKept: true });
    expect(r.players.kapanen).toMatchObject({ pos: 'LW', line: 2 });
    expect(r.players.mcdavid).toEqual(read.mcdavid);                      // a line of one that already sits where it sat
    // two skaters who were not linemates last time: a real change, left as read
    expect(keepKnownSlots({ kapanen: P('Kapanen', 'LW', 2), mcdavid: P('McDavid', 'C', 2) }, last).kept).toBe(0);
    expect(keepKnownSlots(read, null)).toEqual({ players: read, kept: 0 });
    // a whole line is never touched
    const whole = { kapanen: P('Kapanen', 'RW', 2), rnh: P('Nugent-Hopkins', 'C', 2), hyman: P('Hyman', 'LW', 2) };
    expect(keepKnownSlots(whole, last)).toEqual({ players: whole, kept: 0 });
  });
  test('the snapshot: the short line is put back and its centre carried from the last lineup', async () => {
    const DATE = '2026-11-14';
    const ref = { 1: { id: 1, name: 'Kasperi Kapanen', team: 'EDM', pos: 'RW' }, 2: { id: 2, name: 'Ryan Nugent-Hopkins', team: 'EDM', pos: 'C' }, 3: { id: 3, name: 'Zach Hyman', team: 'EDM', pos: 'LW' } };
    mockStored.clear();
    mockStored.set(PLAYERS_PATH, { players: ref });
    mockStored.set(lastLineupPath('EDM'), { date: '2026-11-13', gameId: 1, source: 'gamedaytweets', players: { 'kasperi kapanen': { name: 'Kasperi Kapanen', id: 1, pos: 'LW', line: 2 }, 'ryan nugent hopkins': { name: 'Ryan Nugent-Hopkins', id: 2, pos: 'C', line: 2 }, 'zach hyman': { name: 'Zach Hyman', id: 3, pos: 'RW', line: 2 } } });
    const graphic = { players: { 'kasperi kapanen': { name: 'Kasperi Kapanen', id: 1, pos: 'LW', line: 2 }, 'zach hyman': { name: 'Zach Hyman', id: 3, pos: 'C', line: 2 } }, meta: { handle: 'EdmontonOilers', at: '2026-11-15T00:00:04Z', date: DATE } };
    await snapshotPositions(DATE, [{ id: 31, away: 'EDM', home: 'TOR', state: 'FUT', startTimeUTC: '2026-11-15T00:00:00Z' }], { date: DATE, games: [], gdt: { EDM: graphic } });
    const edm = mockStored.get(positionsPath(DATE)).games[31].teams.EDM;
    expect(edm.players['zach hyman']).toMatchObject({ pos: 'RW', line: 2 });
    expect(edm.players['kasperi kapanen']).toMatchObject({ pos: 'LW', line: 2 });
    expect(edm.players['ryan nugent hopkins']).toMatchObject({ pos: 'C', line: 2, carried: true });
    expect(edm.meta.slotsKept).toBe(1);
  });
});

describe('the snapshot in one line a team, for the lineup job\'s log', () => {
  const { linesSummary } = require('../lib/nhl-data/positions');
  test('the source, each line and pair by last name; an empty slot, a carried skater and an unmatched name marked', () => {
    const P = (name, pos, line, extra = {}) => ({ name, pos, line, id: 1, ...extra });
    const file = { games: { 1: { teams: { EDM: { source: 'lineup', players: {
      a: P('Vasily Podkolzin', 'LW', 1), b: P('Connor McDavid', 'C', 1), c: P('Leon Draisaitl', 'RW', 1),
      d: P('Kasperi Kapanen', 'LW', 2), e: P('Ryan Nugent-Hopkins', 'C', 2, { carried: true }), f: P('Zach Hyman', 'RW', 2, { id: null }),
      g: P('Mattias Ekholm', 'D', 1), h: P('Evan Bouchard', 'D', 1), x: P('Max Jones', 'LW', null, { inLineup: false }),
    } } } } } };
    expect(linesSummary(file).EDM).toBe('lineup · L1 Podkolzin-McDavid-Draisaitl | L2 Kapanen-Nugent-Hopkins~-Hyman! | L3 ?-?-? | L4 ?-?-? | D1 Ekholm-Bouchard | D2 ? | D3 ?');
    expect(linesSummary(null)).toEqual({});
  });
});
