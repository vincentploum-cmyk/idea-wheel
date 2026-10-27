import { describe, expect, test } from '@jest/globals';
import { marketFromText, groupOf, statFields, MARKETS, GROUPS } from '../lib/nba/markets';
import { teamAbbrFromText, parseMatchup, teamLogo } from '../lib/nba/teams';
import { parseCheatSheet, classifyHeader, parsePlayerCell } from '../lib/nba/cheatsheet';
import { parseSummary, parseScoreboard, seasonOfDate, derived } from '../lib/nba/espn';
import { gameRow, mapPlayers, defenseAllowed, fieldsSeen, depthChart, fetchInjuries, applyInjuries } from '../lib/nba/propfinder-nba';
import { buildBoard, statOf, logRates } from '../lib/nba/picks';
import { dateFromFileName } from '../lib/nba/store';
import summary from './fixtures/espn-nba-summary.json';

describe('NBA markets and teams', () => {
  test('spellings land on one key, in five groups', () => {
    expect(GROUPS.map(([k]) => k)).toEqual(['points', 'rebounds', 'assists', 'threes', 'combos']);
    expect(marketFromText('Points')).toBe('pts');
    expect(marketFromText('PTS')).toBe('pts');
    expect(marketFromText('player_points')).toBe('pts');
    expect(marketFromText('Rebounds')).toBe('reb');
    expect(marketFromText('REB')).toBe('reb');
    expect(marketFromText('Assists')).toBe('ast');
    expect(marketFromText('3-Pointers Made')).toBe('tpm');
    expect(marketFromText('3PM')).toBe('tpm');
    expect(marketFromText('Threes')).toBe('tpm');
    expect(marketFromText('Pts + Reb + Ast')).toBe('pra');
    expect(marketFromText('Points + Rebounds + Assists')).toBe('pra');
    expect(marketFromText('PRA')).toBe('pra');
    expect(marketFromText('Points + Assists')).toBe('pa');
    expect(marketFromText('Rebounds + Assists')).toBe('ra');
    expect(marketFromText('Steals + Blocks')).toBe('stl_blk');
    expect(marketFromText('Double-Double')).toBe('dd');
    expect(marketFromText('Triple Double')).toBe('td3');
    expect(marketFromText('Turnovers')).toBe('tov');
    expect(marketFromText('Combos')).toBeNull();
    expect(groupOf('pra')).toBe('combos');
    expect(statFields('pra')).toEqual(['pts', 'reb', 'ast']);
    expect(MARKETS.dd.yesNo).toBe(true);
  });
  test('team spellings', () => {
    expect(teamAbbrFromText('GSW')).toBe('GS');
    expect(teamAbbrFromText('Golden State Warriors')).toBe('GS');
    expect(teamAbbrFromText('NYK')).toBe('NY');
    expect(teamAbbrFromText('UTA')).toBe('UTAH');
    expect(teamAbbrFromText('WAS')).toBe('WSH');
    expect(teamAbbrFromText('PHO')).toBe('PHX');
    expect(teamAbbrFromText('@ SAS')).toBe('SA');
    expect(teamAbbrFromText('LA Clippers')).toBe('LAC');
    expect(teamAbbrFromText('Lakers')).toBe('LAL');
    expect(parseMatchup('BOS @ NYK')).toEqual({ away: 'BOS', home: 'NY' });
    expect(parseMatchup('vs GSW', 'LAL')).toEqual({ away: 'GS', home: 'LAL' });
    expect(teamLogo('GS')).toMatch(/nba\/500\/gs\.png$/);
    expect(seasonOfDate('2026-10-21')).toBe(2026);
    expect(seasonOfDate('2027-03-01')).toBe(2026);
  });
});

describe('NBA cheat sheet', () => {
  test('a long sheet and a wide sheet', () => {
    const csv = 'Player,Team,Opp,Pos,Market,Line,Side,Odds,L5,L10,Season\nJayson Tatum,BOS,@ NYK,SF,Points,27.5,Over,-115,3/5,6/10,60%\nJalen Brunson,NYK,vs BOS,PG,Pts + Ast,34.5,O,-110,4/5,7/10,65%\nMitchell Robinson,NYK,vs BOS,C,Double-Double,,Yes,+140,2/5,4/10,40%\n';
    const { rows, warnings } = parseCheatSheet({ text: csv, fileName: 'props-2026-10-21.csv' });
    expect(warnings).toEqual([]);
    expect(rows[0]).toMatchObject({ player: 'Jayson Tatum', team: 'BOS', opp: 'NY', venue: 'A', pos: 'SF', market: 'pts', group: 'points', line: 27.5, side: 'over', odds: -115, hit: { l5: 0.6, l10: 0.6, season: 0.6 } });
    expect(rows[1]).toMatchObject({ player: 'Jalen Brunson', team: 'NY', opp: 'BOS', venue: 'H', market: 'pa', group: 'combos', line: 34.5 });
    expect(rows[2]).toMatchObject({ market: 'dd', line: 0.5, side: 'yes', odds: 140 });
    expect(classifyHeader('PTS')).toEqual({ role: 'wide', market: 'pts', part: 'line' });
    expect(classifyHeader('PTS Odds')).toEqual({ role: 'wide', market: 'pts', part: 'odds' });
    expect(classifyHeader('REB L10 %')).toEqual({ role: 'wide', market: 'reb', part: 'hit', window: 'l10' });
    expect(parsePlayerCell('Jayson Tatum SF')).toEqual({ name: 'Jayson Tatum', pos: 'SF', team: null });
    expect(parsePlayerCell('Shai Gilgeous-Alexander (OKC)')).toEqual({ name: 'Shai Gilgeous-Alexander', pos: null, team: 'OKC' });
    const wide = 'Player,Team,Opp,PTS,PTS Odds,REB,AST,3PM\nJayson Tatum,BOS,@ NYK,27.5,-115,8.5,4.5,3.5\n';
    const w = parseCheatSheet({ text: wide, fileName: 'tonight.csv' });
    expect(w.rows.map((r) => [r.market, r.line, r.odds])).toEqual([['pts', 27.5, -115], ['reb', 8.5, null], ['ast', 4.5, null], ['tpm', 3.5, null]]);
    expect(dateFromFileName('props-2026-10-21.csv')).toBe('2026-10-21');
    expect(dateFromFileName('tonight.csv')).toBeNull();
  });
});

