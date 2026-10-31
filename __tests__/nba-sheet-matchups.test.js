import { describe, expect, test } from '@jest/globals';
import { sheetMatchups, hasSheet, ordinal, SHEET_SOFT } from '../lib/nba/sheet-matchups';

// The Cheat sheet tab (Vincent, 2026-10-31: "create a new view with best cheat sheet matchups per game"), read off a board
// game: each side's allowed table carries the sheet's tile on its cells (`sheet`, rank 1 = gives up the most of 30).
const cell = (sheet, rank, value) => ({ value, rank, ...(sheet != null ? { sheet } : {}) });
const player = (key, name, envPos, ranges, extra = {}) => ({ key, player: name, envPos, pos: envPos, ranges, ladders: {}, out: false, health: 'In', ...extra });
const range = (exp, line = null, p = null, odds = null) => ({ exp, floor: Math.floor(exp * 0.7), ceiling: Math.ceil(exp * 1.3), line, p, odds });

export function fixtureGame() {
  return {
    id: 'g1', away: 'BOS', home: 'NY', date: '2026-10-31T23:30:00Z', final: false,
    sides: {
      BOS: {
        team: 'BOS', opp: 'NY', venue: 'A',
        allowed: { count: 30, league: { PG: { ast: 7.1 }, C: { reb: 11 } }, rows: {
          PG: { ast: cell(2, 4, 8.9), pts: cell(18, 20, 20.1) },
          C: { reb: cell(5, 25, 10.2), tpm: cell(12, 9, 0.9) },
          SF: { pts: cell(null, 1, 30) },   // no tile: not a sheet matchup
        } },
        players: [
          player('jrue', 'Jrue Holiday', 'PG', { ast: range(6.4, 5.5, 0.62, -115) }, { slot: 'PG1', depth: 1, ladders: { ast: [{ line: 5.5, p: 0.62, odds: -115, main: true }] } }),
          player('payton', 'Payton Pritchard', 'PG', { ast: range(3.1, 2.5, 0.58, 120) }),
          player('hurt', 'Hurt Guard', 'PG', { ast: range(5) }, { out: true }),
          player('kp', 'Kristaps Porzingis', 'C', { reb: range(7.8, 7.5, 0.52, -140), tpm: range(1.9) }),
        ],
      },
      NY: {
        team: 'NY', opp: 'BOS', venue: 'H',
        allowed: { count: 30, rows: { PG: { pts: cell(1, 2, 26.5) }, PF: { reb: cell(9, 11, 9.4) } } },
        players: [player('jb', 'Jalen Brunson', 'PG', { pts: range(28.1, 26.5, 0.55, -110) })],
      },
    },
  };
}

describe('the cheat sheet’s best matchups per game', () => {
  const g = fixtureGame();
  const best = [{ game: 'g1', key: 'jrue', market: 'ast', side: 'over', line: 5.5, p: 0.62, odds: -115, edge: 0.085 }];
  test('the soft tiles of both sides, the softest first; a tile past the top ten and a cell without one left out', () => {
    const rows = sheetMatchups(g, { best });
    expect(rows.map((r) => `${r.team} ${r.pos} ${r.stat} ${r.sheet}`)).toEqual(['NY PG pts 1', 'BOS PG ast 2', 'BOS C reb 5', 'NY PF reb 9']);
    expect(rows[0]).toMatchObject({ opp: 'BOS', venue: 'H', pfRank: 2, value: 26.5, agree: 'soft' });
    expect(rows[2]).toMatchObject({ pfRank: 25, agree: 'tough', league: 11 });   // the sheet says soft, PropFinder tough
    expect(sheetMatchups(g, { soft: null }).length).toBe(6);   // every tile
    expect(SHEET_SOFT).toBe(10);
  });
  test('the players at the spot: active, the highest projection first, with the line, the chance, the edge and the best bet', () => {
    const pg = sheetMatchups(g, { best }).find((r) => r.team === 'BOS' && r.stat === 'ast');
    expect(pg.players.map((x) => x.player)).toEqual(['Jrue Holiday', 'Payton Pritchard']);   // the out guard left off
    expect(pg.players[0]).toMatchObject({ slot: 'PG1', exp: 6.4, line: 5.5, p: 0.62, odds: -115, implied: 0.535, edge: 0.085, bet: { side: 'over', line: 5.5 } });
    expect(pg.players[1]).toMatchObject({ odds: 120, implied: 0.455, edge: 0.125, bet: null });
    const ny = sheetMatchups(g).find((r) => r.team === 'NY' && r.pos === 'PF');
    expect(ny.players).toEqual([]);   // nobody at the spot
  });
  test('coverage and the words', () => {
    expect(hasSheet(g)).toBe(true);
    expect(hasSheet({ sides: { A: { allowed: { rows: { PG: { pts: cell(null, 3, 20) } } } } } })).toBe(false);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '30th']);
  });
});

describe('the Cheat sheet tab', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { SheetMatchups } = require('../components/nba/NbaSheetMatchups');
  const render = (board, game = null) => renderToStaticMarkup(React.createElement(SheetMatchups, { board, game }));
  test('a game a block: the spot, the sheet’s rank, PropFinder’s, the players; the dropdown’s pick alone', () => {
    const g = fixtureGame();
    const board = { date: '2026-10-31', games: [g, { id: 'g2', away: 'LAL', home: 'GS', sides: {} }], best: [{ game: 'g1', key: 'jrue', market: 'ast', side: 'over', line: 5.5, p: 0.62, odds: -115, edge: 0.085 }], sources: { sheets: [{}] } };
    const html = render(board);
    expect(html).toContain('NY PGs · Points');
    expect(html).toContain('1st');
    expect(html).toContain('BOS PGs · Assists');
    expect(html).toContain('Jrue Holiday');
    expect(html).toContain('best bet');
    expect(html).toContain('This game is not on the night’s cheat sheet.');   // LAL @ GS
    expect(html.indexOf('NY PGs · Points')).toBeLessThan(html.indexOf('BOS PGs · Assists'));
    expect(render(board, 'g2')).not.toContain('Jrue Holiday');
  });
  test('without a sheet the tab says where to drop one', () => {
    const board = { date: '2026-10-31', games: [{ id: 'g1', away: 'BOS', home: 'NY', sides: {} }], best: [], sources: { sheets: [] } };
    expect(render(board)).toContain('No cheat sheet for this date yet');
    expect(render({ games: [] })).toContain('No games on this date.');
  });
});
