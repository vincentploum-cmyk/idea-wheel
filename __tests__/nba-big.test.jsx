/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBA_BIG, boardTail, nbaBigChance, nbaBigGames } from '../lib/nba/big';
import { statOf, actualFor } from '../lib/nba/picks';
import NbaBigGames, { outlierWhy, sortOutliers } from '../components/nba/NbaBigGames';

// The NBA's big games (Vincent, 2026-11-01: "Do the same big games study for the NBA"; docs/audits/2026-11-01-nba-big-games.md).
describe('NBA big games: the read', () => {
  test('the board’s tail falls as the mark rises; his own record and his threes lift it where the model reads them', () => {
    expect(boardTail(25, 7, 30)).toBeGreaterThan(boardTail(25, 7, 40));
    expect(boardTail(25, 0, 30)).toBeNull();
    const lo = nbaBigChance(25, 7, 'pts', 30, { big: { 30: 0.05 } });
    const hi = nbaBigChance(25, 7, 'pts', 30, { big: { 30: 0.4 } });
    expect(hi).toBeGreaterThan(lo);
    expect(nbaBigChance(2.8, 1.6, 'tpm', 5, { tpa5: 10 })).toBeGreaterThan(nbaBigChance(2.8, 1.6, 'tpm', 5, { tpa5: 5 }));
    // The rarest marks read the board's tail as it is; under the stat's floor, no read.
    expect(nbaBigChance(9, 3, 'reb', 15, { big: { 15: 0.5 } })).toBe(boardTail(9, 3, 15));
    expect(nbaBigChance(8, 4, 'pts', 30, {})).toBeNull();
    expect(Object.keys(NBA_BIG)).toEqual(['pts', 'reb', 'ast', 'tpm', 'pra']);
  });

  const logs = (pts, n = 20) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, type: 'REG', min: 34, pts: pts(i), reb: 6, ast: 5, tpm: 3, tpa: 8 }));
  const pf = { data: { players: [
    { key: 'star one', team: 'DEN', games: logs((i) => (i % 3 === 0 ? 34 : 24)) },
    { key: 'steady two', team: 'DEN', games: logs(() => 24) },
  ] } };
  const side = (players) => ({ opp: 'LAL', venue: 'H', players });
  const player = (key, name, exp) => ({ key, player: name, pos: 'SG', ranges: { pts: { exp }, pra: { exp: exp + 11 }, tpm: { exp: 3 } }, ladders: { pts: [{ sd: 7 }], pra: [{ sd: 9 }], tpm: [{ sd: 1.6 }] } });
  const board = { date: '2026-11-01', games: [{ id: 'g1', final: false, sides: { DEN: side([player('star one', 'Star One', 26), player('steady two', 'Steady Two', 26)]) } }] };

  test('every active player the board projected gets a row, ranked by the first mark; his record carried', () => {
    const big = nbaBigGames(board, { pf, results: {}, statOf, actualFor });
    const star = big.rows['star one|DEN|pts'];
    const steady = big.rows['steady two|DEN|pts'];
    expect(star.ctx.hits[30]).toBe(7);
    expect(steady.ctx.hits[30]).toBe(0);
    expect(star.p[30]).toBeGreaterThan(steady.p[30]);
    expect(big.lists.pts[0]).toBe('star one|DEN|pts');
    expect(big.rows['star one|DEN|tpm'].ctx.tpa5).toBe(8);
  });

  test('the tab draws the stat’s list with the reason, no price', () => {
    const b = { ...board, big: nbaBigGames(board, { pf, results: {}, statOf, actualFor }) };
    const html = renderToStaticMarkup(<NbaBigGames board={b} />);
    expect(html).toContain('Star One');
    expect(html).toContain('30+ in 7 of his last 20');
    expect(html).toContain('>30+<');
    expect(html).toContain('>40+<');
    expect(html).not.toMatch(/\bEV\b|edge|juice/i);
  });
});

// The outliers (Vincent, 2026-11-07: "build the outliers list on the big games tab"; docs/audits/2026-11-07-nba-outliers.md).
import { NBA_OUTLIERS, OUTLIER_MIN_MINUTES, outlierMark, outlierChance, nbaOutliers } from '../lib/nba/big';
import { countTail } from '../lib/picks/projection';

