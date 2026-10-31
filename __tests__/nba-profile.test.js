import { describe, expect, test } from '@jest/globals';
import { teamProfile, gameProfile, rankIn, PROFILE_ROWS } from '../lib/nba/profile';
import { buildBoard } from '../lib/nba/picks';

// Sixteen teams: fourteen fillers near the average, BOS strong, NY weak.
const fillers = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`T${String(i).padStart(2, '0')}`, { for: { gp: 12, pts: 113 + i * 0.1, reb: 44 + i * 0.1, ast: 25 + i * 0.1, tpm: 13 + i * 0.05, ftm: 19 + i * 0.1, tov: 13.5 + i * 0.05 }, against: { gp: 12, pts: 114 + i * 0.1, reb: 44, tpm: 13, tov: 13.5 }, l10: { against: { gp: 10, pts: 114 + i * 0.1 } } }]));
const totals = {
  ...fillers,
  BOS: { for: { gp: 12, pts: 120, reb: 46, ast: 27, tpm: 18, ftm: 18, tov: 12 }, against: { gp: 12, pts: 108, reb: 42, tpm: 12, tov: 15 }, l10: { against: { gp: 10, pts: 118 } } },
  NY: { for: { gp: 12, pts: 110, reb: 44, ast: 24, tpm: 12, ftm: 20, tov: 15 }, against: { gp: 12, pts: 118, reb: 46, tpm: 15, tov: 12 }, l10: { against: { gp: 10, pts: 106 } } },
};
const mean = (side, key) => { const v = Object.values(totals).map((t) => t[side]?.[key]).filter((x) => x != null); return v.reduce((s, x) => s + x, 0) / v.length; };
const defense = { count: 16, totals, leagueFor: { pts: mean('for', 'pts') } };
const cellOf = (rank, sheet = null) => ({ value: 20, rank, rankBlend: sheet != null ? Math.round((rank + sheet) / 2) : rank, sheet });
const sides = {
  BOS: { team: 'BOS', opp: 'NY', teamProj: { pts: 121 }, out: [],
    // What NY gives up (BOS attacks it): PG leaky on points, C on rebounds; C tight on points.
    allowed: { count: 16, from: 'propfinder', rows: { PG: { pts: cellOf(2, 3), reb: cellOf(8) }, SG: { pts: cellOf(7) }, SF: { pts: cellOf(9) }, PF: { pts: cellOf(10) }, C: { pts: cellOf(15), reb: cellOf(1) } } } },
  NY: { team: 'NY', opp: 'BOS', teamProj: { pts: 104 }, out: [{ name: 'Josh Hart' }],
    // What BOS gives up: nothing soft, three positions tight.
    allowed: { count: 16, from: 'propfinder', rows: { PG: { pts: cellOf(12) }, SG: { pts: cellOf(14) }, SF: { pts: cellOf(9) }, PF: { pts: cellOf(16) }, C: { pts: cellOf(15) } } } },
};
const row = (p, key, team) => p.rows.find((r) => r.key === key)?.cells[team] || null;

