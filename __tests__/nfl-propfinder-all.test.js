// Everything PropFinder's NFL pull sends, loaded (2026-11-01, "we need to load all PropFinder data"): every market on
// the pull of that day filed where it settles, the defense / kicking / period fields read, the rest kept as `extra`,
// and ESPN's box score grading the new markets (the defense, the kicker, the periods' touchdowns).
import { describe, expect, test } from '@jest/globals';
import { marketOfItem, playerProps, gameRow, otherProps, extraOf, defenseAllowed, periodOf, lineMarket, mapPlayers } from '../lib/nfl/propfinder-nfl';
import { statOf, logRates, buildBoard } from '../lib/nfl/picks';
import { parseSummary } from '../lib/nfl/espn';
import summary from './fixtures/espn-nfl-summary-dal-phi.json';

// The market names and categories as the pull of 2026-11-01 listed them, with where each must be filed.
const SEEN = [
  ['Player Receiving Yards', 'receivingYards', 'rec_yds'], ['Player Receptions', 'receivingReceptions', 'receptions'],
  ['Player Touchdowns', 'touchdowns', 'anytime_td'], ['Player Rushing Yards', 'rushingYards', 'rush_yds'],
  ['Anytime Touchdown Scorer', '', 'anytime_td'], ['Player Passing Yards', 'passingYards', 'pass_yds'],
  ['First Touchdown Scorer', 'firstTouchdownScorer', 'first_td'], ['Player Longest Reception', 'receivingLongest', 'rec_long'],
  ['Player Rushing + Receiving Yards', 'rushingAndReceivingYards', 'rush_rec_yds'], ['1st Half Player Receiving Yards', 'H1receivingYards', 'h1_rec_yds'],
  ['Player Tackles + Assists', 'defenseCombined', 'def_tkl_ast'], ['Player Rushing Attempts', 'rushingAttempts', 'rush_att'],
  ['1st Half Player Touchdowns', 'H1touchdowns', 'h1_anytime_td'], ['Player Passing + Rushing Yards', 'passingAndRushingYards', 'pass_rush_yds'],
  ['1st Quarter Player Receiving Yards', 'Q1receivingYards', 'q1_rec_yds'], ['1st Quarter Player Touchdowns', 'Q1touchdowns', 'q1_anytime_td'],
  ['1st Quarter Anytime Touchdown Scorer', 'Q1anytimeTouchdownScorer', 'q1_anytime_td'], ['Player Passing Completions', 'passingCompletions', 'pass_cmp'],
  ['Player Passing Touchdowns', 'passingTouchdowns', 'pass_td'], ['Player Tackles', 'defenseTackles', 'def_tkl'],
  ['Player Longest Rush', 'rushingLongest', 'rush_long'], ['Player Passing Attempts', 'passingAttempts', 'pass_att'],
  ['Player Sacks', 'defenseSacks', 'def_sacks'], ['Player Assists', 'assists', 'def_ast'],
  ['1st Half Player Rushing Yards', 'H1rushingYards', 'h1_rush_yds'], ['1st Half Player Passing Yards', 'H1passingYards', 'h1_pass_yds'],
  ['Player Interceptions', 'passingInterceptions', 'pass_int'], ['Player Longest Passing Completion', 'passingLongest', 'pass_long'],
  ['1st Quarter Player Rushing Yards', 'Q1rushingYards', 'q1_rush_yds'], ['2nd Half Player Touchdowns', 'H2touchdowns', 'h2_anytime_td'],
  ['Player Kicking Points', 'KICKPTS', 'kick_pts'], ['Player Defensive Interceptions', 'defenseInterceptions', 'def_int'],
  ['Player Field Goals Made', 'fieldGoalsMade', 'fg_made'], ['1st Quarter Player Passing Yards', 'Q1passingYards', 'q1_pass_yds'],
  ['1st Quarter Player Receptions', 'Q1receivingReceptions', 'q1_receptions'], ['1st Half Player Receptions', 'H1receivingReceptions', 'h1_receptions'],
  ['Player Extra Points Made', 'extraPointsKicksMade', 'xp_made'], ['Player Fantasy Score (All)', 'fantasyPoints', null],
  ['1st Half Player Passing Touchdowns', 'H1passingTouchdowns', 'h1_pass_td'], ['1st Quarter Player Rushing Attempts', 'Q1rushingAttempts', 'q1_rush_att'],
  ['1st Half Player Rushing + Receiving Yards', 'H1rushingAndReceivingYards', 'h1_rush_rec_yds'], ['1st Quarter Player Rushing + Receiving Yards', 'Q1rushingAndReceivingYards', 'q1_rush_rec_yds'],
  ['Player Fantasy Score', 'fantasyPoints', null], ['1st Quarter Player Passing Touchdowns', 'Q1passingTouchdowns', 'q1_pass_td'],
];
const item = (market, categoryMapping, points, price, selectionLine = 'over', sportsbook = 'DraftKings') => ({ market, categoryMapping, points, price, selectionLine, sportsbook, isMain: true });

