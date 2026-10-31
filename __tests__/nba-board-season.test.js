import { describe, expect, test } from '@jest/globals';
import { buildBoard, nbaBoard, COCKTAIL } from '../lib/nba/picks';
import { teamCharacteristics } from '../lib/nba/characteristics';

// The board's sides as the court reads them: who is out tonight, last season's table beside this season's.
const row = (pts, reb, ast, tpm, stl, blk, tov, ftm) => ({ gp: 10, season: 2026, pts, reb, ast, tpm, stl, blk, tov, ftm });
const totals = {
  BOS: { for: row(122, 46, 28, 17, 8.5, 6.2, 11.5, 18), against: row(106, 42, 23, 11, 7, 4.5, 15, 17) },
  NY: { for: row(100, 40, 22, 10, 6.5, 3.8, 16, 15), against: row(124, 48, 29, 15, 9, 6, 11, 22) },
  SAC: { for: row(121, 44, 26, 13, 7.5, 5, 14, 17), against: row(128, 44, 26, 13, 7.5, 5, 14, 17) },
};
['ATL', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GS', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NO', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SA', 'TOR', 'UTAH', 'WSH'].forEach((t, i) => {
  const r = row(106 + 0.5 * i, 43 + 0.1 * i, 24 + 0.15 * i, 12 + 0.1 * i, 7 + 0.05 * i, 4.5 + 0.05 * i, 13 + 0.08 * i, 16 + 0.1 * i);
  totals[t] = { for: r, against: r };
});
const defense = {
  totals, leagueFor: { pts: 113 }, count: 30, league: { SF: { pts: 22 } },
  teams: { BOS: { SF: { gp: 10, pts: 23 } }, NY: { SF: { gp: 10, pts: 22 } } },
  ranks: { BOS: { SF: { pts: 15 } }, NY: { SF: { pts: 18 } } },
  prior: { season: 2025, teams: { NY: { SF: { gp: 82, pts: 21 } }, BOS: { SF: { gp: 82, pts: 20 } } }, ranks: { NY: { SF: { pts: 1 } }, BOS: { SF: { pts: 2 } } }, league: { SF: { pts: 20.5 } }, count: 2 },
};

describe('the trend line', () => {
  test('points allowed over the last ten against the season: loosening, tightening, or nothing', () => {
    // Every team's last ten = its season figure, but BOS has let in 115 lately (the 1st fewest on the season, 20th of the
    // 29 with a last-ten row, SAC's 110 now under it) and SAC has tightened to 110 (29th on the season, 9th lately).
    const withL10 = Object.fromEntries(Object.entries(totals).map(([t, x]) => [t, { ...x, l10: t === 'NY' ? null : { for: x.for, against: { ...x.against, pts: t === 'BOS' ? 115 : t === 'SAC' ? 110 : x.against.pts } } }]));
    const d = { ...defense, totals: withL10 };
    const bos = teamCharacteristics({ team: 'BOS', venue: 'H', defense: d });
    expect(bos.weaknesses.find((x) => x.key === 'trend')).toMatchObject({ text: 'Defense loosening over the last ten', level: 'weak', kind: 'defense', rank: 20, n: 29 });
    expect(bos.weaknesses.find((x) => x.key === 'trend').detail).toBe('115.0 points a game allowed over its last 10, #20 of 29 fewest, against #1 of 29 on the season · PropFinder');
    const sac = teamCharacteristics({ team: 'SAC', venue: 'H', defense: d });
    expect(sac.strengths.find((x) => x.key === 'trend')).toMatchObject({ text: 'Defense tightening over the last ten', level: 'strong', rank: 9, n: 29 });
    // A team without a last-ten row, or a league where fewer than ten teams carry one, reads no trend.
    expect(teamCharacteristics({ team: 'NY', venue: 'A', defense: d }).weaknesses.find((x) => x.key === 'trend')).toBeUndefined();
    expect(teamCharacteristics({ team: 'ATL', venue: 'A', defense: d }).strengths.find((x) => x.key === 'trend')).toBeUndefined();
    const few = { ...defense, totals: Object.fromEntries(Object.entries(withL10).map(([t, x], i) => [t, i < 6 || t === 'BOS' ? x : { ...x, l10: null }])) };
    expect(teamCharacteristics({ team: 'BOS', venue: 'H', defense: few }).weaknesses.find((x) => x.key === 'trend')).toBeUndefined();
  });
});