describe('NBA ESPN feeds', () => {
  test('a finished game’s box score: every line with the combined stats, DNP kept out', () => {
    const g = parseSummary(summary);
    expect(g).toMatchObject({ id: '401898406', away: 'MIA', home: 'ORL', final: true, awayScore: 115, homeScore: 136 });
    const paolo = g.players.find((p) => p.name === 'Paolo Banchero');
    expect(paolo).toMatchObject({ team: 'ORL', espnId: '4432573', played: true, min: 26, pts: 24, reb: 7, ast: 4, tpm: 1, tpa: 2, fgm: 5, fga: 11, ftm: 13, fta: 16, stl: 0, blk: 1, tov: 1, pra: 35, pr: 31, pa: 28, ra: 11, stlBlk: 1, dd: 0, td3: 0 });
    const bane = g.players.find((p) => p.name === 'Desmond Bane');
    expect(bane).toMatchObject({ pts: 23, tpm: 7, tpa: 12 });
    expect(g.players.find((p) => p.name === 'Pelle Larsson')).toMatchObject({ played: false, pts: 0 });
    expect(derived({ pts: 12, reb: 10, ast: 11, stl: 1, blk: 0 })).toMatchObject({ dd: 1, td3: 1, pra: 33 });
  });
  test('the scoreboard', () => {
    const j = { season: { year: 2027, type: 1 }, events: [{ id: '1', date: '2026-10-21T23:30Z', season: { year: 2027, type: 2 }, status: { type: { state: 'pre', completed: false, shortDetail: '7:30 PM' } }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'NY' }, score: '0' }, { homeAway: 'away', team: { abbreviation: 'BOS' }, score: '0' }], odds: [{ details: 'NY -3.5', overUnder: 221.5 }] }] }] };
    const s = parseScoreboard(j);
    expect(s.games[0]).toMatchObject({ id: '1', away: 'BOS', home: 'NY', final: false, awayScore: null, odds: { spread: 'NY -3.5', total: 221.5 } });
    expect(s.seasonYear).toBe(2027);
  });
});

