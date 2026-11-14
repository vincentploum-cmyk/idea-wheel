import { describe, expect, test, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Vincent, 2026-11-14: a fallback for the lines when no beat writer has tweeted and NHL.com has no projected lineup.
// RotoWire's lineups page carries no lines; Daily Faceoff's line combinations do (the page as served 2026-11-14).
const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (p) => mockStored.get(p) ?? null,
  writeJson: async (p, v) => { mockStored.set(p, v); },
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { parseLineCombinations, dfUsable, mergeDf, dfSummary, dfUrl, DF_SLUGS, DF_MAX_AGE_DAYS } = require('../lib/nhl-data/dailyfaceoff');
const { snapshotPositions, positionsPath, lineupToRemember } = require('../lib/nhl-data/positions');
const { PLAYERS_PATH } = require('../lib/nhl-data/rosters');
const { PF_DEPTH_PATH } = require('../lib/nhl-data/propfinder-api');
const { lineupRead, lineupVerdict, VERDICT } = require('../lib/nhl-data/lineup-read');
const { OWED } = require('../lib/nhl-data/lineup-audit');
const { pageFor } = require('../lib/nhl-data/rotowire');

const html = fs.readFileSync(path.join(__dirname, 'fixtures/dailyfaceoff-vgk.html'), 'utf8');
const read = parseLineCombinations(html);

describe('the page', () => {
  test('the even-strength lines and pairs, when they were set and whose report they follow', () => {
    expect(read.team).toBe('VGK');
    expect(read.at).toBe('2026-11-14T02:38:15.679Z');
    expect(read.by).toBe('Jesse Granger');
    expect(read.url).toMatch(/^https:\/\/x\.com\/JesseGranger_\/status\//);
    const list = Object.values(read.players);
    expect(list).toHaveLength(18);                                            // twelve forwards, six defensemen: no goalies, no power-play or kill rows
    expect(list.filter((p) => p.pos === 'D')).toHaveLength(6);
    expect(read.players['jack eichel']).toEqual({ name: 'Jack Eichel', pos: 'C', line: 1 });
    expect(read.players['mitch marner']).toEqual({ name: 'Mitch Marner', pos: 'RW', line: 2 });
    expect(read.players['tomas hertl']).toEqual({ name: 'Tomas Hertl', pos: 'C', line: 3 });
    expect(read.players['braeden bowman']).toEqual({ name: 'Braeden Bowman', pos: 'LW', line: 4 });
    expect(read.players['shea theodore']).toEqual({ name: 'Shea Theodore', pos: 'D', line: 1 });
    expect(read.players['adin hill']).toBeUndefined();
    for (const n of [1, 2, 3, 4]) expect(list.filter((p) => p.pos !== 'D' && p.line === n).map((p) => p.pos).sort()).toEqual(['C', 'LW', 'RW']);
  });
  test('no line combinations on the page: null', () => {
    expect(parseLineCombinations('<html>Just a moment...</html>')).toBeNull();
    expect(parseLineCombinations('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>')).toBeNull();
    expect(parseLineCombinations('<script id="__NEXT_DATA__" type="application/json">not json</script>')).toBeNull();
    expect(parseLineCombinations(null)).toBeNull();
  });
  test('every team has a page', () => {
    expect(Object.keys(DF_SLUGS)).toHaveLength(32);
    expect(dfUrl('VGK')).toBe('https://www.dailyfaceoff.com/teams/vegas-golden-knights/line-combinations');
    expect(dfUrl('MTL')).toMatch(/montreal-canadiens/);
    expect(dfUrl('XXX')).toBeNull();
  });
});

describe('when a stored read may stand for a game', () => {
  const entry = (date) => ({ players: read.players, meta: { at: `${date}T15:00:00Z`, date } });
  test('set on the game day or up to five days before it; never after it', () => {
    expect(DF_MAX_AGE_DAYS).toBe(5);
    expect(dfUsable(entry('2026-11-14'), '2026-11-14')).toBe(true);
    expect(dfUsable(entry('2026-11-09'), '2026-11-14')).toBe(true);
    expect(dfUsable(entry('2026-11-08'), '2026-11-14')).toBe(false);   // nobody has touched the chart in six days
    expect(dfUsable(entry('2026-11-15'), '2026-11-14')).toBe(false);   // set after the game: a later game's lines
    expect(dfUsable({ error: '403' }, '2026-11-14')).toBe(false);
    expect(dfUsable(null, '2026-11-14')).toBe(false);
  });
  test('a failed read keeps what was stored; the summary says whether the server is served', () => {
    const kept = mergeDf({ VGK: entry('2026-11-14') }, { VGK: { error: '403 https://www.dailyfaceoff.com/x' }, NSH: { none: true } });
    expect(kept.VGK.players).toBeTruthy();
    expect(kept.NSH).toEqual({ none: true });
    expect(mergeDf({ VGK: { error: 'old' } }, { VGK: entry('2026-11-14') }).VGK.players).toBeTruthy();
    expect(dfSummary({ VGK: entry('2026-11-14'), NSH: { none: true }, NYR: { error: '403 https://www.dailyfaceoff.com/x' }, VAN: { error: '403 https://www.dailyfaceoff.com/y' } })).toEqual({ asked: 4, withLines: 1, none: 1, errors: ['403'] });
  });
});

describe('the snapshot: behind the tweets and NHL.com, ahead of PropFinder\'s depth chart', () => {
  const DATE = '2026-11-14';
  const schedule = [{ id: 7, away: 'NSH', home: 'VGK', state: 'FUT', startTimeUTC: '2026-11-15T03:00:00Z' }];
  const players = { 1: { id: 1, name: 'Jack Eichel', team: 'VGK', pos: 'C' }, 2: { id: 2, name: 'Mitch Marner', team: 'VGK', pos: 'RW' }, 3: { id: 3, name: 'Filip Forsberg', team: 'NSH', pos: 'LW' } };
  const df = { VGK: { players: read.players, meta: { at: '2026-11-14T02:38:15.679Z', date: '2026-11-13', by: 'Jesse Granger', url: 'https://x.com/p', page: dfUrl('VGK'), fetchedAt: '2026-11-14T20:00:00Z' } } };
  const depth = { at: '2026-11-14T12:00:00Z', date: DATE, teams: { VGK: { players: { 'jack eichel': { name: 'Jack Eichel', id: 1, pos: 'C', line: 2 } } }, NSH: { players: { 'filip forsberg': { name: 'Filip Forsberg', id: 3, pos: 'LW', line: 1 } } } } };
  const tweet = (at, date) => ({ players: { 'jack eichel': { name: 'Jack Eichel', id: 1, pos: 'C', line: 3 } }, meta: { handle: 'writer', at, date } });
  const snap = async (lineups) => {
    mockStored.clear(); mockStored.set(PLAYERS_PATH, { players }); mockStored.set(PF_DEPTH_PATH, depth);
    await snapshotPositions(DATE, schedule, { date: DATE, games: [], ...lineups });
    return mockStored.get(positionsPath(DATE)).games[7].teams;
  };

  test('no tweet, no NHL.com lineup: Daily Faceoff\'s lines, with the roster\'s ids; the other team stays on PropFinder', async () => {
    const t = await snap({ gdt: {}, df });
    expect(t.VGK.source).toBe('dailyfaceoff');
    expect(t.VGK.players['jack eichel']).toMatchObject({ id: 1, pos: 'C', line: 1 });
    expect(t.VGK.players['mitch marner']).toMatchObject({ id: 2, pos: 'RW', line: 2 });
    expect(t.VGK.meta).toMatchObject({ dfAt: '2026-11-14T02:38:15.679Z', dfBy: 'Jesse Granger', dfUrl: 'https://x.com/p' });
    expect(t.NSH.source).toBe('propfinder');
    expect(lineupToRemember(t.VGK, DATE, 7)?.source).toBe('dailyfaceoff');   // kept as the team's last known lineup
  });
  test('a game-day tweet wins; an older tweet wins only when it is newer than the page', async () => {
    expect((await snap({ gdt: { VGK: tweet('2026-11-14T18:00:00Z', DATE) }, df })).VGK.source).toBe('gamedaytweets');
    const older = await snap({ gdt: { VGK: tweet('2026-11-12T18:00:00Z', '2026-11-12') }, df });
    expect(older.VGK.source).toBe('dailyfaceoff');
    expect(older.VGK.players['jack eichel'].line).toBe(1);
    const newer = await snap({ gdt: { VGK: tweet('2026-11-14T03:30:00Z', '2026-11-13') }, df });
    expect(newer.VGK.source).toBe('gamedaytweets');
  });
  test('a chart nobody has touched for six days is not used', async () => {
    const stale = { VGK: { ...df.VGK, meta: { ...df.VGK.meta, at: '2026-11-08T15:00:00Z', date: '2026-11-08' } } };
    expect((await snap({ gdt: {}, df: stale })).VGK.source).toBe('propfinder');
  });
});

describe('the rink\'s pill', () => {
  const side = { source: 'dailyfaceoff', sourceMeta: { dfAt: '2026-11-14T02:38:15.679Z', dfBy: 'Jesse Granger', dfUrl: 'https://x.com/p', capturedAt: '2026-11-14T20:00:00Z' }, carried: null };
  test('amber "Daily Faceoff", when it was set and whose report, projected; owed a better read', () => {
    const r = lineupRead(side, '2026-11-15T03:00:00Z');
    expect(lineupVerdict({ source: 'dailyfaceoff', meta: {} }, null).verdict).toBe(VERDICT.dailyfaceoff);
    expect(r).toMatchObject({ verdict: 'daily-faceoff', tone: 'warn', label: 'Daily Faceoff', url: 'https://x.com/p' });
    expect(r.note).toBe('updated Nov 13, 9:38 PM ET · via Jesse Granger · projected');
    expect(r.title).toMatch(/no beat-writer tweet and no NHL\.com projected lineup yet/);
    expect(OWED.has(VERDICT.dailyfaceoff)).toBe(true);
  });
  test('the guess is still the guess', () => {
    expect(lineupRead({ source: 'propfinder', sourceMeta: {} }, null)).toMatchObject({ tone: 'bad', label: 'A guess' });
  });
});

describe('RotoWire: tonight\'s page, else tomorrow\'s', () => {
  const today = { date: '2026-11-14', games: [1] }; const tomorrow = { date: '2026-11-15', games: [1] };
  test('the page whose date is the one asked', () => {
    expect(pageFor('2026-11-14', today, tomorrow)).toEqual({ read: today, page: 'today' });
    expect(pageFor('2026-11-15', today, tomorrow)).toEqual({ read: tomorrow, page: 'tomorrow' });
    expect(pageFor('2026-11-13', today, tomorrow)).toBeNull();          // RotoWire's day has turned: nothing for last night
    expect(pageFor('2026-11-14', { games: [1] }, null)).toEqual({ read: { games: [1] }, page: 'today' });   // a page without a date in its head is taken as today's, as before
    expect(pageFor('2026-11-15', null, null)).toBeNull();
  });
});
