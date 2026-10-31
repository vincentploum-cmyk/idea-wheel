import { describe, expect, test } from '@jest/globals';
import { levelOf, ordinal, badgeOf, teamRates, pfDefenseOf, matchupProfile, PROFILE_ROWS, WORDS } from '../lib/nhl-data/matchup-profile';
import { rowObj, ROW_FIELDS } from '../lib/nhl-data/ingest';
import { game, rates, pfTeams, shotpropz } from './fixtures/matchup-profile-mtl-dal';

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
  test('badgeOf: the tone follows the rink rule — a strong attack and a leaky defense read green, a tight defense red', () => {
    expect(badgeOf('attack', 2, 32)).toEqual({ level: 'elite', word: 'Elite', tone: 'is-soft' });
    expect(badgeOf('attack', 31, 32)).toEqual({ level: 'poor', word: 'Poor', tone: 'is-tough' });
    expect(badgeOf('defense', 2, 32)).toEqual({ level: 'elite', word: 'Elite', tone: 'is-tough' });
    expect(badgeOf('defense', 28, 32)).toEqual({ level: 'weak', word: 'Leaky', tone: 'is-soft' });
    expect(badgeOf('defense', 32, 32).word).toBe(WORDS.defense.poor);
    expect(badgeOf('attack', null, 32)).toEqual({ level: null, word: null, tone: '' });
  });
});

describe('matchup profile: the rink side', () => {
  test('teamRates: a team’s own shots and goals a game from its skaters’ rows, this season from its first game, ranked over the teams', () => {
    const rows = [];
    for (const [gid, date, sog, g] of [[2026020001, '2026-10-10', 30, 3], [2026020002, '2026-10-12', 34, 4], [2026020003, '2026-10-14', 26, 2]]) {
      rows.push(row({ gameId: gid, date, playerId: 1, sog: sog / 2, g }), row({ gameId: gid, date, playerId: 2, sog: sog / 2, g: 0 }));
    }
    for (const [gid, date, sog] of [[2026020001, '2026-10-10', 20], [2026020004, '2026-10-16', 24]]) rows.push(row({ gameId: gid, date, team: 'DAL', opp: 'MTL', venue: 'H', playerId: 3, sog, g: 1 }));
    rows.push(row({ gameId: 2025020900, date: '2026-03-01', team: 'BOS', opp: 'MTL', playerId: 4, sog: 40, g: 5 }));
    const t = teamRates(rows, 2026);
    expect(t.teams.MTL).toEqual({ gp: 3, sog: 30, g: 3, l5: { gp: 3, sog: 30, g: 3 }, l10: { gp: 3, sog: 30, g: 3 }, last: '2026-10-14', season: 2026, held: false });
    expect(t.teams.DAL).toMatchObject({ gp: 2, sog: 22, g: 1, held: false });
    expect(t.teams.BOS).toMatchObject({ gp: 1, sog: 40, g: 5, season: 2025, held: true });
    expect(t.ranks.BOS.sog).toBe(1); expect(t.ranks.MTL.sog).toBe(2); expect(t.ranks.DAL.sog).toBe(3);
    expect(t.teamCount).toBe(3);
    expect(t.league.sog).toBe(30.67);
    expect(teamRates(rows, 2026)).toBe(t);
  });
  test('pfDefenseOf: the tab the rink opens on (this season’s) and its L10', () => {
    const d = pfDefenseOf(game.sides[0].propfinder.tabs);
    expect(d.tab.key).toBe('season-2026');
    expect(d.l10.key).toBe('l10');
    expect(pfDefenseOf([])).toBeNull();
  });
});

