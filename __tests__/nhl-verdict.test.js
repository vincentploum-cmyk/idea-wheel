import { describe, expect, test } from '@jest/globals';
import { defenseTier, paceTier, teamVerdict } from '../lib/nhl-data/verdict';

const pos = (rank) => ({ season: { gp: 20, sog: 7, g: 0.8 }, rank: { sog: rank, g: rank }, teamCount: 32 });
const defense = {
  All: { season: { gp: 20, sog: 29.4, g: 3.1 }, rank: { sog: 4, g: 6 }, teamCount: 32, l10: { gp: 10, sog: 26.1 }, l10Rank: { sog: 15 }, source: 'games' },
  LW: pos(2), C: pos(9), RW: pos(14), D: pos(30),
};
const mp = {
  teams: 32,
  situations: { all: { PHI: { sf60: 31.2, xgf60: 2.61, cf60: 58.1, ca60: 60.4 }, PIT: { sf60: 27.0, xgf60: 2.2, cf60: 50, ca60: 52, pace60: 102 } } },
  ranks: { all: { PHI: { sf60: 5, xgf60: 11, pace60: 3 }, PIT: { sf60: 22, xgf60: 20, pace60: 29 } } },
};

describe('team verdicts', () => {
  test('tiers by thirds of the league', () => {
    expect(defenseTier(1)).toBe('leaky');
    expect(defenseTier(11)).toBe('leaky');
    expect(defenseTier(12)).toBe('average');
    expect(defenseTier(21)).toBe('average');
    expect(defenseTier(22)).toBe('tight');
    expect(defenseTier(null)).toBeNull();
    expect(paceTier(2)).toBe('fast');
    expect(paceTier(30)).toBe('slow');
  });
  test('a leaky home defense reads as such, by position, with trend, offense and pace', () => {
    const v = teamVerdict({ team: 'PHI', venue: 'H', defense, teamCount: 32, mp });
    expect(v.tier).toBe('leaky');
    expect(v.headline).toBe('Leaky defense at home');
    const byKey = Object.fromEntries(v.lines.map((l) => [l.key, l]));
    expect(byKey.defense.text).toBe('Leaky defense at home: allows 29.4 SOG (#4) and 3.10 goals (#6) per game over 20 games.');
    expect(byKey.defense.tone).toBe('is-soft');
    expect(byKey.positions.text).toBe('Leaks shots to LW (#2), C (#9) · holds D (#30).');
    expect(byKey.trend.text).toBe('Last 10: 26.1 SOG allowed (#15, average) · tightening.');
    expect(byKey.trend.tone).toBe('is-tough');
    expect(byKey.offense.text).toBe('Offense: 31.2 SF/60 (#5), 2.61 xGF/60 (#11) · high volume.');
    // Pace falls back to CF/60 + CA/60 when the stored snapshot predates the pace column.
    expect(byKey.pace.text).toBe('Pace: 118.5 shot attempts/60 both ways (#3, fast).');
  });
  test('a tight away defense, slow pace, and nothing when there is no data', () => {
    const tight = { ...defense, All: { ...defense.All, rank: { sog: 27, g: 25 } }, LW: pos(28), C: pos(16), RW: pos(12), D: pos(13) };
    const v = teamVerdict({ team: 'PIT', venue: 'A', defense: tight, mp });
    expect(v.headline).toBe('Tight defense away');
    const byKey = Object.fromEntries(v.lines.map((l) => [l.key, l]));
    expect(byKey.positions.text).toBe('Holds LW (#28).');
    expect(byKey.pace.text).toBe('Pace: 102.0 shot attempts/60 both ways (#29, slow).');
    expect(byKey.offense.text).toContain('low volume');
    expect(teamVerdict({ team: 'X', venue: 'H', defense: { All: {} } })).toBeNull();
    expect(teamVerdict({ team: null, venue: 'H', defense })).toBeNull();
  });
});
