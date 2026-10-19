import { describe, expect, test } from '@jest/globals';
import { marketFromText, groupOf, statFields, MARKETS, GROUPS } from '../lib/nfl/markets';
import { teamAbbrFromText, parseMatchup, teamLogo } from '../lib/nfl/teams';
import { parseOdds, impliedProb, fairOdds, parseRate, parseNumber } from '../lib/nfl/odds';

describe('NFL markets', () => {
  test('every spelling a sheet or PropFinder uses lands on one key', () => {
    expect(marketFromText('Receiving Yards')).toBe('rec_yds');
    expect(marketFromText('Rec Yds O/U')).toBe('rec_yds');
    expect(marketFromText('player_reception_yds')).toBe('rec_yds');
    expect(marketFromText('Receptions')).toBe('receptions');
    expect(marketFromText('Passing Yards')).toBe('pass_yds');
    expect(marketFromText('Pass TDs')).toBe('pass_td');
    expect(marketFromText('Passing Touchdowns')).toBe('pass_td');
    expect(marketFromText('Rushing Yards')).toBe('rush_yds');
    expect(marketFromText('Rush Attempts')).toBe('rush_att');
    expect(marketFromText('Carries')).toBe('rush_att');
    expect(marketFromText('Anytime Touchdown Scorer')).toBe('anytime_td');
    expect(marketFromText('Anytime TD')).toBe('anytime_td');
    expect(marketFromText('1st TD Scorer')).toBe('first_td');
    expect(marketFromText('Receiving Touchdowns')).toBe('rec_td');
    expect(marketFromText('Rush + Rec Yards')).toBe('rush_rec_yds');
    expect(marketFromText('Longest Reception')).toBe('rec_long');
    expect(marketFromText('TD')).toBe('anytime_td');
    expect(marketFromText('Hit Rate')).toBeNull();
    expect(marketFromText('')).toBeNull();
  });
  test('groups and the box-score fields each market settles on', () => {
    expect(GROUPS.map(([k]) => k)).toEqual(['touchdowns', 'passing', 'rushing', 'receiving']);
    expect(groupOf('anytime_td')).toBe('touchdowns');
    expect(groupOf('pass_td')).toBe('passing');
    expect(statFields('anytime_td')).toEqual(['rushTd', 'recTd', 'retTd']);
    expect(statFields('rush_rec_yds')).toEqual(['rushYds', 'recYds']);
    expect(statFields('receptions')).toEqual(['rec']);
    for (const m of Object.values(MARKETS)) expect(m.floor).toBeGreaterThan(0);
  });
});

describe('NFL teams', () => {
  test('ESPN, PropFinder and sheet spellings map to one abbreviation', () => {
    expect(teamAbbrFromText('WAS')).toBe('WSH');
    expect(teamAbbrFromText('Washington Commanders')).toBe('WSH');
    expect(teamAbbrFromText('JAC')).toBe('JAX');
    expect(teamAbbrFromText('LA Rams')).toBe('LAR');
    expect(teamAbbrFromText('@ KC')).toBe('KC');
    expect(teamAbbrFromText('49ers')).toBe('SF');
    expect(teamAbbrFromText('Green Bay')).toBe('GB');
    expect(teamAbbrFromText('Nowhere FC')).toBeNull();
    expect(teamLogo('SF')).toMatch(/sf\.png$/);
  });
  test('matchup cells give the venue', () => {
    expect(parseMatchup('DAL @ PHI')).toEqual({ away: 'DAL', home: 'PHI' });
    expect(parseMatchup('PHI vs DAL')).toEqual({ away: 'DAL', home: 'PHI' });
    expect(parseMatchup('@ PHI', 'DAL')).toEqual({ away: 'DAL', home: 'PHI' });
    expect(parseMatchup('vs DAL', 'PHI')).toEqual({ away: 'DAL', home: 'PHI' });
    expect(parseMatchup('PHI', 'DAL')).toBeNull();
  });
});

describe('NFL odds and rates', () => {
  test('prices', () => {
    expect(parseOdds('+120')).toBe(120);
    expect(parseOdds('-110')).toBe(-110);
    expect(parseOdds('−115')).toBe(-115);
    expect(parseOdds(1.91)).toBe(-110);
    expect(parseOdds('2.50')).toBe(150);
    expect(parseOdds('')).toBeNull();
    expect(parseOdds('N/A')).toBeNull();
    expect(impliedProb(-110)).toBeCloseTo(0.524, 3);
    expect(impliedProb(150)).toBeCloseTo(0.4, 3);
    expect(fairOdds(0.6)).toBe('-150');
    expect(fairOdds(0.4)).toBe('+150');
  });
  test('hit rates in every printed form', () => {
    expect(parseRate('7/10')).toEqual({ rate: 0.7, n: 10 });
    expect(parseRate('70%')).toEqual({ rate: 0.7, n: null });
    expect(parseRate(0.7)).toEqual({ rate: 0.7, n: null });
    expect(parseRate('70')).toEqual({ rate: 0.7, n: null });
    expect(parseRate('7 of 10')).toEqual({ rate: 0.7, n: 10 });
    expect(parseRate('80% (4/5)')).toEqual({ rate: 0.8, n: 5 });
    expect(parseRate('Josh')).toBeNull();
    expect(parseNumber('o245.5')).toBe(245.5);
    expect(parseNumber('245,5')).toBe(245.5);
  });
});
