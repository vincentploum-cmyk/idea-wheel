import { describe, expect, test } from '@jest/globals';
import { sogLinesOf, goalLineOf, skaterPropsOf, skaterPropFor, skaterPropsPath } from '../lib/nhl-data/skater-props';

// PropFinder's prop items in the NBA pull's shape (one item per book and side) and the older shape, on skaters.
const item = (market, points, side, price, sportsbook = 'DraftKings', extra = {}) => ({ market, categoryMapping: 'Skater', sportsbook, selectionLine: side, points, price, ...extra });
const mcdavid = {
  id: 'pf-97', name: 'Connor McDavid', positionGroup: 'F', positionAbbreviation: 'C', team: { abbreviation: 'EDM' },
  odds: [
    item('Player Shots on Goal', 2.5, 'over', -140, 'DraftKings', { isMain: true }), item('Player Shots on Goal', 2.5, 'under', +110, 'DraftKings', { isMain: true }),
    item('Player Shots on Goal', 2.5, 'over', -135, 'FanDuel', { isMain: true }),
    item('Player Shots on Goal', 3.5, 'over', +115, 'DraftKings'), item('Player Shots on Goal', 3.5, 'under', -145, 'DraftKings'),
    item('Player Shots on Goal', 4.5, 'over', +260, 'DraftKings'),
    item('1st Period Shots on Goal', 0.5, 'over', -200, 'DraftKings', { isMain: true }),
    item('Player Blocked Shots', 0.5, 'over', -120, 'DraftKings', { isMain: true }),
    { market: 'Anytime Goal Scorer', categoryMapping: 'Skater', sportsbook: 'DraftKings', selectionLine: 'yes', price: -105, isMain: true },
    { market: 'Anytime Goal Scorer', categoryMapping: 'Skater', sportsbook: 'FanDuel', selectionLine: 'yes', price: +100 },
    { market: 'First Goal Scorer', categoryMapping: 'Skater', sportsbook: 'DraftKings', selectionLine: 'yes', price: +650 },
    item('Player Goals', 1.5, 'over', +340, 'DraftKings'),
    item('Player Points', 0.5, 'over', -250, 'DraftKings', { isMain: true }),
  ],
};
const legacy = { id: 'pf-29', name: 'Leon Draisaitl', position: 'C', team: { code: 'EDM' }, props: [{ market: 'Shots On Goal', line: 3.5, overOdds: -105, underOdds: -115, book: 'BetMGM' }, { market: 'Anytime Goalscorer', overOdds: +120, book: 'BetMGM' }] };
const unpriced = { id: 'pf-3', name: 'Mattias Janmark', positionGroup: 'F', team: { abbreviation: 'EDM' }, odds: [item('Player Blocked Shots', 0.5, 'over', -120)] };
const goalie = { id: 'pf-4', name: 'Stuart Skinner', positionGroup: 'G', positionAbbreviation: 'G', team: { abbreviation: 'EDM' }, odds: [item('Player Saves', 27.5, 'over', -115), item('Player Shots on Goal', 2.5, 'over', -115)] };

describe('the skaters’ lines off PropFinder’s players', () => {
  test('sogLinesOf: the main line nearest a coin flip, the best price a side, the ladder; a period’s shots and blocked shots left out', () => {
    const l = sogLinesOf(mcdavid);
    expect(l).toMatchObject({ line: 2.5, odds: -135, underOdds: 110, book: 'FanDuel', books: 2, isMain: true, implied: 0.574 });
    expect(l.lines).toEqual([{ line: 2.5, odds: -135, underOdds: 110, books: 2, main: true }, { line: 3.5, odds: 115, underOdds: -145, books: 1, main: false }, { line: 4.5, odds: 260, underOdds: null, books: 1, main: false }]);
    expect(sogLinesOf(legacy)).toMatchObject({ line: 3.5, odds: -105, underOdds: -115, book: 'BetMGM', implied: 0.512 });
    expect(sogLinesOf(unpriced)).toBeNull();
  });
  test('goalLineOf: the anytime price, the best of the books; the first scorer, 2+ goals and points left out', () => {
    expect(goalLineOf(mcdavid)).toMatchObject({ line: 0.5, odds: 100, implied: 0.5, books: 2 });
    expect(goalLineOf(mcdavid).lines.map((x) => x.line)).toEqual([0.5, 1.5]);
    expect(goalLineOf(legacy)).toMatchObject({ line: 0.5, odds: 120, implied: 0.455 });
    expect(goalLineOf(unpriced)).toBeNull();
    expect(goalLineOf({ name: 'x', odds: [{ market: 'First Goal Scorer', selectionLine: 'yes', price: 650, sportsbook: 'DK' }] })).toBeNull();
  });
  test('skaterPropsOf: the skaters with a price, keyed and with their team; the goalies and the unpriced left out; a raw sample', () => {
    const got = skaterPropsOf([goalie, mcdavid, legacy, unpriced], { teamOf: (p) => p.team?.abbreviation || p.team?.code });
    expect(got.skaters.map((s) => [s.name, s.key, s.team, s.pos, s.sog?.line, s.goal?.odds])).toEqual([['Connor McDavid', 'connor mcdavid', 'EDM', 'C', 2.5, 100], ['Leon Draisaitl', 'leon draisaitl', 'EDM', 'C', 3.5, 120]]);
    expect(got.withSog).toBe(2); expect(got.withGoal).toBe(2);
    expect(got.sample).toMatchObject({ name: 'Connor McDavid' });
    expect(got.sample.items).toHaveLength(8);
  });
  test('skaterPropFor: by name, the NHL spelling against PropFinder’s; the surname on the team as the fallback; the file path per slate', () => {
    const props = skaterPropsOf([mcdavid, legacy], { teamOf: (p) => p.team?.abbreviation || p.team?.code });
    expect(skaterPropFor(props, 'Connor McDavid', 'EDM')).toMatchObject({ name: 'Connor McDavid', sog: { line: 2.5 }, goal: { odds: 100 } });
    expect(skaterPropFor(props, 'L. Draisaitl', 'EDM')).toMatchObject({ name: 'Leon Draisaitl' });
    expect(skaterPropFor(props, 'Connor McDavid', 'CGY')).toBeNull();
    expect(skaterPropFor(props, 'Zach Hyman', 'EDM')).toBeNull();
    expect(skaterPropFor(null, 'Connor McDavid', 'EDM')).toBeNull();
    expect(skaterPropsPath('2026-10-31')).toBe('data/propfinder/skater-props/2026-10-31.json');
  });
});
