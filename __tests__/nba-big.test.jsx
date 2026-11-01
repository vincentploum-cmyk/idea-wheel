/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBA_BIG, boardTail, nbaBigChance, nbaBigGames } from '../lib/nba/big';
import { statOf, actualFor } from '../lib/nba/picks';
import NbaBigGames from '../components/nba/NbaBigGames';

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