describe('NBA PropFinder mapping', () => {
  const GAME = { gameDate: '2026-10-21T23:30:00Z', season: 2026, seasonType: 'REG', isHomeGame: false, opponent: { code: 'NYK' }, points: 31, rebounds: 9, assists: 5, threePointersMade: 4, steals: 2, blocks: 0, turnovers: 3, minutes: 36, oddStat: 1 };
  const PLAYER = { id: 'p1', name: 'Jayson Tatum', positionAbbreviation: 'SF', team: { code: 'BOS' }, stats: [GAME, { ...GAME, gameDate: '2026-10-19T23:30:00Z', points: 22, rebounds: 11, assists: 10 }], odds: [{ market: 'Points', line: 27.5, overOdds: -115, underOdds: -105 }, { market: 'Pts+Reb+Ast', line: 39.5, odds: -110 }] };
  test('game rows, lines, positions and the unread fields', () => {
    expect(gameRow(GAME)).toMatchObject({ date: '2026-10-21', season: 2026, opp: 'NY', home: false, pts: 31, reb: 9, ast: 5, tpm: 4, stl: 2, tov: 3, min: 36, pra: 45, pr: 40, pa: 36, ra: 14, stlBlk: 2, dd: 0, td3: 0 });
    expect(gameRow({ ...GAME, points: 22, rebounds: 11, assists: 10 })).toMatchObject({ dd: 1, td3: 1 });
    // Tracking figures read when the row has them, null (never 0) when it does not.
    expect(gameRow(GAME)).toMatchObject({ usg: null, rebCh: null, potAst: null });
    expect(gameRow({ ...GAME, usagePercentage: 31.4, reboundChances: 12, potentialAssists: 9 })).toMatchObject({ usg: 31.4, rebCh: 12, potAst: 9 });
    // The live spelling: usagePct as a fraction of the possessions, read as a percentage.
    expect(gameRow({ ...GAME, usagePct: 0.1274 })).toMatchObject({ usg: 12.7 });
    // The game's id rides along (the without-teammate splits read a teammate's games by it), null without one.
    expect(gameRow(GAME).gameId).toBeNull();
    expect(gameRow({ ...GAME, gameId: 401 }).gameId).toBe('401');
    const players = mapPlayers([PLAYER]);
    expect(players[0]).toMatchObject({ key: 'jayson tatum', team: 'BOS', pos: 'SF' });
    expect(players[0].props).toEqual([{ market: 'pts', line: 27.5, odds: -115, underOdds: -105, book: null, books: 1, isMain: true }, { market: 'pra', line: 39.5, odds: -110, underOdds: null, book: null, books: 1, isMain: true }]);
    expect(mapPlayers([{ ...PLAYER, positionAbbreviation: 'G-F' }])[0].pos).toBe('G');
    // The API's own shape (2026-10-20): one item per sportsbook and side, the main line flagged, quarter markets skipped.
    const item = (market, categoryMapping, sportsbook, selectionLine, price, points, isMain = true) => ({ id: 1, gameId: 'g', playerId: 'p', sportsbook, market, categoryMapping, isMain, selection: 'Jock Landale', selectionLine, price, points, lastUpdated: '2026-10-19T22:50:38Z' });
    const api = { ...PLAYER, odds: [
      item('1st Quarter Player Assists', 'Q1assists', 'Betano', 'over', 195, 0.5),
      item('Player Points', 'points', 'DraftKings', 'over', -115, 27.5), item('Player Points', 'points', 'DraftKings', 'under', -105, 27.5),
      item('Player Points', 'points', 'FanDuel', 'over', -110, 27.5), item('Player Points', 'points', 'FanDuel', 'over', 120, 29.5, false),
      item('Player Points + Rebounds + Assists', 'pointsReboundsAssists', 'DraftKings', 'over', -120, 39.5),
      item('Player Three Points Made', 'threePointsMade', 'DraftKings', 'over', -130, 2.5),
      item('Double Double', 'doubleDouble', 'DraftKings', 'yes', 140, 0.5),
    ] };
    expect(mapPlayers([api])[0].props).toEqual([
      { market: 'pts', line: 27.5, odds: -110, underOdds: -105, book: 'FanDuel', books: 2, isMain: true, lines: [{ line: 27.5, odds: -110, underOdds: -105, books: 2, main: true }, { line: 29.5, odds: 120, underOdds: null, books: 1, main: false }] },
      { market: 'pra', line: 39.5, odds: -120, underOdds: null, book: 'DraftKings', books: 1, isMain: true },
      { market: 'tpm', line: 2.5, odds: -130, underOdds: null, book: 'DraftKings', books: 1, isMain: true },
      { market: 'dd', line: 0.5, odds: 140, underOdds: null, book: 'DraftKings', books: 1, isMain: true },
    ]);
    // A book flags an alternate ladder's rung main too (Drummond o1.5 points, 2026-10-20): of the
    // main lines the one nearest his own last-ten average is the play's line; the rest ride as `lines`.
    const ladder = { ...PLAYER, stats: [{ ...GAME, points: 8 }, { ...GAME, gameDate: '2026-10-19T23:30:00Z', points: 10 }], odds: [
      item('Player Points', 'points', 'Betano', 'over', -2000, 1.5), item('Player Points', 'points', 'Betano', 'over', -900, 3.5),
      item('Player Points', 'points', 'DraftKings', 'over', -115, 8.5), item('Player Points', 'points', 'DraftKings', 'under', -105, 8.5),
      item('Player Points', 'points', 'FanDuel', 'over', 130, 11.5, false),
    ] };
    const pts = mapPlayers([ladder])[0].props.find((x) => x.market === 'pts');
    expect(pts).toMatchObject({ line: 8.5, odds: -115, underOdds: -105, isMain: true });
    expect(pts.lines.map((x) => x.line)).toEqual([1.5, 3.5, 8.5, 11.5]);
    // Markets the board does not settle whose names carry a market's word (the live pull, 2026-10-20) are skipped.
    const stray = { ...PLAYER, odds: [
      item('Player Made Two Pointers', 'twoPointsMade', 'Betano', 'over', -150, 1.5), item('Player Two Pointers Attempted', 'twoPointsAtt', 'Betano', 'over', -150, 3.5),
      item('Player Fantasy Score (All)', 'fantasyPoints', 'Betano', 'over', -110, 30.5), item('Player Threes Attempted', 'threePointsAtt', 'Betano', 'over', -110, 4.5),
      item('Player Free Throws Attempted', 'freeThrowsAtt', 'Betano', 'over', -110, 3.5), item('Player Field Goals Made', 'fieldGoalsMade', 'Betano', 'over', -110, 7.5),
      item('Player Made Threes', 'threePointsMade', 'DraftKings', 'over', -120, 2.5), item('Player Points', 'points', 'DraftKings', 'over', -110, 26.5),
    ] };
    expect(mapPlayers([stray])[0].props.map((x) => `${x.market} ${x.line}`)).toEqual(['tpm 2.5', 'pts 26.5']);
    // Preseason rows are left out of the logs and the anchor (LeBron's o14.5 points, 2026-10-20), and the
    // main line priced both ways by the most books wins before the one nearest his average.
    const pre = { ...ladder, stats: [{ ...GAME, points: 9, seasonType: 'PRE' }, { ...GAME, gameDate: '2026-10-19T23:30:00Z', points: 10, seasonType: 'PRE' }, { ...GAME, gameDate: '2026-04-10T23:30:00Z', points: 28, season: 2025 }], odds: [
      item('Player Points', 'points', 'Betano', 'over', -300, 9.5), item('Player Points', 'points', 'DraftKings', 'over', -115, 26.5), item('Player Points', 'points', 'DraftKings', 'under', -105, 26.5), item('Player Points', 'points', 'FanDuel', 'over', -110, 26.5),
    ] };
    const preP = mapPlayers([pre])[0];
    expect(preP.games.map((g) => g.pts)).toEqual([28]);
    expect(preP.props.find((x) => x.market === 'pts').line).toBe(26.5);
    // Without a log the most books decide, and the flag still beats an unflagged line.
    expect(mapPlayers([{ ...ladder, stats: [] }])[0].props.find((x) => x.market === 'pts').line).toBe(8.5);
    expect(fieldsSeen([PLAYER], []).unread).toEqual(['oddStat']);
    const seen = fieldsSeen([PLAYER], []).markets;
    expect(Object.values(seen).reduce((s, m) => s + m.n, 0)).toBeGreaterThan(0);
    expect(Object.values(seen).every((m) => typeof m.n === 'number')).toBe(true);
  });
  test('the injury report, live: the games payload first, the per-team route as the fallback; statuses onto the players', async () => {
    const teams = [{ id: 1, code: 'BOS' }, { id: 2, code: 'NYK' }];
    const byAbbr = { BOS: teams[0], NY: teams[1] };
    const report = JSON.stringify({ data: [{ team: { id: 1 }, player: { id: 'p1', name: 'Jayson Tatum', position: 'SF' }, status: 'out', type: 'Achilles' }] });
    const calls = [];
    const v2 = async (path) => { calls.push(path); if (path.startsWith('/NBA/v2?sportsbooks=draftkings&sportsbooks=fanduel')) return { games: [], players: [], depthCharts: [], injuryReport: report }; throw new Error('404'); };
    const got = await fetchInjuries({ teams, byAbbr, slateAbbrs: ['BOS', 'NY'], get: v2 });
    expect(got.source).toBe('v2');
    expect(calls).toHaveLength(1);
    expect(got.rows).toEqual([{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', status: 'Out', detail: 'Achilles', date: null }]);
    expect(got.keys).toEqual(['games', 'players', 'depthCharts', 'injuryReport']);
    expect(got.sample).toMatchObject({ status: 'out' });
    // Without the games payload, the per-team route; one refusal ends it.
    const perTeam = async (path) => { if (path.startsWith('/NBA/v2')) throw new Error('PropFinder 404 for /NBA/v2'); if (path === '/injuries/nba/1') return [{ id: 7, name: 'Jaylen Brown', status: 'Questionable', position: 'SG' }]; if (path === '/injuries/nba/2') return []; throw new Error('404'); };
    const fb = await fetchInjuries({ teams, byAbbr, slateAbbrs: ['BOS', 'NY'], get: perTeam });
    expect(fb.source).toBe('teams');
    expect(fb.rows).toEqual([{ id: '7', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SG', status: 'Questionable', detail: null, date: null }]);
    expect(fb.errors[0]).toContain('404');
    const none = await fetchInjuries({ teams, byAbbr, slateAbbrs: ['BOS'], get: async () => { throw new Error('down'); } });
    expect(none).toMatchObject({ rows: [], source: null });
    expect(none.error).toContain('down');
    // Onto the players: the report by id, then team + name; the depth chart's flag when the report says nothing.
    const players = [{ id: 'p1', key: 'jayson tatum', team: 'BOS' }, { id: 'x', key: 'jaylen brown', team: 'BOS' }, { id: 'y', key: 'josh hart', team: 'NY' }, { id: 'z', key: 'nobody', team: 'NY' }];
    applyInjuries(players, [...got.rows, ...fb.rows], { NY: { SG: [{ key: 'josh hart', injury: 'Out' }] } });
    expect(players.map((p) => [p.injury || null, p.injuryFrom || null])).toEqual([['Out', 'report'], ['Questionable', 'report'], ['Out', 'depth'], [null, null]]);
    expect(players[0].injuryDetail).toBe('Achilles');
    expect(fieldsSeen([PLAYER], [], got).sample.injury).toContain('Achilles');
    expect(fieldsSeen([PLAYER], [], got).sample.gamesPayload).toBe('games, players, depthCharts, injuryReport');
  });
  test('a team’s depth chart, in the shape the NHL team objects carry', () => {
    const team = { code: 'BOS', depthChart: { positions: { PG: { players: [{ full_name: 'Payton Pritchard', depth: 1, status: 'ACT', reference: '11' }, { full_name: 'Devin Carter', depth: 2, status: 'ACT' }] }, C: { players: [{ full_name: 'Neemias Queta', depth: 1 }] } } } };
    expect(depthChart(team)).toEqual({ PG: [{ name: 'Payton Pritchard', key: 'payton pritchard', depth: 1, status: 'ACT', starter: null, injury: null, id: '11' }, { name: 'Devin Carter', key: 'devin carter', depth: 2, status: 'ACT', starter: null, injury: null, id: null }], C: [{ name: 'Neemias Queta', key: 'neemias queta', depth: 1, status: null, starter: null, injury: null, id: null }] });
    expect(depthChart({ code: 'BOS' })).toBeNull();
    // The NBA shape: the chart as a JSON string in `data` (checked 2026-10-20), with the starter and injury flags.
    const nba = { code: 'CHI', depthChart: { id: 1, teamId: 't', data: JSON.stringify({ id: 't', alias: 'CHI', positions: { C: { name: 'C', players: [{ id: 'x1', depth: 1, full_name: 'Nic Claxton', nba_com_starter: true, espn_injury_status: 'Out' }, { id: 'x2', depth: 2, full_name: 'Jalen Smith' }] }, PG: { players: [{ id: 'x3', depth: 1, full_name: 'Josh Giddey', nba_com_starter: true }] } } }) } };
    expect(depthChart(nba)).toEqual({ C: [{ name: 'Nic Claxton', key: 'nic claxton', depth: 1, status: null, starter: true, injury: 'Out', id: 'x1' }, { name: 'Jalen Smith', key: 'jalen smith', depth: 2, status: null, starter: null, injury: null, id: 'x2' }], PG: [{ name: 'Josh Giddey', key: 'josh giddey', depth: 1, status: null, starter: true, injury: null, id: 'x3' }] });
    expect(depthChart({ code: 'CHI', depthChart: { data: 'not json' } })).toBeNull();
    expect(fieldsSeen([], [team]).sample.depthChart).toContain('Payton Pritchard');
  });
  test('what each defense allows per position, from the positions the rows carry', () => {
    // PropFinder's NBA rows are per-game figures already (no division by the games); a playoff row is not the season's.
    const row = (pos, pts, reb = 6, ast = 4) => ({ type: 'Opponent', position: pos, seasonYear: 2026, seasonType: 'REG', gamesPlayed: 5, points: pts / 5, rebounds: reb, assists: ast });
    const teams = [{ code: 'BOS', stats: [row('PG', 120), row('C', 100)] }, { code: 'NYK', stats: [row('PG', 150), row('C', 110)] }, { code: 'MIA', stats: [row('PG', 135)] }];
    const d = defenseAllowed(teams, { season: 2026 });
    expect(d.positions.sort()).toEqual(['C', 'PG']);
    expect(d.teams.NY.PG).toMatchObject({ gp: 5, pts: 30, reb: 6, ast: 4, pra: 40 });
    expect(defenseAllowed([{ code: 'NYK', stats: [{ ...row('PG', 150), seasonType: 'PST' }] }], { season: 2026 }).teams.NY).toBeUndefined();
    expect(d.ranks.NY.PG.pts).toBe(1);
    expect(d.ranks.MIA.PG.pts).toBe(2);
    expect(d.ranks.BOS.PG.pts).toBe(3);
    expect(d.ranks.NY.C.pts).toBe(1);
    // The team's own totals and what it gives up in all ride along, with the league's average of the former.
    const withTotals = teams.map((t) => ({ ...t, stats: [...t.stats, { ...row('All', t.code === 'BOS' ? 600 : 550), type: 'Team' }, { ...row('All', 560) }, { ...row('All', 580), type: 'Team', lastNGames: 10, gamesPlayed: 10 }, { ...row('All', 540), lastNGames: 10, gamesPlayed: 10 }] }));
    const wt = defenseAllowed(withTotals, { season: 2026 });
    expect(wt.totals.BOS.for.pts).toBe(120);
    expect(wt.totals.BOS.against.pts).toBe(112);
    expect(wt.leagueFor.pts).toBeCloseTo((120 + 110 + 110) / 3, 2);
    // The last ten this season ride on the totals (the characteristics card's trend), last season too when the rows carry it.
    expect(wt.totals.BOS.l10.for).toMatchObject({ pts: 116, gp: 10 });
    expect(wt.totals.BOS.l10.against).toMatchObject({ pts: 108 });
    expect(wt.totals.BOS.prior).toBeNull();
    expect(d.totals).toEqual({});
    // Early in the season the table is this season's from the team's first game (two games: this
    // season's 35 a game, not last season's 22 and no blend of the two); a position without a game
    // this season yet reads last season's row and says so (`held`).
    const early = [
      { code: 'BOS', stats: [{ ...row('PG', 175), gamesPlayed: 2 }, { ...row('PG', 110), seasonYear: 2025, gamesPlayed: 82 }, { ...row('C', 0), gamesPlayed: 0 }, { ...row('C', 20), seasonYear: 2025, gamesPlayed: 82 }] },
      { code: 'NYK', stats: [{ ...row('PG', 150), seasonYear: 2025, gamesPlayed: 82 }] },
    ];
    const e = defenseAllowed(early, { season: 2026 });
    expect(e.teams.BOS.PG).toMatchObject({ gp: 2, season: 2026, pts: 35 });
    expect(e.teams.BOS.PG.held).toBeUndefined();
    expect(e.teams.BOS.PG.prior).toBeUndefined();
    expect(e.teams.BOS.C).toMatchObject({ gp: 0, prior: 82, priorSeason: 2025, season: 2025, held: true, pts: 4 });
    expect(e.teams.NY.PG).toMatchObject({ gp: 0, prior: 82, season: 2025, held: true, pts: 30 });
    expect(e.ranks.BOS.PG.pts).toBe(1);
    expect(e.ranks.NY.PG.pts).toBe(2);
    // Last season's full table rides along as `prior`, ranked on its own: NY's 30 over BOS's 22.
    expect(e.prior).toMatchObject({ season: 2025, count: 2 });
    expect(e.prior.teams.BOS.PG.pts).toBe(22);
    expect(e.prior.teams.NY.PG.pts).toBe(30);
    expect(e.prior.ranks.NY.PG.pts).toBe(1);
    expect(e.prior.ranks.BOS.PG.pts).toBe(2);
    expect(e.prior.league.PG.pts).toBe(26);
    expect(d.prior).toBeNull();   // no last-season rows in the plain fixture
    // The league's average per position and stat rides along, and the last-N windows PropFinder publishes with their own ranks.
    expect(d.league.PG.pts).toBeCloseTo((24 + 30 + 27) / 3, 2);
    expect(d.windows).toEqual({});
    const windowed = teams.map((t) => ({ ...t, stats: [...t.stats, { ...row('PG', t.code === 'BOS' ? 160 : 100), lastNGames: 5 }, { ...row('PG', 60), lastNGames: 10, gamesPlayed: 10 }] }));
    const w = defenseAllowed(windowed, { season: 2026 });
    expect(Object.keys(w.windows).sort()).toEqual(['l10', 'l5']);
    expect(w.windows.l5.teams.BOS.PG).toMatchObject({ pts: 32, lastN: 5, gp: 5 });
    expect(w.windows.l5.ranks.BOS.PG.pts).toBe(1);
    expect(w.windows.l5.ranks.NY.PG.pts).toBe(2);
    expect(w.windows.l5.league.PG.pts).toBeCloseTo((32 + 20 + 20) / 3, 2);
    expect(w.windows.l10.teams.NY.PG.pts).toBe(12);
    expect(w.windows.l5.count).toBe(3);
    expect(w.windows.l5.season).toBe(2026);
    // Before this season's first game the windows are last season's final games, and say so.
    const lastYear = teams.map((t) => ({ ...t, stats: [...t.stats, { ...row('PG', 100), seasonYear: 2025, lastNGames: 5 }] }));
    expect(defenseAllowed(lastYear, { season: 2026 }).windows.l5).toMatchObject({ season: 2025, lastN: 5 });
    // The season table is untouched by the window rows.
    expect(w.teams.NY.PG.pts).toBe(30);
  });
});

describe('NBA board', () => {
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: true, state: 'post', awayScore: 110, homeScore: 104, detail: 'Final' }];
  const log = (date, pts, reb, ast) => ({ date, season: 2026, type: 'REG', opp: 'NY', pts, reb, ast, tpm: 3, stl: 1, blk: 0, tov: 2, pra: pts + reb + ast, pr: pts + reb, pa: pts + ast, ra: reb + ast, stlBlk: 1, dd: reb >= 10 && pts >= 10 ? 1 : 0, td3: 0 });
  const logs = [[30, 8, 5], [25, 11, 6], [33, 7, 4], [28, 12, 8], [19, 6, 3], [31, 9, 5], [27, 10, 6], [35, 8, 7]].map(([p, r, a], i) => log(`2026-10-${String(20 - i).padStart(2, '0')}`, p, r, a));
  const sheets = [{ id: 's1', fileName: 'props-2026-10-21.csv', at: '2026-10-21T12:00:00Z', rows: [
    { player: 'Jayson Tatum', team: 'BOS', pos: 'SF', market: 'pts', group: 'points', line: 27.5, side: 'over', odds: -115, hit: { l10: 0.6 }, avg: {} },
    { player: 'Jayson Tatum', team: 'BOS', pos: 'SF', market: 'dd', group: 'combos', line: 0.5, side: 'yes', odds: 150, hit: { l10: 0.4 }, avg: {} },
    { player: 'Jalen Brunson', team: 'NY', pos: 'PG', market: 'ast', group: 'assists', line: 6.5, side: 'over', odds: -120, hit: { l5: 0.8, l10: 0.7, season: 0.7 }, avg: {} },
  ] }];
  const pf = { at: '2026-10-21T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110 }] }], defense: { count: 3, teams: { NY: { SF: { pts: 28 } } }, ranks: { NY: { SF: { pts: 1 } } } } } };
  const results = { g1: { id: 'g1', final: true, players: [
    { name: 'Jayson Tatum', team: 'BOS', played: true, pts: 29, reb: 12, ast: 4, pra: 45, dd: 1, td3: 0 },
    { name: 'Jalen Brunson', team: 'NY', played: true, pts: 24, reb: 3, ast: 9, pra: 36, dd: 0, td3: 0 },
  ] } };
  test('the injury report: a player out keeps his chip but loses his table rows; a teammate reads w/o him', () => {
    const gid = (i) => `g${i}`;
    // Brown's eight games (newest first): 34 points in the three without Tatum, 20 in the five with him.
    const brownLogs = logs.map((g, i) => ({ ...log(g.date, i < 3 ? 34 : 20, 6, 4), gameId: gid(i), min: 35 }));
    const tatumLogs = logs.map((g, i) => ({ ...g, gameId: gid(i), min: 34 })).filter((_, i) => i >= 3);   // no rows for g0–g2: he sat them
    const pfInj = { at: pf.at, data: { ...pf.data, players: [
      { id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: tatumLogs, props: [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110 }], injury: 'Out', injuryDetail: 'Achilles' },
      { id: 'p2', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SG', games: brownLogs, props: [{ market: 'pts', line: 24.5, odds: -110, underOdds: -110 }] },
    ], injuries: { source: 'v2', rows: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', status: 'Out', detail: 'Achilles', date: null }] } } };
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: pfInj, results: {} });
    const g = b.games[0];
    expect(g.tables.rebounds.rows.find((x) => x.player === 'Jayson Tatum')).toBeUndefined();
    expect(g.tables.rebounds.next.find((x) => x.player === 'Jayson Tatum')).toBeUndefined();
    expect(g.out).toBe(1);
    expect(b.plays).toBe(1);
    const tatum = g.sides.BOS.players.find((p) => p.player === 'Jayson Tatum');
    expect(tatum).toMatchObject({ injury: 'Out', injuryDetail: 'Achilles', out: true, without: null });
    expect(tatum.plays).toHaveLength(1);
    // Brown over 24.5 points: 3 of 8 overall, 3 of 3 without Tatum; the season read moves at 3 / (3 + 8).
    const brown = [...g.tables.points.rows, ...g.tables.points.next].find((x) => x.player === 'Jaylen Brown');
    expect(brown).toMatchObject({ out: false, injury: null, rates: { l5: 0.6, l10: 0.375, season: 0.545 } });
    expect(brown.without).toMatchObject({ names: ['Tatum'], n: 3, rate: 1, rateN: 3, seasonAll: 0.375, avg: 34, avgAll: 25.3, weight: 0.273 });
    expect(brown.without.absent[0]).toMatchObject({ name: 'Jayson Tatum', status: 'Out', detail: 'Achilles', together: 5, of: 8 });
    expect(brown.avg).toMatchObject({ l5: 28.4, l10: 25.3, season: 27.7 });
    const side = g.sides.BOS.players.find((p) => p.player === 'Jaylen Brown');
    expect(side.own.pts).toMatchObject({ all: 25.3, without: 34, n: 3, season: 27.7 });
    expect(side.without).toMatchObject({ names: ['Tatum'], n: 3, weight: 0.273 });
    // Tatum's production goes to his teammates: his 28 a game, for the 5 of Brown's 8 games he was part
    // of, 60% of it to the priced players (Brown alone here), at 1 − the split's weight: 28 × 0.625 ×
    // 0.6 × 0.727 = 7.6 on Brown's rate (26.9 → 34.5), the ladder's centre and the range with it.
    expect(side.own.pts).toMatchObject({ lift: 7.6, liftFrom: ['Jayson Tatum'] });
    expect(side.ranges.pts).toMatchObject({ rate: 34.5, lift: 7.6, liftFrom: ['Jayson Tatum'], exp: 34.5 });
    expect(side.ladders.pts[0].rate).toBe(34.5);
    expect(b.notes.find((n) => n.startsWith('Vacated production'))).toContain('BOS: Jaylen Brown +7.6 pts (Tatum out)');
    // A season-long absence hands over nothing: Brown's averages were earned without him already.
    const gone = { ...pfInj, data: { ...pfInj.data, players: pfInj.data.players.map((p) => (p.key === 'jayson tatum' ? { ...p, games: p.games.map((g) => ({ ...g, gameId: 'old' + g.gameId })) } : p)) } };
    const goneSide = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: gone, results: {} }).games[0].sides.BOS.players.find((p) => p.player === 'Jaylen Brown');
    expect(goneSide.own.pts.lift).toBeUndefined();
    expect(goneSide.ranges.pts.lift).toBeNull();
    expect(side.ladders.pts.find((r) => r.main).proj).toBeGreaterThan(buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: { ...pfInj, data: { ...pfInj.data, injuries: { rows: [] }, players: pfInj.data.players.map((p) => ({ ...p, injury: null })) } }, results: {} }).games[0].sides.BOS.players.find((p) => p.player === 'Jaylen Brown').ladders.pts.find((r) => r.main).proj);
    expect(b.notes.find((n) => n.startsWith('Out tonight'))).toContain('Jayson Tatum (BOS, Out, Achilles)');
    expect(b.notes.find((n) => n.startsWith('Without-teammate reads'))).toContain('Jaylen Brown w/o Tatum (3 games: 100% over 24.5 Points, 34 a game)');
    // Nobody out: no split, nothing muted, the plain reads.
    const plain = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: { ...pfInj, data: { ...pfInj.data, injuries: { rows: [] }, players: pfInj.data.players.map((p) => ({ ...p, injury: null })) } }, results: {} });
    expect(plain.games[0].out).toBe(0);
    expect([...plain.games[0].tables.points.rows, ...plain.games[0].tables.points.next].find((x) => x.player === 'Jaylen Brown')).toMatchObject({ without: null, rates: { season: 0.375 } });
    expect(plain.notes.find((n) => n.startsWith('Nobody on the slate is out'))).toBeUndefined();
  });
  test('tables per group from the logs and the sheet, graded', () => {
    expect(statOf({ pts: 10, reb: 11, ast: 12 }, 'pra')).toBe(33);
    const r = logRates(logs, { market: 'pts', line: 27.5, side: 'over', season: 2026, opp: 'NY' });
    // 30 25 33 28 19 | 31 27 35 over 27.5: 3 of 5, 5 of 8; the last four against NY: 3 of 4.
    expect(r).toMatchObject({ l5: 0.6, l5N: 5, l10: 0.625, l10N: 8, season: 0.625, seasonN: 8, h2h: 0.75, n: 8 });
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets, pf, results });
    expect(b.date).toBe('2026-10-21');
    expect(b.plays).toBe(4);
    const g = b.games[0];
    const row = (group, player) => g.tables[group].rows.find((x) => x.player === player);
    expect(row('points', 'Jayson Tatum')).toMatchObject({ label: 'Points', line: 27.5, rates: { from: 'logs', l10: 0.625 }, actual: 29, hit: true, spot: { soft: true, key: 'pts' }, confirmed: true });
    expect(row('assists', 'Jalen Brunson')).toMatchObject({ pfBacked: false, sheetOnly: true });
    expect(row('rebounds', 'Jayson Tatum')).toMatchObject({ label: 'Rebounds', line: 8.5, sources: ['propfinder'], actual: 12, hit: true });
    expect(row('combos', 'Jayson Tatum')).toMatchObject({ label: 'Double-double', side: 'yes', actual: 1, hit: true });
    expect(row('assists', 'Jalen Brunson')).toMatchObject({ rates: { from: 'sheet' }, actual: 9, hit: true, form: 'hot' });
    expect(g.tables.threes.rows).toEqual([]);
    expect(g.tally.of).toBeGreaterThanOrEqual(3);
    expect(b.notes.join(' ')).toMatch(/Softest spots: NY to SFs/);
  });
});

