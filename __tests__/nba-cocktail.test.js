import { describe, expect, test } from '@jest/globals';
import { blendWindows, ownRate, matchupOf, dampOf, blendText, dampText, pullText, OWN_WEIGHTS } from '../lib/picks/projection';
import { COCKTAIL_DEFAULTS, chanceOf, WEIGHTS } from '../lib/picks/board';
import { minutesTonight, FACTOR_MAX } from '../lib/picks/rotations';
import { pAt } from '../lib/picks/shuffle';
import { COCKTAIL, nbaBoard, logAverages as nbaAverages, ladderOf as nbaLadder } from '../lib/nba/picks';
import { logAverages as nflAverages, buildBoard as nflBoard } from '../lib/nfl/picks';

// The NBA cocktail (lib/nba/picks.js COCKTAIL, docs/audits/2026-10-28-nba-cocktail.md): the weights behind the
// projection and the chance, measured on two seasons of box scores; every other sport keeps the defaults.
describe('his windows, blended', () => {
  test('without a sport’s weights: the season with his last ten at 0.65 / 0.35, as the board always read', () => {
    expect(blendWindows({ season: 20, l10: 30 })).toBeCloseTo(OWN_WEIGHTS.season * 20 + OWN_WEIGHTS.l10 * 30, 6);
    expect(blendWindows({ season: 20 })).toBe(20);
    expect(blendWindows({ l10: 18, l5: 12 })).toBe(18);
    expect(blendWindows({ l5: 12 })).toBe(12);
    expect(blendWindows(null)).toBeNull();
  });
  test('with weights: renormalised over the windows he has', () => {
    const w = { season: 0.4, l10: 0.2, l5: 0.1, l20: 0.3 };   // the cocktail's first cut, across the seasons
    expect(blendWindows({ season: 20, l10: 30, l5: 40, l20: 10, w })).toBeCloseTo(0.4 * 20 + 0.2 * 30 + 0.1 * 40 + 0.3 * 10, 6);
    // No last twenty in the windows: the other three carry it.
    expect(blendWindows({ season: 20, l10: 30, l5: 40, w })).toBeCloseTo((0.4 * 20 + 0.2 * 30 + 0.1 * 40) / 0.7, 6);
    expect(ownRate({ season: 20, l10: 30, l5: 40, l20: 10, w })).toBe(21);
    // The NBA's: the season with his last ten at 0.65 / 0.35, this season's games alone; the NFL's windows stay as they were.
    expect(ownRate({ season: 20, l10: 30, l5: 40, w: COCKTAIL.windows })).toBe(23.5);
    const logs = Array.from({ length: 25 }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', pts: i < 5 ? 30 : 20, passYds: 200 }));
    expect(nbaAverages(logs, { market: 'pts', season: 2026 })).toEqual({ l5: 30, l10: 25, season: 22, seasonN: 25, w: { season: 0.65, l10: 0.35, scope: 'season' } });
    const nfl = nflAverages(logs, { market: 'passYds', season: 2026 });
    expect(nfl).not.toHaveProperty('w');
    expect(nfl).not.toHaveProperty('l20');
  });
  test('in words, for the hovers', () => {
    expect(blendText(null)).toBe('the season blended with his last ten');
    expect(blendText(COCKTAIL.windows)).toBe('the season blended with his last ten at 0.65 / 0.35');
    expect(blendText({ ...COCKTAIL.windows, scope: 'season' })).toBe("the season blended with his last ten at 0.65 / 0.35, this season's games alone");
    expect(blendText({ season: 0.4, l10: 0.2, l5: 0.1, l20: 0.3 })).toBe('his windows blended: the season 0.4, last ten 0.2, last five 0.1, last twenty 0.3');
  });
});

describe('the games his windows read (scope)', () => {
  // Newest first: three games this season, last spring's two playoff games, then last season's regular season.
  const g = (date, season, type, pts) => ({ date, season, type, pts });
  const last = Array.from({ length: 10 }, (_, i) => g(`2026-04-${String(12 - i).padStart(2, '0')}`, 2025, 'REG', 15));
  const logs = [g('2026-10-26', 2026, 'REG', 30), g('2026-10-24', 2026, 'REG', 20), g('2026-10-22', 2026, 'REG', 10), g('2026-05-02', 2025, 'PST', 40), g('2026-04-30', 2025, 'PST', 40), ...last];
  const at = (scope) => nbaBoard({ ...COCKTAIL, scope, windows: { season: 0.65, l10: 0.35 } });
  const avgs = (scope, list = logs) => at(scope).logAverages(list, { market: 'pts', season: 2026 });
  test("'all': last spring's playoff nights fill his last five and ten, as the board read", () => {
    expect(avgs('all')).toMatchObject({ l5: 28, l10: 21.5, season: 20, seasonN: 3 });
    expect(at('all').logRates(logs, { market: 'pts', line: 19.5, side: 'over', season: 2026 })).toMatchObject({ l5: 0.8, season: 2 / 3 });
  });
  test("'regular': the playoffs left out, last season's regular season behind this season's games", () => {
    expect(avgs('regular')).toMatchObject({ l5: 18, l10: 16.5, season: 20 });
  });
  test("'season': this season's games alone; last season's regular season only until he has played", () => {
    expect(avgs('season')).toMatchObject({ l5: 20, l10: 20, season: 20, seasonN: 3 });
    expect(at('season').logRates(logs, { market: 'pts', line: 19.5, side: 'over', season: 2026 })).toMatchObject({ l5: 2 / 3, l10: 2 / 3, l10N: 3 });
    expect(at('season').ownWindows(logs, { market: 'pts', season: 2026 })).toMatchObject({ l3: 20, l5: 20, l10: 20 });
    const before = logs.slice(3);   // opening night: no game this season yet
    expect(avgs('season', before)).toMatchObject({ l5: 15, l10: 15, season: 15, seasonN: 10 });
    expect(avgs('all', before)).toMatchObject({ l5: 25, season: 19.2 });   // the playoffs in the stand-in too, before
  });
});

describe('the matchup, counted by the games behind it', () => {
  // A defense allowing 26.4 to SFs against a league of 22: × 1.12 off the table.
  const cell = { value: 26.4, rank: 1 };
  test('a four-game table counts at a tenth of itself, a season’s at two thirds; no count, no damping', () => {
    expect(matchupOf(cell, 22).factor).toBe(1.12);
    expect(matchupOf(cell, 22, 30, { gp: 4, k: 40 })).toMatchObject({ factor: 1.011, raw: 1.12, weight: 0.091, gp: 4, from: 'propfinder' });
    expect(matchupOf(cell, 22, 30, { gp: 80, k: 40 }).factor).toBe(1.08);
    expect(matchupOf(cell, 22, 30, { gp: 0, k: 40 }).factor).toBe(1);   // last season's row standing in: no game this season behind it
    expect(matchupOf(cell, 22, 30, { gp: null, k: 40 }).factor).toBe(1.12);   // the cheat sheet's tile alone carries no count
    expect(matchupOf(cell, 22, 30, { gp: 4, k: 0 }).factor).toBe(1.12);
  });
  test('the table carries its k; the hovers say how much the matchup counted', () => {
    const allowed = { rows: { SF: { gp: 4, pts: cell } }, league: { SF: { pts: 22 } }, k: 40 };
    expect(dampOf(allowed, 'SF')).toEqual({ gp: 4, k: 40 });
    expect(dampOf({ ...allowed, k: undefined }, 'SF')).toBeNull();
    expect(dampText(matchupOf(cell, 22, 30, dampOf(allowed, 'SF')))).toBe(", PropFinder's table counted at 0.091 of × 1.12 for the 4 games behind it");
    expect(dampText(matchupOf(cell, 22))).toBe('');
  });
});

describe('the cheat sheet first, PropFinder beside it by its games', () => {
  // NY gives up 26.4 to SFs against a league of 22 on PropFinder's table (× 1.12) after four games.
  const damp = { gp: 4, k: 40 };
  test('the sheet’s tile counts in full; PropFinder’s table at gp / (gp + 40) beside it', () => {
    // The sheet agrees (its tile placed on PropFinder's spread at the same 26.4): × 1.12, whatever the games.
    expect(matchupOf({ value: 26.4, rank: 1, sheet: 1, sheetValue: 26.4 }, 22, 30, damp)).toMatchObject({ factor: 1.12, from: 'blend', weight: 0.091 });
    // The sheet reads the league's average (× 1.0), PropFinder × 1.12 on four games: the sheet leads, 1 + 0.091 × 0.12 / 1.091.
    expect(matchupOf({ value: 26.4, rank: 1, sheet: 15, sheetValue: 22 }, 22, 30, damp).factor).toBe(1.01);
    // The sheet alone stands in full; PropFinder alone is damped.
    expect(matchupOf({ value: null, rank: null, sheet: 1, sheetValue: 26.4 }, 22, 30, damp).factor).toBe(1.12);
    expect(matchupOf({ value: 26.4, rank: 1 }, 22, 30, damp).factor).toBe(1.011);
    // A season behind PropFinder's table (eighty games, 0.667): the two near each other's weight.
    expect(matchupOf({ value: 26.4, rank: 1, sheet: 15, sheetValue: 22 }, 22, 30, { gp: 80, k: 40 }).factor).toBe(1.048);
    // The hover says how much PropFinder's table counted (the court's and the card's name the sheet's tile before it).
    expect(dampText(matchupOf({ value: 26.4, rank: 1, sheet: 15, sheetValue: 22 }, 22, 30, damp))).toBe(", PropFinder's table counted at 0.091 of × 1.12 for the 4 games behind it");
  });
});

describe('the chance', () => {
  test('the plays read the sport’s hit-rate weights: the NBA leans on the season, not the last five', () => {
    const rates = { l5: 1, l10: 0.6, season: 0.5 };
    expect(chanceOf({ rates, n: 17, implied: 0.5 })).toBeCloseTo((17 * (0.3 * 1 + 0.3 * 0.6 + 0.4 * 0.5) + 6 * 0.5) / 23, 3);
    expect(chanceOf({ rates, n: 17, implied: 0.5, weights: COCKTAIL.hitWeights })).toBeCloseTo((17 * (0.1 * 1 + 0.3 * 0.6 + 0.6 * 0.5) + 6 * 0.5) / 23, 3);
    expect(WEIGHTS).toEqual({ l5: 0.3, l10: 0.3, season: 0.4 });
  });
  test('a rung: the tail carries the cocktail’s share and what the record gives up for a short season', () => {
    const logs = (n) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(28 - i).padStart(2, '0')}`, season: 2026, type: 'REG', pts: 20 + (i % 5) * 3 }));
    const two = nbaLadder(logs(2), { market: 'pts', season: 2026, lines: [24.5] }).find((r) => r.line === 24.5);
    expect(two.wModel).toBeCloseTo(0.7 + 0.3 * 6 / 8, 3);   // two games: the record keeps 2 / 8 of its 0.3
    const twenty = nbaLadder(logs(20), { market: 'pts', season: 2026, lines: [24.5] }).find((r) => r.line === 24.5);
    expect(twenty.wModel).toBeCloseTo(0.7 + 0.3 * 6 / 23, 3);
    expect(twenty.p).toBeCloseTo(twenty.wModel * twenty.model + (1 - twenty.wModel) * twenty.emp, 3);
    // His spread widens in his first games: × (1 + 0.2 · 5 / (n + 5)).
    const flat = nbaBoard({ ...COCKTAIL, spreadA: 0 });
    const sdOf = (n, ladder = nbaLadder) => ladder(logs(n), { market: 'pts', season: 2026, lines: [24.5] })[0].sd;
    expect(sdOf(2) / sdOf(2, flat.ladderOf)).toBeCloseTo(1 + 0.2 * 5 / 7, 2);
    expect(sdOf(20) / sdOf(20, flat.ladderOf)).toBeCloseTo(1 + 0.2 * 5 / 25, 2);
    // The board as it was: half and half whatever the season's length.
    expect(nbaBoard({}).ladderOf(logs(2), { market: 'pts', season: 2026, lines: [24.5] }).find((r) => r.line === 24.5).wModel).toBe(0.5);
  });
  test('the shuffle recentres the tail at the rung’s own weight: from the blend it reads the board’s number', () => {
    const player = { sd: 5, exp: 26, env: null, own: { l5: 30, l10: 26, season: 26 }, at: [{ p: 0.62, model: 0.6, emp: 0.67, wModel: 0.7 }] };
    expect(pAt(player, [25], 0, 'blend')).toBe(0.62);
    const fromL5 = pAt(player, [25], 0, 'l5');
    // 30 over 24.5 at sd 5: the tail 0.865; 0.7 of it and 0.3 of the record.
    expect(fromL5).toBeCloseTo(0.7 * 0.865 + 0.3 * 0.67, 2);
    expect(pAt({ ...player, at: [{ p: 0.62, model: 0.6, emp: 0.67 }] }, [25], 0, 'l5')).toBeCloseTo(0.5 * 0.865 + 0.5 * 0.67, 2);   // a rung without the weight: half and half
  });
});

describe('his first games pulled toward his role, a stat at a time', () => {
  const games = [{ id: 'g1', date: '2026-10-25T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  // One game this season (40 points, 2 rebounds, 10 assists in 30 minutes) over last season's twenty.
  const one = { date: '2026-10-22', season: 2026, type: 'REG', opp: 'MIA', min: 30, pts: 40, reb: 2, ast: 10, tpm: 6, tpa: 10, pra: 52 };
  const last = Array.from({ length: 20 }, (_, i) => ({ date: `2026-03-${String(28 - i).padStart(2, '0')}`, season: 2025, type: 'REG', opp: 'NY', min: 30, pts: 18, reb: 4, ast: 5, tpm: 2, tpa: 6, pra: 27 }));
  const pfOf = (logs) => ({ at: '2026-10-25T14:00:00Z', data: { players: [{ id: 'p1', name: 'Payton Pritchard', key: 'payton pritchard', team: 'BOS', pos: 'PG', games: logs, props: [] }], defense: null } });
  const sideOf = (board, logs) => board.buildBoard({ date: '2026-10-25', season: 2026, games, sheets: [], pf: pfOf(logs), results: {} }).games[0].sides.BOS.players[0];
  test('ownRate: the read moved toward the role at the pull’s weight, before the minutes and the lift', () => {
    expect(ownRate({ season: 20, l10: 20, pull: { prior: 10, w: 0.5 } })).toBe(15);
    expect(ownRate({ season: 20, l10: 20, pull: { prior: 10, w: 0.5 }, minFactor: 0.9, lift: 1 })).toBe(14.5);
    expect(pullText({ prior: 15.4, w: 0.5, n: 1, group: 'G', min: 30 })).toBe(", pulled toward 15.4 (his role: 30 minutes at a guard's rate) with his own games at 0.5 of the way, 1 game in");
    expect(pullText(null)).toBe('');
  });
  test('one game in: points halfway, rebounds a third of the way, assists two thirds (K 1, 2, 0.5)', () => {
    const p = sideOf(nbaBoard(), [one, ...last]);
    // A guard's rate a minute: the slate's guard games in PropFinder (40 points in 30 minutes) on the reference's 0.4998
    // at 500 minutes → (40 + 250) / 530 = 0.547 × 30 = 16.4.
    expect(p.own.pts.pull).toMatchObject({ prior: 16.4, w: 0.5, n: 1, K: 1, group: 'G', min: 30, from: { sheet: 0, propfinder: 30, reference: 500 } });
    expect(p.ranges.pts.rate).toBe(28.2);   // 16.4 + 0.5 × (40 − 16.4)
    expect(p.own.reb.pull).toMatchObject({ prior: 4, w: 0.333, K: 2 });
    expect(p.ranges.reb.rate).toBe(3.3);    // 4.0 + 1/3 × (2 − 4.0): the position says much about rebounds
    expect(p.own.ast.pull).toMatchObject({ prior: 4.4, w: 0.667, K: 0.5 });
    expect(p.ranges.ast.rate).toBe(8.1);    // 4.4 + 2/3 × (10 − 4.4): who handles the ball is his own
    expect(p.ranges.pts.pull).toEqual(p.own.pts.pull);   // the range carries it for the hovers
    // The board as it was reads his one game as it is.
    expect(sideOf(nbaBoard({ ...COCKTAIL, pull: null }), [one, ...last]).ranges.pts.rate).toBe(40);
  });
  test('the cheat sheet’s player table reads into the role first; a row past what a minute holds is left out', () => {
    // The slate's sheet lists two guards: 20 points in 30 minutes and 10 in 20 (30 points in 50 minutes), and a
    // misread row (300 points in 30). With PropFinder's 40 in 30: (30 + 40 + 0.4998 × 500) / (50 + 30 + 500) = 0.5516.
    const rows = [{ player: 'Jaylen Brown', pos: 'SG', avg: { min: 30, pts: 20, reb: 5, ast: 3, tpm: 2 } }, { player: 'Derrick White', pos: 'PG', avg: { min: 20, pts: 10, reb: 3, ast: 4, tpm: 2 } }, { player: 'Sam Hauser', pos: 'SG', avg: { min: 30, pts: 300, reb: 3, ast: 1, tpm: 3 } }];
    const p = nbaBoard().buildBoard({ date: '2026-10-25', season: 2026, games, sheets: [{ id: 's', fileName: 'nba_20261025.pdf', rows, meta: {} }], pf: pfOf([one, ...last]), results: {} }).games[0].sides.BOS.players[0];
    expect(p.own.pts.pull).toMatchObject({ perMin: 0.5516, prior: 16.5, from: { sheet: 80, propfinder: 30, reference: 500 } });
  });
  test('no game this season, no pull: last season’s regular season stands in as it is', () => {
    const p = sideOf(nbaBoard(), last);
    expect(p.own.pts.pull).toBeUndefined();
    expect(p.ranges.pts.rate).toBe(18);
  });
});

describe('his role from his own opportunity: usage, rebound chances, potential assists', () => {
  const games = [{ id: 'g1', date: '2026-11-05T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  // Ten games this season each, 30 minutes a night: a point guard on 30% usage, 7 rebound chances and 14 potential
  // assists; a centre on 15% usage, 20 rebound chances and 4 potential assists.
  const log = (i, x) => ({ date: `2026-11-${String(4 - Math.floor(i / 3)).padStart(2, '0')}`, gameId: `g${i}`, season: 2026, type: 'REG', opp: 'MIA', min: 30, ...x });
  const pg = Array.from({ length: 10 }, (_, i) => log(i, { pts: 25, reb: 4, ast: 8, tpm: 2, tpa: 6, pra: 37, usg: 30, rebCh: 7, potAst: 14 }));
  const c = Array.from({ length: 10 }, (_, i) => log(i, { pts: 12, reb: 11, ast: 2, tpm: 0, tpa: 0, pra: 25, usg: 15, rebCh: 20, potAst: 4 }));
  const pf = { at: '2026-11-05T14:00:00Z', data: { players: [
    { id: 'p1', name: 'Payton Pritchard', key: 'payton pritchard', team: 'BOS', pos: 'PG', games: pg, props: [] },
    { id: 'p2', name: 'Neemias Queta', key: 'neemias queta', team: 'BOS', pos: 'C', games: c, props: [] },
  ], defense: null } };
  const side = nbaBoard().buildBoard({ date: '2026-11-05', season: 2026, games, sheets: [], pf, results: {} }).games[0].sides.BOS;
  const guard = side.players.find((p) => p.key === 'payton pritchard'); const big = side.players.find((p) => p.key === 'neemias queta');
  // His own opportunity earns the stronger pull (`pullOpportunity`: points 12, PRA 5 on its parts; rebounds and assists as the position's).
  const w = (stat) => Math.round((10 / (10 + COCKTAIL.pullOpportunity[stat])) * 1000) / 1000;
  test('points: his usage at the slate’s points per usage-minute × his minutes', () => {
    // The slate's conversion: 370 points over (30 × 300 + 15 × 300) usage-minutes, with 2025-26's 0.02396 behind it
    // at 500 minutes of 20% usage: (370 + 0.02396 × 10000) / (13500 + 10000) = 0.0259 a point per usage-minute.
    expect(guard.own.pts.pull).toMatchObject({ basis: 'usage', opp: 30, oppGames: 10, prior: 23.3, w: w('pts') });   // 0.0259 × 30 × 30
    expect(big.own.pts.pull).toMatchObject({ basis: 'usage', opp: 15, prior: 11.7 });
  });
  test('rebounds off his rebound chances, assists off his potential assists, at the slate’s conversion', () => {
    // 150 rebounds on 270 chances (0.556): the guard's 7 a game → 3.9, the centre's 20 → 11.1.
    expect(guard.own.reb.pull).toMatchObject({ basis: 'reboundChances', opp: 7, prior: 3.9, w: w('reb') });
    expect(big.own.reb.pull).toMatchObject({ basis: 'reboundChances', opp: 20, prior: 11.1 });
    // 100 assists on 180 potential (0.556): the guard's 14 → 7.8, the centre's 4 → 2.2.
    expect(guard.own.ast.pull).toMatchObject({ basis: 'potentialAssists', opp: 14, prior: 7.8 });
    expect(big.own.ast.pull).toMatchObject({ basis: 'potentialAssists', opp: 4, prior: 2.2 });
    // PRA on its parts: 23.3 + 3.9 + 7.8.
    expect(guard.own.pra.pull).toMatchObject({ basis: 'parts', prior: 35, w: w('pra') });
    // Threes have no opportunity figure here: the position's rate, as before.
    expect(guard.own.tpm.pull.basis).toBe('position');
  });
  test('the hovers name the role; without the figures the position’s rate stands in', () => {
    expect(pullText(guard.own.pts.pull)).toContain('his 30% usage over 30 minutes');
    expect(pullText(big.own.reb.pull)).toContain('his 20 rebound chances a game, 30 minutes');
    const bare = { ...pf, data: { ...pf.data, players: pf.data.players.map((p) => ({ ...p, games: p.games.map(({ usg, rebCh, potAst, ...g }) => g) })) } };
    const plain = nbaBoard().buildBoard({ date: '2026-11-05', season: 2026, games, sheets: [], pf: bare, results: {} }).games[0].sides.BOS.players.find((p) => p.key === 'payton pritchard');
    expect(plain.own.pts.pull).toMatchObject({ basis: 'position', K: COCKTAIL.pull.pts, w: Math.round((10 / (10 + COCKTAIL.pull.pts)) * 1000) / 1000 });
    expect(plain.own.pra.pull).toMatchObject({ basis: 'position', K: COCKTAIL.pull.pra });
    // The NFL board reads no opportunity (the defaults).
    expect(COCKTAIL_DEFAULTS.opportunity).toBeNull();
  });
});

describe('the minutes and the defaults', () => {
  test('the minutes factor’s ceiling is the sport’s', () => {
    const active = [{ key: 'a', minutes: { l5: 30, l10: 20, season: 20 } }];
    expect(minutesTonight(active, []).a.factor).toBe(Math.min(FACTOR_MAX, 25 / 20));
    expect(minutesTonight(active, [], { factorMax: 1.1 }).a.factor).toBe(1.1);
    // The NBA's: minutes that fell cut his rate, minutes that rose lift none of it.
    expect(minutesTonight(active, [], { factorMax: COCKTAIL.factorMax }).a.factor).toBe(1);
    expect(minutesTonight([{ key: 'b', minutes: { l5: 10, l10: 20, season: 20 } }], [], { factorMax: COCKTAIL.factorMax }).b.factor).toBe(0.75);
  });
  test('the defaults are the board as it was; the NBA’s cocktail is its own', () => {
    expect(COCKTAIL_DEFAULTS).toMatchObject({ windows: null, hitWeights: WEIGHTS, matchupK: 0, ladderModel: 0.5, empK: 0, spreadA: 0, factorMax: FACTOR_MAX, scope: 'all', volume: true, pull: null });
    expect(nbaBoard().COCKTAIL).toMatchObject(COCKTAIL);
    expect(nbaBoard({}).COCKTAIL).toEqual(COCKTAIL_DEFAULTS);
    // The NFL board builds as before (its tables carry no k: the matchup at full weight).
    const games = [{ id: 'g1', date: '2026-10-25T17:00Z', away: 'BUF', home: 'MIA', final: false, state: 'pre' }];
    const b = nflBoard({ season: 2026, week: 8, games, sheets: [], pf: { at: 'x', data: { players: [], defense: { teams: { MIA: { QB: { gp: 3, passYds: 300 } } }, ranks: { MIA: { QB: { passYds: 1 } } }, count: 1, league: { QB: { passYds: 230 } } } } }, results: {} });
    expect(b.games[0].sides.BUF.allowed.k).toBeUndefined();
  });
});
