import { describe, expect, test } from '@jest/globals';
import { levelOf, ordinal, badgeOf, teamRates, modelOf, h2hOf, pfDefenseOf, matchupProfile, PROFILE_ROWS, WORDS } from '../lib/nhl-data/matchup-profile';
import { rowObj, ROW_FIELDS } from '../lib/nhl-data/ingest';
import { game, moneypuck, ratios, profiles, rates, pfTeams, h2h, shotpropz } from './fixtures/matchup-profile-mtl-dal';

const row = (over) => rowObj(ROW_FIELDS.map((k) => ({ date: '2026-10-20', gameId: 2026020100, playerId: 1, name: 'A', team: 'MTL', opp: 'DAL', venue: 'A', pos: 'C', toi: 15, g: 0, a: 0, sog: 2, hits: 0, blk: 0, icf: 3, iff: 2, isf: 2, iscf: 1, ihdcf: 0, result: 'W', posSrc: 'lineup', boxPos: 'C', line: 1, fg: 0, ...over }[k])));
const cellOf = (p, key, team) => p.rows.find((r) => r.key === key)?.cells[team] || null;

describe('matchup profile: the words', () => {
  test('levelOf: the top three elite, the top quarter strong, the middle average, the bottom quarter weak, the bottom three poor', () => {
    expect(levelOf(1)).toBe('elite'); expect(levelOf(3)).toBe('elite'); expect(levelOf(4)).toBe('strong'); expect(levelOf(8)).toBe('strong');
    expect(levelOf(9)).toBe('average'); expect(levelOf(24)).toBe('average');
    expect(levelOf(25)).toBe('weak'); expect(levelOf(29)).toBe('weak'); expect(levelOf(30)).toBe('poor'); expect(levelOf(32)).toBe('poor');
    expect(levelOf(null)).toBeNull(); expect(levelOf(2, 12)).toBe('elite'); expect(levelOf(4, 12)).toBe('average'); expect(levelOf(12, 12)).toBe('poor');
  });
  test('ordinal', () => {
    expect(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '32nd', '101st', '111th']).toEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32, 101, 111].map(ordinal));
  });
  test('badgeOf: the tone follows the rink rule — a strong attack, a leaky defense, a fast pace, a poor goalie read green', () => {
    expect(badgeOf('attack', 2, 32)).toEqual({ level: 'elite', word: 'Elite', tone: 'is-soft' });
    expect(badgeOf('attack', 31, 32)).toEqual({ level: 'poor', word: 'Poor', tone: 'is-tough' });
    expect(badgeOf('defense', 2, 32)).toEqual({ level: 'elite', word: 'Elite', tone: 'is-tough' });
    expect(badgeOf('defense', 28, 32)).toEqual({ level: 'weak', word: 'Leaky', tone: 'is-soft' });
    expect(badgeOf('defense', 32, 32).word).toBe(WORDS.defense.poor);
    expect(badgeOf('goalie', 1, 28).tone).toBe('is-tough');
    expect(badgeOf('pace', 30, 32)).toEqual({ level: 'poor', word: 'Very slow', tone: 'is-tough' });
    expect(badgeOf('firstGoal', 30, 32)).toEqual({ level: 'poor', word: 'Often concedes', tone: 'is-soft' });
    expect(badgeOf('attack', null, 32)).toEqual({ level: null, word: null, tone: '' });
  });
});