describe('NBA projection', () => {
  const { envFactor, ownRate, projectionOf, projectFor } = require('../lib/picks/projection');
  test('his rate times the environment, damped', () => {
    expect(ownRate({ l5: 10, l10: 12, season: 20 })).toBe(17.2);
    expect(ownRate({ season: 20 })).toBe(20);
    expect(ownRate({ l10: 12 })).toBe(12);
    expect(ownRate(null)).toBeNull();
    expect(envFactor(30, 25)).toBe(1.12);           // 20% over the league counts 12%
    expect(envFactor(20, 25)).toBe(0.88);
    expect(envFactor(null, 25)).toBeNull();
    expect(projectionOf(17.2, 1.12)).toBe(19.3);
    expect(projectionOf({ season: 20 }, null)).toBe(20);
    const allowed = { rows: { PG: { pts: { value: 30, rank: 1 } } }, league: { PG: { pts: 25 } } };
    expect(projectFor({ season: 20 }, allowed, 'PG', 'pts')).toEqual({ rate: 20, factor: 1.12, team: null, value: 22.4, allowed: 30, league: 25, rank: 1 });
    expect(projectFor({ season: 20 }, allowed, 'C', 'pts')).toMatchObject({ rate: 20, factor: null, value: 20 });
  });
});

describe('NBA ladders', () => {
  const { ladderOf, buildBoard } = require('../lib/nba/picks');
  const { upperTail } = require('../lib/picks/board');
  test('the normal tail', () => { expect(upperTail(0)).toBeCloseTo(0.5, 6); expect(upperTail(1.96)).toBeCloseTo(0.025, 3); expect(upperTail(-1)).toBeCloseTo(0.8413, 3); });
  const logs = Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 20 + (i % 5) * 3, reb: 8, ast: 5, tpm: 2 }));   // 20, 23, 26, 29, 32 repeating
  test('the book’s rungs with his chance of clearing each, the main one marked', () => {
    const prop = { market: 'pts', line: 25.5, odds: -110, underOdds: -110, books: 3, isMain: true, lines: [{ line: 19.5, odds: -400, underOdds: 280, books: 1, main: false }, { line: 25.5, odds: -110, underOdds: -110, books: 3, main: true }, { line: 31.5, odds: 300, underOdds: -400, books: 2, main: false }] };
    const l = ladderOf(logs, { market: 'pts', season: 2026, prop });
    expect(l.map((r) => [r.line, r.main])).toEqual([[19.5, false], [25.5, true], [31.5, false]]);
    expect(l[0].p).toBeGreaterThan(l[1].p);
    expect(l[1].p).toBeGreaterThan(l[2].p);
    expect(l[1].rates).toMatchObject({ season: 0.6, n: 20 });   // 26, 29, 32 clear 25.5: 12 of 20
    expect(l[2].rates.season).toBe(0.2);
    expect(l[0].odds).toBe(-400);
    // The number: half his distribution's tail over the rung (mean 26, sd 4.3), half how often he cleared it; no price in it.
    expect(l[1]).toMatchObject({ proj: 26, emp: 0.6 });
    expect(l[1].sd).toBe(6.5);   // his own spread is 4.35; the floor, a quarter of the projection, keeps a scorer's tail
    expect(l[1].model).toBeCloseTo(0.531, 2);
    expect(l[1].p).toBeCloseTo(0.5 * 0.531 + 0.3, 2);
    // The environment moves the centre: a soft spot (×1.12) lifts every rung.
    const soft = ladderOf(logs, { market: 'pts', season: 2026, prop, env: 1.12 });
    expect(soft[1].proj).toBeCloseTo(29.1, 1);
    expect(soft[1].p).toBeGreaterThan(l[1].p);
    expect(soft[1].env).toBe(1.12);
  });
  test('a prop without a ladder climbs by the market’s step around the main line; no prop, around his average', () => {
    const l = ladderOf(logs, { market: 'pts', season: 2026, prop: { market: 'pts', line: 25.5, odds: -110, underOdds: -110, books: 2, isMain: true } });
    expect(l.map((r) => r.line)).toEqual([21.5, 23.5, 25.5, 27.5, 29.5, 31.5, 33.5]);
    expect(l.find((r) => r.main)).toMatchObject({ line: 25.5, odds: -110, books: 2 });
    const bare = ladderOf(logs, { market: 'reb', season: 2026 });
    expect(bare.map((r) => r.line)).toEqual([6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5]);
    expect(bare.find((r) => r.line === 7.5).p).toBeGreaterThan(0.7);   // 8 every night: the floor on his spread keeps a tail
    expect(bare.find((r) => r.line === 8.5).p).toBeLessThan(0.3);
    expect(ladderOf(logs, { market: 'dd', season: 2026 })).toEqual([]);
    // Four games this season: the rungs' season rate reads those four (20, 23, 26, 29: none over 33.5), not the 24 across
    // the seasons; the spread behind the model half still comes from his last 82.
    const early = [...logs.slice(0, 4).map((g) => ({ ...g, season: 2027 })), ...logs.map((g) => ({ ...g, season: 2026 }))];
    const e = ladderOf(early, { market: 'pts', season: 2027, prop: { market: 'pts', line: 25.5, odds: -110, underOdds: -110, books: 2, isMain: true } });
    expect(e.find((r) => r.line === 33.5).rates).toMatchObject({ n: 4, season: 0 });
    expect(e.find((r) => r.line === 33.5).p).toBeLessThan(0.15);
    expect(e.find((r) => r.line === 33.5).sd).toBeGreaterThan(4);
  });
  test('every side player with logs carries his ladders', () => {
    const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
    const pf = { at: '2026-10-20T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 25.5, odds: -110, underOdds: -110, isMain: true }] }], defense: null } };
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    const p = b.games[0].sides.BOS.players[0];
    expect(Object.keys(p.ladders).sort()).toEqual(['ast', 'pra', 'pts', 'reb', 'tpm']);
    expect(p.ladders.pts.find((r) => r.main).line).toBe(25.5);
    expect(p.ladders.pts[0].env).toBeNull();   // no defense table in this pull
    // His range tonight: the expected figure, the quartiles of his distribution, the book's main rung with his chance.
    expect(p.ranges.pts).toMatchObject({ exp: 26, floor: 22, ceiling: 30, line: 25.5, odds: -110 });
    expect(p.ranges.pts.p).toBe(p.ladders.pts.find((r) => r.main).p);
    expect(p.ranges.reb).toMatchObject({ exp: 8, line: null, p: null });
    // The arithmetic rides on the range (every view spells out the same figure): no table, no scale → his rate alone.
    expect(p.ranges.pts).toMatchObject({ rate: 26, matchup: null, team: null, env: null });
    expect(p.ladders.pts[0].rate).toBe(26);
    expect(p.scale).toEqual({});
    // The team's expected total is a ceiling on the side's projections: BOS scores 110 a game, NY gives up 120
    // against a league of 115 → 112.9 tonight; the players' own rates add up to 130, so the side scales down to it.
    const two = { ...pf, data: { ...pf.data, players: [...pf.data.players, { id: 'p2', name: 'Derrick White', key: 'derrick white', team: 'BOS', pos: 'SG', games: logs.map((g) => ({ ...g, pts: 104 })), props: [] }], defense: { teams: {}, ranks: {}, count: 0, league: {}, windows: {}, totals: { BOS: { for: { gp: 82, pts: 110, reb: 44, ast: 26 }, against: { gp: 82, pts: 112 } }, NY: { for: { gp: 82, pts: 115 }, against: { gp: 82, pts: 120, reb: 44, ast: 26 } } }, leagueFor: { pts: 115, reb: 44, ast: 26 } } } };
    const sc = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: two, results: {} }).games[0].sides.BOS;
    expect(sc.teamProj.pts).toBeCloseTo(112.9, 1);
    expect(sc.scale.pts).toBeCloseTo(112.9 / (26 + 104), 2);   // over Brown's 26 + White's 104 own rates (the rest of the roster stands in White's figure)
    expect(sc.scale.pra).toBeUndefined();   // their PRA rates (39 + 117) stay under the team's 182.9: nothing to scale
    expect(sc.teamProj.pra).toBeCloseTo(182.9, 1);
    expect(sc.players[0].scale.pts).toBe(sc.scale.pts);
    expect(sc.players[0].ladders.pts[0].env).toBeCloseTo(sc.scale.pts, 2);   // no position table: the scale alone centres the ladder
    expect(sc.players[0].ladders.pts[0].proj).toBeCloseTo(26 * sc.scale.pts, 0);
    expect(sc.players[0].ranges.pts).toMatchObject({ rate: 26, matchup: null, team: sc.scale.pts, env: sc.scale.pts });
    expect(sc.players[0].ranges.pts.exp).toBeCloseTo(26 * sc.scale.pts, 0);
    expect(sc.share).toBeNull();   // no minutes in these logs: no measure of the roster the pull covers
    // The minutes the priced players play ride along as the share of the game they cover; they move no figure.
    const withMin = (mins) => ({ ...two, data: { ...two.data, players: two.data.players.map((p, i) => ({ ...p, games: p.games.map((g) => ({ ...g, min: mins[i] })) })) } });
    const cov = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: withMin([36, 144]), results: {} }).games[0].sides.BOS;
    expect(cov.minutes).toBe(180);
    expect(cov.share).toBe(0.75);
    expect(cov.teamProj.pts).toBeCloseTo(112.9, 1);
    expect(cov.scale.pts).toBeCloseTo(112.9 / 130, 3);
    // It never lifts: a thinly priced side (White at 40 a game puts the two at 66 against a 112.9 total)
    // keeps every player on his own rate — the old pro-rated factor put ×1.28 to ×1.5 on every projection
    // of such a side, a non-shooter's threes included (Castle at 3.6 threes, 2026-10-27).
    const thinPts = { ...two, data: { ...two.data, players: two.data.players.map((p) => (p.key === 'derrick white' ? { ...p, games: p.games.map((g) => ({ ...g, pts: 40 })) } : p)) } };
    const thin = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: thinPts, results: {} }).games[0].sides.BOS;
    expect(thin.scale).toEqual({});
    expect(thin.teamProj.pts).toBeCloseTo(112.9, 1);
    expect(thin.players[0].ladders.pts[0].env).toBeNull();
    expect(thin.players[0].ranges.pts).toMatchObject({ rate: 26, team: null, exp: 26 });
    const thinMin = { ...thinPts, data: { ...thinPts.data, players: thinPts.data.players.map((p, i) => ({ ...p, games: p.games.map((g) => ({ ...g, min: [36, 144][i] })) })) } };
    expect(buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: thinMin, results: {} }).games[0].sides.BOS.scale).toEqual({});
    // The floor of the ceiling: a side whose rates run past twice the total scales to 0.5 at the least.
    const wild = { ...two, data: { ...two.data, players: two.data.players.map((p) => (p.key === 'derrick white' ? { ...p, games: p.games.map((g) => ({ ...g, pts: 300 })) } : p)) } };
    expect(buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: wild, results: {} }).games[0].sides.BOS.scale.pts).toBe(0.5);
    // With a PropFinder table in, the cheat sheet's tiles ride on every cell as `sheet` beside PropFinder's rank.
    const defense = { teams: { NY: { SF: { gp: 0, pts: 24, reb: 6 } }, BOS: { SF: { gp: 0, pts: 20, reb: 7 } } }, ranks: { NY: { SF: { pts: 1, reb: 2 } }, BOS: { SF: { pts: 2, reb: 1 } } }, count: 2, league: { SF: { pts: 22, reb: 6.5 } }, windows: {} };
    const sheets = [{ id: 's', fileName: 'nba_20261021.pdf', rows: [], meta: { oppRanks: { BOS: { SF: { pts: 3, reb: 28 } } } } }];   // BOS's opponent (NY) gives up the 3rd most points to SFs, the 28th most rebounds
    const withSheet = buildBoard({ date: '2026-10-21', season: 2026, games, sheets, pf: { ...pf, data: { ...pf.data, defense } }, results: {} });
    const bos = withSheet.games[0].sides.BOS.allowed;
    // With a table the ladder reads against NY's environment at SF: 24 over the league's 22 → ×1.055.
    expect(withSheet.games[0].sides.BOS.players[0].ladders.pts[0].env).toBeCloseTo(1.055, 3);
    // The range names the matchup apart from the side's factor, the season table's cell behind it: 26 × 1.055 = 27.4.
    const range = withSheet.games[0].sides.BOS.players[0].ranges.pts;
    expect(range).toMatchObject({ rate: 26, team: null, exp: 27.4 });
    expect(range.matchup).toBeCloseTo(1.055, 3);
    expect(range.env).toBe(range.matchup);
    expect(bos.rows.SF.pts).toEqual({ value: 24, rank: 1, sheet: 3 });
    expect(bos.rows.SF.reb).toEqual({ value: 6, rank: 2, sheet: 28 });
    expect(bos.sheet).toBe('beside');
    expect(withSheet.games[0].sides.NY.allowed.rows.SF.pts).toEqual({ value: 20, rank: 2 });
  });
});