describe('matchup profile: MTL @ DAL with ShotPropz', () => {
  const p = matchupProfile({ game, rates, pfTeams, shotpropz });
  test('five rows, the heads, the total', () => {
    expect(p.order).toEqual(['MTL', 'DAL']);
    expect(p.rows.map((r) => r.key)).toEqual(['shooting', 'allows', 'powerplay', 'penaltykill', 'last10']);
    expect(PROFILE_ROWS).toHaveLength(5);
    expect(p.rows.every((r) => r.label && r.hint)).toBe(true);
    expect(p.teams.MTL).toMatchObject({ venue: 'A', opp: 'DAL', games: 10, shotpropz: { updated: 'Oct 30, 2026', venueGames: 6, leadAt: 'away' }, verdict: { headline: 'Leaky defense away', tier: 'leaky' } });
    expect(p.total).toEqual({ headline: 'Average scoring · 6.0 goals', tier: 'average', projected: 6.0, league: 6.1 });
  });
  test('shooting and allows at the venue, the word on the shots, every source in the hover', () => {
    const mtl = cellOf(p, 'shooting', 'MTL');
    expect(mtl).toMatchObject({ word: 'Average', tone: '', source: 'spz', text: '29.7 shots · 2.83 goals a game on the road (6 games) · 9th of 32 in shots' });
    expect(mtl.title).toBe('ShotPropz 2026-27, Oct 30, 2026 · ShotPropz on the road: 29.7 shots (9th of 32) and 2.83 goals a game over 6 games · all games 31.0 shots (6th) and 3.15 goals · stored box scores: 31.2 shots (5th of 32) and 3.40 goals a game over 10 games · PropFinder 2026-27: 31.0 shots (6th of 32) and 3.30 goals a game');
    expect(cellOf(p, 'shooting', 'DAL')).toMatchObject({ word: 'Average', text: '29.2 shots · 3.50 goals a game at home (6 games) · 14th of 32 in shots' });
    const dal = cellOf(p, 'allows', 'DAL');
    expect(dal).toMatchObject({ word: 'Elite', level: 'elite', tone: 'is-tough', source: 'spz', text: '24.3 shots · 2.17 goals allowed a game at home · 31st of 32 most' });
    expect(dal.title).toContain('PropFinder 2026: 25.1 shots (30th of 32 most) and 2.40 goals allowed a game');
    expect(dal.title).toContain('stored box scores at home: 24.2 shots (31st of 32 most) and 2.10 goals allowed a game over 6 games');
    expect(cellOf(p, 'allows', 'MTL')).toMatchObject({ word: 'Very leaky', level: 'poor', tone: 'is-soft', text: '32.5 shots · 3.17 goals allowed a game on the road · 3rd of 32 most' });
    // The line is parts: the figures plain, the rank phrase in the tone of its level (the card colours it).
    expect(dal.parts).toEqual([{ t: '24.3 shots · 2.17 goals allowed a game at home · ' }, { t: '31st of 32 most', tone: 'is-tough' }]);
    expect(mtl.parts[1]).toEqual({ t: '9th of 32 in shots', tone: '' });
  });
  test('power play and penalty kill: the venue board from four games there; rank 1 = the softest kill', () => {
    expect(cellOf(p, 'powerplay', 'MTL')).toMatchObject({ word: 'Average', tone: '', text: '22.2% · draws 3.0 power plays a game on the road · 12th of 32' });
    expect(cellOf(p, 'powerplay', 'MTL').title).toBe('ShotPropz 2026-27, Oct 30, 2026 · ShotPropz on the road: 22.2% (12th of 32), 3.0 power plays a game, 6 games · all games 25.6% (6th), 3.3 a game · last 10 28.6% (4th) · PropFinder 2026-27: 27.5% (3rd of 32)');
    expect(cellOf(p, 'powerplay', 'DAL')).toMatchObject({ word: 'Strong', tone: 'is-soft', text: '27.8% · draws 3.0 power plays a game at home · 6th of 32' });
    expect(cellOf(p, 'penaltykill', 'DAL')).toMatchObject({ word: 'Elite', tone: 'is-tough', text: '92.9% · gives 2.3 power plays a game at home · 32nd of 32 softest' });
    expect(cellOf(p, 'penaltykill', 'MTL')).toMatchObject({ word: 'Very leaky', level: 'poor', tone: 'is-soft', text: '68.4% · gives 3.3 power plays a game on the road · 3rd of 32 softest' });
    expect(cellOf(p, 'penaltykill', 'MTL').title).toContain('PropFinder 2026-27: 76.1% (24th of 32, 1 = the best kill)');
  });
  test('last 10: shots for and against, the word on the shots for against the season', () => {
    expect(cellOf(p, 'last10', 'MTL')).toMatchObject({ word: 'Steady', tone: '', text: '32.4 shots for (4th) · 30.8 against (7th most) · 3.40–3.10 goals a game' });
    // Two ranks in one line, each in its own tone: shots for 4th (strong, green), allowed 7th most (leaky, green).
    expect(cellOf(p, 'last10', 'MTL').parts.filter((x) => x.tone != null)).toEqual([{ t: '4th', tone: 'is-soft' }, { t: '7th most', tone: 'is-soft' }]);
    expect(cellOf(p, 'last10', 'DAL').parts.filter((x) => x.tone != null)).toEqual([{ t: '24th', tone: '' }, { t: '26th most', tone: 'is-tough' }]);
    // DAL: 26.1 over 27.9 on the season = 0.935, steady; a tenth down reads Falling.
    expect(cellOf(p, 'last10', 'DAL')).toMatchObject({ word: 'Steady', text: '26.1 shots for (24th) · 26.0 against (26th most) · 2.70–2.60 goals a game' });
    const cold = JSON.parse(JSON.stringify(shotpropz));
    cold.boards.offense.all.l10.sf.teams.DAL.value = 24.0;
    expect(cellOf(matchupProfile({ game, rates, pfTeams, shotpropz: cold }), 'last10', 'DAL')).toMatchObject({ word: 'Falling', tone: 'is-tough' });
  });
  test('under four games at the venue the all-games board leads and the head says so', () => {
    const thin = JSON.parse(JSON.stringify(shotpropz));
    for (const b of ['offense', 'defense']) for (const k of Object.keys(thin.boards[b].home.ytd)) thin.boards[b].home.ytd[k].teams.DAL.gp = 3;
    const q = matchupProfile({ game, rates, pfTeams, shotpropz: thin });
    expect(cellOf(q, 'shooting', 'DAL').text).toBe('27.9 shots · 3.08 goals a game all games (12 games) · 18th of 32 in shots');
    expect(cellOf(q, 'penaltykill', 'DAL').text).toBe('86.7% · gives 2.5 power plays a game all games · 29th of 32 softest');
    expect(q.teams.DAL.shotpropz).toEqual({ updated: 'Oct 30, 2026', venueGames: 3, leadAt: 'all' });
  });
});

