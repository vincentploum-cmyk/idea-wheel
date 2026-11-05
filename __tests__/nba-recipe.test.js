import { describe, expect, test } from '@jest/globals';
import { nbaBoard, COCKTAIL, COCKTAIL_BEFORE_RECIPE, RECIPE, RECIPE_COCKTAIL } from '../lib/nba/picks';
import { defenseAllowed } from '../lib/nba/propfinder-nba';

// The per-stat recipe (docs/audits/2026-11-03-nba-stat-drivers.md): his rate a minute over a decayed memory × this season's
// minutes, the opponent in all positions, the teammates out tonight.
const row = (o) => ({ gp: 10, season: 2026, pts: 113, reb: 44, ast: 26, tpm: 13, tpa: 35, stl: 7.5, blk: 5, tov: 14, ftm: 17, ...o });
const totals = {};
['ATL', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GS', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NO', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SA', 'TOR', 'UTAH', 'WSH', 'SAC'].forEach((t) => { totals[t] = { for: row(), against: row() }; });
totals.BOS = { for: row({ pts: 120 }), against: row() };
// NY gives up 124 points (league 113) and 40 threes attempted (league 35) over 10 games; 50 rebounds over its last ten.
totals.NY = { for: row(), against: row({ pts: 124, tpa: 40 }), l10: { for: row(), against: row({ reb: 50, gp: 10 }) } };
const leagueFor = { pts: 113, reb: 44, ast: 26, tpm: 13, tpa: 35, stl: 7.5, blk: 5, tov: 14, ftm: 17 };
const defense = { totals, leagueFor, count: 30, league: {}, teams: {}, ranks: {}, windows: {} };

// Two seasons of logs, newest first: last season 20 games at 20 minutes, this season 5 at 34; half a point a minute throughout.
const logs = (perMin, { thisMin = 34, lastMin = 20, nThis = 5, threes = 0.05 } = {}) => {
  const g = [];
  for (let i = 0; i < nThis; i++) g.push({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'MIA', min: thisMin, pts: perMin * thisMin, reb: 0.2 * thisMin, ast: 0.1 * thisMin, tpm: threes * thisMin, tpa: 3 * threes * thisMin });
  for (let i = 0; i < 20; i++) g.push({ date: `2026-03-${String(28 - i).padStart(2, '0')}`, season: 2025, type: 'REG', opp: 'MIA', min: lastMin, pts: perMin * lastMin, reb: 0.2 * lastMin, ast: 0.1 * lastMin, tpm: threes * lastMin, tpa: 3 * threes * lastMin });
  return g.map((x) => ({ ...x, pra: x.pts + x.reb + x.ast }));
};
const games = [{ id: 'g1', date: '2026-11-01T23:30Z', away: 'NY', home: 'BOS', final: false, state: 'pre' }];
const pfWith = (players, injuries = null) => ({ at: '2026-11-01T14:00:00Z', data: { players, defense, injuries } });
const tatum = { id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'PG', games: logs(0.5), props: [] };
const brown = { id: 'p2', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'PG', games: logs(0.6, { thisMin: 30, lastMin: 30 }), props: [] };
const recipeBoard = nbaBoard({ ...COCKTAIL, ...RECIPE_COCKTAIL, pull: null, reach: 0 }).buildBoard;

describe('the per-stat recipe', () => {
  test('his rate a minute × this season’s minutes, × the opponent in all positions (shrunk by its games)', () => {
    const b = recipeBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: pfWith([tatum]), results: {} });
    const p = b.games[0].sides.BOS.players.find((x) => x.key === 'jayson tatum');
    // Minutes: this season's 34 (5 games) with last season's 20 at 0.5 / 5.5 → 32.7; 0.5 a minute → 16.36 points.
    expect(p.own.pts).toMatchObject({ decRate: 0.5, decMin: 32.7, decHl: RECIPE.rate.pts });
    expect(p.own.pts.dec).toBeCloseTo(16.36, 1);
    // NY: 124 / 113 over 10 games, shrunk at K = 10 → 1.0487, ^0.94 → 1.046.
    expect(p.ranges.pts.matchup).toBeCloseTo(1.046, 3);
    expect(p.ranges.pts.matchupFrom.from).toBe('team');
    expect(p.ranges.pts.exp).toBeCloseTo(16.4 * 1.046, 0);
    // Threes on the threes NY lets teams attempt: 40 / 35 shrunk → 1.0714, ^1.12 → 1.080.
    expect(p.ranges.tpm.matchup).toBeCloseTo(1.08, 2);
    // Rebounds on NY's last ten (50 / 44 at K = 5 → 1.0909, ^0.65 → 1.058).
    expect(p.ranges.reb.matchup).toBeCloseTo(1.058, 2);
    // The side carries what NY gives up in all positions, ranked (1 = the most): its threes attempted the most of 30.
    expect(b.games[0].sides.BOS.against.stats.tpa).toMatchObject({ value: 40, rank: 1, count: 30, league: 35 });
    expect(b.games[0].sides.BOS.against.stats.pts).toMatchObject({ value: 124, rank: 1 });
  });

  test('a teammate out who played the team’s last games: (1 + his production / the team’s)^b on everyone who plays', () => {
    const injuries = { rows: [{ team: 'BOS', key: 'jaylen brown', name: 'Jaylen Brown', status: 'Out', pos: 'PG' }] };
    const b = recipeBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: pfWith([tatum, brown], injuries), results: {} });
    const side = b.games[0].sides.BOS;
    expect(side.outRead.names).toEqual(['Jaylen Brown']);
    // Brown: 18 points a game (0.6 × 30) of BOS's 120 → (1 + 18 / 120)^0.7 = 1.103.
    expect(side.outRead.mult.pts).toBeCloseTo(1.103, 3);
    const t = side.players.find((x) => x.key === 'jayson tatum');
    expect(t.ranges.pts.out).toBeCloseTo(1.103, 3);
    expect(t.ranges.pts.outFrom).toEqual(['Jaylen Brown']);
    expect(t.ranges.pts.env).toBeCloseTo(1.046 * 1.103, 2);
    // No vacated lift and no minutes factor on top: the factor stands for both.
    expect(t.ranges.pts.lift).toBeNull();
    expect(t.own.pts.minFactor).toBeUndefined();
  });

  test('an absence older than the team’s last games hands over nothing (it is in his own games already)', () => {
    const gone = { ...brown, games: brown.games.filter((g) => g.season === 2025) };
    const injuries = { rows: [{ team: 'BOS', key: 'jaylen brown', name: 'Jaylen Brown', status: 'Out', pos: 'PG' }] };
    const b = recipeBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: pfWith([tatum, gone], injuries), results: {} });
    expect(b.games[0].sides.BOS.outRead).toBeUndefined();
    expect(b.games[0].sides.BOS.players.find((x) => x.key === 'jayson tatum').ranges.pts.out).toBeNull();
  });

  test('the site’s cocktail is the recipe, the role pull off, the team ceiling kept', () => {
    expect(COCKTAIL).toMatchObject({ recipe: RECIPE, withoutSplit: false, pull: null });
    expect(COCKTAIL.teamCeiling).not.toBe(false);
  });

  test('without the recipe the board reads as it did', () => {
    const b = nbaBoard(COCKTAIL_BEFORE_RECIPE).buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: pfWith([tatum]), results: {} });
    const p = b.games[0].sides.BOS.players.find((x) => x.key === 'jayson tatum');
    expect(p.own.pts.dec).toBeUndefined();
    // This season's windows alone: 0.5 × 34 = 17 points a game, no all-positions matchup.
    expect(p.ranges.pts.rate).toBe(17);
    expect(p.ranges.pts.matchupFrom?.from).not.toBe('team');
  });
});