describe('NBA board read', () => {
  const { boardRead, windowRead } = require('../lib/picks/projection');
  const season = { rows: { PF: { pts: { value: 18.8, rank: 26 }, held: true } }, league: { PF: { pts: 20.1 } }, count: 30 };
  const l10 = { rows: { PF: { pts: { value: 21.8, rank: 10 } } }, league: { PF: { pts: 20.1 } }, count: 30 };
  test('one figure per player and stat: the board’s range, the season table’s cell behind it; the window a comparison', () => {
    // Randle at BOS, 2026-10-27: the shuffle said #26 PF × 0.96 and 15.8, the court on L10 said #10 and 17.3.
    const p = { ranges: { pts: { exp: 15.8, floor: 11, ceiling: 21, rate: 18.5, matchup: 0.961, team: 0.89, env: 0.855 } }, own: { pts: { season: 18.4, l10: 18.7 } }, scale: { pts: 0.89 } };
    const read = boardRead(p, 'pts', season, 'PF');
    expect(read).toMatchObject({ value: 15.8, rate: 18.5, matchup: 0.961, team: 0.89, env: 0.855, floor: 11, ceiling: 21, from: 'board', pos: 'PF', allowed: 18.8, rank: 26, league: 20.1, count: 30, held: true });
    // The L10 window would read × 1.051 → 17.3; the figure stays 15.8 and the hover says so.
    expect(windowRead(read, l10, 'pts')).toMatchObject({ factor: 1.051, value: 17.3, allowed: 21.8, rank: 10, league: 20.1 });
    expect(windowRead(read, { rows: {}, league: {} }, 'pts')).toBeNull();
    expect(windowRead(read, season, 'pts')).toMatchObject({ factor: 0.961, value: 15.8 });
  });
  test('a stat without a ladder reads off his windows and the season table, never a window', () => {
    const p = { ranges: {}, own: { pts: { season: 18.4, l10: 18.7 } }, scale: { pts: 0.89 } };
    const read = boardRead(p, 'pts', season, 'PF');
    expect(read).toMatchObject({ rate: 18.5, matchup: 0.961, team: 0.89, env: 0.855, floor: null, from: 'own', rank: 26, held: true });
    expect(read.value).toBeCloseTo(15.8, 1);
    expect(boardRead({ ranges: {}, own: {}, scale: null }, 'pts', season, 'PF')).toMatchObject({ value: null, rate: null, matchup: 0.961, env: 0.961, from: 'own' });
    expect(boardRead({ ranges: {}, own: { pts: { season: 10 } } }, 'pts', null, 'PF')).toMatchObject({ value: 10, matchup: null, team: null, env: null, allowed: null, rank: null, held: false });
  });
});

describe('NBA projection with the team scale', () => {
  const { projectFor } = require('../lib/picks/projection');
  test('the side’s factor multiplies the environment', () => {
    const allowed = { rows: { PG: { pts: { value: 30, rank: 1 } } }, league: { PG: { pts: 25 } } };
    expect(projectFor({ season: 20 }, allowed, 'PG', 'pts', { pts: 0.8 })).toMatchObject({ factor: 1.12, team: 0.8, value: 17.9 });
    expect(projectFor({ season: 20 }, allowed, 'PG', 'pts', null)).toMatchObject({ team: null, value: 22.4 });
  });
});
