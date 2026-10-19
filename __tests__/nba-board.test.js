import { describe, expect, test } from '@jest/globals';
import { marketFromText, groupOf, statFields, MARKETS, GROUPS } from '../lib/nba/markets';
import { teamAbbrFromText, parseMatchup, teamLogo } from '../lib/nba/teams';
import { parseCheatSheet, classifyHeader, parsePlayerCell } from '../lib/nba/cheatsheet';
import { parseSummary, parseScoreboard, seasonOfDate, derived } from '../lib/nba/espn';
import { gameRow, mapPlayers, defenseAllowed, fieldsSeen } from '../lib/nba/propfinder-nba';
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
    const players = mapPlayers([PLAYER]);
    expect(players[0]).toMatchObject({ key: 'jayson tatum', team: 'BOS', pos: 'SF' });
    expect(players[0].props).toEqual([{ market: 'pts', line: 27.5, odds: -115, underOdds: -105, book: null }, { market: 'pra', line: 39.5, odds: -110, underOdds: null, book: null }]);
    expect(mapPlayers([{ ...PLAYER, positionAbbreviation: 'G-F' }])[0].pos).toBe('G');
    expect(fieldsSeen([PLAYER], []).unread).toEqual(['oddStat']);
  });
  test('what each defense allows per position, from the positions the rows carry', () => {
    const row = (pos, pts, reb = 30, ast = 20) => ({ type: 'Opponent', position: pos, seasonYear: 2026, gamesPlayed: 5, points: pts, rebounds: reb, assists: ast });
    const teams = [{ code: 'BOS', stats: [row('PG', 120), row('C', 100)] }, { code: 'NYK', stats: [row('PG', 150), row('C', 110)] }, { code: 'MIA', stats: [row('PG', 135)] }];
    const d = defenseAllowed(teams, { season: 2026 });
    expect(d.positions.sort()).toEqual(['C', 'PG']);
    expect(d.teams.NY.PG).toMatchObject({ gp: 5, pts: 30, reb: 6, ast: 4, pra: 40 });
    expect(d.ranks.NY.PG.pts).toBe(1);
    expect(d.ranks.MIA.PG.pts).toBe(2);
    expect(d.ranks.BOS.PG.pts).toBe(3);
    expect(d.ranks.NY.C.pts).toBe(1);
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
    expect(row('points', 'Jayson Tatum')).toMatchObject({ label: 'Points', line: 27.5, rates: { from: 'logs', l10: 0.625 }, actual: 29, hit: true, spot: { soft: true, key: 'pts' } });
    expect(row('rebounds', 'Jayson Tatum')).toMatchObject({ label: 'Rebounds', line: 8.5, sources: ['propfinder'], actual: 12, hit: true });
    expect(row('combos', 'Jayson Tatum')).toMatchObject({ label: 'Double-double', side: 'yes', actual: 1, hit: true });
    expect(row('assists', 'Jalen Brunson')).toMatchObject({ rates: { from: 'sheet' }, actual: 9, hit: true, form: 'hot' });
    expect(g.tables.threes.rows).toEqual([]);
    expect(g.tally.of).toBeGreaterThanOrEqual(3);
    expect(b.notes.join(' ')).toMatch(/Softest spots: NY to SFs/);
  });
});
