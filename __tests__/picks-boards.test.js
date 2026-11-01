import { describe, expect, test } from '@jest/globals';
import { candidateBoard, ladderBoard, boardsOf, markOf, marksText, NBA_BOARDS, LADDER_BAR } from '../lib/picks/boards';
import { buildBoard } from '../lib/nba/picks';

// The slate's boards (Vincent, 2026-11-01): the best candidates over the main line and the ladders' marks, ranked.
const games = [{ id: 'g1', date: '2026-11-02T00:00Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
const logs = (f) => Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(31 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', home: i % 2 === 0, min: 34, pts: 20, reb: 6, ast: 4, tpm: 1, stl: 1, blk: 0, tov: 2, ...f(i) }));
const player = (id, name, team, pos, f, props, min = 34) => ({ id, name, key: name.toLowerCase(), team, pos, games: logs((i) => ({ min, ...f(i) })), props });
const pf = { at: '2026-11-01T14:00:00Z', data: { players: [
  player('p1', 'Big Glass', 'BOS', 'C', (i) => ({ reb: 11 + (i % 3) }), [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110, isMain: true, lines: [{ line: 6.5, odds: -250, underOdds: 190 }, { line: 8.5, odds: -110, underOdds: -110, main: true }, { line: 10.5, odds: 150, underOdds: -190 }, { line: 12.5, odds: 330, underOdds: -480 }] }]),
  player('p2', 'Steady Hands', 'BOS', 'PG', (i) => ({ ast: 7 + (i % 3), pts: 24 + (i % 5) }), [{ market: 'ast', line: 6.5, odds: -120, underOdds: 100, isMain: true }, { market: 'pts', line: 21.5, odds: -110, underOdds: -110, isMain: true }]),
  player('p3', 'Bench Guy', 'NY', 'SG', (i) => ({ tpm: 2 + (i % 2) }), [{ market: 'tpm', line: 1.5, odds: -140, underOdds: 110, isMain: true }], 12),
  { ...player('p4', 'Hurt Man', 'NY', 'SF', () => ({ pts: 30 }), [{ market: 'pts', line: 25.5, odds: -110, underOdds: -110, isMain: true }]), injury: 'Out' },
], defense: null, injuries: { rows: [{ name: 'Hurt Man', key: 'hurt man', team: 'NY', status: 'Out' }] } } };

describe('the boards', () => {
  const board = buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf, results: {} });
  test('marks read as the lists do', () => {
    expect(markOf(19.5)).toBe('20+');
    expect(markOf(99.5)).toBe('100+');
    expect(markOf(0.5)).toBe('1+');
  });
  test('a ladder board: the marks cleared at the bar, the highest first; a player out is off it', () => {
    const reb = ladderBoard(board, { market: 'reb' });
    expect(reb[0].player).toBe('Big Glass');
    expect(reb[0].marks.length).toBeGreaterThan(0);
    expect(reb[0].marks.length).toBeLessThanOrEqual(3);
    for (const m of reb[0].marks) expect(m.p).toBeGreaterThanOrEqual(LADDER_BAR);
    for (let i = 1; i < reb[0].marks.length; i++) expect(reb[0].marks[i].line).toBeGreaterThan(reb[0].marks[i - 1].line);
    expect(reb[0].top).toBe(reb[0].marks[reb[0].marks.length - 1]);
    expect(marksText(reb[0])).toMatch(/^\d+\+( \/ \d+\+)*$/);
    expect(reb[0].marks.some((m) => m.main)).toBe(true);
    const pts = ladderBoard(board, { market: 'pts' });
    expect(pts.map((r) => r.player)).not.toContain('Hurt Man');
    expect(pts[0].player).toBe('Steady Hands');
    // Thin minutes: the caveat rides on the line.
    const tpm = ladderBoard(board, { market: 'tpm' });
    expect(tpm.find((r) => r.player === 'Bench Guy')?.caveat).toBe('if role confirmed');
    // Cut to a game, or to nothing.
    expect(ladderBoard(board, { market: 'reb', gameId: 'g1' }).length).toBe(reb.length);
    expect(ladderBoard(board, { market: 'reb', gameId: 'nope' })).toEqual([]);
  });
  test('a candidates board: the main line, the likeliest first, the price and the EV', () => {
    const ast = candidateBoard(board, { market: 'ast', min: 0.5 });
    expect(ast[0]).toMatchObject({ player: 'Steady Hands', line: 6.5, odds: -120, side: 'over' });
    expect(ast[0].p).toBeGreaterThanOrEqual(0.5);
    expect(ast[0].ev).toEqual(expect.any(Number));
    expect(ast[0].proj).toBeGreaterThan(5);
    for (let i = 1; i < ast.length; i++) expect(ast[i].p).toBeLessThanOrEqual(ast[i - 1].p);
    expect(candidateBoard(board, { market: 'pts', min: 0.5 }).map((r) => r.player)).not.toContain('Hurt Man');
  });
  test('the NBA specs build every board', () => {
    const boards = boardsOf(board, NBA_BOARDS);
    expect(boards.map((b) => b.key)).toEqual(NBA_BOARDS.map((b) => b.key));
    expect(boards.find((b) => b.key === 'reb').rows[0].player).toBe('Big Glass');
    expect(boards.find((b) => b.key === 'reb-best').rows[0].player).toBe('Big Glass');
    for (const b of boards) for (const r of b.rows) expect(r.game).toBe('g1');
  });
});
