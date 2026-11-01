// Everything PropFinder's NBA pull sends, loaded (2026-11-01, "do the same for the NBA board"): every market of that
// night's pull filed where it settles, the first quarter / first three minutes / shooting lines read off the game rows,
// the rest (and the players the books have not priced) kept as `extra`, and ESPN's play-by-play grading the 1st quarter.
import { describe, expect, test } from '@jest/globals';
import { marketOfItem, playerProps, gameRow, extraOf, mapPlayers, periodOf } from '../lib/nba/propfinder-nba';
import { buildBoard, statOf } from '../lib/nba/picks';
import { parseSummary, periodLines } from '../lib/nba/espn';
import summary from './fixtures/espn-nba-summary-por-uta.json';

// The market names and categories as the pull of 2026-11-01 listed them, with where each must be filed.
const SEEN = [
  ['Player Points', 'points', 'pts'], ['Player Assists', 'assists', 'ast'], ['Player Points + Assists', 'pointsAssists', 'pa'],
  ['Player Points + Rebounds + Assists', 'pointsReboundsAssists', 'pra'], ['Player Rebounds', 'rebounds', 'reb'],
  ['Player Field Goals Made', 'fieldGoalsMade', 'fgm'], ['Player Points + Rebounds', 'pointsRebounds', 'pr'],
  ['Player Steals', 'steals', 'stl'], ['Player Two Pointers Attempted', 'twoPointsAtt', 'fg2a'],
  ['Player Rebounds + Assists', 'reboundAssists', 'ra'], ['Player Steals + Blocks', 'stealsBlocks', 'stl_blk'],
  ['1st Quarter Player Rebounds', 'Q1rebounds', 'q1_reb'], ['Player Made Threes', 'threePointsMade', 'tpm'],
  ['1st Quarter Player Assists', 'Q1assists', 'q1_ast'], ['1st Quarter Player Points', 'Q1points', 'q1_pts'],
  ['Player Made Two Pointers', 'twoPointsMade', 'fg2m'], ['Player Turnovers', 'turnovers', 'tov'], ['Player Blocks', 'blocks', 'blk'],
  ['Player Free Throws Attempted', 'freeThrowsAtt', 'fta'], ['Player Free Throws Made', 'freeThrowsMade', 'ftm'],
  ['Player Threes Attempted', 'threePointsAtt', 'tpa'], ['Player Field Goals Attempted', 'fieldGoalsAtt', 'fga'],
  ['Player Double Double', 'doubleDouble', 'dd'], ['1st 3 Minutes Player Points', '', 'm3_pts'],
  ['Player Fantasy Score (All)', 'fantasyPoints', null], ['Player Triple Double', 'tripleDouble', 'td3'],
  // Names seen on other nights: a quarter or a window without a market stays off the board, a first basket is never a market.
  ['2nd Quarter Player Points', 'Q2points', null], ['Points in First 5 Minutes', 'points', null], ['First Basket Scorer', '', null],
];
const item = (market, categoryMapping, points, price, selectionLine = 'over', sportsbook = 'DraftKings') => ({ market, categoryMapping, points, price, selectionLine, sportsbook, isMain: true });

describe('every PropFinder NBA market filed where it settles', () => {
  test.each(SEEN)('%s [%s] → %s', (market, categoryMapping, want) => {
    expect(marketOfItem({ market, categoryMapping })).toBe(want);
  });
  test('the windows of minutes read whatever the spelling', () => {
    expect(periodOf('1st 3 Minutes Player Points', '')).toEqual({ key: 'm3', name: 'Player Points', cat: '' });
    expect(periodOf('Player Points - First 3 Minutes', 'points')).toMatchObject({ key: 'm3', name: 'Player Points' });
    expect(periodOf('Player Points', 'first3MinPoints')).toEqual({ key: 'm3', name: 'Player Points', cat: 'Points' });
    expect(periodOf('Player Points', 'points3min')).toEqual({ key: 'm3', name: 'Player Points', cat: 'points' });
    expect(periodOf('Player Points', 'points')).toBeNull();
  });
  test('the lines on a player: the shooting and the first quarter read, the fantasy score kept aside', () => {
    const p = { name: 'X', odds: [
      item('Player Field Goals Made', 'fieldGoalsMade', 7.5, -110), item('Player Field Goals Made', 'fieldGoalsMade', 7.5, -110, 'under'),
      item('1st Quarter Player Points', 'Q1points', 6.5, -120), item('1st 3 Minutes Player Points', '', 0.5, -166),
      item('Player Fantasy Score (All)', 'fantasyPoints', 38.5, -115),
    ] };
    expect(Object.fromEntries(playerProps(p).map((r) => [r.market, r.line]))).toEqual({ fgm: 7.5, q1_pts: 6.5, m3_pts: 0.5 });
  });
});