describe('the best plays strip', () => {
  const game = (final) => [{ id: 'g1', date: '2026-10-27T23:30Z', away: 'NY', home: 'BOS', final, state: final ? 'post' : 'pre', ...(final ? { awayScore: 100, homeScore: 110, detail: 'Final' } : {}) }];
  const logs = (pts, reb) => Array.from({ length: 12 }, (_, i) => ({ date: `2026-01-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts, reb, ast: 5, tpm: 2, pra: pts + reb + 5, min: 34 }));
  const pf = { at: '2026-10-27T14:00:00Z', data: { players: [
    { id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs(30, 8), props: [{ market: 'pts', line: 24.5, odds: -110, underOdds: -110, isMain: true }, { market: 'reb', line: 8.5, odds: -120, underOdds: 100, isMain: true }] },
    { id: 'p2', name: 'Derrick White', key: 'derrick white', team: 'BOS', pos: 'SG', games: logs(12, 4), props: [{ market: 'pts', line: 24.5, odds: 150, underOdds: -180, isMain: true }] },
    { id: 'p3', name: 'Payton Pritchard', key: 'payton pritchard', team: 'BOS', pos: 'PG', games: logs(16, 3), props: [{ market: 'pts', line: 12.5, odds: -130, underOdds: 110, isMain: true }] },
  ], defense: null } };
  test('one play a player over the floor, by chance; the picked players marked; graded once final', () => {
    // The strip's mechanics on every market; the site's board picks rebounds, assists and threes alone (the last check).
    const allBoard = nbaBoard(COCKTAIL, { bestMarkets: null, bestBy: 'chance' }).buildBoard;
    const b = allBoard({ date: '2026-10-27', season: 2026, games: game(false), sheets: [], pf, results: {} });
    const g = b.games[0];
    // Brown clears 24.5 every night and Pritchard 12.5 (both 100%, so the shrink toward the book's price puts Pritchard's
    // −130 a hair above Brown's −110); Brown's 8 rebounds never clear 8.5 and White's 12 points never 24.5.
    expect(g.sides.BOS.picks.map((x) => [x.player, x.market, x.line, x.side])).toEqual([['Payton Pritchard', 'pts', 12.5, 'over'], ['Jaylen Brown', 'pts', 24.5, 'over']]);
    expect(g.sides.BOS.picks[1]).toMatchObject({ key: 'jaylen brown', label: 'Points', unit: 'pts', odds: -110, confirmed: false, hit: null });
    expect(g.sides.BOS.picks[0].p).toBeGreaterThan(g.sides.BOS.picks[1].p);
    expect(g.sides.BOS.players.map((p) => [p.player, p.picked]).sort()).toEqual([['Derrick White', false], ['Jaylen Brown', true], ['Payton Pritchard', true]]);
    expect(g.sides.NY.picks).toEqual([]);
    // Final: each pick graded on the box score; a pick without a row stays ungraded (the strip reads DNP).
    const results = { g1: { id: 'g1', final: true, players: [{ name: 'Jaylen Brown', team: 'BOS', played: true, pts: 26, reb: 7, ast: 4, pra: 37 }] } };
    const f = allBoard({ date: '2026-10-27', season: 2026, games: game(true), sheets: [], pf, results }).games[0];
    expect(f.sides.BOS.picks.find((x) => x.player === 'Jaylen Brown')).toMatchObject({ actual: 26, hit: true });
    expect(f.sides.BOS.picks.find((x) => x.player === 'Payton Pritchard')).toMatchObject({ actual: null, hit: null });
    // On the chance read of rebounds, assists and threes alone the points plays stay off the strip.
    expect(nbaBoard(COCKTAIL, { bestBy: 'chance' }).buildBoard({ date: '2026-10-27', season: 2026, games: game(false), sheets: [], pf, results: {} }).games[0].sides.BOS.picks).toEqual([]);
  });
});

describe('the NBA board’s sides', () => {
  const logs = Array.from({ length: 12 }, (_, i) => ({ date: `2026-01-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 24 + (i % 3), reb: 8, ast: 5, tpm: 2, pra: 37 + (i % 3), min: 34 }));
  const games = [{ id: 'g1', date: '2026-10-27T23:30Z', away: 'NY', home: 'BOS', final: false, state: 'pre' }];
  const pf = { at: '2026-10-27T14:00:00Z', data: {
    players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 25.5, odds: -110, underOdds: -110, isMain: true }] }],
    defense,
    injuries: { rows: [{ team: 'BOS', name: 'Jayson Tatum', key: 'jayson tatum', status: 'Out', detail: 'Achilles', pos: 'SF' }, { team: 'NY', name: 'OG Anunoby', key: 'og anunoby', status: 'Questionable', detail: 'knee', pos: 'SF' }] },
  } };
  test('who is out per side, last season’s table beside this season’s, the characteristics on the game', () => {
    const b = buildBoard({ date: '2026-10-27', season: 2026, games, sheets: [], pf, results: {} });
    const g = b.games[0];
    // Who is out, per side (Questionable is not out), with the position for the line above the table.
    expect(g.sides.BOS.out).toEqual([{ id: null, name: 'Jayson Tatum', key: 'jayson tatum', status: 'Out', detail: 'Achilles', pos: 'SF' }]);
    expect(g.sides.NY.out).toEqual([]);
    // Last season's full table on the side's allowed block (the opponent's), the tab to compare against; this season's unchanged.
    expect(g.sides.BOS.allowed.prior).toMatchObject({ season: 2025, count: 2, rows: { SF: { pts: { value: 21, rank: 1 } } } });
    expect(g.sides.NY.allowed.prior.rows.SF.pts).toEqual({ value: 20, rank: 2 });
    expect(g.sides.BOS.allowed.rows.SF.pts).toEqual({ value: 22, rank: 18 });
    // The characteristics card (lib/picks/characteristics.js) rides on the game from the same totals.
    expect(g.characteristics.BOS.tier).toBe('tight');
    expect(g.characteristics.NY.tier).toBe('leaky');
    // Without a report nobody is out; without totals no characteristics.
    const bare = buildBoard({ date: '2026-10-27', season: 2026, games, sheets: [], pf: { ...pf, data: { ...pf.data, injuries: null, defense: { teams: {}, ranks: {}, count: 0, league: {}, windows: {} } } }, results: {} });
    expect(bare.games[0].sides.BOS.out).toEqual([]);
    expect(bare.games[0].sides.BOS.allowed).toBeNull();
    expect(bare.games[0].characteristics).toBeNull();
  });
});