describe('three-point attempts allowed', () => {
  test('PropFinder’s team rows carry threePointsAtt: read into the tables per position and in all', () => {
    const stat = (type, position, o) => ({ type, position, seasonYear: 2026, seasonType: 'REG', gamesPlayed: 6, lastNGames: 0, points: 110, rebounds: 44, assists: 25, threePointsMade: 13, steals: 7, blocks: 5, turnovers: 14, freeThrowsMade: 17, ...o });
    const teams = [
      { code: 'NY', stats: [stat('Opponent', 'All', { threePointsAtt: 40.5 }), stat('Opponent', 'PG', { threePointsAtt: 9.2 }), stat('Team', 'All', { threePointsAtt: 36 })] },
      { code: 'BOS', stats: [stat('Opponent', 'All', { threePointsAtt: 33 }), stat('Opponent', 'PG', { threePointsAtt: 7.1 }), stat('Team', 'All', { threePointsAtt: 42 })] },
    ];
    const d = defenseAllowed(teams, { season: 2026 });
    expect(d.teams.NY.PG.tpa).toBe(9.2);
    expect(d.ranks.NY.PG.tpa).toBe(1);
    expect(d.totals.NY.against.tpa).toBe(40.5);
    expect(d.leagueFor.tpa).toBe(39);
  });
});

