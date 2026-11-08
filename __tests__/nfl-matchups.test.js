/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import { digestPages, matchupFactor, matchupText, coverageFit, CAP, WEIGHTS } from '../lib/nfl/matchups';
import { buildBoard } from '../lib/nfl/picks';

// PropFinder's matchup pages feeding the numbers (Vincent, 2026-11-08: "we need them to feed our numbers", hand-set):
// the pages in the shapes the pull stored on 2026-11-08 (trimmed), the digest, each factor's direction, the cap, the board.
const scheme = (category, playPerc) => ({ grouping: /Man|1|0/.test(category) ? 'man' : 'zone', category, playCount: 10, playPerc, epaPerPlay: 0, ydsPerPlay: 6, successPerc: 40, leaguePlayPerc: 20, leagueEpaPerPlay: 0 });
const team = (teamId, code, { mix, epaPerPass = 0.07, rz = 0.59 } = {}) => ({ teamId, code, name: code, gamesIncluded: 8, epaPerPass, redZoneTdRateDef: rz, topSchemes: mix });
const split = (playerId, coverage, routesRun, yardsSb) => ({ playerId, coverage, routesRun, yardsSb, games: 6, targets: 10, teamId: 't', position: 'WR' });
const pages = {
  coverageTeams: { season: 2026, teams: [
    team('id-sea', 'SEA', { mix: [scheme('Cover 3', 60), scheme('Cover 1', 40)], epaPerPass: 0.25, rz: 0.75 }),   // soft through the air, zone-heavy
    team('id-lar', 'LAR', { mix: [scheme('Cover 3', 20), scheme('Cover 1', 80)], epaPerPass: -0.11, rz: 0.43 }),   // tough, man-heavy
  ] },
  coverageReceiverSplits: { season: 2026, baselines: [split('p-zone', 'All', 200, 300), split('p-small', 'All', 10, 20)], players: [
    split('p-zone', 'Cover 3', 120, 240), split('p-zone', 'Cover 1', 80, 60), split('p-zone', 'zone', 120, 240),   // 2.0 a route against Cover 3, 0.75 against Cover 1
  ] },
  wrCbMatchups: { games: [{ homeTeamId: 'id-sea', awayTeamId: 'id-lar', homeTeam: 'SEA', awayTeam: 'LAR', receivers: [
    { playerId: 'p-zone', name: 'Zone Guy', teamId: 'id-lar', opponentTeamId: 'id-sea', advantageScore: 0.15, matchupScore: 0.4, matchupSample: 30, confidence: 'alignment-supported', defenders: [{ name: 'Corner One' }] },
    { playerId: 'p-other', name: 'Other', advantageScore: 0.02, confidence: 'alignment-supported', defenders: [] },
    { playerId: 'p-none', name: 'None', advantageScore: 0.3, confidence: 'unavailable', defenders: [] },
  ] }] },
  rushingSlateBoard: { season: 2026, rows: [
    { playerId: 'p-back', position: 'RB', opponentCode: 'SEA', shareLeftAdjPct: 60, shareMiddleAdjPct: 20, shareRightAdjPct: 20, defEpaPerRushAllowed: 0.0, gapLeftYardsPerGame: 60, gapCenterYardsPerGame: 30, gapRightYardsPerGame: 30, totalAttempts: 100 },
    { playerId: 'p-back2', position: 'RB', opponentCode: 'LAR', shareLeftAdjPct: 60, shareMiddleAdjPct: 20, shareRightAdjPct: 20, defEpaPerRushAllowed: -0.2, gapLeftYardsPerGame: 20, gapCenterYardsPerGame: 30, gapRightYardsPerGame: 30, totalAttempts: 100 },
  ] },
  tdMatchups: { games: [{ homeTeam: { id: 'id-sea', code: 'SEA' }, visitorTeam: { id: 'id-lar', code: 'LAR' } }], leagueTeamStats: [
    { type: 'Opponent', position: 'RB', lastNGames: 0, teamId: 'id-sea', gamesPlayed: 8, rushingTouchdowns: 10, receivingTouchdowns: 2 },
    { type: 'Opponent', position: 'RB', lastNGames: 0, teamId: 'id-lar', gamesPlayed: 8, rushingTouchdowns: 3, receivingTouchdowns: 1 },
    { type: 'Opponent', position: 'RB', lastNGames: 5, teamId: 'id-lar', gamesPlayed: 5, rushingTouchdowns: 30, receivingTouchdowns: 0 },
  ] },
};

