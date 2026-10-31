import { describe, expect, test } from '@jest/globals';
import { lineupRead, lineupVerdict, minutesWord, VERDICT } from '../lib/nhl-data/lineup-read';

const start = '2026-10-31T23:00:00Z'; // 7:00 PM ET
const side = (source, meta = {}, carried = null) => ({ source, sourceMeta: { handle: 'writer', url: 'https://x.com/writer/status/1', ...meta }, carried });

describe('the rink pill: where the lines came from', () => {
  test('a tweet from the warm-up window or the game is the writers’ final word (green)', () => {
    const r = lineupRead(side('gamedaytweets', { gdtAt: '2026-10-31T22:42:00Z', at: '2026-10-31T22:42:00Z' }), start);
    expect(r).toMatchObject({ verdict: VERDICT.settled, tone: 'ok', label: 'GameDayTweets @writer', note: '6:42 PM ET · 18 min before puck drop', url: 'https://x.com/writer/status/1', tweetMinutes: -18, finalWord: true });
    expect(r.title).toMatch(/warm-up or game lines/);
    const during = lineupRead(side('gamedaytweets', { gdtAt: '2026-11-01T00:35:00Z' }), start);
    expect(during).toMatchObject({ verdict: VERDICT.settled, note: '8:35 PM ET · 1 h 35 into the game' });
    const confirmed = lineupRead(side('gamedaytweets', { gdtAt: '2026-10-31T22:00:00Z', gdtConfirmed: true }), start);
    expect(confirmed.confirmed).toBe(true);
    expect(confirmed.title).toMatch(/same lineup/);
  });
  test('an earlier tweet is projected lines (amber), with its distance from puck drop', () => {
    const r = lineupRead(side('gamedaytweets', { gdtAt: '2026-10-31T18:10:00Z' }), start);
    expect(r).toMatchObject({ verdict: VERDICT.early, tone: 'warn', label: 'GameDayTweets @writer', note: '2:10 PM ET · 4 h 50 before puck drop · projected', tweetMinutes: -290, finalWord: false });
    // Past the four-hour cutoff: not this game's read.
    expect(lineupRead(side('gamedaytweets', { gdtAt: '2026-11-01T03:30:00Z' }), start).verdict).toBe(VERDICT.early);
    // A tweet without a time: the date alone.
    expect(lineupRead(side('gamedaytweets', { date: '2026-10-31' }), start)).toMatchObject({ verdict: VERDICT.early, note: '2026-10-31 · projected', tweetMinutes: null });
    // Without the game's start the window cannot be read: an earlier tweet at best.
    expect(lineupRead(side('gamedaytweets', { gdtAt: '2026-10-31T22:42:00Z' }), null).verdict).toBe(VERDICT.early);
  });
  test('the NHL.com preview (amber) names its update and any older tweet', () => {
    const r = lineupRead(side('lineup', { nhlUpdated: '2026-10-31T21:30:00Z', gdtAt: '2026-10-31T14:00:00Z' }), start);
    expect(r).toMatchObject({ verdict: VERDICT.preview, tone: 'warn', label: 'NHL.com projected', note: 'updated 5:30 PM ET · older tweet @writer 10:00 AM ET' });
    expect(lineupRead({ source: 'lineup', sourceMeta: { nhlUpdated: '2026-10-31T21:30:00Z' } }, start).note).toBe('updated 5:30 PM ET');
  });
  test('the depth chart, the roster and the last known lineup are a guess (red)', () => {
    expect(lineupRead({ source: 'propfinder', sourceMeta: { pfAt: '2026-10-31T13:17:00Z' } }, start)).toMatchObject({ verdict: VERDICT.none, tone: 'bad', label: 'A guess', note: 'PropFinder’s depth chart, pulled 9:17 AM ET' });
    expect(lineupRead({ source: 'roster', sourceMeta: null, carried: { count: 18, date: '2026-10-29' } }, start)).toMatchObject({ tone: 'bad', note: 'the last known lineup (2026-10-29)' });
    expect(lineupRead({ source: 'roster', sourceMeta: { capturedAt: '2026-10-31T20:00:00Z' } }, start)).toMatchObject({ tone: 'bad', note: 'the roster, by projected shots' });
    expect(lineupRead({ source: 'roster', sourceMeta: { capturedAt: '2026-10-31T20:00:00Z' } }, start).title).toMatch(/last checked 4:00 PM ET/);
    expect(lineupRead(null, start)).toMatchObject({ verdict: VERDICT.missing, tone: 'bad' });
  });
  test('carried slots ride on the note of a tweet or preview read', () => {
    const r = lineupRead({ source: 'lineup', sourceMeta: { nhlUpdated: '2026-10-31T21:30:00Z' }, carried: { count: 3, date: '2026-10-29' } }, start);
    expect(r.note).toBe('updated 5:30 PM ET · 3 slots carried from the last known lineup (2026-10-29)');
    expect(r.title).toMatch(/3 slots carried/);
    expect(lineupRead({ source: 'lineup', sourceMeta: {}, carried: { count: 1 } }, start).note).toBe('1 slot carried from the last known lineup');
    // An older tweet beside the preview, then the carried slots.
    expect(lineupRead(side('lineup', { nhlUpdated: '2026-10-31T21:30:00Z' }, { count: 2 }), start).note).toBe('updated 5:30 PM ET · older tweet @writer · 2 slots carried from the last known lineup');
  });
  test('the verdict rule and the minutes words', () => {
    expect(lineupVerdict({ source: 'gamedaytweets', meta: { gdtAt: '2026-10-31T21:30:00Z' } }, start)).toEqual({ verdict: VERDICT.settled, tweetMinutes: -90, finalWord: true });
    expect(lineupVerdict({ source: 'gamedaytweets', meta: { gdtAt: '2026-10-31T21:29:00Z' } }, start).verdict).toBe(VERDICT.early);
    expect(lineupVerdict(null, start).verdict).toBe(VERDICT.missing);
    expect(minutesWord(-5)).toBe('5 min before puck drop');
    expect(minutesWord(0)).toBe('0 min before puck drop');
    expect(minutesWord(-120)).toBe('2 h before puck drop');
    expect(minutesWord(45)).toBe('45 min into the game');
    expect(minutesWord(300)).toBe('5 h after puck drop');
    expect(minutesWord(null)).toBeNull();
  });
});
