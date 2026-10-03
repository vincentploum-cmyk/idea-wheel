import { describe, expect, test } from '@jest/globals';
import { gameLogAgainst } from '../lib/nhl-data/defense';

const row = (date, gameId, playerId, name, team, opp, venue, pos, line, g, sog, result = 'W') => ({ date, gameId, playerId, name, team, opp, venue, pos, line, toi: 15, g, a: 0, sog, hits: 1, blk: 0, icf: sog + 1, iff: sog, isf: sog, iscf: 1, ihdcf: 0, result });

describe('game log against a team', () => {
  const rows = [
    row('2026-09-29', 1, 11, 'A', 'MTL', 'TOR', 'A', 'RW', 1, 0, 1, 'L'),
    row('2026-09-30', 2, 12, 'B', 'BUF', 'TOR', 'A', 'RW', 2, 1, 4, 'W'),
    row('2026-09-30', 2, 13, 'C', 'BUF', 'TOR', 'A', 'D', null, 0, 2, 'W'),
    row('2026-09-30', 2, 14, 'G', 'BUF', 'TOR', 'A', 'G', null, 0, 0, 'W'),
    row('2026-09-30', 3, 15, 'D', 'TOR', 'BUF', 'H', 'C', 1, 2, 5, 'L'),
  ];
  test('keeps skaters who faced the team, newest first, with their slot, points and result', () => {
    const log = gameLogAgainst(rows, 'TOR');
    expect(log.map((r) => r.name)).toEqual(['B', 'C', 'A']);
    expect(log[0]).toMatchObject({ slot: 'RW2', pts: 1, sog: 4, result: 'W', venue: 'A', team: 'BUF' });
    // A box-score position has no slot; goalies and TOR's own skaters are left out.
    expect(log[1].slot).toBeNull();
    expect(log.some((r) => r.pos === 'G' || r.team === 'TOR')).toBe(false);
  });
});