describe('NFL matchup pages: the digest', () => {
  const d = digestPages(pages, { at: 'x' });
  test('teams, the league, receivers and runners read off the pages', () => {
    expect(d.at).toBe('x');
    expect(d.teams.SEA.shells).toEqual({ 'Cover 3': 0.6, 'Cover 1': 0.4 });
    expect(d.league.epaPass).toBeCloseTo(0.07, 6);
    expect(d.teams.SEA.td.RB).toBeCloseTo(12 / 8, 6);
    expect(d.teams.LAR.td.RB).toBeCloseTo(4 / 8, 6);            // the season's window, not the last five
    expect(d.receivers['p-zone'].now.total).toEqual({ routes: 200, yards: 300 });
    expect(d.receivers['p-zone'].now.shells.zone).toBeUndefined();   // man / zone are groupings, not shells
    expect(d.receivers['p-none']).toBeUndefined();                 // WR vs CB "unavailable" is no score
    expect(d.runners['p-back'].fit).toBeGreaterThan(1);            // he runs left, SEA leaks left
    expect(d.runners['p-back2'].fit).toBeLessThan(1);
    expect(digestPages(null)).toBeNull();
    expect(digestPages({})).toBeNull();
  });
  test('the coverage fit: his yards a route in each shell, weighted by the defense\'s mix, over his overall', () => {
    const rec = d.receivers['p-zone'];
    expect(coverageFit(rec, d.teams.SEA.shells)).toBeGreaterThan(1);
    expect(coverageFit(rec, d.teams.LAR.shells)).toBeLessThan(1);
    expect(coverageFit(d.receivers['p-small'], d.teams.SEA.shells)).toBeNull();   // 10 routes: too few
  });
});

