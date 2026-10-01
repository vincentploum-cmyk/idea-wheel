import { describe, expect, test } from '@jest/globals';
import { defenseByPosition, playerBaselines } from '../lib/nhl-data/defense';
import { toRow, rowObj } from '../lib/nhl-data/ingest';

const game = (id, date) => ({ id, date });
const sk = (id, name, team, opp, venue, pos, sog, g) => ({ id, name, team, opp, venue, pos, toi: 15, g, a: 0, sog, hits: 0, blk: 0, icf: sog + 1, iff: sog, isf: sog, iscf: 1, ihdcf: 0, result: 'W' });
const rows = [
  toRow(game(1, '2026-10-01'), sk(1, 'A One', 'NYR', 'FLA', 'A', 'LW', 4, 1)),
  toRow(game(1, '2026-10-01'), sk(2, 'B Two', 'FLA', 'NYR', 'H', 'C', 2, 0)),
  toRow(game(2, '2026-10-03'), sk(1, 'A One', 'NYR', 'BOS', 'H', 'LW', 3, 0)),
  toRow(game(2, '2026-10-03'), sk(3, 'C Three', 'BOS', 'NYR', 'A', 'D', 1, 0)),
].map(rowObj);

describe('per-request memoisation', () => {
  test('defense tables and baselines are computed once per rows array and option set', () => {
    const season = defenseByPosition(rows);
    expect(defenseByPosition(rows)).toBe(season);
    expect(defenseByPosition(rows, { lastN: 0 })).toBe(season);
    const l10 = defenseByPosition(rows, { lastN: 10 });
    expect(l10).not.toBe(season);
    expect(l10.teams.FLA.H.LW.sog).toBe(4);
    expect(season.teams.FLA.H.LW.sog).toBe(4);
    // Another array with the same content is a new computation, not a stale hit.
    const copy = rows.map((r) => ({ ...r }));
    expect(defenseByPosition(copy)).not.toBe(season);
    expect(defenseByPosition(copy)).toEqual(season);

    const base = playerBaselines(rows, { window: 20 });
    expect(playerBaselines(rows, { window: 20 })).toBe(base);
    expect(playerBaselines(rows, { window: 5 })).not.toBe(base);
    expect(base[1].all.sog).toBe(3.5);
  });
});
