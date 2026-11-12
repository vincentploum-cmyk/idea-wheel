import { rankThird, rankTone } from '@/components/nhl/pf-ui';
import { bandTone, tintRank, zoneTone } from '@/components/nhl/Rink';

// Tinted from PropFinder, a band reads the table's split (1–11 / 12–22 / 23–32 of 32) on its tint rank,
// the way the cells above it are coloured; off the stored games the rink keeps its own split. Vincent,
// 2026-11-12, of WSH's LW at #22 SOG: amber in the table, red on the ice.
const pf = (rank) => ({ source: 'propfinder', rank, teamCount: 32 });

describe('rank thirds', () => {
  test("PropFinder's split of 32", () => {
    expect([1, 11, 12, 22, 23, 32].map((r) => rankThird(r, 32))).toEqual(['soft', 'soft', 'mid', 'mid', 'tough', 'tough']);
    expect(rankThird(null, 32)).toBe('none');
  });
  test('a PropFinder band on a single rank matches the table cell at every rank', () => {
    for (let r = 1; r <= 32; r += 1) expect(`is-${bandTone(pf({ sog: r }), 'sog', 32)}`).toBe(rankTone(r, 32));
  });
  test("WSH's LW off the L10 tab: amber on shots, the ISCF read under goals", () => {
    const d = pf({ sog: 22, g: 2, icf: 8, iff: 15, iscf: 10 });
    expect(tintRank(d, 'sog')).toBe(16.8);
    expect(bandTone(d, 'sog', 32)).toBe('mid');
    expect(bandTone(d, 'g', 32)).toBe('soft');
  });
  test('a stored-games band keeps the rink split', () => {
    expect(bandTone({ rank: { sog: 22 }, teamCount: 32 }, 'sog', 32)).toBe(zoneTone(22, 32));
    expect(zoneTone(22, 32)).toBe('tough');
  });
});
