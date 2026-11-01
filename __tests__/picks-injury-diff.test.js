import { injuryChanges } from '../lib/picks/injury-diff';

const board = (players, rows, { final = false } = {}) => ({
  games: [{ id: 'g1', final, sides: { SEA: { team: 'SEA', players } } }],
  projections: { rows },
});

describe('injuryChanges', () => {
  const before = board(
    [
      { key: 'kwalker', player: 'Kenneth Walker', pos: 'RB', health: 'In' },
      { key: 'zcharbonnet', player: 'Zach Charbonnet', pos: 'RB', health: 'In' },
      { key: 'dmetcalf', player: 'DK Metcalf', pos: 'WR', health: 'DTD', injury: 'Questionable' },
    ],
    {
      'zcharbonnet|SEA': { player: 'Zach Charbonnet', team: 'SEA', pos: 'RB', yards: { rush_yds: { proj: 32 } }, td: { p: 0.22 } },
      'dmetcalf|SEA': { player: 'DK Metcalf', team: 'SEA', pos: 'WR', yards: { rec_yds: { proj: 61 } }, td: { p: 0.31 } },
    },
  );
  const after = board(
    [
      { key: 'kwalker', player: 'Kenneth Walker', pos: 'RB', health: 'Out', injury: 'Out', injuryDetail: 'Ankle' },
      { key: 'zcharbonnet', player: 'Zach Charbonnet', pos: 'RB', health: 'In' },
      { key: 'dmetcalf', player: 'DK Metcalf', pos: 'WR', health: 'In' },
    ],
    {
      'zcharbonnet|SEA': { player: 'Zach Charbonnet', team: 'SEA', pos: 'RB', yards: { rush_yds: { proj: 58 } }, td: { p: 0.38 } },
      'dmetcalf|SEA': { player: 'DK Metcalf', team: 'SEA', pos: 'WR', yards: { rec_yds: { proj: 61.2 } }, td: { p: 0.312 } },
    },
  );

  it('names the status changes, the newly out first', () => {
    const c = injuryChanges(before, after);
    expect(c.status.map((s) => [s.name, s.from, s.to])).toEqual([['Kenneth Walker', 'In', 'Out'], ['DK Metcalf', 'DTD', 'In']]);
    expect(c.status[0].detail).toBe('Ankle');
    expect(c.counts).toMatchObject({ status: 2, out: 1, dtd: 0, back: 1 });
  });

  it('lists the projections that moved, ignoring rounding noise', () => {
    const c = injuryChanges(before, after);
    expect(c.moved.map((m) => [m.name, m.market])).toEqual([['Zach Charbonnet', 'rush_yds'], ['Zach Charbonnet', 'anytime_td']]);
    expect(c.counts.moved).toBe(2);
  });

  it('reports nothing for an unchanged board or a played game', () => {
    expect(injuryChanges(before, before).counts).toEqual({ status: 0, out: 0, dtd: 0, back: 0, moved: 0 });
    const fb = { ...before, games: before.games.map((g) => ({ ...g, final: true })) };
    const fa = { ...after, games: after.games.map((g) => ({ ...g, final: true })) };
    expect(injuryChanges(fb, fa).counts.status).toBe(0);
  });
});
