// The players' odds from the five sportsbooks, both sides (Vincent, 2026-11-24: "fix the fact that we are actually pulling AND
// using the propfinder data for our predictions"): the players call carried no `sportsbooks=` and its odds came back as one
// pick'em product's overs (DraftKings Pick 6 on the pull of 2026-11-08), no under and no sportsbook.
import { describe, expect, test } from '@jest/globals';
import { playerProps } from '../lib/nba/propfinder-nba';
import { isDfsBook } from '../lib/picks/propfinder';

const item = (book, side, price, points, extra = {}) => ({ market: 'Player Points', categoryMapping: 'points', sportsbook: book, selectionLine: side, price, points, isMain: true, ...extra });

describe('the players odds: sportsbooks first, both sides, the vig out', () => {
  test('a pick’em product is told from a sportsbook', () => {
    expect(isDfsBook('DraftKings (Pick 6)')).toBe(true);
    expect(isDfsBook('PrizePicks')).toBe(true);
    expect(isDfsBook('Underdog')).toBe(true);
    expect(isDfsBook('DraftKings')).toBe(false);
    expect(isDfsBook('FanDuel')).toBe(false);
  });

  test('the best price each side across the books, the no-vig chance from each book’s own pair', () => {
    const p = { odds: [
      item('DraftKings', 'over', -115, 24.5), item('DraftKings', 'under', -105, 24.5),
      item('FanDuel', 'over', -108, 24.5), item('FanDuel', 'under', -112, 24.5),
      item('DraftKings (Pick 6)', 'over', -165, 24.5),
    ] };
    const [row] = playerProps(p);
    expect(row).toMatchObject({ market: 'pts', line: 24.5, odds: -108, underOdds: -105, books: 2, book: 'FanDuel', underBook: 'DraftKings', fairBooks: 2 });
    expect(row.dfs).toBeUndefined();
    // DraftKings 53.5 / 51.2 → 51.1%; FanDuel 51.9 / 52.8 → 49.6%: 50.4% on the mean.
    expect(row.fair).toBeCloseTo(0.504, 2);
    expect(row.hold).toBeGreaterThan(0.03);
  });

  test('a line only a pick’em product lists keeps its price, flagged, and loses the main line to a sportsbook’s', () => {
    const p = { odds: [
      item('DraftKings (Pick 6)', 'over', -165, 22.5),
      item('FanDuel', 'over', -110, 24.5), item('FanDuel', 'under', -110, 24.5),
    ] };
    const [row] = playerProps(p);
    expect(row).toMatchObject({ line: 24.5, odds: -110, underOdds: -110, fair: 0.5 });
    expect(row.lines.find((x) => x.line === 22.5)).toMatchObject({ odds: -165, dfs: true });
    const [alone] = playerProps({ odds: [item('DraftKings (Pick 6)', 'over', -165, 22.5)] });
    expect(alone).toMatchObject({ line: 22.5, odds: -165, underOdds: null, dfs: true });
    expect(alone.fair).toBeUndefined();
  });

  test('the previous line (`lastLines`) rides on the market’s row, keyed by market name or as odds items', () => {
    const odds = [item('FanDuel', 'over', -110, 24.5), item('FanDuel', 'under', -110, 24.5)];
    expect(playerProps({ odds, lastLines: { 'Player Points': { points: 22.5, price: -120 } } })[0].last).toEqual({ line: 22.5, odds: -120 });
    expect(playerProps({ odds, lastLines: [item('FanDuel', 'over', -125, 23.5)] })[0].last).toEqual({ line: 23.5, odds: -125 });
    expect(playerProps({ odds, lastLines: {} })[0].last).toBeUndefined();
  });
});