describe('matchup profile: the rink side', () => {
  test('teamRates: a team’s own shots and goals a game from its skaters’ rows, this season from its first game, ranked over the teams', () => {
    const rows = [];
    // MTL: three games this season (30, 34, 26 shots; 3, 4, 2 goals), two skaters a game. DAL: two games (20, 24). BOS: last season only.
    for (const [gid, date, sog, g] of [[2026020001, '2026-10-10', 30, 3], [2026020002, '2026-10-12', 34, 4], [2026020003, '2026-10-14', 26, 2]]) {
      rows.push(row({ gameId: gid, date, playerId: 1, sog: sog / 2, g }), row({ gameId: gid, date, playerId: 2, sog: sog / 2, g: 0 }));
    }
    for (const [gid, date, sog] of [[2026020001, '2026-10-10', 20], [2026020004, '2026-10-16', 24]]) rows.push(row({ gameId: gid, date, team: 'DAL', opp: 'MTL', venue: 'H', playerId: 3, sog, g: 1 }));
    rows.push(row({ gameId: 2025020900, date: '2026-03-01', team: 'BOS', opp: 'MTL', playerId: 4, sog: 40, g: 5 }));
    const t = teamRates(rows, 2026);
    expect(t.teams.MTL).toEqual({ gp: 3, sog: 30, g: 3, l5: { gp: 3, sog: 30, g: 3 }, last: '2026-10-14', season: 2026, held: false });
    expect(t.teams.DAL).toEqual({ gp: 2, sog: 22, g: 1, l5: { gp: 2, sog: 22, g: 1 }, last: '2026-10-16', season: 2026, held: false });
    // Last season's regular season stands in for a team without a game yet, marked held.
    expect(t.teams.BOS).toMatchObject({ gp: 1, sog: 40, g: 5, season: 2025, held: true });
    expect(t.ranks.BOS.sog).toBe(1); expect(t.ranks.MTL.sog).toBe(2); expect(t.ranks.DAL.sog).toBe(3);
    expect(t.teamCount).toBe(3);
    expect(t.league.sog).toBe(30.67);
    // Kept per rows array.
    expect(teamRates(rows, 2026)).toBe(t);
  });
  test('modelOf: the lineup’s λ summed, the plays counted, the best play named', () => {
    const m = modelOf(game.sides[0]);
    expect(m.skaters).toBe(18);
    expect(m.sog).toBe(32.3);
    expect(m.goals).toBe(3.04);
    expect(m.plays).toBe(2);
    expect(m.best).toEqual({ name: 'Cole Caufield', market: '3+ SOG', prob: 0.62 });
    expect(modelOf({ skaters: [{ inLineup: true, model: null }], plays: null })).toBeNull();
  });
  test('h2hOf: each team’s side of the stored meetings', () => {
    expect(h2hOf(h2h, 'MTL', 'DAL')).toEqual({ gp: 2, gf: 3.5, ga: 3, won: 1, lost: 1, last: { date: '2026-02-14', score: 'DAL 2–5 MTL' } });
    expect(h2hOf(h2h, 'DAL', 'MTL')).toMatchObject({ gf: 3, ga: 3.5, won: 1, lost: 1 });
    expect(h2hOf([], 'MTL', 'DAL')).toBeNull();
  });
  test('pfDefenseOf: the tab the rink opens on (this season’s) and its L10', () => {
    const d = pfDefenseOf(game.sides[0].propfinder.tabs);
    expect(d.tab.key).toBe('season-2026');
    expect(d.l10.key).toBe('l10');
    expect(pfDefenseOf([])).toBeNull();
  });
});

