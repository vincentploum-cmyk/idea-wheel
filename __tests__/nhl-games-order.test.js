import { describe, expect, test } from '@jest/globals';
import { byStartTime } from '../lib/nhl-data/slate';

// Vincent, 2026-11-14: "sort the games on time. the earliest first".
describe('the night in the order it is played', () => {
  test('the earliest puck drop first, whatever order the store holds them in', () => {
    const games = [
      { id: 2026020311, away: 'NSH', home: 'VGK', startTimeUTC: '2026-11-14T03:00:00Z' },
      { id: 2026020309, away: 'BOS', home: 'TOR', startTimeUTC: '2026-11-14T00:00:00Z' },
      { id: 2026020310, away: 'NYR', home: 'VAN', startTimeUTC: '2026-11-14T02:00:00Z' },
    ];
    expect(byStartTime(games).map((g) => g.home)).toEqual(['TOR', 'VAN', 'VGK']);
    expect(games[0].home).toBe('VGK');   // a new array
  });
  test('the same start: by game id; no start time: after the ones with one, by id', () => {
    const games = [
      { id: 5, home: 'E' }, { id: 4, home: 'D', startTimeUTC: null },
      { id: 3, home: 'C', startTimeUTC: '2026-11-14T00:00:00Z' }, { id: 2, home: 'B', startTimeUTC: '2026-11-14T00:00:00Z' },
      { id: 1, home: 'A', startTimeUTC: '2026-11-14T01:00:00Z' },
    ];
    expect(byStartTime(games).map((g) => g.home)).toEqual(['B', 'C', 'A', 'D', 'E']);
    expect(byStartTime(null)).toEqual([]);
  });
});