describe('NFL matchup pages: the factors (hand-set, capped)', () => {
  const d = digestPages(pages);
  test('a soft defense raises, a tough one lowers, every market', () => {
    const f = (market, pos, id, opp) => matchupFactor(d, { market, pos, id, opp })?.factor ?? 1;
    expect(f('rec_yds', 'WR', 'p-zone', 'SEA')).toBeGreaterThan(1);
    expect(f('rec_yds', 'WR', 'p-zone', 'LAR')).toBeLessThan(f('rec_yds', 'WR', 'p-zone', 'SEA'));
    expect(f('rush_yds', 'RB', 'p-back', 'SEA')).toBeGreaterThan(1);
    expect(f('rush_yds', 'RB', 'p-back2', 'LAR')).toBeLessThan(1);
    expect(f('pass_yds', 'QB', null, 'SEA')).toBeGreaterThan(1);
    expect(f('pass_yds', 'QB', null, 'LAR')).toBeLessThan(1);
    expect(f('td', 'RB', null, 'SEA')).toBeGreaterThan(1);
    expect(f('td', 'RB', null, 'LAR')).toBeLessThan(1);
  });
  test('receptions move half as far; the product stays within the cap; no page, no factor', () => {
    const y = matchupFactor(d, { market: 'rec_yds', pos: 'WR', id: 'p-zone', opp: 'SEA' });
    const r = matchupFactor(d, { market: 'receptions', pos: 'WR', id: 'p-zone', opp: 'SEA' });
    expect(y.factor).toBeLessThan(1 + CAP);   // not capped here
    expect(r.factor).toBeCloseTo(1 + (y.factor - 1) / 2, 2);
    for (const opp of ['SEA', 'LAR']) for (const market of ['rec_yds', 'rush_yds', 'pass_yds', 'td']) {
      const m = matchupFactor(d, { market, pos: market === 'pass_yds' ? 'QB' : market === 'rec_yds' ? 'WR' : 'RB', id: market === 'rec_yds' ? 'p-zone' : 'p-back', opp });
      if (m) { expect(m.factor).toBeLessThanOrEqual(1 + CAP + 1e-9); expect(m.factor).toBeGreaterThanOrEqual(1 - CAP - 1e-9); }
    }
    expect(matchupFactor(d, { market: 'rec_yds', pos: 'QB', id: 'p-zone', opp: 'SEA' })).toBeNull();
    expect(matchupFactor(d, { market: 'rec_yds', pos: 'WR', id: 'p-zone', opp: 'KC' })).toBeNull();
    expect(matchupFactor(null, { market: 'rec_yds', pos: 'WR', id: 'p-zone', opp: 'SEA' })).toBeNull();
  });
  test('WR vs CB: over the slate\'s median advantage, a limited pairing at half', () => {
    const m = matchupFactor(d, { market: 'rec_yds', pos: 'WR', id: 'p-zone', opp: 'SEA' });
    const w = m.parts.find((p) => p.page === 'WR vs CB');
    expect(d.league.wrcbAdv).toBeCloseTo((0.02 + 0.15) / 2, 6);
    expect(w.factor).toBeCloseTo(1 + WEIGHTS.wrcb * (0.15 - d.league.wrcbAdv), 3);
    // his score is against SEA: against another defense it does not apply
    expect(matchupFactor(d, { market: 'rec_yds', pos: 'WR', id: 'p-zone', opp: 'LAR' }).parts.some((p) => p.page === 'WR vs CB')).toBe(false);
    expect(w.why).toMatch(/Corner One/);
    expect(matchupText(m)).toMatch(/^PropFinder's matchup pages ×1\.\d\d: Coverage ×/);
  });
});

describe('NFL matchup pages: on the board', () => {
  const dates = Array.from({ length: 8 }, (_, i) => `2026-10-${String(30 - i * 3).padStart(2, '0')}`);
  const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0 };
  const logs = (f) => dates.map((date, i) => { const g = { ...base, date, opp: 'ARI', gameId: `g${i}`, ...f(i) }; return { ...g, td: g.rushTd + g.recTd }; });
  const players = [
    { id: 'p-zone', name: 'Zone Guy', key: 'zone guy', team: 'LAR', pos: 'WR', games: logs((i) => ({ rec: 6, recYds: 70 + i, tgt: 9, recTd: i % 3 === 0 ? 1 : 0 })), props: [{ market: 'rec_yds', line: 69.5, odds: -110, isMain: true }] },
    { id: 'p-back', name: 'Back Guy', key: 'back guy', team: 'LAR', pos: 'RB', games: logs((i) => ({ rushAtt: 18, rushYds: 80, rushTd: i % 2 })), props: [{ market: 'rush_yds', line: 79.5, odds: -110, isMain: true }] },
  ];
  const games = [{ id: 'g', date: '2026-11-08T21:25Z', away: 'LAR', home: 'SEA', final: false, state: 'pre', odds: { spread: 'SEA -3', total: 47.5 } }];
  const pf = { at: 'a', data: { players, defense: null } };
  test('the factor moves the projection, the ladder and the touchdown chance; the tested read rides along', () => {
    const plain = buildBoard({ season: 2026, week: 10, games, sheets: [], pf, results: {} }).projections.rows;
    const fed = buildBoard({ season: 2026, week: 10, games, sheets: [], pf: { ...pf, matchups: digestPages(pages) }, results: {} }).projections.rows;
    const y0 = plain['zone guy|LAR'].yards.rec_yds; const y1 = fed['zone guy|LAR'].yards.rec_yds;
    expect(y0.pages).toBeNull();
    expect(y1.pages.factor).toBeGreaterThan(1);
    expect(y1.beforePages).toBe(y0.proj);
    expect(y1.proj).toBeCloseTo(y0.proj * y1.pages.factor, 0);
    const b1 = fed['back guy|LAR'];
    expect(b1.yards.rush_yds.pages.factor).toBeGreaterThan(1);
    expect(b1.td.pages.factor).toBeGreaterThan(1);
    expect(b1.td.p).toBeGreaterThan(plain['back guy|LAR'].td.p);
    expect(b1.td.beforePages).toBe(plain['back guy|LAR'].td.p);
  });
});