describe('matchup profile: without a ShotPropz snapshot', () => {
  const p = matchupProfile({ game, rates, pfTeams });
  test('the rink and PropFinder stand in: own stored games for the shooting, PropFinder’s table above the rink for allows, its season table for the special teams, the stored last ten', () => {
    expect(cellOf(p, 'shooting', 'MTL')).toMatchObject({ word: 'Strong', source: 'rink', text: '31.2 shots · 3.40 goals a game over 10 stored games · 5th of 32 in shots' });
    expect(cellOf(p, 'allows', 'DAL')).toMatchObject({ word: 'Elite', tone: 'is-tough', source: 'pf', text: '25.1 shots · 2.40 goals allowed a game · 30th of 32 most · PropFinder 2026' });
    expect(cellOf(p, 'powerplay', 'MTL')).toMatchObject({ word: 'Elite', tone: 'is-soft', source: 'pf', text: '27.5% on the power play · 3rd of 32 · PropFinder 2026-27' });
    expect(cellOf(p, 'penaltykill', 'DAL')).toMatchObject({ word: 'Tight', tone: 'is-tough', source: 'pf', text: '84.2% on the penalty kill · 4th of 32 · PropFinder 2026-27' });
    expect(cellOf(p, 'penaltykill', 'MTL')).toMatchObject({ word: 'Average', tone: '' });
    expect(p.teams.MTL.shotpropz).toBeNull();
    // The fixture's rates carry no l10 window; the last-ten row is left out rather than guessed.
    expect(p.rows.map((r) => r.key)).toEqual(['shooting', 'allows', 'powerplay', 'penaltykill']);
  });
  test('without PropFinder either: the shooting from the rink, allows from the stored venue table, no special teams', () => {
    const bare = { ...game, sides: game.sides.map((s) => ({ ...s, propfinder: null })) };
    const q = matchupProfile({ game: bare, rates });
    expect(cellOf(q, 'allows', 'DAL')).toMatchObject({ source: 'rink', word: 'Elite', text: '24.2 shots · 2.10 goals allowed a game at home over 6 stored games · 31st of 32 most' });
    expect(q.rows.map((r) => r.key)).toEqual(['shooting', 'allows']);
    const withL10 = { ...rates, teams: { ...rates.teams, MTL: { ...rates.teams.MTL, l10: { gp: 10, sog: 35.0, g: 3.9 } } } };
    const l10 = cellOf(matchupProfile({ game: bare, rates: withL10 }), 'last10', 'MTL');
    expect(l10).toMatchObject({ word: 'Rising', tone: 'is-soft', source: 'rink', text: '35.0 shots for · 31.8 against (6th most) · 3.90–2.90 goals a game · stored games' });
  });
  test('held on last season’s games or under five, PropFinder’s team table leads the shooting; nothing at all is null', () => {
    const held = { ...rates, teams: { ...rates.teams, MTL: { ...rates.teams.MTL, held: true, season: 2025 } } };
    expect(cellOf(matchupProfile({ game, rates: held, pfTeams }), 'shooting', 'MTL')).toMatchObject({ source: 'pf', text: '31.0 shots · 3.30 goals a game · 6th of 32 in shots · PropFinder 2026-27' });
    const empty = { away: 'MTL', home: 'DAL', sides: [{ team: 'MTL', opp: 'DAL', venue: 'A', defense: null, propfinder: null }, { team: 'DAL', opp: 'MTL', venue: 'H', defense: null, propfinder: null }] };
    expect(matchupProfile({ game: empty })).toBeNull();
    expect(matchupProfile({ game: null })).toBeNull();
  });
});
