import { describe, expect, test } from '@jest/globals';
import { plainSummary, chancesOf, picksOf, projectionOf, coverageOf } from '../lib/picks/scorecard-words';

// The NBA scorecard of 2026-10-20 to 2026-10-26 as the site answered it (one graded game), trimmed.
const report = {
  from: '2026-10-20', to: '2026-10-26', slates: 2, games: 2, graded: 1, plays: 214, boardPlays: 20,
  all: { n: 214, said: 0.48, hit: 0.514, diff: 0.034, brier: 0.2323, priced: 214, implied: 0.525, ret: -0.077 },
  board: { n: 20, said: 0.721, hit: 0.7, diff: -0.021, brier: 0.1958, priced: 20, implied: 0.625, ret: 0.107 },
  predictors: [
    { key: 'pts', label: 'Points', n: 19, common: { n: 17, predictors: [
      { key: 'own5', label: 'Last 5', source: 'own', n: 17, mae: 5.47, bias: -0.44 },
      { key: 'own20', label: 'Last 20', source: 'own', n: 17, mae: 5.82, bias: 0.47 },
      { key: 'h2h', label: 'Head to head', source: 'own', sparse: true, n: 15, mae: 4.38, bias: 0.94, against: { proj: { n: 15, mae: 5.69 }, blend: { n: 15, mae: 5.41 } } },
      { key: 'blend', label: 'Board’s blend', source: 'board', n: 17, mae: 5.59, bias: -0.29 },
      { key: 'proj', label: 'Projection', source: 'board', n: 17, mae: 5.86, bias: -1.26 },
      { key: 'line', label: 'The book’s line', source: 'book', n: 17, mae: 8.32, bias: -5.79 },
    ] } },
    { key: 'reb', label: 'Rebounds', n: 19, common: { n: 18, predictors: [
      { key: 'own20', label: 'Last 20', source: 'own', n: 18, mae: 2.84, bias: 0.19 },
      { key: 'proj', label: 'Projection', source: 'board', n: 18, mae: 2.72, bias: -0.03 },
      { key: 'line', label: 'The book’s line', source: 'book', n: 18, mae: 2.39, bias: -0.56 },
    ] } },
    { key: 'stl', label: 'Steals', n: 0, common: { n: 0, predictors: [] } },
  ],
};

describe('the scorecard in plain words', () => {
  test('coverage names the nights graded and the days with nothing stored', () => {
    expect(coverageOf(report)).toBe('2 nights with finished games, 1 of 2 finished games graded. 5 days in the range have no finished games stored yet.');
    expect(coverageOf({ ...report, slates: 7, games: 40, graded: 40 })).toBe('7 nights with finished games, 40 of 40 finished games graded.');
    expect(coverageOf({ ...report, from: null, slates: 1, games: 1, graded: 1 }, { kind: 'week' })).toBe('1 week with finished games, 1 of 1 finished game graded.');
  });
  test('the chances: said against hit, judged once there are enough plays', () => {
    expect(chancesOf(report.all)).toBe('On all 214 plays the board said they would hit 48% of the time; they hit 51%. They hit more often than it said: the board has been cautious by 3 points.');
    expect(chancesOf({ n: 100, said: 0.6, hit: 0.5, diff: -0.1 })).toMatch(/too confident by 10 points/);
    expect(chancesOf({ n: 100, said: 0.6, hit: 0.61, diff: 0.01 })).toMatch(/That is about right/);
    expect(chancesOf({ n: 12, said: 0.6, hit: 0.5, diff: -0.1 })).toBe('Only 12 plays graded so far, too few to judge the chances.');
    expect(chancesOf({ n: 0 })).toBe('No plays graded yet.');
  });
  test('the board’s plays and the return at the book’s price', () => {
    expect(picksOf(report.board)).toBe('20 plays made the board. The board said 72%; 14 of 20 hit (70%). A flat stake on each at the book\'s price returned 11% per unit.');
    expect(picksOf({ n: 3, said: 0.7, hit: 0.333, priced: 0 })).toBe('3 plays made the board. The board said 70%; 1 of 3 hit (33%).');
  });
  test('a market’s projection: the miss, the lean, the closest read and head to head on its own games', () => {
    expect(projectionOf(report.predictors[0]).text).toBe('Points: the board\'s projection missed by 5.9 on average over 17 games, running 1.3 low. Last 5 came closer, missing by 5.5. Head to head missed by 4.4 against the projection\'s 5.7 on the same 15 games.');
    expect(projectionOf(report.predictors[1]).text).toBe('Rebounds: the board\'s projection missed by 2.7 on average over 18 games, with no lean either way. The book’s line came closer, missing by 2.4.');
    expect(projectionOf(report.predictors[2])).toBeNull();
    expect(projectionOf({ key: 'x', label: 'X', common: { predictors: [{ key: 'proj', n: 5, mae: 2, bias: 0.3 }, { key: 'own5', label: 'Last 5', n: 5, mae: 2.5 }] } }).text).toBe('X: the board\'s projection missed by 2.0 on average over 5 games, running 0.3 high. Nothing read closer.');
  });
  test('the whole summary', () => {
    const s = plainSummary(report);
    expect(s.projections.map((p) => p.key)).toEqual(['pts', 'reb']);
    expect(s.book).toBe('Staking every priced play flat at the book\'s price lost 8% per unit over 214 plays; the prices themselves implied 53% and the board said 48%.');
    expect(s.caution).toBeNull();   // 214 plays
    expect(plainSummary({ ...report, plays: 40 }).caution).toMatch(/fewer than 100 plays/);
    expect(plainSummary(null)).toBeNull();
  });
});