describe('the game rows read whole', () => {
  // A row in the shape the pull sends (Nembhard's of 2024-10-23, trimmed).
  const ROW = { gameId: 'g1', gameDate: '2024-10-23T23:00:00Z', season: 2024, seasonType: 'REG', opposingTeamCode: 'DET', starter: true, minutes: 34.8,
    fieldGoalsMade: 3, fieldGoalsAtt: 8, threePointsMade: 0, threePointsAtt: 2, twoPointsMade: 3, twoPointsAtt: 6, freeThrowsMade: 2, freeThrowsAtt: 2,
    points: 8, rebounds: 2, assists: 7, steals: 1, blocks: 0, turnovers: 2, passesMade: 50, contestedRebounds: 0, hadFirstFG: false, hadFirstPoint: true,
    q1Minutes: 7.0, q1Points: 3, q1Rebounds: 1, q1Assists: 2, q1ThreePointsMade: 0, pointsInFirstThreeMinutes: 2, q2Points: 5, efficiency: 12, isDivisional: true };
  test('the shooting, the first quarter, the first minutes and the first basket on the row', () => {
    const g = gameRow(ROW);
    expect(g).toMatchObject({ fgm: 3, fga: 8, fg2m: 3, fg2a: 6, tpa: 2, fta: 2, q1Pts: 3, q1Reb: 1, q1Ast: 2, pts3m: 2, firstPt: 1, starter: 1, passes: 50 });
    expect('firstFg' in g).toBe(false); // false on the row: left out, read 0
    expect('fg2mApi' in g).toBe(false);
    expect(statOf(g, 'q1_pts')).toBe(3);
    expect(statOf(g, 'm3_pts')).toBe(2);
    expect(statOf(gameRow({ ...ROW, q1Points: undefined }), 'q1_pts')).toBeNull(); // a row without the key: no figure
  });
  test('the rest kept as extra, the players the books have not priced with their logs', () => {
    const raw = [{ id: 'p1', name: 'Andrew Nembhard', team: { code: 'IND' }, dob: '2000-01-16', stats: [ROW], odds: [item('Player Fantasy Score (All)', 'fantasyPoints', 30.5, -110)] },
      { id: 'p2', name: 'Bench Player', team: { code: 'IND' }, offBoard: true, stats: [ROW] }];
    const x = extraOf(raw, [{ id: 't', code: 'IND', stats: [{ id: 1, teamId: 't', type: 'Team', position: 'All', seasonYear: 2026, gamesPlayed: 6, fastBreakPts: 18.5, fastBreakPtsRank: 3 }] }]);
    expect(x.counts).toMatchObject({ players: 2, games: 2, otherProps: 1, teamRows: 1, offBoard: 1 });
    expect(x.players.p1.games.g1).toEqual({ q2Points: 5, efficiency: 12, isDivisional: true });
    expect(x.players.p1.info).toEqual({ id: 'p1', dob: '2000-01-16' });
    expect(x.players.p2).toMatchObject({ offBoard: true, logs: [{ date: '2024-10-23', pts: 8, q1Pts: 3 }] });
    expect(x.teams.IND.rows[0]).toMatchObject({ fastBreakPts: 18.5, fastBreakPtsRank: 3 });
  });
});

