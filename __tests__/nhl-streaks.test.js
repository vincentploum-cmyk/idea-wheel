import { describe, expect, test } from '@jest/globals';
import { skaterStreaks, seasonStart } from '../lib/nhl-data/streaks';

const row = (date, gameId, playerId, name, team, opp, venue, pos, g, a, sog, line = 1) => ({ date, gameId, playerId, name, team, opp, venue, pos, g, a, sog, line });
const rows = [
  // Connor: goals in his last three, points in all four, 3+ SOG in all four.
  row('2026-10-01', 1, 1, 'Kyle Connor', 'WPG', 'DAL', 'H', 'LW', 0, 1, 5),
  row('2026-10-04', 2, 1, 'Kyle Connor', 'WPG', 'LAK', 'A', 'LW', 1, 0, 4),
  row('2026-10-08', 3, 1, 'Kyle Connor', 'WPG', 'VGK', 'H', 'LW', 2, 0, 6),
  row('2026-10-11', 4, 1, 'Kyle Connor', 'WPG', 'MIN', 'H', 'LW', 1, 1, 3),
  // Hagel: scored in game one only; blanked in game two; an assist in game three; shots fall off.
  row('2026-10-01', 5, 2, 'Brandon Hagel', 'TBL', 'BOS', 'A', 'LW', 1, 0, 3, 2),
  row('2026-10-05', 6, 2, 'Brandon Hagel', 'TBL', 'MTL', 'H', 'LW', 0, 0, 2, 2),
  row('2026-10-09', 7, 2, 'Brandon Hagel', 'TBL', 'DET', 'H', 'LW', 0, 1, 1, 2),
  // A quiet skater, and last season's games that never count.
  row('2026-10-01', 1, 3, 'Neal Pionk', 'WPG', 'DAL', 'H', 'D', 0, 0, 1),
  row('2026-04-10', 9, 3, 'Neal Pionk', 'WPG', 'CHI', 'H', 'D', 1, 0, 3),
  row('2026-04-12', 10, 3, 'Neal Pionk', 'WPG', 'STL', 'A', 'D', 1, 0, 3),
];

describe('skater streaks', () => {
  test('the season starts the previous July', () => {
    expect(seasonStart('2026-10-13')).toBe('2026-07-01');
    expect(seasonStart('2027-03-01')).toBe('2026-07-01');
  });
  test('counts current goal, point and 3+ SOG streaks from this season only, with tonight\'s opponent', () => {
    const s = skaterStreaks(rows, { date: '2026-10-13', games: [{ away: 'MIN', home: 'WPG' }] });
    expect(s.map((p) => p.name)).toEqual(['Kyle Connor']); // Hagel's one goal and one-game point run fall under the floors; Pionk's streak was last season
    const c = s[0];
    expect(c).toMatchObject({ team: 'WPG', pos: 'LW', line: 1, gp: 4, goals: { streak: 3, l5: 4, l10: 4 }, points: { streak: 4, l5: 6 }, sog3: { streak: 4, l5: 18 } });
    expect(c.last).toMatchObject({ date: '2026-10-11', opp: 'MIN', g: 1, a: 1, sog: 3 });
    expect(c.tonight).toEqual({ opp: 'MIN', venue: 'H' });
  });
  test('lower floors bring in a skater on goals over his last five, sorted by goal streak then those goals', () => {
    const s = skaterStreaks(rows, { date: '2026-10-13', min: { goals: 9, points: 9, sog3: 9, goalsL5: 1 } });
    expect(s.map((p) => p.name)).toEqual(['Kyle Connor', 'Brandon Hagel']);
    expect(s[1]).toMatchObject({ goals: { streak: 0, l5: 1 }, points: { streak: 1 }, sog3: { streak: 0 }, tonight: null });
  });
});
