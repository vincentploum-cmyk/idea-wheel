import { describe, expect, test, jest } from '@jest/globals';
import { memoByRows, identityOf, identityKey, inputsMemo, asyncMemo } from '../lib/memo';

describe('memo helpers', () => {
  test('memoByRows keeps a value per rows array and key', () => {
    const rows = [{ a: 1 }];
    let n = 0;
    const compute = () => ({ n: ++n });
    const first = memoByRows(rows, 'k', compute);
    expect(memoByRows(rows, 'k', compute)).toBe(first);
    expect(memoByRows(rows, 'other', compute)).not.toBe(first);
    // Another array with the same content is its own computation; a non-array is never kept.
    expect(memoByRows(rows.slice(), 'k', compute)).not.toBe(first);
    expect(memoByRows(null, 'k', compute)).not.toBe(memoByRows(null, 'k', compute));
  });

  test('identityOf names an object once and primitives as themselves', () => {
    const a = {}; const b = {};
    expect(identityOf(a)).toBe(identityOf(a));
    expect(identityOf(a)).not.toBe(identityOf(b));
    expect(identityOf(null)).toBe('null');
    expect(identityOf('pts')).toBe('pts');
    expect(identityKey([a, null, 'pts'])).toBe(`${identityOf(a)}|null|pts`);
  });

  test('inputsMemo hands back the value built for the same objects, least recently used dropped first', () => {
    const memo = inputsMemo({ max: 2 });
    const a = {}; const b = {}; const c = {};
    let n = 0;
    const build = () => ({ n: ++n });
    const ab = memo.get([a, b], build);
    expect(memo.get([a, b], build)).toBe(ab);
    expect(memo.get([a, { ...b }], build)).not.toBe(ab);   // a new object: a new board
    expect(memo.size).toBe(2);
    memo.get([a, b], build);                                // touched: stays
    memo.get([a, c], build);                                // the untouched one goes
    expect(memo.size).toBe(2);
    expect(memo.get([a, b], build)).toBe(ab);
    expect(n).toBe(3);
  });

  test('asyncMemo shares a build in flight and keeps it while the revision, inputs and TTL hold', async () => {
    let rev = 0;
    const memo = asyncMemo({ ttl: 1000, max: 2, revision: () => rev });
    const rows = [1];
    let builds = 0;
    let release;
    const compute = () => new Promise((r) => { builds += 1; release = () => r({ built: builds }); });
    const inputs = () => Promise.resolve([rows]);
    const p1 = memo('k', inputs, compute);
    const p2 = memo('k', inputs, compute);     // joins the build in flight
    await new Promise((r) => setTimeout(r, 0));
    expect(builds).toBe(1);
    release();
    const [v1, v2] = await Promise.all([p1, p2]);
    expect(v1).toBe(v2);
    expect(await memo('k', inputs, compute)).toBe(v1);
    // A write on this server (the revision moves) drops it.
    rev += 1;
    const p3 = memo('k', inputs, compute);
    await new Promise((r) => setTimeout(r, 0));
    expect(builds).toBe(2);
    release();
    const v3 = await p3;
    expect(v3).not.toBe(v1);
    // So does an input that is no longer the same object (a file re-read, a run saved elsewhere).
    const p4 = memo('k', () => Promise.resolve([rows.slice()]), compute);
    await new Promise((r) => setTimeout(r, 0));
    expect(builds).toBe(3);
    release();
    expect(await p4).not.toBe(v3);
  });

  test('asyncMemo forgets a build that threw and expires after the TTL', async () => {
    const memo = asyncMemo({ ttl: 50, revision: () => 0 });
    let n = 0;
    await expect(memo('k', null, () => { n += 1; throw new Error('boom'); })).rejects.toThrow('boom');
    expect(memo.has('k')).toBe(false);
    const v = await memo('k', null, () => ({ n: ++n }));
    expect(await memo('k', null, () => ({ n: ++n }))).toBe(v);
    await new Promise((r) => setTimeout(r, 60));
    expect(await memo('k', null, () => ({ n: ++n }))).not.toBe(v);
    expect(n).toBe(3);
  });
});