describe('every PropFinder NFL market filed where it settles', () => {
  test.each(SEEN)('%s [%s] → %s', (market, categoryMapping, want) => {
    expect(marketOfItem({ market, categoryMapping })).toBe(want);
  });
  test('a period reads off the name or the category; the touchdown ladder by its line', () => {
    expect(periodOf('1st Half Player Receiving Yards', 'H1receivingYards')).toEqual({ key: 'h1', name: 'Player Receiving Yards', cat: 'receivingYards' });
    expect(periodOf('2nd Quarter Player Touchdowns', '')).toMatchObject({ key: 'q2' });
    expect(periodOf('Player Receiving Yards', 'receivingYards')).toBeNull();
    expect(marketOfItem({ market: '2nd Quarter Player Receiving Yards', categoryMapping: 'Q2receivingYards' })).toBeNull(); // no such market: kept in extra
    expect([lineMarket('anytime_td', 0.5), lineMarket('anytime_td', 1.5), lineMarket('anytime_td', 2.5), lineMarket('h1_anytime_td', 1.5), lineMarket('rec_yds', 60.5)]).toEqual(['anytime_td', 'two_td', null, null, 'rec_yds']);
  });
  test('the lines on a player: the touchdowns ladder split, the kicker and the half read, the fantasy score kept aside', () => {
    const p = { name: 'X', odds: [
      item('Player Touchdowns', 'touchdowns', 0.5, 120), item('Player Touchdowns', 'touchdowns', 1.5, 650), item('Player Touchdowns', 'touchdowns', 2.5, 4000),
      item('Player Kicking Points', 'KICKPTS', 7.5, -115), item('Player Kicking Points', 'KICKPTS', 7.5, -105, 'under'),
      item('1st Half Player Receiving Yards', 'H1receivingYards', 30.5, -110),
      item('Player Fantasy Score', 'fantasyPoints', 14.5, -110), item('2nd Quarter Player Receiving Yards', 'Q2receivingYards', 20.5, -110),
    ] };
    const props = Object.fromEntries(playerProps(p).map((r) => [r.market, r]));
    expect(Object.keys(props).sort()).toEqual(['anytime_td', 'h1_rec_yds', 'kick_pts', 'two_td']);
    expect(props.anytime_td).toMatchObject({ line: 0.5, odds: 120 });
    expect(props.two_td).toMatchObject({ line: 1.5, odds: 650 });
    expect(props.kick_pts).toMatchObject({ line: 7.5, odds: -115, underOdds: -105 });
    const other = otherProps(p);
    expect(Object.keys(other).sort()).toEqual(['2nd Quarter Player Receiving Yards [Q2receivingYards]', 'Player Fantasy Score [fantasyPoints]', 'Player Touchdowns [touchdowns]']);
    expect(other['Player Touchdowns [touchdowns]']).toEqual([{ line: 2.5, odds: 4000, underOdds: null, books: 1 }]);
  });
});

