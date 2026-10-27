import { describe, expect, test } from '@jest/globals';
import { minutesTonight, RECENT_WEIGHT, FACTOR_MIN, FACTOR_MAX } from '../lib/picks/rotations';

describe('the rotation: minutes tonight', () => {
  const g = (i, extra = {}) => ({ gameId: `g${i}`, season: 2026, type: 'REG', ...extra });
  const games = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => g(i));
  test('his last five blend into the minutes behind his rate; the factor is tonight over the base, clamped', () => {
    expect(RECENT_WEIGHT).toBe(0.5);
    // Base = 0.35 × l10 + 0.65 × season = 24; recent = 0.5 × 30 + 0.5 × 24 = 27 → × 1.125.
    const m = minutesTonight([{ key: 'a', games, minutes: { l5: 30, l10: 24, season: 24 } }], [], { season: 2026 });
    expect(m.a).toEqual({ base: 24, recent: 27, vacated: 0, tonight: 27, factor: 1.125, from: [] });
    // Steady minutes: no factor.
    expect(minutesTonight([{ key: 'a', games, minutes: { l5: 24, l10: 24, season: 24 } }], [], { season: 2026 }).a.factor).toBe(1);
    // A role cut in half reads down to the floor; one that tripled tops out.
    expect(minutesTonight([{ key: 'a', games, minutes: { l5: 10, l10: 30, season: 30 } }], [], { season: 2026 }).a.factor).toBe(FACTOR_MIN);
    expect(minutesTonight([{ key: 'a', games, minutes: { l5: 36, l10: 10, season: 10 } }], [], { season: 2026 }).a.factor).toBe(FACTOR_MAX);
    // No minutes in the logs: nothing to say.
    expect(minutesTonight([{ key: 'a', games, minutes: null }], [], { season: 2026 })).toEqual({});
  });
  test('the out players’ minutes go to the ones who play, by their own minutes, the priced players’ share of them, capped', () => {
    const star = { key: 'star', name: 'The Star', played: new Set(games.map((x) => x.gameId)), minutes: { l5: 36, l10: 36, season: 36 } };
    const active = [
      { key: 'a', games, minutes: { l5: 30, l10: 30, season: 30 } },
      { key: 'b', games, minutes: { l5: 20, l10: 20, season: 20 } },
    ];
    // 36 × 1 (he played all their games) × share 0.5 = 18 shared 30 : 20 → 10.8 to a (40.8, capped at 38 → × 1.267), 7.2 to b (27.2, × 1.36 → FACTOR_MAX).
    const m = minutesTonight(active, [star], { season: 2026, share: 0.5, cap: 38 });
    expect(m.a).toEqual({ base: 30, recent: 30, vacated: 8, tonight: 38, factor: 1.267, from: ['The Star'] });
    expect(m.b).toEqual({ base: 20, recent: 20, vacated: 7.2, tonight: 27.2, factor: FACTOR_MAX, from: ['The Star'] });
    // Out all season (none of their games): nothing to hand over. The cap never cuts the minutes he plays already.
    expect(minutesTonight(active, [{ ...star, played: new Set(['x']) }], { season: 2026 }).a).toMatchObject({ vacated: 0, tonight: 30, factor: 1, from: [] });
    expect(minutesTonight([{ key: 'c', games, minutes: { l5: 40, l10: 40, season: 40 } }], [star], { season: 2026, share: 0.5, cap: 38 }).c).toMatchObject({ tonight: 40, factor: 1 });
    // Half his games with the star: half the minutes.
    const half = { ...star, played: new Set(['g0', 'g1', 'g2', 'g3']) };
    expect(minutesTonight([active[0]], [half], { season: 2026, share: 0.5, cap: 48 }).a.vacated).toBe(9);
  });
});