describe('matchup profile: MTL @ DAL', () => {
  const p = matchupProfile({ game, moneypuck, ratios, profiles, rates, pfTeams, h2h });
  test('the order, the heads and the total', () => {
    expect(p.order).toEqual(['MTL', 'DAL']);
    expect(p.teams.MTL).toMatchObject({ venue: 'A', opp: 'DAL', games: 10, seasonLabel: '2026-27', pf: { label: '2026', stored: false }, verdict: { headline: 'Leaky defense away', tier: 'leaky' } });
    expect(p.teams.DAL).toMatchObject({ venue: 'H', games: 11 });
    expect(p.total).toEqual({ headline: 'Average scoring · 6.0 goals', tier: 'average', projected: 6.0, league: 6.1 });
    expect(p.rows.map((r) => r.key)).toEqual(PROFILE_ROWS.map((r) => r.key));
    expect(p.rows.every((r) => r.label && r.hint && r.group)).toBe(true);
  });
  test('shot volume: the rink’s own count leads from five games, PropFinder and MoneyPuck in the figures and the second line', () => {
    const c = cellOf(p, 'shots', 'MTL');
    expect(c).toMatchObject({ word: 'Strong', level: 'strong', tone: 'is-soft', value: '31.2', unit: 'shots/G', source: 'rink' });
    expect(c.detail).toEqual(['5th of 32 · 31.2 shots a game · over 10 stored games', 'PropFinder 31.0 (6th) · MoneyPuck 30.1 per 60 (7th)']);
    expect(c.figures.map((f) => [f.label, f.value, f.rank, f.tone])).toEqual([['Rink', '31.2', 5, 'is-soft'], ['PF', '31.0', 6, 'is-soft'], ['SF/60', '30.1', 7, 'is-soft']]);
    expect(cellOf(p, 'shots', 'DAL')).toMatchObject({ word: 'Average', tone: '', value: '28.0' });
    expect(cellOf(p, 'goals', 'MTL')).toMatchObject({ word: 'Strong', value: '3.40', unit: 'goals/G' });
  });
  test('shot volume without stored games: PropFinder’s team table leads, then MoneyPuck', () => {
    const thin = { ...rates, teams: { ...rates.teams, MTL: { ...rates.teams.MTL, gp: 3 } } };
    const c = cellOf(matchupProfile({ game, moneypuck, ratios, profiles, rates: thin, pfTeams, h2h }), 'shots', 'MTL');
    expect(c).toMatchObject({ source: 'pf', word: 'Strong', value: '31.0' });
    expect(c.detail[0]).toBe('6th of 32 · 31.0 shots a game · PropFinder 2026-27');
    const mpOnly = cellOf(matchupProfile({ game, moneypuck, ratios, profiles, rates: null, pfTeams: null, h2h }), 'shots', 'MTL');
    expect(mpOnly).toMatchObject({ source: 'mp', value: '30.1', word: 'Strong' });
    // A team held on last season's games says so.
    const held = { ...rates, teams: { ...rates.teams, MTL: { ...rates.teams.MTL, gp: 82, held: true, season: 2025 } } };
    expect(cellOf(matchupProfile({ game, moneypuck, ratios, profiles, rates: held, pfTeams, h2h }), 'shots', 'MTL').detail[1]).toMatch(/2025-26 stored games: 31\.2 a game — no game this season yet/);
  });
  test('chance quality, special teams and attack form', () => {
    expect(cellOf(p, 'chances', 'MTL')).toMatchObject({ word: 'Strong', value: '3.05', unit: 'xGF/60', source: 'mp' });
    expect(cellOf(p, 'chances', 'MTL').detail[1]).toBe('finishing ×1.08 on expected (9th of 28) · PropFinder 28.4 scoring chances a game (4th)');
    expect(cellOf(p, 'chances', 'DAL').figures.map((f) => f.label)).toEqual(['xGF/60', 'SC/G', 'Finish']);
    // Without a ShotPropz snapshot the power play and penalty kill rows read PropFinder's season table alone.
    expect(cellOf(p, 'powerplay', 'MTL')).toMatchObject({ word: 'Elite', tone: 'is-soft', value: '27.5%', unit: 'PP', source: 'pf' });
    expect(cellOf(p, 'powerplay', 'MTL').detail).toEqual(['3rd of 32 · 27.5% on the power play · PropFinder 2026-27 (no ShotPropz snapshot yet)']);
    // A strong kill reads red: fewer goals against it.
    expect(cellOf(p, 'penaltykill', 'DAL')).toMatchObject({ word: 'Tight', tone: 'is-tough', value: '84.2%', unit: 'PK', source: 'pf' });
    expect(cellOf(p, 'penaltykill', 'MTL')).toMatchObject({ word: 'Average', tone: '' });
    expect(cellOf(p, 'form', 'MTL')).toMatchObject({ word: 'Rising', tone: 'is-soft', value: '34.5' });
    expect(cellOf(p, 'form', 'DAL')).toMatchObject({ word: 'Falling', tone: 'is-tough' });
    expect(cellOf(p, 'form', 'DAL').detail[0]).toBe('last 5 vs season · 24.9 shots and 2.60 goals a game against 28.0 and 3.10 over 11 games');
  });
  test('shots allowed: PropFinder’s table above the rink leads, the venue table and the last ten beside it; the words are the defense’s', () => {
    const dal = cellOf(p, 'shotsAllowed', 'DAL');
    expect(dal).toMatchObject({ word: 'Elite', level: 'elite', tone: 'is-tough', value: '25.1', source: 'pf' });
    expect(dal.detail).toEqual(['30th of 32 most · 25.1 shots allowed a game · PropFinder 2026', 'at home: 24.2 over 6 stored games (31st of 32) · last 10: 25.8 (27th)']);
    // The figures show the source's own rank (1 = allows the most) with the tone of its level.
    expect(dal.figures.map((f) => [f.label, f.value, f.rank, f.tone])).toEqual([['PF', '25.1', 30, 'is-tough'], ['Rink home', '24.2', 31, 'is-tough'], ['L10', '25.8', 27, 'is-tough']]);
    const mtl = cellOf(p, 'shotsAllowed', 'MTL');
    expect(mtl).toMatchObject({ word: 'Leaky', tone: 'is-soft', value: '31.4' });
    expect(mtl.figures[1].label).toBe('Rink away');
    expect(cellOf(p, 'goalsAllowed', 'DAL')).toMatchObject({ word: 'Tight', value: '2.40', unit: 'goals A/G' });
    expect(cellOf(p, 'goalsAllowed', 'MTL')).toMatchObject({ word: 'Average', value: '2.90' });
  });
  test('shots allowed without a PropFinder table: the rink’s venue table leads, a PropFinder stand-in says so', () => {
    const noPf = { ...game, sides: game.sides.map((s) => ({ ...s, propfinder: null })) };
    const c = cellOf(matchupProfile({ game: noPf, moneypuck, ratios, profiles, rates, pfTeams, h2h }), 'shotsAllowed', 'DAL');
    expect(c).toMatchObject({ source: 'rink', word: 'Elite', value: '24.2' });
    expect(c.detail).toEqual(['31st of 32 most · 24.2 shots allowed a game · 6 stored games at home', 'last 10: 26.0 a game (25th of 32)']);
    expect(cellOf(matchupProfile({ game: noPf, moneypuck, ratios, profiles, rates, pfTeams, h2h }), 'leaks', 'DAL')).toBeNull();
    const stand = { ...noPf, sides: noPf.sides.map((s, i) => (i === 0 ? { ...s, defense: { ...s.defense, All: { ...s.defense.All, source: 'propfinder', seasonLabel: '2025' } } } : s)) };
    expect(cellOf(matchupProfile({ game: stand, moneypuck, ratios, profiles, rates, pfTeams, h2h }), 'shotsAllowed', 'DAL').detail[0]).toMatch(/PropFinder 2025, standing in/);
  });
  test('by position: a pill a position from the table above the rink, tinted by third, the word naming the soft spots', () => {
    const dal = cellOf(p, 'leaks', 'DAL');
    expect(dal.pills.map((x) => [x.label, x.value, x.tone])).toEqual([['LW', '#30', 'is-tough'], ['C', '#7', 'is-soft'], ['RW', '#29', 'is-tough'], ['D', '#31', 'is-tough']]);
    expect(dal.word).toBe('Leaks to C');
    expect(dal.pills[0].title).toBe('LW: 6.4 shots and 0.50 goals allowed a game, 30th of 32 most · PropFinder 2026');
    const mtl = cellOf(p, 'leaks', 'MTL');
    expect(mtl.word).toBe('Leaks to LW, RW');
    expect(mtl.tone).toBe('is-soft');
  });
  test('defense trend, the first goal, goaltending', () => {
    expect(cellOf(p, 'trend', 'DAL')).toMatchObject({ word: 'Loosening', tone: 'is-soft', value: '26.0' });
    expect(cellOf(p, 'trend', 'DAL').detail[0]).toBe('26.0 shots allowed a game over its last 10 (25th of 32 most) against 31st on the season at home');
    expect(cellOf(p, 'trend', 'MTL')).toMatchObject({ word: 'Steady', tone: '' });
    expect(cellOf(p, 'trend', 'DAL').figures.map((f) => [f.label, f.value, f.rank])).toEqual([['L10', '26.0', 25], ['Season', '24.2', 31], ['Drift', '-6', null]]);
    expect(cellOf(p, 'firstGoal', 'MTL')).toMatchObject({ word: 'Often concedes', tone: 'is-soft', value: '60%' });
    expect(cellOf(p, 'firstGoal', 'MTL').detail).toEqual(['conceded the first goal in 3 of 5 games on the road (60%, league 50%) · 8th of 32 most', 'scored first in 6 of 10 games (60%)']);
    expect(cellOf(p, 'firstGoal', 'DAL')).toMatchObject({ word: 'Rarely concedes', tone: 'is-tough', value: '33%' });
    expect(cellOf(p, 'firstGoal', 'DAL').figures.map((f) => [f.label, f.value])).toEqual([['Scores 1st', '64%'], ['Concedes 1st', '33%'], ['League', '50%']]);
    expect(cellOf(p, 'goaltending', 'MTL')).toMatchObject({ word: 'Elite', tone: 'is-tough', value: '×0.84' });
    expect(cellOf(p, 'goaltending', 'MTL').detail[0]).toBe('2nd of 28 · 2.70 goals against per 60 on 3.20 expected (×0.84) · MoneyPuck');
    expect(cellOf(p, 'goaltending', 'DAL')).toMatchObject({ word: 'Average', tone: '' });
  });
  test('the game: pace, the meetings, the model', () => {
    expect(cellOf(p, 'pace', 'MTL')).toMatchObject({ word: 'Fast', tone: 'is-soft', value: '112.0' });
    expect(cellOf(p, 'pace', 'DAL')).toMatchObject({ word: 'Slow', tone: 'is-tough' });
    expect(cellOf(p, 'pace', 'DAL').detail[0]).toBe('27th of 32 fastest · 98.0 shot attempts both ways per 60 · takes 52.0% of them · MoneyPuck');
    expect(cellOf(p, 'h2h', 'MTL')).toMatchObject({ word: '1–1', value: '3.5', tone: '' });
    expect(cellOf(p, 'h2h', 'MTL').detail[0]).toBe('2 meetings stored · 3.5 goals for and 3.0 against a game · last DAL 2–5 MTL (2026-02-14)');
    expect(cellOf(p, 'h2h', 'DAL').figures.map((f) => [f.label, f.value])).toEqual([['GF', '3.0'], ['GA', '3.5']]);
    expect(cellOf(p, 'tonight', 'MTL')).toMatchObject({ word: '2 plays', tone: 'is-soft', value: '32.3', unit: 'λ SOG' });
    expect(cellOf(p, 'tonight', 'MTL').detail[0]).toBe('32.3 shots and 3.04 goals expected over 18 skaters · best play Cole Caufield 3+ SOG 62%');
    expect(cellOf(p, 'tonight', 'DAL')).toMatchObject({ word: '1 play' });
  });
  test('with ShotPropz: the power play and the penalty kill lead on the venue board from four games there, the shots rows carry the venue split', () => {
    const q = matchupProfile({ game, moneypuck, ratios, profiles, rates, pfTeams, h2h, shotpropz });
    expect(q.teams.MTL.shotpropz).toEqual({ updated: 'Oct 30, 2026', venueGames: 6 });
    expect(q.teams.DAL.shotpropz.venueGames).toBe(6);
    // Shot volume: the rink still leads; ShotPropz's venue split and last ten ride on a third line and two figures.
    const shots = cellOf(q, 'shots', 'MTL');
    expect(shots.source).toBe('rink');
    expect(shots.detail[2]).toBe('ShotPropz on the road 29.7 (9th of 32, 6 games) · last 10 32.4 (4th)');
    expect(shots.figures.map((f) => f.label)).toEqual(['Rink', 'PF', 'SF/60', 'SPZ away', 'SPZ L10']);
    expect(shots.figures[3]).toMatchObject({ value: '29.7', rank: 9, tone: '' });
    expect(cellOf(q, 'goals', 'DAL').detail[2]).toBe('ShotPropz at home 3.50 (9th of 32, 6 games) · last 10 2.70 (22nd)');
    // Power play: MTL on the road (6 games there), DAL at home.
    const pp = cellOf(q, 'powerplay', 'MTL');
    expect(pp).toMatchObject({ word: 'Average', tone: '', value: '22.2%', unit: 'PP on the road', source: 'spz' });
    expect(pp.detail).toEqual(['12th of 32 · 22.2% on the power play on the road · gets 3.0 power plays a game (13th) · ShotPropz 2026-27, 6 games', 'all games 25.6% (6th) · last 10 28.6% (4th) · PropFinder 27.5% (3rd)']);
    expect(pp.figures.map((f) => [f.label, f.value, f.rank])).toEqual([['PP%', '22.2', 12], ['PP/G', '3.0', 13], ['L10', '28.6', 4], ['PF', '27.5', 3]]);
    expect(cellOf(q, 'powerplay', 'DAL')).toMatchObject({ word: 'Strong', tone: 'is-soft', value: '27.8%', unit: 'PP at home' });
    expect(cellOf(q, 'powerplay', 'DAL').figures[1]).toMatchObject({ label: 'PP/G', value: '3.0', rank: 17, tone: '' });
    // Penalty kill: rank 1 = the softest, so DAL's 92.9% at home (32nd) is Elite and red, MTL's 68.4% on the road (3rd) Very leaky and green.
    const dal = cellOf(q, 'penaltykill', 'DAL');
    expect(dal).toMatchObject({ word: 'Elite', level: 'elite', tone: 'is-tough', value: '92.9%', unit: 'PK at home', source: 'spz' });
    expect(dal.detail[0]).toBe('32nd of 32 softest · 92.9% on the penalty kill at home · gives 2.3 power plays a game (29th most) · ShotPropz 2026-27, 6 games');
    expect(dal.detail[1]).toBe('all games 86.7% (29th) · last 10 88.9% (30th) · PropFinder 84.2% (4th)');
    expect(dal.figures.map((f) => [f.label, f.value, f.rank, f.tone])).toEqual([['PK%', '92.9', 32, 'is-tough'], ['PP given/G', '2.3', 29, 'is-tough'], ['L10', '88.9', 30, 'is-tough'], ['PF', '84.2', 4, 'is-tough']]);
    const mtl = cellOf(q, 'penaltykill', 'MTL');
    expect(mtl).toMatchObject({ word: 'Very leaky', level: 'poor', tone: 'is-soft', value: '68.4%' });
    expect(mtl.figures[1]).toMatchObject({ label: 'PP given/G', value: '3.3', rank: 7, tone: 'is-soft' });
    // Shots allowed: the venue split and the last ten from ShotPropz on a third line, rank 1 = the softest.
    const sa = cellOf(q, 'shotsAllowed', 'DAL');
    expect(sa.detail[2]).toBe('ShotPropz at home 24.3 allowed (31st of 32 most, 6 games) · last 10 26.0 (26th)');
    expect(sa.figures.slice(3).map((f) => [f.label, f.value, f.rank, f.tone])).toEqual([['SPZ home', '24.3', 31, 'is-tough'], ['SPZ L10', '26.0', 26, 'is-tough']]);
    expect(cellOf(q, 'goalsAllowed', 'MTL').figures.find((f) => f.label === 'SPZ away')).toMatchObject({ value: '3.17', rank: 10 });
    // Under four games at the venue the all-games board leads and the venue figure follows on the second line.
    const thin = JSON.parse(JSON.stringify(shotpropz));
    for (const k of Object.keys(thin.boards.offense.home.ytd)) thin.boards.offense.home.ytd[k].teams.DAL.gp = 3;
    const t = cellOf(matchupProfile({ game, moneypuck, ratios, profiles, rates, pfTeams, h2h, shotpropz: thin }), 'powerplay', 'DAL');
    expect(t).toMatchObject({ word: 'Average', value: '21.2%', unit: 'PP all games' });
    expect(t.detail[1]).toBe('at home 27.8% over 3 games · last 10 15.4% (25th) · PropFinder 21.0% (15th)');
  });
  test('without meetings or a run the game rows say so; without any read at all the profile is null', () => {
    const bare = { ...game, sides: game.sides.map((s) => ({ ...s, skaters: s.skaters.map((k) => ({ ...k, model: null })), plays: null })) };
    const q = matchupProfile({ game: bare, moneypuck, ratios, profiles, rates, pfTeams, h2h: [] });
    expect(cellOf(q, 'h2h', 'MTL')).toMatchObject({ word: null, detail: ['no stored meetings this season or last'] });
    expect(cellOf(q, 'tonight', 'DAL')).toMatchObject({ word: null, detail: ['no model run saved for this slate yet'] });
    const empty = { away: 'MTL', home: 'DAL', sides: [{ team: 'MTL', opp: 'DAL', venue: 'A', skaters: [], defense: null, propfinder: null, plays: null }, { team: 'DAL', opp: 'MTL', venue: 'H', skaters: [], defense: null, propfinder: null, plays: null }] };
    const e = matchupProfile({ game: empty });
    // The meetings and the model rows always read (they say what is missing), nothing else does.
    expect(e.rows.map((r) => r.key)).toEqual(['h2h', 'tonight']);
    expect(matchupProfile({ game: null })).toBeNull();
  });
});
