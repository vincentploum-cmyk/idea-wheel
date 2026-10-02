import { describe, expect, test } from '@jest/globals';
import { defenseTier, paceTier, teamVerdict, h2hTotals, gameTotalRead, leagueGoalsPerGame } from '../lib/nhl-data/verdict';
import { rowObj } from '../lib/nhl-data/ingest';

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

describe('game total read', () => {
  const row = (date, gameId, pid, team, opp, venue, g) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, 'C', 15, g, 0, 2, 0, 0, 2, 2, 2, 1, 0, 'W']);
  const rows = [
    // Three NYR–NJD meetings: 7, 4 and 8 goals. One unrelated game.
    row('2025-11-01', 1, 1, 'NYR', 'NJD', 'A', 3), row('2025-11-01', 1, 2, 'NYR', 'NJD', 'A', 1), row('2025-11-01', 1, 3, 'NJD', 'NYR', 'H', 3),
    row('2026-01-05', 2, 1, 'NYR', 'NJD', 'H', 2), row('2026-01-05', 2, 3, 'NJD', 'NYR', 'A', 2),
    row('2026-03-02', 3, 1, 'NYR', 'NJD', 'A', 5), row('2026-03-02', 3, 3, 'NJD', 'NYR', 'H', 3),
    row('2026-03-05', 4, 1, 'NYR', 'BOS', 'H', 1), row('2026-03-05', 4, 9, 'BOS', 'NYR', 'A', 0),
  ];
  const teams = Object.fromEntries(['NYR', 'NJD', 'BOS', 'PHI', 'PIT', 'TOR', 'MTL', 'OTT', 'BUF', 'DET', 'FLA', 'TBL'].map((t) => [t, { gf60: 3.0, ga60: 3.0, xgf60: 3.0, xga60: 3.0, cf60: 55, ca60: 55, pace60: 110 }]));
  const mp = {
    teams: 12,
    situations: { all: { ...teams, NYR: { gf60: 3.6, ga60: 3.2, xgf60: 3.4, xga60: 3.1, cf60: 62, ca60: 60, pace60: 122 }, NJD: { gf60: 3.4, ga60: 3.4, xgf60: 3.2, xga60: 3.3, cf60: 60, ca60: 61, pace60: 121 } } },
    ranks: { all: { NYR: { xgf60: 1, xga60: 10, pace60: 1 }, NJD: { xgf60: 2, xga60: 11, pace60: 2 } } },
  };
  test("h2hTotals lists the stored meetings with each side's goals", () => {
    const h = h2hTotals(rows, 'NYR', 'NJD');
    expect(h.map((g) => g.total)).toEqual([7, 4, 8]);
    expect(h[0]).toMatchObject({ gameId: 1, home: 'NJD', goals: { NYR: 4, NJD: 3 } });
    expect(h2hTotals(rows, 'NYR', 'PHI')).toEqual([]);
  });
  test('league average comes from GF/60, with a fallback', () => {
    expect(leagueGoalsPerGame(mp)).toBeCloseTo(6.2, 1);
    expect(leagueGoalsPerGame(null)).toBe(6.1);
  });
  test('two high-event teams with high-scoring meetings read as a high-scoring game', () => {
    const t = gameTotalRead({ away: 'NYR', home: 'NJD', h2h: h2hTotals(rows, 'NYR', 'NJD'), mp });
    // Expected: NJD (3.2 + 3.1)/2 + NYR (3.4 + 3.3)/2 = 3.15 + 3.35 = 6.5; h2h avg 6.3 at 30% → 6.44; both fast → +0.25.
    expect(t.expected).toMatchObject({ total: 6.5, split: false });
    expect(t.h2h).toMatchObject({ gp: 3, avg: 6.3, over: 2 });
    expect(t.pace.both).toBe('fast');
    expect(t.projected).toBeCloseTo(6.7, 1);
    expect(t.tier).toBe('high');
    expect(t.headline).toMatch(/^High-scoring game likely/);
    expect(t.lines.map((l) => l.key)).toEqual(['h2h', 'xg', 'pace', 'read']);
    expect(t.lines[0].text).toContain('3 meetings');
    expect(t.lines[0].text).toContain('last NJD 3–5 NYR (2026-03-02)');
  });
  test('venue splits are used once both teams have enough games there', () => {
    const split = { ...mp, byVenue: { all: { H: { NJD: { gp: 8, xgf60: 2.4, xga60: 2.2 } }, A: { NYR: { gp: 8, xgf60: 2.3, xga60: 2.5 } } } }, venueRanks: { all: { H: { NJD: { xgf60: 20 } }, A: {} } } };
    const t = gameTotalRead({ away: 'NYR', home: 'NJD', h2h: [], mp: split });
    expect(t.expected).toMatchObject({ total: 4.7, split: true, gp: { home: 8, away: 8 } });
    expect(t.basis).toBe('moneypuck');
    expect(t.tier).toBe('low');
    expect(t.lines[1].text).toContain('NJD at home over 8 games');
    // Too few games at the venue: back to the season tables.
    expect(gameTotalRead({ away: 'NYR', home: 'NJD', h2h: [], mp: { ...split, byVenue: { all: { H: { NJD: { ...split.byVenue.all.H.NJD, gp: 3 } }, A: split.byVenue.all.A } } } }).expected.split).toBe(false);
  });
  test('head to head alone still gives a read; nothing at all gives none', () => {
    const t = gameTotalRead({ away: 'NYR', home: 'NJD', h2h: h2hTotals(rows, 'NYR', 'NJD'), mp: null });
    expect(t).toMatchObject({ basis: 'h2h', projected: 6.3, tier: 'average' });
    expect(gameTotalRead({ away: 'NYR', home: 'BOS', h2h: [], mp: null })).toBeNull();
  });
});