describe('the team ceiling leaves out the roster players without a game this season (2026-11-05)', () => {
  // Vincent, 2026-11-05: "Jokic 6 rebounds … are you fucking kidding me?" — every Nugget at half his figure: PropFinder's roster
  // brought players without a game this season at last season's minutes, the sum ran to twice the team's and the floor (×0.5) hit.
  const g = (season, min, reb, i) => ({ date: season === 2026 ? `2026-10-${String(30 - i).padStart(2, '0')}` : `2026-03-${String(28 - i).padStart(2, '0')}`, season, type: 'REG', opp: 'MIA', min, pts: min / 2, reb, ast: min / 10, tpm: 0, tpa: 0 });
  const player = (key, min, reb, season = 2026) => ({ id: key, name: key, key, team: 'BOS', pos: 'C', games: Array.from({ length: 6 }, (_, i) => g(season, min, reb, i)), props: [] });
  // BOS gets 44 rebounds a game: its star 13 in 36 minutes and seven regulars at 4.4 in 29; eight more on the roster with only
  // last season's games, 25 minutes and 6 rebounds each.
  const roster = [player('star', 36, 13), ...Array.from({ length: 7 }, (_, i) => player(`regular ${i}`, 29, 4.4)), ...Array.from({ length: 8 }, (_, i) => player(`roster ${i}`, 25, 6, 2025))];
  const t = { ...totals, BOS: { for: row({ reb: 44 }), against: row() } };
  const pf = { at: '2026-11-01T14:00:00Z', data: { players: roster, defense: { ...defense, totals: t }, injuries: null } };
  test('the players who have not played do not scale the regulars down', () => {
    const side = nbaBoard(COCKTAIL).buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf, results: {} }).games[0].sides.BOS;
    expect(side.scale.reb).toBeUndefined();   // 13 + 7 × 4.4 = 43.8 counted, under the 44 (with the eight: 91.8, ×0.48 → the floor)
    const star = side.players.find((p) => p.key === 'star');
    expect(star.ranges.reb.team).toBeNull();
    expect(star.ranges.reb.exp).toBeGreaterThan(12);
  });
  test('the floor: the ceiling never cuts an NBA side by more than a fifth', () => {
    const thin = { ...pf, data: { ...pf.data, defense: { ...defense, totals: { ...t, BOS: { for: row({ reb: 20 }), against: row() } } } } };
    const side = nbaBoard(COCKTAIL).buildBoard({ date: '2026-11-01', season: 2026, games, sheets: [], pf: thin, results: {} }).games[0].sides.BOS;
    expect(side.scale.reb).toBe(0.8);
  });
});
