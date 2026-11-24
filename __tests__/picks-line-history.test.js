// The lines across a night's pulls (2026-11-24): where each line opened, and a started game's lines kept from before tip.
import { describe, expect, test } from '@jest/globals';
import { carryForward, moveOf } from '../lib/picks/line-history';
import { impliedProb } from '../lib/nfl/odds';

const pull = (at, players) => ({ at, data: { players } });
const games = [{ away: 'IND', home: 'DET', date: '2026-11-24T00:00:00Z' }, { away: 'LAL', home: 'PHX', date: '2026-11-24T03:00:00Z' }];

describe('carryForward', () => {
  test('the first pull opens every line at its own price; a later pull keeps the open and moves the price', () => {
    const first = carryForward(null, pull('2026-11-23T14:47:00Z', [{ key: 'a', team: 'LAL', props: [{ market: 'pts', line: 24.5, odds: -110, underOdds: -110, fair: 0.5 }] }]), { games, now: '2026-11-23T14:47:00Z' }).pull;
    expect(first.data.players[0].props[0].open).toEqual({ line: 24.5, odds: -110, underOdds: -110, fair: 0.5, at: '2026-11-23T14:47:00Z' });
    const second = carryForward(first, pull('2026-11-23T22:23:00Z', [{ key: 'a', team: 'LAL', props: [{ market: 'pts', line: 25.5, odds: -105, underOdds: -115 }] }]), { games, now: '2026-11-23T22:23:00Z' });
    expect(second.pull.data.players[0].props[0]).toMatchObject({ line: 25.5, open: { line: 24.5, odds: -110, at: '2026-11-23T14:47:00Z' } });
    expect(second.carried.opened).toBe(1);
  });

  test('a started game keeps its lines when the pull near the late tips no longer lists them', () => {
    const prev = pull('2026-11-23T22:23:00Z', [
      { key: 'early', team: 'IND', props: [{ market: 'pts', line: 18.5, odds: -110, underOdds: -110 }] },
      { key: 'late', team: 'LAL', props: [{ market: 'reb', line: 7.5, odds: -120, underOdds: 100 }] },
    ]);
    const next = pull('2026-11-24T01:00:00Z', [{ key: 'late', team: 'LAL', props: [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110 }] }]);
    const { pull: out, carried } = carryForward(prev, next, { games, now: '2026-11-24T01:00:00Z' });
    expect(out.data.players.map((p) => p.key)).toEqual(['late', 'early']);
    expect(out.data.players[1].props[0]).toMatchObject({ line: 18.5, open: { line: 18.5 } });
    expect(carried.keptPlayers).toBe(1);
    // A game still to start is never kept from the old pull: its lines are the books' now.
    const notYet = carryForward(prev, pull('2026-11-23T23:00:00Z', []), { games, now: '2026-11-23T23:00:00Z' });
    expect(notYet.pull.data.players).toEqual([]);
  });

  test('moveOf: the side’s implied chance now less at the open, or the line’s move', () => {
    const row = { line: 24.5, odds: -130, underOdds: 105, open: { line: 24.5, odds: -110, underOdds: -110 } };
    expect(moveOf(row, 'over', impliedProb).price).toBeCloseTo(0.565 - 0.524, 2);
    expect(moveOf(row, 'under', impliedProb).price).toBeLessThan(0);
    expect(moveOf({ ...row, line: 25.5 }, 'over', impliedProb)).toEqual({ line: 1, price: null });
  });
});