describe('the game rows read whole', () => {
  // A game row in the shape the pull sends (2026-10-31's sample): every key present, the zeros as 0.
  const ROW = { gameDate: '2026-10-26T17:00:00Z', season: 2026, seasonType: 'REG', isHome: true, opposingTeamCode: 'PHI', gameId: 'g1',
    receivingReceptions: 5, receivingYards: 74, receivingTouchdowns: 2, receivingTargets: 12, receivingShare: 0.31, receivingRedzoneTargets: 2, receivingAirYards: 61,
    h1ReceivingYards: 40, h1ReceivingReceptions: 3, h1ReceivingTouchdowns: 1, q1ReceivingYards: 9, q1ReceivingTouchdowns: 1, h2ReceivingTouchdowns: 1,
    q2ReceivingYards: 31, q3ReceivingYards: 20, h1RushingTouchdowns: 0, q1RushingTouchdowns: 0, h2RushingTouchdowns: 0, defenseTackles: 0, defenseAssists: 0, fieldGoalsMade: 0, extraPointsKicksMade: 0, isPrimetime: true };
  test('the period, defense, kicking and opportunity fields: kept when not 0, null when the row lacks the key', () => {
    const g = gameRow(ROW);
    expect(g).toMatchObject({ recYds: 74, h1RecYds: 40, h1Rec: 3, h1RecTd: 1, q1RecYds: 9, q1RecTd: 1, h2RecTd: 1, tgtShare: 0.31, rzTgt: 2, airYds: 61 });
    expect('defTkl' in g).toBe(false); // 0 on the row: left out, read 0
    expect(g.defSacks).toBeNull(); // the row has no defenseSacks key: unknown
    expect(g.kickPts).toBeUndefined();
    expect(statOf(g, 'h1_rec_yds')).toBe(40);
    expect(statOf(g, 'h1_anytime_td')).toBe(1);
    expect(statOf(g, 'def_tkl')).toBe(0);
    expect(statOf(g, 'def_sacks')).toBeNull();
    const k = gameRow({ gameDate: '2026-10-26', fieldGoalsMade: 3, extraPointsKicksMade: 3, defenseTackles: 1 });
    expect(k).toMatchObject({ fgMade: 3, xpMade: 3, kickPts: 12, defTkl: 1 });
  });
  test('a game without the figure is no game in the hit rate (null), a 0 is a miss', () => {
    const games = [gameRow({ ...ROW, gameId: 'a' }), gameRow({ ...ROW, gameId: 'b', gameDate: '2026-10-19T17:00:00Z', defenseTackles: 0, h1ReceivingYards: 10 })];
    const r = logRates(games, { market: 'h1_rec_yds', line: 25.5, side: 'over', season: 2026 });
    expect([r.l5, r.l5N]).toEqual([0.5, 2]);
    const s = logRates(games, { market: 'def_sacks', line: 0.5, side: 'over', season: 2026 });
    expect(s.l5N).toBe(0);
  });
  test('what the board does not read is kept as extra: the players, their games, the team rows as published', () => {
    const raw = [{ id: 'p1', name: 'CeeDee Lamb', jerseyNumber: 88, fullPosition: 'WR1', team: { code: 'DAL' }, splits: [], stats: [ROW], odds: [item('Player Fantasy Score', 'fantasyPoints', 14.5, -110), item('Player Receiving Yards', 'receivingYards', 70.5, -115)] }];
    const teams = [{ id: 't1', code: 'DAL', fullName: 'Dallas Cowboys', stats: [{ id: 'r1', teamId: 't1', type: 'Opponent', position: 'WR1', year: 2026, lastNGames: 3, gamesPlayed: 3, receivingYards: 240, receivingYardsRank: 4, passingBlitzes: 0 }] }];
    const x = extraOf(raw, teams);
    expect(x.counts).toEqual({ players: 1, games: 1, otherProps: 1, teams: 1, teamRows: 1 });
    expect(x.players.p1.info).toEqual({ id: 'p1', jerseyNumber: 88, fullPosition: 'WR1' });
    expect(x.players.p1.games.g1).toEqual({ q2ReceivingYards: 31, q3ReceivingYards: 20, isPrimetime: true });
    expect(Object.keys(x.players.p1.otherProps)).toEqual(['Player Fantasy Score [fantasyPoints]']);
    expect(x.teams.DAL.rows).toEqual([{ type: 'Opponent', position: 'WR1', year: 2026, lastNGames: 3, gamesPlayed: 3, receivingYards: 240, receivingYardsRank: 4 }]);
  });
  test('the defense tables read the last-3 window the NFL publishes', () => {
    const row = (lastNGames, gp, recYds) => ({ type: 'Opponent', position: 'WR', year: 2026, lastNGames, gamesPlayed: gp, receivingYards: recYds });
    const d = defenseAllowed([{ code: 'KC', stats: [row(0, 7, 1050), row(3, 3, 600), row(5, 5, 800)] }, { code: 'BUF', stats: [row(0, 7, 700), row(3, 3, 300)] }], { season: 2026 });
    expect(Object.keys(d.windows)).toEqual(['l3', 'l5']);
    expect(d.windows.l3.teams.KC.WR.recYds).toBe(200);
  });
});