describe("ESPN's play-by-play grades the first quarter (POR 112 at UTAH 90, 2026-10-31)", () => {
  const r = parseSummary(summary);
  const p = (name) => r.players.find((x) => x.name === name);
  test('every play relabelled the first quarter adds up to the box score', () => {
    const all = periodLines({ plays: summary.plays.map((x) => ({ ...x, period: { number: 1 } })) });
    const played = r.players.filter((x) => x.played);
    expect(played.length).toBeGreaterThan(20);
    for (const x of played) {
      const got = all[x.espnId] || { q1Pts: 0, q1Reb: 0, q1Ast: 0, q1Tpm: 0 };
      expect([x.name, got.q1Pts, got.q1Reb, got.q1Ast, got.q1Tpm]).toEqual([x.name, x.pts, x.reb, x.ast, x.tpm]);
    }
  });
  test('the first quarter and the first three minutes, the two-pointers', () => {
    expect(p('Damian Lillard')).toMatchObject({ pts3m: 5 });
    expect(p('Darryn Peterson')).toMatchObject({ pts3m: 3 });
    expect(p('Deni Avdija')).toMatchObject({ pts3m: 1 });
    expect(p('Ace Bailey').pts3m).toBe(0);
    expect(p('Ace Bailey').q1Pts).toBeGreaterThanOrEqual(4);
    expect(p('Ace Bailey').q1Ast).toBeGreaterThanOrEqual(1);
    const l = p('Damian Lillard');
    expect(l.fg2m).toBe(l.fgm - l.tpm);
    expect(l.fg2a).toBe(l.fga - l.tpa);
    // Without plays the first quarter is unknown, never 0.
    const bare = parseSummary({ ...summary, plays: [] });
    expect(bare.players.find((x) => x.name === 'Damian Lillard').q1Pts).toBeNull();
    expect(statOf(bare.players.find((x) => x.name === 'Damian Lillard'), 'q1_pts')).toBeNull();
  });
  test('the board grades the new markets off it', () => {
    const logs = Array.from({ length: 8 }, (_, i) => ({ gameId: `x${i}`, gameDate: `2026-10-${String(29 - i).padStart(2, '0')}T23:00:00Z`, season: 2026, seasonType: 'REG', opposingTeamCode: 'SAC', minutes: 34,
      points: 24, rebounds: 4, assists: 7, threePointsMade: 3, threePointsAtt: 9, fieldGoalsMade: 8, fieldGoalsAtt: 18, freeThrowsMade: 5, freeThrowsAtt: 6,
      q1Points: 7, q1Rebounds: 1, q1Assists: 2, pointsInFirstThreeMinutes: i % 2 ? 2 : 0 }));
    const players = mapPlayers([{ id: 'dl', name: 'Damian Lillard', position: 'PG', team: { code: 'POR' }, stats: logs, odds: [
      item('Player Field Goals Attempted', 'fieldGoalsAtt', 16.5, -120), item('Player Field Goals Attempted', 'fieldGoalsAtt', 16.5, -110, 'under'),
      item('1st Quarter Player Points', 'Q1points', 5.5, -125), item('1st Quarter Player Points', 'Q1points', 5.5, -105, 'under'),
      item('1st 3 Minutes Player Points', '', 0.5, 120),
    ] }]);
    const GAMES = [{ id: summary.header.id, date: '2026-10-31T19:00Z', away: 'POR', home: 'UTAH', final: true, state: 'post', awayScore: 112, homeScore: 90, detail: 'Final' }];
    const b = buildBoard({ date: '2026-10-31', season: 2026, games: GAMES, sheets: [], pf: { at: '2026-10-31T13:00:00Z', data: { players } }, results: { [summary.header.id]: parseSummary(summary) } });
    const rows = Object.values(b.games[0].tables).flatMap((t) => [...(t.rows || []), ...(t.marginal || [])]);
    const lill = p('Damian Lillard');
    const fga = rows.find((x) => x.market === 'fga');
    expect(fga).toMatchObject({ player: 'Damian Lillard', group: 'shooting', actual: lill.fga });
    const q1 = rows.find((x) => x.market === 'q1_pts');
    expect(q1).toMatchObject({ group: 'periods', actual: lill.q1Pts, hit: lill.q1Pts > 5.5 });
    expect(rows.find((x) => x.market === 'm3_pts')).toMatchObject({ actual: 5, hit: true });
  });
});
