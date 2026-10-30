import { describe, expect, test } from '@jest/globals';
import { teamProfile, gameProfile, ROWS } from '../lib/nba/profile';
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
  BOS: { team: 'BOS', opp: 'NY', teamProj: { pts: 121 }, out: [], players: [{ player: 'Jaylen Brown', plays: [{ confirmed: true, sheetFiles: ['nba_2026-10-30.pdf'] }] }, { player: 'Derrick White', plays: [{ confirmed: false }] }],
    // What NY gives up (BOS attacks it): PG leaky, C tight.
    allowed: { count: 16, from: 'propfinder', rows: { PG: { pts: cellOf(2, 3), reb: cellOf(8) }, SG: { pts: cellOf(7) }, SF: { pts: cellOf(9) }, PF: { pts: cellOf(10) }, C: { pts: cellOf(15), reb: cellOf(1) } } } },
  NY: { team: 'NY', opp: 'BOS', teamProj: { pts: 104 }, out: [{ name: 'Josh Hart' }], players: [{ player: 'Jalen Brunson', plays: [] }],
    // What BOS gives up: nothing soft, three positions tight.
    allowed: { count: 16, from: 'propfinder', rows: { PG: { pts: cellOf(12) }, SG: { pts: cellOf(14) }, SF: { pts: cellOf(9) }, PF: { pts: cellOf(16) }, C: { pts: cellOf(15) } } } },
};

describe('the NBA game profile (the firsthalfscore layout)', () => {
  test('each team’s cells: a word and the figures, from the pull’s rows, the allowed tables and the sheet', () => {
    const bos = teamProfile({ team: 'BOS', defense, side: sides.BOS, oppSide: sides.NY });
    expect(bos.scoring).toMatchObject({ level: 'very', word: 'Elite' });
    expect(bos.scoring.text).toMatch(/^1st \/ 16 · 120\.0 points a game/);
    expect(bos.ptsAgainst).toMatchObject({ level: 'very', word: 'Elite' });   // allows the fewest
    expect(bos.security).toMatchObject({ level: 'very' });   // the fewest turnovers
    expect(bos.forcing).toMatchObject({ level: 'very' });   // forces the most
    expect(bos.threes.text).toContain('45% of its points');
    expect(bos.expected).toMatchObject({ word: 'High' });
    expect(bos.expected.text).toMatch(/^121 points expected tonight/);
    // Its last ten: 118 allowed against 108 on the season → from 1st to last of 16: loosening.
    expect(bos.trend).toMatchObject({ word: 'Loosening', level: 'veryWeak' });
    // What BOS gives up (NY's allowed table): nothing in the soft third, three positions in the tough third.
    expect(bos.leaksPts).toMatchObject({ word: 'Holds', level: 'very' });
    expect(bos.leaksPts.text).toContain('nothing in the soft third');
    expect(bos.sheet).toMatchObject({ word: '1 named' });
    expect(bos.sheet.text).toBe('Brown · nba_2026-10-30.pdf');
    const ny = teamProfile({ team: 'NY', defense, side: sides.NY, oppSide: sides.BOS });
    expect(ny.scoring).toMatchObject({ level: 'veryWeak', word: 'Very weak' });
    expect(ny.expected).toMatchObject({ word: 'Low' });
    expect(ny.trend).toMatchObject({ word: 'Tightening' });
    // What NY gives up: PG in the soft third (#2 blended of PropFinder's #2 and the sheet's #3), named with both reads.
    expect(ny.leaksPts).toMatchObject({ word: 'PG', level: 'veryWeak' });
    expect(ny.leaksPts.text).toBe('PG #3 (PropFinder #2, sheet #3) of 16');   // the blend of #2 and #3 rounds to 3
    expect(ny.leaksReb).toMatchObject({ word: 'C', level: 'veryWeak' });
    expect(ny.sheet).toMatchObject({ word: 'No sheet' });
    // A filler team in the middle reads Average everywhere it has a row.
    const t = teamProfile({ team: 'T07', defense, side: null, oppSide: null });
    expect(t.scoring).toMatchObject({ level: 'average', word: 'Average' });
    expect(t.leaksPts).toBeUndefined();
    expect(teamProfile({ team: 'ZZZ', defense, side: null, oppSide: null })).toBeNull();
  });
  test('the game: both teams, the rows either has, in the table’s order', () => {
    const g = gameProfile({ away: 'BOS', home: 'NY' }, defense, sides);
    expect(g.teams).toEqual(['BOS', 'NY']);
    expect(g.rows.map((r) => r.key)).toEqual(ROWS.map(([k]) => k).filter((k) => !['leaksAst', 'leaksTpm'].includes(k)));
    expect(g.cells.NY.ptsAgainst.word).toBe('Very weak');
    expect(gameProfile({ away: 'AAA', home: 'BBB' }, defense, {})).toBeNull();
  });
  test('the board carries it per game', () => {
    const games = [{ id: 'g1', date: '2026-10-30T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
    const logs = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 24 + (i % 3), reb: 6, ast: 5, tpm: 3, stl: 1, blk: 0 }));
    const pf = { at: '2026-10-30T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [] }], defense: { ...defense, teams: { NY: { SF: { gp: 12, pts: 24 } }, BOS: { SF: { gp: 12, pts: 20 } } }, ranks: { NY: { SF: { pts: 1 } }, BOS: { SF: { pts: 2 } } }, league: { SF: { pts: 22 } }, windows: {} } } };
    const b = buildBoard({ date: '2026-10-30', season: 2026, games, sheets: [], pf, results: {} });
    expect(b.games[0].profile.teams).toEqual(['BOS', 'NY']);
    expect(b.games[0].profile.cells.BOS.scoring.word).toBe('Elite');
    expect(b.games[0].profile.cells.BOS.sheet.word).toBe('No sheet');
  });
});