describe('NBA outliers: double his projection', () => {
  test('the mark: double his projection and the stat’s add over it, a whole count', () => {
    expect(outlierMark(4.4, 'reb')).toBe(9);     // 8.8 → 9, 8.4 → 9
    expect(outlierMark(3.6, 'reb')).toBe(8);     // 7.2 → 8, 7.6 → 8
    expect(outlierMark(7, 'reb')).toBe(14);
    expect(outlierMark(1.2, 'tpm')).toBe(4);     // 2.4 → 3, 3.2 → 4
    expect(outlierMark(8, 'pts')).toBe(18);
    expect(outlierMark(4, 'pra')).toBeNull();
  });
  test('the chance: the board’s count tail at the mark, through the fit; threes as they are; under the floor, none', () => {
    const c = outlierChance(4.4, 2.5, 'reb', 'count');
    expect(c.mark).toBe(9);
    expect(c.raw).toBeCloseTo(countTail(8.5, 4.4, 2.5), 3);
    const { a, b } = NBA_OUTLIERS.reb.cal; const q = c.raw;
    expect(c.p).toBeCloseTo(1 / (1 + Math.exp(-(a + b * Math.log(q / (1 - q))))), 3);
    const t = outlierChance(1.2, 1.1, 'tpm', 'count');
    expect(t.p).toBe(t.raw);
    expect(outlierChance(2, 1.5, 'reb', 'count')).toBeNull();
    expect(outlierChance(4.4, 0, 'reb', 'count')).toBeNull();
    // A higher spread at the same centre: a likelier outlier.
    expect(outlierChance(4.4, 3.5, 'reb', 'count').p).toBeGreaterThan(c.p);
  });

  // Five games this season (2027), fifteen last season's behind them.
  const logs = (reb, n = 20) => Array.from({ length: n }, (_, i) => ({ date: i < 5 ? `2026-11-${String(6 - i).padStart(2, '0')}` : `2026-04-${String(30 - i).padStart(2, '0')}`, season: i < 5 ? 2027 : 2026, type: 'REG', min: 22, pts: 9, reb: reb(i), ast: 2, tpm: 1, tpa: 3 }));
  const pf = { data: { players: [
    { key: 'trey lyles', team: 'MIN', games: logs((i) => (i % 5 === 0 ? 11 : 4)) },
    { key: 'deep bench', team: 'MIN', games: logs(() => 4) },
    { key: 'steady big', team: 'MIN', games: logs(() => 5) },
  ] } };
  const sp = (key, name, { exp = 4.4, sd = 3, minutes = 22, ladder = null, role = null, outFrom = null } = {}) => ({
    key, player: name, pos: 'PF', minutes: { tonight: minutes }, ...(role ? { lineup: { role, factor: 1.2 } } : {}),
    ranges: { reb: { exp, line: 4.5, outFrom } }, ladders: { reb: ladder || [{ line: 4.5, sd, tail: 'count', odds: -120 }] },
  });
  const board = { date: '2026-11-07', games: [{ id: 'g1', final: false, sides: { MIN: { opp: 'NO', venue: 'A', players: [
    sp('trey lyles', 'Trey Lyles', { role: 'promoted', outFrom: ['Rudy Gobert'], ladder: [{ line: 4.5, sd: 3, tail: 'count', odds: -120 }, { line: 8.5, sd: 3, tail: 'count', odds: 900 }] }),
    sp('deep bench', 'Deep Bench', { minutes: OUTLIER_MIN_MINUTES - 1 }),
    sp('steady big', 'Steady Big', { sd: 1.2 }),
  ] } } }] };

  test('every rotation player from the floor gets a row: the mark, the chance, why, the book’s price at the mark', () => {
    const o = nbaOutliers(board, { pf, results: {}, statOf, actualFor, season: 2027 });
    const lyles = o.rows['trey lyles|MIN|reb'];
    // Lyles: 11 rebounds every fifth game (games 0, 5, 10, 15): one this season, three last season's.
    expect(lyles).toMatchObject({ mark: 9, proj: 4.4, line: 4.5, minutes: 22, hits: 4, n: 20, role: 'promoted', outFrom: ['Rudy Gobert'], record: { season: { hits: 1, n: 5 }, last: { hits: 3, n: 15 } } });
    // No rung at o8.5 with a chance on his ladder: the fitted tail.
    expect(lyles.from).toBe('fit');
    expect(lyles.p).toBeCloseTo(outlierChance(4.4, 3, 'reb', 'count').p, 3);
    expect(lyles.book).toMatchObject({ line: 8.5, odds: 900, implied: 0.1 });
    expect(lyles.book.edge).toBeCloseTo(lyles.p - 0.1, 3);
    expect(o.rows['deep bench|MIN|reb']).toBeUndefined();          // under the minutes floor
    expect(o.rows['steady big|MIN|reb'].book).toBeNull();          // no rung at 8.5
    expect(o.rows['steady big|MIN|reb'].p).toBeLessThan(lyles.p);  // the narrow spread
    expect(o.lists.reb[0]).toBe('trey lyles|MIN|reb');
    // Without the board's season: his newest log's.
    expect(nbaOutliers(board, { pf, results: {}, statOf, actualFor }).rows['trey lyles|MIN|reb'].record.season.n).toBe(5);
  });
  test("the ladder's rung at the mark is the chance when the ladder has it: the card's number for that line", () => {
    const withRung = { ...board, games: [{ ...board.games[0], sides: { MIN: { ...board.games[0].sides.MIN, players: [
      sp('trey lyles', 'Trey Lyles', { ladder: [{ line: 4.5, sd: 3, tail: 'count', p: 0.45, odds: -120 }, { line: 8.5, sd: 3, tail: 'count', p: 0.07, raw: 0.081, odds: 900 }] }),
    ] } } }] };
    const r = nbaOutliers(withRung, { pf, results: {}, statOf, actualFor, season: 2027 }).rows['trey lyles|MIN|reb'];
    expect(r).toMatchObject({ from: 'ladder', p: 0.07, raw: 0.081, book: { odds: 900, edge: -0.03 } });
  });
  test('the note: this season first, last season to make 20; the sort: by any column, nulls last, a second click flips', () => {
    expect(outlierWhy({ mark: 4, record: { season: { hits: 0, n: 5 }, last: { hits: 5, n: 15 } }, minutes: 22 })).toBe('4+ in 0 of 5 this season · 5 of 15 last season · 22 min');
    expect(outlierWhy({ mark: 4, record: { season: { hits: 0, n: 0 }, last: { hits: 3, n: 20 } } })).toBe('4+ in 3 of his last 20 last season');
    expect(outlierWhy({ mark: 4, role: 'demoted', record: { season: { hits: 2, n: 12 }, last: { hits: 0, n: 8 } } })).toBe('Off the bench tonight · 4+ in 2 of 12 this season · 0 of 8 last season');
    const rows = [{ player: 'B', p: 0.1, proj: 2, book: null, mark: 4 }, { player: 'A', p: 0.2, proj: 1, book: { edge: 0.02 }, mark: 5 }, { player: 'C', p: 0.15, proj: 3, book: { edge: -0.01 }, mark: 4 }];
    expect(sortOutliers(rows).map((r) => r.player)).toEqual(['A', 'C', 'B']);
    expect(sortOutliers(rows, { key: 'proj', dir: 'desc' }).map((r) => r.player)).toEqual(['C', 'B', 'A']);
    expect(sortOutliers(rows, { key: 'book', dir: 'desc' }).map((r) => r.player)).toEqual(['A', 'C', 'B']);
    expect(sortOutliers(rows, { key: 'book', dir: 'asc' }).map((r) => r.player)).toEqual(['C', 'A', 'B']);
    expect(sortOutliers(rows, { key: 'player', dir: 'asc' }).map((r) => r.player)).toEqual(['A', 'B', 'C']);
  });

  test('the tab’s Outliers view: the stat’s list with the mark, the price and why', () => {
    const b = { ...board, big: { rows: {}, lists: {}, outliers: nbaOutliers(board, { pf, results: {}, statOf, actualFor, season: 2027 }) } };
    const html = renderToStaticMarkup(<NbaBigGames board={b} initialView="outliers" />);
    expect(html).toContain('>Outliers<');
    expect(html).toContain('Trey Lyles');
    expect(html).toContain('>9+<');
    expect(html).toContain('+900');
    expect(html).toContain('Starts tonight · Rudy Gobert out · 9+ in 1 of 5 this season · 3 of 15 last season · 22 min');
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('Click a column to sort');
    expect(html).toContain('double their projection');
    // The Big games view stays as it was by default.
    expect(renderToStaticMarkup(<NbaBigGames board={b} />)).toContain('No big-game candidate yet');
  });
});
