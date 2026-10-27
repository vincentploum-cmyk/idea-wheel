import { describe, expect, test } from '@jest/globals';
import { auditGame, auditDate, owedSides, VERDICT } from '../lib/nhl-data/lineup-audit';

const start = '2026-10-26T23:00:00Z';
const game = {
  id: 1, date: '2026-10-26', startTimeUTC: start, away: { abbrev: 'COL' }, home: { abbrev: 'NYR' },
  skaters: [
    { id: 11, name: 'Cale Makar', team: 'COL', pos: 'D', boxPos: 'D', line: 1, posSource: 'lineup' },
    { id: 12, name: 'Nathan MacKinnon', team: 'COL', pos: 'C', boxPos: 'C', line: 1, posSource: 'lineup' },
    { id: 13, name: 'Jack Drury', team: 'COL', pos: 'C', boxPos: 'C', line: null, posSource: 'box' },
    { id: 21, name: 'Artemi Panarin', team: 'NYR', pos: 'LW', boxPos: 'LW', line: 1, posSource: 'lineup' },
  ],
};
const snapshot = (colSource, colAt, nyr = { source: 'lineup', players: { 'artemi panarin': { pos: 'LW', line: 1 } } }) => ({
  games: { 1: { away: 'COL', home: 'NYR', startTimeUTC: start, teams: {
    COL: { source: colSource, meta: { gdtAt: colAt, handle: 'writer' }, carried: { count: 2 }, players: { 'cale makar': { pos: 'D', line: 1 }, 'nathan mackinnon': { pos: 'C', line: 1 }, 'jack drury': { pos: 'C', line: 3 } } },
    NYR: nyr,
  } } },
});

describe('the lineup audit: which stored games still owe a post-game read', () => {
  test('a tweet from the warm-up window or the game is the final word; a re-stamp pending on a row the snapshot has moved', () => {
    const a = auditGame(game, snapshot('gamedaytweets', '2026-10-26T22:45:00Z'));
    expect(a.teams.COL).toMatchObject({ verdict: VERDICT.settled, tweetMinutes: -15, carried: 2, skaters: 3, fromLineup: 2, withLine: 2, pendingRestamp: 1 }); // Drury: the snapshot has C3, the row is box
    expect(a.teams.NYR).toMatchObject({ verdict: VERDICT.preview, source: 'lineup', tweetMinutes: null, pendingRestamp: 0 });
    expect(auditGame(game, snapshot('gamedaytweets', '2026-10-27T01:30:00Z')).teams.COL.verdict).toBe(VERDICT.settled);   // 2 h 30 in: still the game's
    expect(auditGame(game, snapshot('gamedaytweets', '2026-10-27T03:30:00Z')).teams.COL.verdict).toBe(VERDICT.early);     // past the 4-hour cutoff: not this game's read
  });
  test('an earlier tweet, the depth chart and a missing snapshot are owed a read', () => {
    expect(auditGame(game, snapshot('gamedaytweets', '2026-10-26T15:00:00Z')).teams.COL.verdict).toBe(VERDICT.early);
    expect(auditGame(game, snapshot('propfinder', null)).teams.COL.verdict).toBe(VERDICT.none);
    expect(auditGame(game, snapshot('roster', null)).teams.COL.verdict).toBe(VERDICT.none);
    const none = auditGame(game, { games: {} });
    expect(none.teams.COL).toMatchObject({ verdict: VERDICT.missing, source: null, pendingRestamp: 2 }); // without a snapshot the lineup rows would fall back to the box score
  });
  test('the date summary and the owed list', () => {
    const d = auditDate('2026-10-26', { games: [game] }, snapshot('gamedaytweets', '2026-10-26T22:45:00Z'));
    expect(d.summary).toMatchObject({ games: 1, sides: 2, owed: 1, pendingRestamp: 1, skaters: 4, fromLineup: 3, byVerdict: { settled: 1, preview: 1 } });
    const owed = owedSides([d]);
    expect(owed.map((o) => [o.team, o.verdict, o.pendingRestamp])).toEqual([['COL', 'settled', 1], ['NYR', 'preview', 0]]);
    expect(auditDate('2026-10-26', null, null).summary.games).toBe(0);
  });
});
