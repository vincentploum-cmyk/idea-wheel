import { describe, expect, test } from '@jest/globals';
import { evOf, decimalOf, juiceOk, failsOf, passes, matchupScore, teamLeak, gameLeak, blowoutFactor, spreadOf, rankGames, topPlays, ladderValue, orderBy, DEFAULTS, MATCHUP, BLOWOUT } from '../lib/picks/value';
import { slatePayload, gamePayload, filtersOf } from '../lib/picks/v1';
import { buildBoard } from '../lib/nba/picks';

// The value layer (the brief of 2026-10-31): EV at the book's price, the floors, the Matchup Score, the ranking.

describe('expected value', () => {
  test('decimal odds, the book’s chance, the EV a unit and the edge', () => {
    expect(decimalOf(-110)).toBeCloseTo(1.909, 3);
    expect(decimalOf(145)).toBeCloseTo(2.45, 3);
    expect(decimalOf(null)).toBeNull();
    // The brief's two figures: a 99% lock at -5000 is worth about +1%, a 47% touchdown at +145 about +13%.
    expect(evOf(0.99, -5000).ev).toBeCloseTo(0.0098, 3);
    expect(evOf(0.47, 145).ev).toBeCloseTo(0.1515, 3);
    const v = evOf(0.6, -110);
    expect(v.pBook).toBeCloseTo(0.524, 3);
    expect(v.edge).toBeCloseTo(0.076, 3);
    expect(v.ev).toBeCloseTo(0.6 * 0.909 - 0.4, 3);
    expect(evOf(0.6, null)).toBeNull();
    expect(evOf(null, -110)).toBeNull();
  });
  test('EV and the edge agree on the sign, never on the order', () => {
    // A positive edge is a positive EV and the other way round; chance-sorting inverts the P&L.
    for (const [p, o] of [[0.99, -5000], [0.47, 145], [0.55, -120], [0.52, -110]]) expect(Math.sign(evOf(p, o).ev)).toBe(Math.sign(evOf(p, o).edge));
    const rows = [{ player: 'Lock', p: 0.99, ev: evOf(0.99, -5000).ev }, { player: 'TD', p: 0.47, ev: evOf(0.47, 145).ev }];
    expect([...rows].sort(orderBy('ev')).map((r) => r.player)).toEqual(['TD', 'Lock']);
    expect([...rows].sort(orderBy('chance')).map((r) => r.player)).toEqual(['Lock', 'TD']);
  });
});

describe('the floors', () => {
  const row = (ev, odds, extra = {}) => ({ id: 'x', player: 'X', p: 0.6, ev, odds, ...extra });
  test('the juice ceiling, the EV floor, the chance floor, the minutes gate, a player out', () => {
    expect(juiceOk(-150, -200)).toBe(true);
    expect(juiceOk(-200, -200)).toBe(true);
    expect(juiceOk(-250, -200)).toBe(false);
    expect(juiceOk(145, -200)).toBe(true);
    expect(juiceOk(null, -200)).toBe(false);
    expect(failsOf(row(0.1, -110))).toBeNull();
    expect(failsOf(row(0.1, -5000))).toBe('juice');
    expect(failsOf(row(0.02, -110))).toBe('ev');
    expect(failsOf(row(null, null))).toBe('price');
    expect(failsOf(row(0.1, -110, { thin: true }))).toBe('thin');
    expect(failsOf(row(0.1, -110, { out: true }))).toBe('out');
    expect(failsOf(row(0.1, -110), { minChance: 0.65 })).toBe('chance');
    expect(passes(row(0.1, -110), { minChance: 0.55 })).toBe(true);
    // The "Mahomes 99%" play (the brief's acceptance criterion 3) never appears at the defaults.
    expect(passes({ ...row(evOf(0.99, -5000).ev, -5000), p: 0.99 })).toBe(false);
    expect(passes({ ...row(evOf(0.99, -5000).ev, -5000), p: 0.99 }, { maxJuice: null, minEv: 0 })).toBe(true);
  });
});

