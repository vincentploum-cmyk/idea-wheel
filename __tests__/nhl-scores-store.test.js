import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// The store is mocked: the stored projections live in a Map.
const mockFiles = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (p) => mockFiles.get(p) ?? null,
  writeJson: async (p, v) => { mockFiles.set(p, JSON.parse(JSON.stringify(v))); },
}));
const { stampScores, started, scoresPath } = require('../lib/nhl-data/scores-store');

const proj = (a, h) => ({ exp: { AWAY: a, HOME: h }, total: a + h, win: { AWAY: 0.45, HOME: 0.55 }, headline: `AWAY ${a} – ${h} HOME`, title: 't', parts: {} });
const now = Date.parse('2026-10-31T22:00:00Z');

describe('the stored pre-game projections', () => {
  beforeEach(() => mockFiles.clear());
  test('started: by the start time, else by the date', () => {
    expect(started({ startTimeUTC: '2026-10-31T23:00:00Z' }, '2026-10-31', now)).toBe(false);
    expect(started({ startTimeUTC: '2026-10-31T21:00:00Z' }, '2026-10-31', now)).toBe(true);
    expect(started({}, '2026-10-30', now, '2026-10-31')).toBe(true);
    expect(started({}, '2026-10-31', now, '2026-10-31')).toBe(false);
    expect(started({}, '2026-10-31', now)).toBe(false);
  });
  test('the games still to start are stored, a started or final game keeps its earlier entry, nothing written without a change', async () => {
    const board = { games: [
      { id: 1, away: 'AWAY', home: 'HOME', startTimeUTC: '2026-10-31T23:00:00Z', projected: proj(2.8, 3.1) },
      { id: 2, away: 'AWAY', home: 'HOME', startTimeUTC: '2026-10-31T21:00:00Z', projected: proj(3.0, 3.0) },
      { id: 3, away: 'AWAY', home: 'HOME', startTimeUTC: '2026-10-31T23:30:00Z', projected: null },
    ] };
    const first = await stampScores('2026-10-31', board, { now, today: '2026-10-31' });
    expect(first).toEqual({ date: '2026-10-31', stored: 1, kept: 0, skipped: 2 });
    const file = mockFiles.get(scoresPath('2026-10-31'));
    expect(Object.keys(file.games)).toEqual(['1']);
    expect(file.games[1]).toMatchObject({ at: '2026-10-31T22:00:00.000Z', away: 'AWAY', home: 'HOME', exp: { AWAY: 2.8, HOME: 3.1 }, total: 5.9, headline: 'AWAY 2.8 – 3.1 HOME' });
    // An hour later game 1 is under way: its entry stays as stored, a new projection for it is not written.
    const later = now + 90 * 60 * 1000;
    const second = await stampScores('2026-10-31', { games: [{ ...board.games[0], projected: proj(2.9, 3.0) }] }, { now: later, today: '2026-10-31' });
    expect(second).toEqual({ date: '2026-10-31', stored: 0, kept: 1, skipped: 0 });
    expect(mockFiles.get(scoresPath('2026-10-31')).games[1].exp).toEqual({ AWAY: 2.8, HOME: 3.1 });
    // Before the start the newest projection replaces the stored one.
    const third = await stampScores('2026-10-31', { games: [{ ...board.games[0], projected: proj(2.7, 3.2) }] }, { now: now + 60 * 1000, today: '2026-10-31' });
    expect(third.stored).toBe(1);
    expect(mockFiles.get(scoresPath('2026-10-31')).games[1].exp).toEqual({ AWAY: 2.7, HOME: 3.2 });
  });
});
