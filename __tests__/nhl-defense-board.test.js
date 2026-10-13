import { describe, expect, test } from '@jest/globals';
import { defenseByPosition } from '../lib/nhl-data/defense';
import { boardTables, overviewRows, matchupReads, rankDesc } from '../lib/nhl-data/defense-board';

// Three games: NYR at NJD, BOS at NJD, NJD at BOS. One skater per position per side.
const row = (date, gameId, team, opp, venue, pos, sog, g) => ({ date, gameId, team, opp, venue, pos, sog, g, a: 0, icf: sog, iff: sog, iscf: 0, ihdcf: 0 });
const side = (date, gameId, team, opp, venue, by) => Object.entries(by).map(([pos, [sog, g]]) => row(date, gameId, team, opp, venue, pos, sog, g));
const rows = [
  ...side('2026-10-01', 1, 'NYR', 'NJD', 'A', { C: [4, 1], LW: [3, 0], RW: [5, 2], D: [2, 0] }),
  ...side('2026-10-01', 1, 'NJD', 'NYR', 'H', { C: [2, 0], LW: [2, 0], RW: [2, 0], D: [1, 0] }),
  ...side('2026-10-03', 2, 'BOS', 'NJD', 'A', { C: [6, 1], LW: [1, 0], RW: [1, 0], D: [3, 1] }),
  ...side('2026-10-03', 2, 'NJD', 'BOS', 'H', { C: [3, 1], LW: [3, 0], RW: [3, 0], D: [3, 0] }),
  ...side('2026-10-05', 3, 'NJD', 'BOS', 'A', { C: [2, 0], LW: [2, 1], RW: [2, 0], D: [2, 0] }),
  ...side('2026-10-05', 3, 'BOS', 'NJD', 'H', { C: [1, 0], LW: [1, 0], RW: [1, 0], D: [1, 0] }),
];
const defense = defenseByPosition(rows);

describe('defense board', () => {
  test('ranks share ties and 1 is the most', () => {
    expect(rankDesc([{ v: 2 }, { v: 5 }, { v: 5 }, { v: 1 }], 'v').map((r) => [r.v, r.rank])).toEqual([[5, 1], [5, 1], [2, 3], [1, 4]]);
  });
  test('per-position tables: NJD gives up the most to centres, every team listed once', () => {
    const t = boardTables(defense, { metric: 'sog', venue: 'ALL', group: 'pos' });
    // NJD defended three games (two at home, one away): C shots 4, 6 and 1.
    expect(t.C.rows.map((r) => [r.abbr, r.value, r.rank])).toEqual([['NJD', 3.67, 1], ['BOS', 2.5, 2], ['NYR', 2, 3]]);
    expect(t.C.league).toBeCloseTo(2.72, 2);
    expect(t.C.n).toBe(3);
    expect(t.D.rows[0]).toMatchObject({ abbr: 'BOS', value: 2.5, gp: 2 });
  });
  test('wings combine: BOS gives up the most to wingers, NJD and NYR tie behind', () => {
    const t = boardTables(defense, { metric: 'sog', group: 'cwd' });
    expect(t.W.rows.map((r) => [r.abbr, r.value, r.rank])).toEqual([['BOS', 5, 1], ['NJD', 4, 2], ['NYR', 4, 2]]);
    expect(boardTables(defense, { metric: 'sog', group: 'fd' }).F.rows[0]).toMatchObject({ abbr: 'NJD', value: 7.67 });
  });
  test('the venue is where the defender played; a team with no game there is left out', () => {
    const home = boardTables(defense, { metric: 'g', venue: 'H' });
    expect(home.C.rows.map((r) => r.abbr)).toEqual(['NJD', 'BOS']); // NYR never defended at home
    expect(home.C.rows[0]).toMatchObject({ gp: 2, value: 1 });
  });
  test('overview rows rank each column on its own, MoneyPuck figures included', () => {
    const o = overviewRows(defense, { NJD: { xga60: 3.1, pace60: 120 }, BOS: { xga60: 2.4, pace60: 110 } });
    const njd = o.find((r) => r.abbr === 'NJD');
    expect(njd).toMatchObject({ gp: 3, sog: 9.67, g: 1.67, xga60: 3.1, hdsa60: null });
    expect(njd.rank).toMatchObject({ sog: 2, g: 1, xga60: 1, pace60: 1 }); // BOS allows 10 shots a game, NJD 9.67
    expect(njd.rank.hdsa60).toBeUndefined();
    expect(o.find((r) => r.abbr === 'NYR').rank.xga60).toBeUndefined();
  });
  test("tonight's reads come off the defender's venue table, softest first", () => {
    const tables = { ALL: boardTables(defense), H: boardTables(defense, { venue: 'H' }), A: boardTables(defense, { venue: 'A' }) };
    const all = matchupReads([{ id: 9, away: 'BOS', home: 'NJD' }], tables);
    expect(all[0].cells.C).toMatchObject({ abbr: 'NJD', value: 3.67, n: 3 }); // every game NJD defended
    const reads = matchupReads([{ id: 9, away: 'BOS', home: 'NJD' }], tables, { venueMatched: true });
    expect(reads[0]).toMatchObject({ team: 'BOS', opp: 'NJD', venue: 'A', best: { key: 'C', rank: 1 } });
    expect(reads[0].cells.C).toMatchObject({ abbr: 'NJD', value: 5, rank: 1, n: 2 });
    expect(reads[1]).toMatchObject({ team: 'NJD', opp: 'BOS', venue: 'H' });
    expect(reads[1].cells.C).toMatchObject({ abbr: 'BOS', value: 3 }); // BOS away: the one game at NJD
  });
});