describe("ESPN's box score grades the new markets (DAL 38 at PHI 21, 2026-10-26)", () => {
  const r = parseSummary(summary);
  const p = (name) => r.players.find((x) => x.name === name);
  test('the kicker, the defense, the touchdowns by period; no period yards', () => {
    expect(p('Brandon Aubrey')).toMatchObject({ fgMade: 3, fgAtt: 3, xpMade: 3, kickPts: 12 });
    expect(p('DeMarvion Overshown')).toMatchObject({ defTkl: 5, defAst: 1, defInt: 1, defSacks: 0 });
    expect(p('CeeDee Lamb')).toMatchObject({ recTd: 2, q1RecTd: 1, h1RecTd: 1, h2RecTd: 1 });
    expect(p('Dak Prescott')).toMatchObject({ passTd: 3, q1PassTd: 1, h1PassTd: 2 });
    expect(p('Saquon Barkley')).toMatchObject({ q1RushTd: 1, h1RushTd: 1 });
    expect(p('Javonte Williams')).toMatchObject({ h2RushTd: 1, h1RushTd: 0 });
    expect(statOf(p('CeeDee Lamb'), 'h1_rec_yds')).toBeNull(); // not in the summary: ungraded, never a 0
    expect(statOf(p('Dak Prescott'), 'pass_long')).toBeNull();
    expect(statOf(p('CeeDee Lamb'), 'h2_anytime_td')).toBe(1);
    expect(statOf(p('DeMarvion Overshown'), 'def_tkl_ast')).toBe(6);
    expect(statOf(p('Brandon Aubrey'), 'kick_pts')).toBe(12);
  });
});

describe('the new markets on the board, graded by the box score', () => {
  // Ten games for each, newest first; the lines PropFinder lists on them.
  const logs = (fn) => Array.from({ length: 10 }, (_, i) => ({ gameId: `x${i}`, gameDate: `2026-${i < 6 ? '10' : '09'}-${String(28 - i * 2).padStart(2, '0')}T17:00:00Z`, season: 2026, seasonType: 'REG', opposingTeamCode: 'NYG', isHome: i % 2 === 0, h1RushingTouchdowns: 0, q1RushingTouchdowns: 0, h2RushingTouchdowns: 0, ...fn(i) }));
  const raw = [
    { id: 'p1', name: 'DeMarvion Overshown', position: 'LB', team: { code: 'DAL' }, stats: logs((i) => ({ defenseTackles: 5 + (i % 3), defenseAssists: 2 })), odds: [item('Player Tackles + Assists', 'defenseCombined', 5.5, -120), item('Player Tackles + Assists', 'defenseCombined', 5.5, -105, 'under')] },
    { id: 'p2', name: 'Brandon Aubrey', position: 'K', team: { code: 'DAL' }, stats: logs((i) => ({ fieldGoalsMade: 2 + (i % 2), extraPointsKicksMade: 3 })), odds: [item('Player Kicking Points', 'KICKPTS', 7.5, -125), item('Player Kicking Points', 'KICKPTS', 7.5, 100, 'under')] },
    { id: 'p3', name: 'CeeDee Lamb', position: 'WR', team: { code: 'DAL' }, stats: logs((i) => ({ receivingYards: 80, h1ReceivingYards: 45 + i, receivingTouchdowns: i % 2, h1ReceivingTouchdowns: i % 2, q1ReceivingTouchdowns: 0, h2ReceivingTouchdowns: 0 })), odds: [item('1st Half Player Receiving Yards', 'H1receivingYards', 38.5, -115), item('1st Half Player Receiving Yards', 'H1receivingYards', 38.5, -105, 'under'), item('1st Half Player Touchdowns', 'H1touchdowns', 0.5, 160)] },
  ];
  const players = mapPlayers(raw);
  const GAMES = [{ id: '401873009', date: '2026-10-26T20:20Z', away: 'DAL', home: 'PHI', final: true, state: 'post', awayScore: 38, homeScore: 21, detail: 'Final' }];
  test('the defense, the kicker and the 1st half get plays and tables; the box score grades all but the half\'s yards', () => {
    expect(players.map((p) => p.props.map((x) => x.market).sort())).toEqual([['def_tkl_ast'], ['kick_pts'], ['h1_anytime_td', 'h1_rec_yds']]);
    const b = buildBoard({ season: 2026, week: 8, games: GAMES, sheets: [], pf: { at: '2026-10-26T13:00:00Z', data: { players } }, results: { 401873009: { ...parseSummary(summary), final: true } } });
    const g = b.games[0];
    const row = (group, label) => [...(g.tables[group]?.rows || []), ...(g.tables[group]?.marginal || [])].find((r) => r.label === label);
    expect(row('defense', 'Tackles + assists')).toMatchObject({ player: 'DeMarvion Overshown', line: 5.5, actual: 6, hit: true });
    expect(row('kicking', 'Kicking points')).toMatchObject({ player: 'Brandon Aubrey', line: 7.5, actual: 12, hit: true });
    const half = row('periods', '1st half rec yards');
    expect(half).toMatchObject({ player: 'CeeDee Lamb', line: 38.5, hit: null });
    expect(half.actual).toBeUndefined(); // the summary has no half's yards: ungraded, not "did not play"
    expect(row('periods', '1st half anytime TD')).toMatchObject({ player: 'CeeDee Lamb', actual: 1, hit: true });
  });
});