describe('the Matchup Score', () => {
  const profile = { rows: [
    { key: 'allows', cells: { BOS: { level: 'weak', word: 'Leaky' }, NY: { level: 'strong', word: 'Tight' } } },
    { key: 'spots', cells: { BOS: { level: 'poor', word: 'Very leaky' }, NY: { level: 'average', word: 'Average' } } },
  ], script: { tier: 'high', word: 'Fast pace · high total' } };
  const plays = [
    { id: 'a', player: 'A', p: 0.6, ev: 0.12, odds: -110 },
    { id: 'b', player: 'B', p: 0.55, ev: 0.08, odds: 120 },
    { id: 'c', player: 'C', p: 0.5, ev: 0.06, odds: -105 },
    { id: 'd', player: 'D', p: 0.7, ev: 0.055, odds: -150 },
    { id: 'e', player: 'E', p: 0.9, ev: 0.03, odds: -400 },   // fails the EV floor and the juice
    { id: 'f', player: 'F', p: 0.5, ev: null, odds: null },   // no price
  ];
  test('the leak tier from the profile’s words, the pace folded in', () => {
    expect(teamLeak(profile, 'BOS')).toMatchObject({ tier: 2, word: 'Very leaky' });
    expect(teamLeak(profile, 'NY')).toMatchObject({ tier: 0, word: 'Average' });
    expect(teamLeak(null, 'NY').tier).toBe(0);
    const leak = gameLeak({ away: 'BOS', home: 'NY', profile });
    expect(leak).toMatchObject({ defense: 2, pace: 1, tier: 3, word: 'Very leaky' });
    expect(gameLeak({ away: 'BOS', home: 'NY', profile: { ...profile, script: { tier: 'low' } } }).tier).toBe(1);
    expect(gameLeak({ away: 'BOS', home: 'NY', profile: { rows: [], script: { tier: 'low' } } }).tier).toBe(0);
  });
  test('the top three’s EV, the breadth, the leak multiplier, the blowout dampener', () => {
    const m = matchupScore(plays, { leak: { tier: 1 }, spread: null });
    expect(m.top).toEqual(['a', 'b', 'c']);
    expect(m.breadth).toBe(4);
    expect(m.base).toBeCloseTo(0.26, 4);
    expect(m.leakMult).toBeCloseTo(1 + MATCHUP.leak, 3);
    expect(m.blowout).toBe(1);
    expect(m.score).toBeCloseTo((26 + 0.5 * 4) * 1.15, 0);   // the EV in points: the concentration leads, the breadth a bonus
    expect(m.topPlay.id).toBe('a');
    // A big spread damps it: 1 up to 9 points, 0.7 from 16.
    expect(blowoutFactor('DET -2.5')).toBe(1);
    expect(blowoutFactor('-9')).toBe(1);
    expect(blowoutFactor('BOS -16')).toBe(BLOWOUT.min);
    expect(blowoutFactor(12.5)).toBeCloseTo(1 - 0.3 * (3.5 / 7), 3);
    expect(spreadOf('DET −2.5')).toBe(2.5);
    expect(matchupScore(plays, { leak: { tier: 1 }, spread: 'BOS -16' }).score).toBeCloseTo(m.score * BLOWOUT.min, 0);
    // The user's own floors read it again: a 10% minimum keeps one play.
    expect(matchupScore(plays, { filters: { minEv: 0.1 } })).toMatchObject({ breadth: 1, top: ['a'] });
    expect(matchupScore([], {})).toMatchObject({ score: 0, breadth: 0, top: [] });
  });
  test('the games ranked and the plays listed with a user’s filters', () => {
    const board = {
      games: [{ id: 'g1', away: 'BOS', home: 'NY', date: '2026-11-01T23:00Z', profile }, { id: 'g2', away: 'LAL', home: 'GS', date: '2026-11-02T02:00Z', odds: { spread: 'GS -14' } }],
      best: [...plays.map((x) => ({ ...x, game: 'g1' })), { id: 'z', player: 'Z', p: 0.58, ev: 0.2, odds: 110, game: 'g2' }],
    };
    const ranked = rankGames(board);
    expect(ranked.map((r) => r.game.id)).toEqual(['g1', 'g2']);
    expect(ranked[1].matchup.blowout).toBeCloseTo(1 - 0.3 * (5 / 7), 3);
    // The dampener is the NBA's: a board that says so (the NFL's `value.blowout` false) reads the spread as nothing.
    expect(rankGames({ ...board, value: { blowout: false } })[1].matchup.blowout).toBe(1);
    expect(topPlays(board).map((r) => r.id)).toEqual(['z', 'a', 'b', 'c', 'd']);
    expect(topPlays(board, { sort: 'matchup' }).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'z']);
    expect(topPlays(board, { sort: 'chance' }).map((r) => r.id)).toEqual(['d', 'a', 'z', 'b', 'c']);
    expect(topPlays(board, { minEv: 0.1 }).map((r) => r.id)).toEqual(['z', 'a']);
  });
  test('a ladder’s value per rung, the best one marked', () => {
    const rungs = [{ line: 20.5, p: 0.7, odds: -200, underOdds: 150 }, { line: 22.5, p: 0.58, odds: -110, underOdds: -110, main: true }, { line: 24.5, p: 0.4, odds: 140, underOdds: -170 }, { line: 26.5, p: 0.28, odds: null, underOdds: null }];
    const over = ladderValue(rungs, 'over');
    expect(over.map((r) => r.best)).toEqual([false, true, false, false]);
    expect(over[1]).toMatchObject({ main: true, p: 0.58, odds: -110 });
    expect(over[3]).toMatchObject({ ev: null, odds: null });
    const under = ladderValue(rungs, 'under');
    expect(under[0]).toMatchObject({ p: 0.3, odds: 150 });
    expect(under.find((r) => r.best).line).toBe(under.filter((r) => r.ev != null).sort((a, b) => b.ev - a.ev)[0].line);
  });
});

