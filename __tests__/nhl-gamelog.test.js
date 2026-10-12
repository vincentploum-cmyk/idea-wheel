import { describe, expect, test } from '@jest/globals';
import { gameLogAgainst } from '../lib/nhl-data/defense';
import { shootingProfile, shootingProfiles, similarProfile } from '../lib/nhl-data/profile';

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

describe('shooting / scoring profile', () => {
  const game = (playerId, date, sog, g) => ({ playerId, date, sog, g, icf: sog + 2, toi: 17 });
  const many = (playerId, season, n, sog, g) => Array.from({ length: n }, (_, i) => game(playerId, `${season}-11-${String(1 + (i % 28)).padStart(2, '0')}`, sog, g));

  test('blends this season into last at n / (n + 18) shots and n / (n + 40) goals', () => {
    // 6 games this season at 5 shots / 1 goal over a 20-game prior at 2 shots / 0 goals.
    const p = shootingProfile([...many(1, 2026, 6, 5, 1), ...many(1, 2025, 20, 2, 0)], 2026);
    expect(p.gp).toBe(6);
    expect(p.n).toBe(26);
    expect(p.sog).toBeCloseTo((6 / 24) * 5 + (18 / 24) * 2, 2);
    expect(p.g).toBeCloseTo((6 / 46) * 1, 2);
  });
  test('last season alone before his first game; this season alone without a 10-game prior; null without games', () => {
    expect(shootingProfile(many(1, 2025, 20, 3, 0.5), 2026)).toMatchObject({ gp: 0, n: 20, sog: 3 });
    expect(shootingProfile([...many(1, 2026, 4, 4, 0), ...many(1, 2025, 3, 1, 0)], 2026)).toMatchObject({ gp: 4, n: 4, sog: 4 });
    expect(shootingProfile([], 2026)).toBeNull();
  });
  test('similar: within 15% of his shots (at least 0.35) and 30% of his goals (at least 0.08), read off 10+ games', () => {
    const me = { sog: 3.4, g: 0.3, n: 30 };
    expect(similarProfile(me, { sog: 3.8, g: 0.36, n: 30 })).toBe(true);
    expect(similarProfile(me, { sog: 4.0, g: 0.3, n: 30 })).toBe(false); // shots off by 0.6 > 0.51
    expect(similarProfile(me, { sog: 3.4, g: 0.42, n: 30 })).toBe(false); // goals off by 0.12 > 0.09
    expect(similarProfile(me, { sog: 3.5, g: 0.3, n: 6 })).toBe(false); // too few games
    expect(similarProfile(null, { sog: 3.5, g: 0.3, n: 30 })).toBe(false);
    // A low scorer gets the floors: 0.35 shots and 0.08 goals.
    expect(similarProfile({ sog: 1.0, g: 0.05, n: 20 }, { sog: 1.3, g: 0.12, n: 20 })).toBe(true);
  });
  test('profiles per skater over mixed rows', () => {
    const rows = [...many(1, 2026, 5, 3, 0.2), ...many(2, 2026, 12, 3.2, 0.25), ...many(3, 2026, 12, 1, 0)];
    const ps = shootingProfiles(rows, [1, 2, 3, 9], 2026);
    expect(Object.keys(ps).sort()).toEqual(['1', '2', '3']);
    expect(similarProfile(ps[1], ps[2])).toBe(true);
    expect(similarProfile(ps[1], ps[3])).toBe(false);
  });
});
