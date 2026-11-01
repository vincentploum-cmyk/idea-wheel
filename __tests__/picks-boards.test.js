import { describe, expect, test } from '@jest/globals';
import { candidateBoard, ladderBoard, tierBoard, boardsOf, markOf, marksText, tierOf, NBA_BOARDS, TIERS } from '../lib/picks/boards';
import { buildBoard, shuffleOf } from '../lib/nba/picks';

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
  test('a ladder board: the highest mark at each tier, the strongest ladder first; a player out is off it', () => {
    expect(tierOf(0.8)).toBe('strong'); expect(tierOf(0.6)).toBe('lean'); expect(tierOf(0.45)).toBe('thin'); expect(tierOf(0.3)).toBeNull();
    const reb = ladderBoard(board, { market: 'reb' });
    expect(reb[0].player).toBe('Big Glass');
    const marks = reb[0].marks;
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.length).toBeLessThanOrEqual(TIERS.length);
    for (const m of marks) expect(tierOf(m.p)).toBe(m.tier);
    for (let i = 1; i < marks.length; i++) { expect(marks[i].line).toBeGreaterThan(marks[i - 1].line); expect(marks[i].p).toBeLessThan(marks[i - 1].p); }
    // His strong mark is the highest rung the board gives 70% or better, and nothing higher clears it.
    const rungs = board.games[0].sides.BOS.players.find((p) => p.key === 'big glass').ladders.reb;
    const strongLine = Math.max(...rungs.filter((r) => r.p >= 0.7).map((r) => r.line));
    expect(reb[0].strong.line).toBe(strongLine);
    expect(marksText(reb[0])).toMatch(/^\d+\+ strong/);
    const pts = ladderBoard(board, { market: 'pts' });
    expect(pts.map((r) => r.player)).not.toContain('Hurt Man');
    expect(pts[0].player).toBe('Steady Hands');
    expect(pts[0].strong).not.toBeNull();
    // Thin minutes: the caveat rides on the line.
    const tpm = ladderBoard(board, { market: 'tpm' });
    expect(tpm.find((r) => r.player === 'Bench Guy')?.caveat).toBe('if role confirmed');
    // Cut to a game, or to nothing.
    expect(ladderBoard(board, { market: 'reb', gameId: 'g1' }).length).toBe(reb.length);
    expect(ladderBoard(board, { market: 'reb', gameId: 'nope' })).toEqual([]);
  });
  test('a candidates board: the main line, the likeliest first, with the chance', () => {
    const ast = candidateBoard(board, { market: 'ast', min: 0.5 });
    expect(ast[0]).toMatchObject({ player: 'Steady Hands', line: 6.5, odds: -120, side: 'over' });
    expect(ast[0].p).toBeGreaterThanOrEqual(0.5);
    expect(ast[0].ev).toEqual(expect.any(Number));
    expect(ast[0].proj).toBeGreaterThan(5);
    for (let i = 1; i < ast.length; i++) expect(ast[i].p).toBeLessThanOrEqual(ast[i - 1].p);
    expect(candidateBoard(board, { market: 'pts', min: 0.5 }).map((r) => r.player)).not.toContain('Hurt Man');
  });
  test('round marks off the shuffle: points by 5, the highest each tier clears', () => {
    const sh = shuffleOf({ market: 'pts', board, pf, season: 2026, results: {} });
    const rows = tierBoard(sh, { step: 5 });
    const top = rows.find((r) => r.player === 'Steady Hands');
    expect(top).toBeTruthy();
    for (const m of top.marks) { expect(Number(m.mark.replace('+', '')) % 5).toBe(0); expect(tierOf(m.p)).toBe(m.tier); }
    // Steady Hands scores 24–28: 20+ is strong, nothing at 30+ strong.
    expect(top.strong.mark).toBe('20+');
    expect(rows.map((r) => r.player)).not.toContain('Hurt Man');
    const viaSpecs = boardsOf(board, NBA_BOARDS, { shuffles: { pts: sh } }).find((b) => b.key === 'pts');
    expect(viaSpecs.round).toBe(true);
    expect(viaSpecs.rows.map((r) => r.player)).toEqual(rows.map((r) => r.player));
  });
  test('the NBA specs build every board', () => {
    const boards = boardsOf(board, NBA_BOARDS);
    expect(boards.map((b) => b.key)).toEqual(NBA_BOARDS.map((b) => b.key));
    expect(boards.find((b) => b.key === 'reb').rows[0].player).toBe('Big Glass');
    // The ladders, and the double-double candidates (the NBA's touchdown list) by their chance.
    expect(boards.filter((b) => b.kind === 'candidates').map((b) => b.market)).toEqual(['dd']);
    for (const b of boards) for (const r of b.rows) expect(r.game).toBe('g1');
  });
});
