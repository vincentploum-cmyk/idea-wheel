import { describe, expect, test } from '@jest/globals';
import { candidateBoard, ladderBoard, tierBoard, withEveryone, boardsOf, markOf, marksText, tierOf, matchupOf, matchupText, NBA_BOARDS, TIERS } from '../lib/picks/boards';
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
  test('every active player is on a stat list: no ladder for the stat reads 0, no game in the pull reads —', () => {
    // A centre who never made a three and a rookie without a game had no row on the threes list (Vincent, 2026-11-13).
    const pf2 = { ...pf, data: { ...pf.data, players: [
      ...pf.data.players.map((p) => (p.id === 'p1' ? { ...p, games: p.games.map((x) => ({ ...x, tpm: 0 })) } : p)),
      { id: 'p5', name: 'New Kid', key: 'new kid', team: 'BOS', pos: 'SF', games: [], props: [] },
    ] } };
    const b2 = buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: pf2, results: {} });
    const sh = shuffleOf({ market: 'tpm', board: b2, pf: pf2, season: 2026, results: {} });
    const listed = tierBoard(sh, { step: 1, keepAll: true });
    expect(listed.map((r) => r.player)).not.toContain('Big Glass');
    const rows = withEveryone(b2, listed, { market: 'tpm' });
    const glass = rows.find((r) => r.player === 'Big Glass');
    expect(glass).toMatchObject({ proj: 0, floor: 0, ceiling: 0, strong: null, lean: null, thin: null });
    expect(glass.noLogs).toBeUndefined();
    const kid = rows.find((r) => r.player === 'New Kid');
    if (kid) expect(kid).toMatchObject({ proj: null, floor: null, ceiling: null, noLogs: true });
    // The listed rows keep their place and their figures; a player out stays off; nobody is listed twice.
    expect(rows.slice(0, listed.length)).toEqual(listed);
    expect(rows.map((r) => r.player)).not.toContain('Hurt Man');
    expect(new Set(rows.map((r) => `${r.team}|${r.key}`)).size).toBe(rows.length);
    for (const r of listed) { expect(r.proj).not.toBeNull(); expect(r.floor).not.toBeNull(); expect(r.ceiling).not.toBeNull(); }
    // The ladder fallback (before the shuffle loads) reads the same way.
    expect(withEveryone(b2, ladderBoard(b2, { market: 'tpm', keepAll: true }), { market: 'tpm' }).find((r) => r.player === 'Big Glass').proj).toBe(0);
  });
  test('rebounds and assists count by 1 (2026-11-13: by 2 jumped past the lean band)', () => {
    const step = (k) => NBA_BOARDS.find((b) => b.key === k).step;
    expect(step('reb')).toBe(1);
    expect(step('ast')).toBe(1);
    const sh = shuffleOf({ market: 'ast', board, pf, season: 2026, results: {} });
    const rows = tierBoard(sh, { step: step('ast') });
    expect(rows.some((r) => r.marks.some((m) => Number(m.mark.replace('+', '')) % 2 === 1))).toBe(true);
    for (const r of rows) for (const m of r.marks) expect(tierOf(m.p)).toBe(m.tier);
  });
  test('every line carries the matchup its projection reads', () => {
    // A defense table on the pull: NY gives BOS's centre the most rebounds, the sheet agrees; the last ten too.
    const cell = (value, rank, sheet = null) => ({ value, rank, rankBlend: sheet == null ? rank : (rank + sheet) / 2, ...(sheet != null ? { sheet } : {}) });
    const g = board.games[0];
    const glass = g.sides.BOS.players.find((p) => p.key === 'big glass');
    const withTable = { ...board, games: [{ ...g, sides: { ...g.sides, BOS: { ...g.sides.BOS, allowed: { count: 30, league: { [glass.envPos]: { reb: 10 } }, rows: { [glass.envPos]: { reb: cell(13.2, 2, 4) } }, windows: { l10: { rows: { [glass.envPos]: { reb: cell(14, 1) } } } } } } } }] };
    const m = matchupOf(withTable, { game: 'g1', team: 'BOS', key: 'big glass', market: 'reb' });
    expect(m).toMatchObject({ pos: glass.envPos, pf: 2, pfValue: 13.2, l10: 1, sheet: 4, agree: true, pfTone: 'soft', league: 10 });
    expect(matchupText(m, 'NY')).toMatch(/PropFinder #2 of 30 .* last 10 #1 .* cheat sheet #4, the same third: confirmed/);
    const rows = boardsOf(withTable, NBA_BOARDS).find((b) => b.key === 'reb').rows;
    expect(rows.find((r) => r.key === 'big glass').matchup).toMatchObject({ pf: 2, sheet: 4 });
    // No table: null, and the hover says the projection is his own rate.
    expect(matchupOf(board, { game: 'g1', team: 'BOS', key: 'big glass', market: 'reb' })).toBeNull();
    expect(matchupText(null)).toMatch(/his own rate/);
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
