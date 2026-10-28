import { describe, expect, test } from '@jest/globals';
import { blendWindows, ownRate, matchupOf, dampOf, blendText, dampText, OWN_WEIGHTS } from '../lib/picks/projection';
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
  test('with the NBA’s: season 0.4, last ten 0.2, last five 0.1, last twenty 0.3, renormalised over the windows he has', () => {
    const w = COCKTAIL.windows;
    expect(blendWindows({ season: 20, l10: 30, l5: 40, l20: 10, w })).toBeCloseTo(0.4 * 20 + 0.2 * 30 + 0.1 * 40 + 0.3 * 10, 6);
    // No last twenty in the windows: the other three carry it.
    expect(blendWindows({ season: 20, l10: 30, l5: 40, w })).toBeCloseTo((0.4 * 20 + 0.2 * 30 + 0.1 * 40) / 0.7, 6);
    expect(ownRate({ season: 20, l10: 30, l5: 40, l20: 10, w })).toBe(21);
    // The weights ride on the windows the NBA board reads (logAverages), with the last twenty; the NFL's stay as they were.
    const logs = Array.from({ length: 25 }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', pts: i < 5 ? 30 : 20, passYds: 200 }));
    expect(nbaAverages(logs, { market: 'pts', season: 2026 })).toEqual({ l5: 30, l10: 25, l20: 22.5, season: 22, seasonN: 25, w: COCKTAIL.windows });
    const nfl = nflAverages(logs, { market: 'passYds', season: 2026 });
    expect(nfl).not.toHaveProperty('w');
    expect(nfl).not.toHaveProperty('l20');
  });
  test('in words, for the hovers', () => {
    expect(blendText(null)).toBe('the season blended with his last ten');
    expect(blendText(COCKTAIL.windows)).toBe('his windows blended: the season 0.4, last ten 0.2, last five 0.1, last twenty 0.3');
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
    expect(dampText(matchupOf(cell, 22, 30, dampOf(allowed, 'SF')))).toBe(', counted at 0.091 of × 1.12 for the 4 games behind the table');
    expect(dampText(matchupOf(cell, 22))).toBe('');
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
    expect(COCKTAIL_DEFAULTS).toMatchObject({ windows: null, hitWeights: WEIGHTS, matchupK: 0, ladderModel: 0.5, empK: 0, spreadA: 0, factorMax: FACTOR_MAX });
    expect(nbaBoard().COCKTAIL).toMatchObject(COCKTAIL);
    expect(nbaBoard({}).COCKTAIL).toEqual(COCKTAIL_DEFAULTS);
    // The NFL board builds as before (its tables carry no k: the matchup at full weight).
    const games = [{ id: 'g1', date: '2026-10-25T17:00Z', away: 'BUF', home: 'MIA', final: false, state: 'pre' }];
    const b = nflBoard({ season: 2026, week: 8, games, sheets: [], pf: { at: 'x', data: { players: [], defense: { teams: { MIA: { QB: { gp: 3, passYds: 300 } } }, ranks: { MIA: { QB: { passYds: 1 } } }, count: 1, league: { QB: { passYds: 230 } } } } }, results: {} });
    expect(b.games[0].sides.BUF.allowed.k).toBeUndefined();
  });
});