describe('the defense tables off one aggregate', () => {
  const { defenseByPosition, defenseBySlot, blendedDefense, defenseVsTeam, pairRows } = require('../lib/nhl-data/defense');
  const { h2hTotals } = require('../lib/nhl-data/verdict');
  const { toRow, rowObj } = require('../lib/nhl-data/ingest');
  const game = (id, date) => ({ id, date });
  const sk = (id, name, team, opp, venue, pos, sog, g, line = 1) => ({ id, name, team, opp, venue, pos, line, posSource: 'lineup', toi: 15, g, a: 0, sog, hits: 0, blk: 0, icf: sog + 1, iff: sog, isf: sog, iscf: 1, ihdcf: 0, result: 'W' });
  const rows = [
    toRow(game(2024020001, '2025-01-01'), sk(1, 'A One', 'NYR', 'FLA', 'A', 'LW', 4, 1)),
    toRow(game(2024020001, '2025-01-01'), sk(2, 'B Two', 'FLA', 'NYR', 'H', 'C', 2, 0)),
    toRow(game(2025020002, '2025-10-03'), sk(1, 'A One', 'NYR', 'FLA', 'H', 'LW', 3, 0)),
    toRow(game(2025020002, '2025-10-03'), sk(2, 'B Two', 'FLA', 'NYR', 'A', 'C', 5, 2)),
    toRow(game(2025010003, '2025-09-25'), sk(1, 'A One', 'NYR', 'BOS', 'H', 'LW', 7, 1)),   // preseason
  ].map(rowObj);

  test('season, window, regular-season and slot tables read the same per-game totals', () => {
    const season = defenseByPosition(rows);
    expect(season.teams.FLA.ALL.LW).toMatchObject({ gp: 2, sog: 3.5 });
    expect(defenseByPosition(rows, { lastN: 1 }).teams.FLA.ALL.LW.sog).toBe(3);
    // The preseason game is left out of the regular-season table and of no other.
    expect(defenseByPosition(rows).teams.BOS.ALL.LW.sog).toBe(7);
    expect(defenseByPosition(rows, { games: 'regular' }).teams.BOS).toBeUndefined();
    expect(defenseByPosition(rows, { games: 'regular' }).teamCount).toBe(2);
    expect(defenseBySlot(rows).teams.FLA.ALL.LW1.sog).toBe(3.5);
    expect(defenseBySlot(rows).teams.FLA.ALL.LW2.gp).toBe(2);
    expect(defenseBySlot(rows).teams.FLA.ALL.LW2.sog).toBe(0);
    // Blended: this season's game at games / (games + 15) over last season's base (none under 10 games).
    const blend = blendedDefense(rows, '2025-10-20');
    expect(blend.teams.FLA.ALL.LW).toMatchObject({ gp: 1, base: 0 });
    expect(blend.teams.FLA.ALL.LW.sog).toBe(3);
  });

  test('head-to-head reads come off the pair index, kept per rows array', () => {
    const pairs = pairRows(rows);
    expect(pairRows(rows)).toBe(pairs);
    expect(pairs.get('FLA|NYR').map((r) => r.gameId)).toEqual([2024020001, 2025020002]);
    expect(defenseVsTeam(rows, 'FLA', 'NYR').ALL.LW.sog).toBe(3.5);
    expect(defenseVsTeam(rows, 'FLA', 'BOS')).toBeNull();
    const totals = h2hTotals(rows, 'NYR', 'FLA');
    expect(totals.map((t) => t.total)).toEqual([1, 2]);
    expect(totals[1]).toMatchObject({ home: 'NYR', goals: { NYR: 0, FLA: 2 } });
    expect(h2hTotals(rows, 'NYR', 'FLA')).toBe(totals);
    expect(h2hTotals(rows, 'NYR', 'BOS')).toHaveLength(1);
  });
});