describe('the NBA matchup profile', () => {
  test('rankIn: 1 = the highest, or the lowest when low; ties share the better rank', () => {
    expect(rankIn([1, 2, 3], 3)).toEqual({ rank: 1, n: 3 });
    expect(rankIn([1, 2, 3], 1, true)).toEqual({ rank: 1, n: 3 });
    expect(rankIn([2, 2, 3], 2)).toEqual({ rank: 2, n: 3 });
    expect(rankIn([null, 2], null)).toBeNull();
  });
  test('each team’s cells: a word, the line as parts with the rank phrases toned, every read on the hover', () => {
    const bos = teamProfile({ team: 'BOS', defense, oppSide: sides.NY });
    expect(bos.scoring).toMatchObject({ word: 'Elite', level: 'elite', tone: 'is-soft', source: 'propfinder', text: '120.0 points a game · 1st of 16 · 18.0 threes (1st, 45% of its points)' });
    expect(bos.scoring.parts[1]).toEqual({ t: '1st of 16', tone: 'is-soft' });
    expect(bos.scoring.title).toBe("PropFinder's team row, 12 games: 120.0 points a game, 1st of 16 · 18.0 threes made a game, 1st of 16 · 18.0 free throws made a game");
    expect(bos.rebounding).toMatchObject({ word: 'Elite', text: '46.0 rebounds a game · 1st of 16' });
    expect(bos.playmaking).toMatchObject({ word: 'Elite', text: '27.0 assists a game · 1st of 16 · 12.0 turnovers (1st fewest)' });
    // Allows the fewest: 16th of 16 most → Elite, red; its last ten 118 allowed, the most of 16 → loosening.
    expect(bos.allows).toMatchObject({ word: 'Elite', tone: 'is-tough', trend: 'loosening', text: '108.0 points allowed a game · 16th of 16 most · last 10: 118.0 (1st most, loosening)' });
    expect(bos.allows.parts.filter((x) => x.tone != null)).toEqual([{ t: '16th of 16 most', tone: 'is-tough' }, { t: '1st most', tone: 'is-soft' }]);
    // What BOS gives up (NY's allowed table): nothing in the soft third, three positions in the tough third of five.
    expect(bos.spots).toMatchObject({ word: 'Average', tone: '', text: 'points: none' });
    expect(bos.spots.title).toContain('points: SF #9, PG #12, SG #14, C #15, PF #16 of 16');
    const ny = teamProfile({ team: 'NY', defense, oppSide: sides.BOS });
    expect(ny.scoring).toMatchObject({ word: 'Poor', level: 'poor', tone: 'is-tough' });
    expect(ny.allows).toMatchObject({ word: 'Very leaky', tone: 'is-soft', trend: 'tightening' });
    expect(ny.allows.text).toBe('118.0 points allowed a game · 1st of 16 most · last 10: 106.0 (16th most, tightening)');
    // What NY gives up: PG in the soft third on points (#3 blended of PropFinder's #2 and the sheet's #3), C on rebounds.
    expect(ny.spots).toMatchObject({ word: 'Leaky', level: 'weak', tone: 'is-soft', text: 'points to PG #3 · rebounds to C #1' });
    expect(ny.spots.parts.filter((x) => x.tone)).toEqual([{ t: 'PG #3', tone: 'is-soft' }, { t: 'C #1', tone: 'is-soft' }]);
    expect(ny.spots.title).toContain('points: PG #3 (PropFinder #2, sheet #3), SG #7');
    // A filler team in the middle reads Average; a team without a row reads nothing.
    const t = teamProfile({ team: 'T07', defense, oppSide: null });
    expect(t.scoring).toMatchObject({ word: 'Average', tone: '' });
    expect(t.spots).toBeUndefined();
    expect(teamProfile({ team: 'ZZZ', defense, oppSide: null })).toBeNull();
  });
  test('the game: the card’s shape — order, heads with the defense pill, the expected points, five rows', () => {
    const p = gameProfile({ away: 'BOS', home: 'NY' }, defense, sides);
    expect(p.order).toEqual(['BOS', 'NY']);
    expect(PROFILE_ROWS).toHaveLength(5);
    expect(p.rows.map((r) => r.key)).toEqual(['scoring', 'rebounding', 'playmaking', 'allows', 'spots']);
    expect(p.teams.BOS).toMatchObject({ venue: 'A', opp: 'NY', games: 12, sub: '12 games · PropFinder', verdict: { headline: 'Tight defense', tier: 'tight' } });
    expect(p.teams.NY).toMatchObject({ venue: 'H', sub: '12 games · 1 out · PropFinder', verdict: { headline: 'Leaky defense', tier: 'leaky' } });
    expect(p.total).toMatchObject({ headline: '225 points expected · BOS 121 · NY 104' });
    expect(p.title).toBe('Matchup profile');
    expect(row(p, 'allows', 'NY').word).toBe('Very leaky');
    expect(gameProfile({ away: 'AAA', home: 'BBB' }, defense, {})).toBeNull();
  });
  test('the board carries it per game', () => {
    const games = [{ id: 'g1', date: '2026-10-30T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
    const logs = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 24 + (i % 3), reb: 6, ast: 5, tpm: 3, stl: 1, blk: 0 }));
    const pf = { at: '2026-10-30T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [] }], defense: { ...defense, teams: { NY: { SF: { gp: 12, pts: 24 } }, BOS: { SF: { gp: 12, pts: 20 } } }, ranks: { NY: { SF: { pts: 1 } }, BOS: { SF: { pts: 2 } } }, league: { SF: { pts: 22 } }, windows: {} } } };
    const b = buildBoard({ date: '2026-10-30', season: 2026, games, sheets: [], pf, results: {} });
    expect(b.games[0].profile.order).toEqual(['BOS', 'NY']);
    expect(row(b.games[0].profile, 'scoring', 'BOS').word).toBe('Elite');
  });
});
