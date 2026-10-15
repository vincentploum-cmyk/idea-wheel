import { describe, expect, test } from '@jest/globals';
import { defenseByPosition, blendedDefense } from '../lib/nhl-data/defense';
import { boardTables, overviewRows, matchupReads, rankDesc, groupKeyFor, shootersAt } from '../lib/nhl-data/defense-board';

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
    expect(t.C.rows.map((r) => [r.abbr, r.value, r.rank])).toEqual([['NJD', 3.667, 1], ['BOS', 2.5, 2], ['NYR', 2, 3]]);
    expect(t.C.league).toBeCloseTo(2.722, 3);
    expect(t.C.n).toBe(3);
    expect(t.D.rows[0]).toMatchObject({ abbr: 'BOS', value: 2.5, gp: 2 });
  });
  test('wings combine per skater: BOS gives up the most to wingers, NJD and NYR tie behind', () => {
    const t = boardTables(defense, { metric: 'sog', group: 'cwd' });
    // One LW and one RW a side, so a winger's figure is the two positions' mean: BOS (3 + 2) / 2.
    expect(t.W.rows.map((r) => [r.abbr, r.value, r.rank])).toEqual([['BOS', 2.5, 1], ['NJD', 2, 2], ['NYR', 2, 2]]);
    expect(boardTables(defense, { metric: 'sog', group: 'fd' }).F.rows[0]).toMatchObject({ abbr: 'NJD', value: 2.556 });
  });
  test('the figure is per skater: two wingers sharing the shots do not double the read', () => {
    // NJD faces two LWs with 2 shots each in one game, then one LW with 4: 4 a game either night, 2.67 per skater.
    const two = [
      ...side('2026-10-01', 1, 'NYR', 'NJD', 'A', { LW: [2, 0] }), row('2026-10-01', 1, 'NYR', 'NJD', 'A', 'LW', 2, 0),
      ...side('2026-10-03', 2, 'BOS', 'NJD', 'A', { LW: [4, 0] }),
    ];
    const d = defenseByPosition(two);
    expect(d.teams.NJD.ALL.LW).toMatchObject({ gp: 2, sog: 4, skaters: 1.5 });
    expect(d.teams.NJD.ALL.LW.per.sog).toBeCloseTo(2.667, 3);
    expect(boardTables(d, { metric: 'sog' }).LW.rows[0]).toMatchObject({ abbr: 'NJD', value: 2.667, gp: 2, base: 0 });
  });
  test('the blended season table: this season at games / (games + 15) for shots, games / (games + 40) for goals, over a 10-game base', () => {
    // Last season: NJD allowed its centres 2 shots and 0.2 goals a game over 20 games; this season 6 and 1 over 2 games.
    const prev = [];
    for (let i = 0; i < 20; i++) prev.push(row('2025-11-01', 100 + i, 'BOS', 'NJD', 'A', 'C', 2, i < 4 ? 1 : 0));
    const cur = [row('2026-10-01', 1, 'NYR', 'NJD', 'A', 'C', 6, 1), row('2026-10-03', 2, 'BOS', 'NJD', 'A', 'C', 6, 1)];
    const b = blendedDefense([...prev, ...cur], '2026-10-05');
    const c = b.teams.NJD.ALL.C;
    expect(c).toMatchObject({ gp: 2, base: 20, skaters: 1 });
    expect(c.per.sog).toBeCloseTo((2 / 17) * 6 + (15 / 17) * 2, 2);
    expect(c.per.g).toBeCloseTo((2 / 42) * 1 + (40 / 42) * 0.2, 2);
    expect(c.sog).toBeCloseTo((2 / 17) * 6 + (15 / 17) * 2, 1);
    // The shooters were away, so NJD defended at home only: no away table; a team with no record in either season is absent.
    expect(b.teams.NJD.A.C).toBeUndefined();
    expect(b.teams.NJD.H.C.gp).toBe(2);
    expect(b.teams.NYR).toBeUndefined();
    expect(b.blended).toBe(true);
    // The board reads the blend and shows the base.
    expect(boardTables(b, { metric: 'sog' }).C.rows[0]).toMatchObject({ abbr: 'NJD', gp: 2, base: 20, value: 2.471, rank: 1 });
    // Under a 10-game base last season counts for nothing: this season alone.
    const thin = blendedDefense([...prev.slice(0, 5), ...cur], '2026-10-05');
    expect(thin.teams.NJD.ALL.C).toMatchObject({ gp: 2, base: 0 });
    expect(thin.teams.NJD.ALL.C.per.sog).toBe(6);
    // Nothing this season yet: last season's table alone, gp 0.
    const none = blendedDefense(prev, '2026-10-05');
    expect(none.teams.NJD.ALL.C).toMatchObject({ gp: 0, base: 20 });
    expect(none.teams.NJD.ALL.C.per.sog).toBe(2);
  });
  test('the venue is where the defender played; a team with no game there is left out', () => {
    const home = boardTables(defense, { metric: 'g', venue: 'H' });
    expect(home.C.rows.map((r) => r.abbr)).toEqual(['NJD', 'BOS']); // NYR never defended at home
    expect(home.C.rows[0]).toMatchObject({ gp: 2, value: 1 });
  });
  test('the shooters at a softest spot come from the side\'s lineup, first line first, grouped the way the tables are', () => {
    const side = { team: 'BUF', skaters: [
      { id: 1, name: 'Tage Thompson', pos: 'C', line: 1, lamS: 3.9 }, { id: 2, name: 'Jack Quinn', pos: 'RW', line: 1 }, { id: 3, name: 'Josh Norris', pos: 'C', line: 2, lamS: 2.1 },
      { id: 4, name: 'Zach Benson', pos: 'LW', line: 2 }, { id: 5, name: 'Rasmus Dahlin', pos: 'D', line: 1 }, { id: 6, name: 'Peyton Krebs', pos: 'C', line: null, lamS: 1 },
    ] };
    expect(shootersAt(side, 'C').map((p) => p.name)).toEqual(['Tage Thompson', 'Josh Norris', 'Peyton Krebs']);
    // Within a line the run's λ for the metric orders the names: shots under 'sog', goals under 'g'.
    const tied = { skaters: [{ id: 1, name: 'A', pos: 'RW', line: 1, lamS: 2, lamG: 0.5 }, { id: 2, name: 'B', pos: 'RW', line: 1, lamS: 3, lamG: 0.3 }] };
    expect(shootersAt(tied, 'RW', 'pos', 'sog').map((p) => p.name)).toEqual(['B', 'A']);
    expect(shootersAt(tied, 'RW', 'pos', 'g').map((p) => p.name)).toEqual(['A', 'B']);
    expect(shootersAt(side, 'W', 'cwd').map((p) => p.name)).toEqual(['Jack Quinn', 'Zach Benson']);
    expect(shootersAt(side, 'F', 'fd').map((p) => p.name)).toEqual(['Tage Thompson', 'Jack Quinn', 'Josh Norris', 'Zach Benson', 'Peyton Krebs']);
    expect(shootersAt(side, 'D', 'fd').map((p) => p.id)).toEqual([5]);
    expect(shootersAt(null, 'C')).toEqual([]);
    expect(groupKeyFor('RW', 'cwd')).toBe('W');
    expect(groupKeyFor('D', 'fd')).toBe('D');
    expect(groupKeyFor('G')).toBeNull();
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
    expect(all[0].cells.C).toMatchObject({ abbr: 'NJD', value: 3.667, n: 3 }); // every game NJD defended
    const reads = matchupReads([{ id: 9, away: 'BOS', home: 'NJD' }], tables, { venueMatched: true });
    expect(reads[0]).toMatchObject({ team: 'BOS', opp: 'NJD', venue: 'A', best: { key: 'C', rank: 1 } });
    expect(reads[0].cells.C).toMatchObject({ abbr: 'NJD', value: 5, rank: 1, n: 2 });
    expect(reads[1]).toMatchObject({ team: 'NJD', opp: 'BOS', venue: 'H' });
    expect(reads[1].cells.C).toMatchObject({ abbr: 'BOS', value: 3 }); // BOS away: the one game at NJD
  });
});