describe('the board carries the value', () => {
  const games = [{ id: 'g1', date: '2026-10-31T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre', odds: { spread: 'BOS -3.5', total: 228.5 } }];
  const logs = (f) => Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 34, pts: 20, reb: 6, ast: 4, tpm: 1, stl: 1, blk: 0, tov: 2, ...f(i) }));
  const player = (id, name, team, pos, f, props, min = 34) => ({ id, name, key: name.toLowerCase(), team, pos, games: logs((i) => ({ min, ...f(i) })), props });
  const pf = { at: '2026-10-31T14:00:00Z', data: { players: [
    player('p1', 'Big Glass', 'BOS', 'C', (i) => ({ reb: 11 + (i % 3) }), [{ market: 'reb', line: 6.5, odds: -110, underOdds: -110, isMain: true }]),
    player('p2', 'Steady Hands', 'BOS', 'PG', (i) => ({ ast: 5 + (i % 3) }), [{ market: 'ast', line: 5.5, odds: -110, underOdds: -110, isMain: true }]),
    // Twelve minutes a night: under the minutes gate, his play is thin whatever its edge.
    player('p3', 'Bench Guy', 'NY', 'SG', (i) => ({ tpm: 2 + (i % 2) }), [{ market: 'tpm', line: 1.5, odds: -110, underOdds: -110, isMain: true }], 12),
  ], defense: null } };
  test('EV on every play and rung, the minutes gate, the back-to-back, the matchup score and the v1 payloads', () => {
    const b = buildBoard({ date: '2026-10-31', season: 2026, games, sheets: [], pf, results: {} });
    expect(b.value).toMatchObject({ minEv: DEFAULTS.minEv, maxJuice: DEFAULTS.maxJuice, minMinutes: 20, blowout: true });
    for (const r of b.best) { expect(r.ev).toBeCloseTo(evOf(r.p, r.odds).ev, 4); expect(r.ev).toBeGreaterThan(0); }
    for (let i = 1; i < b.best.length; i++) expect(b.best[i].ev).toBeLessThanOrEqual(b.best[i - 1].ev);
    const g = b.games[0];
    const glass = g.sides.BOS.players.find((p) => p.key === 'big glass');
    expect(glass.thin).toBe(false);
    expect(glass.b2b).toBe(true);   // his newest log is Oct 30, the night before
    expect(glass.ladders.reb.find((r) => r.main)).toMatchObject({ ev: expect.any(Number), evUnder: expect.any(Number) });
    const bench = g.sides.NY.players.find((p) => p.key === 'bench guy');
    expect(bench.thin).toBe(true);
    const benchPlay = b.best.find((r) => r.key === 'bench guy');
    expect(benchPlay).toMatchObject({ thin: true, minutes: expect.any(Number) });
    expect(failsOf(benchPlay)).toBe('thin');
    expect(b.value.top).not.toContain(benchPlay.id);
    expect(b.value.top).toContain(b.best.find((r) => r.key === 'big glass').id);
    // The game's score at the defaults: the passing plays, the spread (3.5, no dampening), the leak tier from the profile (none without a pull's team rows).
    expect(g.matchup).toMatchObject({ breadth: b.value.top.filter((id) => b.best.find((r) => r.id === id).game === 'g1').length, blowout: 1, spread: 3.5 });
    expect(g.matchup.score).toBeGreaterThan(0);
    expect(b.value.ranked).toEqual(['g1']);
    // The tables rank by EV and keep the thin play as marginal.
    const threes = g.tables.threes;
    expect(threes.rows.find((r) => r.key === 'bench guy')?.under ?? true).toBe(true);
    expect(threes.marginal.concat(threes.rows).find((r) => r.key === 'bench guy').fails).toBe('thin');
    // The v1 slate payload: the games by score, the plays passing the floors with the fields the brief names.
    const slate = slatePayload({ ...b, sport: 'nba' });
    expect(slate.games[0]).toMatchObject({ id: 'g1', matchup: 'BOS @ NY', leak_tier: 0, plays_with_edge: b.best.length, line: { spread: 'BOS -3.5', total: 228.5 } });
    expect(slate.games[0].matchup_score).toBe(g.matchup.score);
    expect(slate.top_plays.map((r) => r.id)).toEqual(b.value.top);
    expect(slate.top_plays[0]).toMatchObject({ player: expect.any(String), market: expect.any(String), model_chance: expect.any(Number), fair_price: expect.any(String), book_price: -110, EV_pct: expect.any(Number), edge: expect.any(Number), status: { thin: false }, result: null, marginal: false });
    expect(slatePayload({ ...b, sport: 'nba' }, { marginal: true }).top_plays.some((r) => r.fails === 'thin')).toBe(true);
    // One game's payload, and the query-string filters.
    const one = gamePayload({ ...b, sport: 'nba' }, 'g1');
    expect([...one.tables.threes.rows, ...one.tables.threes.marginal].some((r) => r.fails === 'thin' && r.marginal)).toBe(true);
    expect(one.sides.NY.players.find((p) => p.key === 'bench guy')).toMatchObject({ thin: true });
    expect(gamePayload(b, 'nope')).toBeNull();
    expect(filtersOf(new URLSearchParams('minEv=0.1&maxJuice=-150&minChance=0.55&sort=chance'))).toMatchObject({ minEv: 0.1, maxJuice: -150, minChance: 0.55, sort: 'chance' });
    expect(filtersOf(new URLSearchParams(''))).toMatchObject(DEFAULTS);
  });
});
