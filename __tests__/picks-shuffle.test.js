import { describe, expect, test } from '@jest/globals';
import { heightsOf, lineOf, readAt, survivorsAt, fallenAt, curveOf, thinsAt, returnOf } from '../lib/picks/shuffle';
import { buildBoard as nbaBoard, ladderOf as nbaLadder, shuffleOf as nbaShuffle, SHUFFLE_MARKETS as NBA_BARS, envPosFor } from '../lib/nba/picks';
import { buildBoard as nflBoard, shuffleOf as nflShuffle, SHUFFLE_MARKETS as NFL_BARS, LADDER_MARKETS as NFL_LADDERS } from '../lib/nfl/picks';
import { MARKETS as NFL_MARKETS } from '../lib/nfl/markets';

// A scorer whose last 20 games read 20, 23, 26, 29, 32 in turn: mean 26, so a 28+ bar clears in 8 of 20.
const logs = Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 20 + (i % 5) * 3, reb: 8, ast: 5, tpm: 2, pra: 33 + (i % 5) * 3 }));
const prop = { market: 'pts', line: 25.5, odds: -110, underOdds: -110, books: 3, isMain: true, lines: [{ line: 19.5, odds: -400, underOdds: 280, books: 1, main: false }, { line: 25.5, odds: -110, underOdds: -110, books: 3, main: true }, { line: 31.5, odds: 300, underOdds: -400, books: 2, main: false }] };

describe('the bar and the ladder', () => {
  test('heights by step and the line a height clears', () => {
    expect(heightsOf({ min: 8, max: 12, step: 1 })).toEqual([8, 9, 10, 11, 12]);
    expect(heightsOf({ min: 20, max: 40, step: 5 })).toEqual([20, 25, 30, 35, 40]);
    expect(lineOf(28)).toBe(27.5);
    expect(lineOf(85)).toBe(84.5);
  });
  test('the ladder takes the shuffle’s lines as rungs and keeps the book’s rungs priced beside them', () => {
    const l = nbaLadder(logs, { market: 'pts', season: 2026, prop, lines: [27.5, 29.5, 33.5] });
    expect(l.map((r) => r.line)).toEqual([19.5, 25.5, 27.5, 29.5, 31.5, 33.5]);
    expect(l.find((r) => r.line === 25.5)).toMatchObject({ main: true, odds: -110 });
    expect(l.find((r) => r.line === 31.5).odds).toBe(300);
    const bar = l.find((r) => r.line === 27.5);
    expect(bar.odds).toBeNull();
    expect(bar.rates).toMatchObject({ season: 0.4, n: 20, l10: 0.4, l10N: 10 });   // 29 and 32 clear 27.5: 8 of 20, 4 of 10
    expect(bar.p).toBeCloseTo(0.5 * bar.model + 0.5 * bar.emp, 3);   // rounded to three places
    // Without a ladder from the book the main line still gets its price.
    const bare = nbaLadder(logs, { market: 'pts', season: 2026, prop: { market: 'pts', line: 25.5, odds: -115, underOdds: -105 }, lines: [27.5] });
    expect(bare.map((r) => [r.line, r.odds, r.main])).toEqual([[25.5, -115, true], [27.5, null, false]]);
  });
});

describe('the NBA shuffle', () => {
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  const defense = { teams: { NY: { SF: { gp: 0, pts: 24, reb: 6 } }, BOS: { SF: { gp: 0, pts: 20, reb: 7 } } }, ranks: { NY: { SF: { pts: 1, reb: 2 } }, BOS: { SF: { pts: 2, reb: 1 } } }, count: 2, league: { SF: { pts: 22, reb: 6.5 } }, windows: {} };
  const pf = { at: '2026-10-20T14:00:00Z', data: { players: [
    { id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [prop] },
    { id: 'p2', name: 'Sam Hauser', key: 'sam hauser', team: 'BOS', pos: 'SF', games: logs.map((g) => ({ ...g, pts: 8 })), props: [] },
  ], defense } };
  const board = nbaBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
  const sh = nbaShuffle({ market: 'pts', board, pf, season: 2026 });
  const pts = NBA_BARS.find((m) => m.market === 'pts');
  test('every player read at every height, the book’s rungs and the matchup beside him', () => {
    expect(sh).toMatchObject({ market: 'pts', label: 'Points', unit: 'pts', stat: 'pts', step: 1, start: pts.start, games: 1, finals: 0 });
    expect(sh.heights[0]).toBe(pts.min);
    expect(sh.heights[sh.heights.length - 1]).toBe(pts.max);
    expect(sh.players.map((p) => p.player)).toEqual(['Jaylen Brown', 'Sam Hauser']);
    const brown = sh.players[0];
    expect(brown).toMatchObject({ team: 'BOS', opp: 'NY', venue: 'A', pos: 'SF', spot: { pos: 'SF', rank: 1, value: 24, count: 2 }, main: { line: 25.5, odds: -110 } });
    expect(brown.env).toBeCloseTo(1.055, 3);   // NY gives up 24 to SFs against a league of 22, damped
    expect(brown.matchup).toBeCloseTo(1.055, 3);   // the matchup alone; no team totals in this pull, so no side factor
    expect(brown.teamFactor).toBeNull();
    expect(brown.spot.league).toBe(22);
    expect(brown.at).toHaveLength(sh.heights.length);
    expect(brown.at.every((r) => r && r.p >= 0 && r.p <= 1)).toBe(true);
    expect(brown).toMatchObject({ n: 20, l10N: 10 });
    // The chance falls as the bar rises.
    for (let i = 1; i < brown.at.length; i++) expect(brown.at[i].p).toBeLessThanOrEqual(brown.at[i - 1].p);
    expect(brown.book.map((b) => [b.line, b.odds, b.main])).toEqual([[19.5, -400, false], [25.5, -110, true], [31.5, 300, false]]);
    expect(brown.exp).toBeCloseTo(26 * 1.055, 0);
  });
  test('the read at a height: the chance, how often he cleared it, the book’s price at or above the bar', () => {
    const brown = sh.players[0];
    const r26 = readAt(brown, sh.heights, 26);   // o25.5: the main line, priced
    expect(r26).toMatchObject({ height: 26, line: 25.5, exact: true, book: { line: 25.5, odds: -110 }, cleared: { of: 10, n: 6 } });
    expect(r26.edge).toBeCloseTo(r26.book.p - 110 / 210, 3);
    const r28 = readAt(brown, sh.heights, 28);   // o27.5 is not priced: the nearest rung above is o31.5
    expect(r28).toMatchObject({ height: 28, line: 27.5, exact: false, book: { line: 31.5, odds: 300 } });
    expect(r28.p).toBeLessThan(r26.p);
    expect(r28.cleared).toEqual({ of: 10, n: 4 });
    expect(r28.got).toBeUndefined();
    expect(readAt(brown, sh.heights, 999)).toBeNull();
  });
  test('survivors, the fallen and the curve at a floor', () => {
    const floor = 0.35;
    const at28 = survivorsAt(sh.players, sh.heights, 28, floor);
    expect(at28.map((x) => x.player.player)).toEqual(['Jaylen Brown']);   // Hauser (8 a game) is long gone
    expect(at28[0].thins).toBe(thinsAt(sh.players[0], sh.heights, floor));
    expect(at28[0].thins).toBeGreaterThanOrEqual(28);
    const fallen = fallenAt(sh.players, sh.heights, 28, floor);
    expect(fallen.map((x) => x.player.player)).toEqual(['Sam Hauser']);
    expect(fallen[0].read.p).toBeLessThan(floor);
    const curve = curveOf(sh.players, sh.heights, floor);
    expect(curve[0]).toEqual({ height: pts.min, n: 2 });
    for (let i = 1; i < curve.length; i++) expect(curve[i].n).toBeLessThanOrEqual(curve[i - 1].n);
    expect(curve[curve.length - 1].n).toBe(0);
    // A low bar everyone clears: the best edge first (Brown is priced, so he carries an edge; Hauser has no line).
    const at8 = survivorsAt(sh.players, sh.heights, 8, floor);
    expect(at8.map((x) => x.player.player)).toEqual(['Jaylen Brown', 'Sam Hauser']);
    expect(at8[1].read.edge).toBeNull();
    expect(survivorsAt(sh.players, sh.heights, 10, floor).map((x) => x.player.player)).toEqual(['Jaylen Brown']);   // 8 a game clears 10 in no game
  });
  test('a finished game grades the read', () => {
    const final = [{ ...games[0], final: true, state: 'post', awayScore: 110, homeScore: 100 }];
    const results = { g1: { id: 'g1', final: true, players: [{ name: 'Jaylen Brown', team: 'BOS', played: true, pts: 29, reb: 7, ast: 4 }, { name: 'Sam Hauser', team: 'BOS', played: false }] } };
    const b = nbaBoard({ date: '2026-10-21', season: 2026, games: final, sheets: [], pf, results });
    const s = nbaShuffle({ market: 'pts', board: b, pf, season: 2026, results });
    const brown = s.players.find((p) => p.player === 'Jaylen Brown');
    expect(brown).toMatchObject({ final: true, actual: 29 });
    expect(readAt(brown, s.heights, 28)).toMatchObject({ got: 29, hit: true });
    expect(readAt(brown, s.heights, 30)).toMatchObject({ got: 29, hit: false });
    expect(returnOf(readAt(brown, s.heights, 26))).toBeCloseTo(0.909, 3);   // o25.5 at -110, hit
    expect(returnOf(readAt(brown, s.heights, 32))).toBe(-1);               // o31.5 at +300, missed
    expect(s.players.find((p) => p.player === 'Sam Hauser').actual).toBeNull();
  });
  test('the matchup column keeps the opponent’s factor apart from the side’s', () => {
    // BOS scores 110 a game against NY's 120 allowed (league 115): 112.9 expected; Brown and Hauser at
    // 36 + 24 minutes = 25% of the game, too few to scale → the matchup is the whole environment; at
    // 36 + 180 = 90% the side's factor is 112.9 × 0.9 over their 34, capped at 1.5, and rides beside it.
    const totals = { BOS: { for: { gp: 82, pts: 110, reb: 44, ast: 26 }, against: { gp: 82, pts: 112 } }, NY: { for: { gp: 82, pts: 115 }, against: { gp: 82, pts: 120 } } };
    const withMin = (mins) => ({ ...pf, data: { ...pf.data, players: pf.data.players.map((p, i) => ({ ...p, games: p.games.map((g) => ({ ...g, min: mins[i] })) })), defense: { ...defense, totals, leagueFor: { pts: 115, reb: 44, ast: 26 } } } });
    const few = nbaShuffle({ market: 'pts', board: nbaBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: withMin([36, 24]), results: {} }), pf: withMin([36, 24]), season: 2026 }).players.find((p) => p.player === 'Jaylen Brown');
    expect(few.matchup).toBeCloseTo(1.055, 3);
    expect(few.teamFactor).toBeNull();
    expect(few.env).toBeCloseTo(1.055, 3);
    const most = nbaShuffle({ market: 'pts', board: nbaBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: withMin([36, 180]), results: {} }), pf: withMin([36, 180]), season: 2026 }).players.find((p) => p.player === 'Jaylen Brown');
    expect(most.matchup).toBeCloseTo(1.055, 3);
    expect(most.teamFactor).toBe(1.5);
    expect(most.env).toBeCloseTo(1.055 * 1.5, 2);
    expect(most.exp).toBeCloseTo(26 * most.env, 0);
    expect(most.own.blend).toBe(26);
  });
  test('a market without a bar, or a yes-no market, reads as nothing', () => {
    expect(nbaShuffle({ market: 'dd', board, pf, season: 2026 })).toBeNull();
    expect(nbaShuffle({ market: 'stl', board, pf, season: 2026 })).toBeNull();
  });
});

describe('NFL ladders by configuration', () => {
  const games = [{ id: 'g1', date: '2026-11-01T18:00Z', away: 'DAL', home: 'PHI', final: false, state: 'pre' }];
  // A receiver whose last ten read 60, 75, 90, 105, 120 in turn: mean 90.
  const rec = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'DAL', recYds: 60 + (i % 5) * 15, rec: 5 + (i % 3), recTd: i % 4 === 0 ? 1 : 0, rushYds: 0, rushTd: 0, retTd: 0, passYds: 0 }));
  const prop = { market: 'rec_yds', line: 74.5, odds: -112, underOdds: -108, books: 6, isMain: true, lines: [{ line: 59.5, odds: -220, underOdds: 170, books: 2, main: false }, { line: 74.5, odds: -112, underOdds: -108, books: 6, main: true }, { line: 89.5, odds: 150, underOdds: -190, books: 4, main: false }, { line: 104.5, odds: 270, underOdds: -380, books: 2, main: false }] };
  const defense = { teams: { DAL: { WR: { gp: 8, recYds: 184 }, WR1: { gp: 8, recYds: 96 } }, PHI: { WR: { gp: 8, recYds: 149 } } }, ranks: { DAL: { WR: { recYds: 3 }, WR1: { recYds: 2 } }, PHI: { WR: { recYds: 19 } } }, count: 32, league: { WR: { recYds: 160 }, WR1: { recYds: 84 } }, windows: {} };
  const pf = (depth) => ({ at: '2026-10-28T14:00:00Z', data: { players: [{ id: 'p1', name: 'A.J. Brown', key: 'a.j. brown', team: 'PHI', pos: 'WR', games: rec, props: [prop] }], defense, ...(depth ? { depth } : {}) } });
  test('the yardage markets carry a step and are ladder markets', () => {
    expect(NFL_MARKETS.rec_yds.step).toBe(10);
    expect(NFL_MARKETS.pass_yds.step).toBe(25);
    expect(NFL_MARKETS.receptions.step).toBe(1);
    expect(NFL_LADDERS).toEqual(expect.arrayContaining(['pass_yds', 'rush_yds', 'rec_yds', 'receptions']));
    expect(NFL_BARS.map((m) => m.market)).toEqual(expect.arrayContaining(['rec_yds', 'rush_yds', 'pass_yds', 'receptions']));
  });
  test('without a coverage measure the team’s total is a ceiling on the side, never a floor', () => {
    // PHI throws for 300 a game against DAL's 250 allowed (league 240): 307.5 expected over Brown's 90 alone
    // would be ×1.5 at the cap; the NFL pull carries no minutes, so the side scales down only: ×1 here.
    const t = { ...pf(null), data: { ...pf(null).data, defense: { ...defense, totals: { PHI: { for: { gp: 8, recYds: 300 } }, DAL: { against: { gp: 8, recYds: 250 } } }, leagueFor: { recYds: 240 } } } };
    const side = nflBoard({ season: 2026, week: 9, games, sheets: [], pf: t, results: {} }).games[0].sides.PHI;
    expect(side.share).toBeNull();
    expect(side.teamProj.recYds).toBeCloseTo(307.5, 1);
    expect(side.scale.recYds).toBe(1);
    const crowd = { ...t, data: { ...t.data, players: [...t.data.players, { id: 'p2', name: 'DeVonta Smith', key: 'devonta smith', team: 'PHI', pos: 'WR', games: rec.map((g) => ({ ...g, recYds: 300 })), props: [] }] } };
    expect(nflBoard({ season: 2026, week: 9, games, sheets: [], pf: crowd, results: {} }).games[0].sides.PHI.scale.recYds).toBeCloseTo(307.5 / 390, 3);
  });
  test('a receiver’s ladder and range read against the WR row, the slot row when PropFinder lists it', () => {
    const b = nflBoard({ season: 2026, week: 9, games, sheets: [], pf: pf(null), results: {} });
    const brown = b.games[0].sides.PHI.players.find((p) => p.key === 'a.j. brown');
    expect(brown.envPos).toBe('WR');
    expect(Object.keys(brown.ladders)).toEqual(expect.arrayContaining(['rec_yds', 'receptions']));
    const lad = brown.ladders.rec_yds;
    expect(lad.map((r) => r.line)).toEqual([59.5, 74.5, 89.5, 104.5]);
    expect(lad[0].env).toBeCloseTo(1 + 0.6 * (184 / 160 - 1), 3);   // DAL gives up 184 to WRs against the league's 160
    expect(brown.ranges.rec_yds).toMatchObject({ line: 74.5, odds: -112 });
    expect(brown.ranges.rec_yds.exp).toBeCloseTo(90 * lad[0].env, 0);
    expect(brown.ranges.rec_yds.ceiling).toBeGreaterThan(brown.ranges.rec_yds.exp);
    // With a depth chart the slot's own row is the environment when the table carries it.
    const withSlot = nflBoard({ season: 2026, week: 9, games, sheets: [], pf: pf({ PHI: { WR1: [{ key: 'a.j. brown', depth: 1 }] } }), results: {} });
    const slotted = withSlot.games[0].sides.PHI.players.find((p) => p.key === 'a.j. brown');
    expect(slotted).toMatchObject({ slot: 'WR1', depth: 1, envPos: 'WR1' });
    expect(slotted.ladders.rec_yds[0].env).toBeCloseTo(1 + 0.6 * (96 / 84 - 1), 3);
    expect(envPosFor('WR1', 'WR', { WR: {} })).toBe('WR');
    expect(envPosFor('WR1', 'WR', null)).toBe('WR1');
    expect(envPosFor(null, 'G', { SG: {} })).toBe('SG');
  });
  test('the NFL shuffle reads receiving yards at every bar', () => {
    const b = nflBoard({ season: 2026, week: 9, games, sheets: [], pf: pf(null), results: {} });
    const sh = nflShuffle({ market: 'rec_yds', board: b, pf: pf(null), season: 2026 });
    expect(sh).toMatchObject({ market: 'rec_yds', label: 'Rec yards', unit: 'yds', step: 5 });
    const brown = sh.players[0];
    expect(brown).toMatchObject({ team: 'PHI', opp: 'DAL', venue: 'H', spot: { pos: 'WR', rank: 3, count: 32 } });
    const r90 = readAt(brown, sh.heights, 90);
    expect(r90).toMatchObject({ line: 89.5, exact: true, book: { line: 89.5, odds: 150 } });
    expect(r90.p).toBeGreaterThan(0.3);
    const r100 = readAt(brown, sh.heights, 100);
    expect(r100).toMatchObject({ line: 99.5, exact: false, book: { line: 104.5, odds: 270 } });
    expect(survivorsAt(sh.players, sh.heights, 60, 0.35)).toHaveLength(1);
    expect(survivorsAt(sh.players, sh.heights, 160, 0.35)).toHaveLength(0);
  });
});

describe('reading from his own results', () => {
  const { ownWindows } = require('../lib/nba/picks');
  const { centreOf, pAt, readAt: read, survivorsAt: survivors, READ_FROM } = require('../lib/picks/shuffle');
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  // Ten games this season on top of twenty from last: last 3 = 36, last 5 = 34.8, last 10 = 31.5, season (this one) = 31.5.
  const thisSeason = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(20 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 36 - i, reb: 8, ast: 5, tpm: 2, pra: 49 - i }));
  const lastSeason = Array.from({ length: 20 }, (_, i) => ({ date: `2026-03-${String(28 - i).padStart(2, '0')}`, season: 2025, type: 'REG', opp: 'NY', pts: 20, reb: 8, ast: 5, tpm: 2, pra: 33 }));
  const logs = [...lastSeason, ...thisSeason];   // oldest first on purpose: the windows sort
  test('the windows: last 3 / 5 / 10 / 20 and this season alone', () => {
    expect(ownWindows(logs, { market: 'pts', season: 2026 })).toEqual({ l3: 35, l5: 34, l10: 31.5, l20: 25.8, season: 31.5, seasonN: 10, n: 30, h2h: null, h2hN: 0 });   // no opponent asked: no head to head
    expect(ownWindows(thisSeason.slice(0, 2), { market: 'pts', season: 2026 })).toMatchObject({ l3: 35.5, season: null, seasonN: 2 });
    expect(ownWindows([], { market: 'pts', season: 2026 })).toEqual({ l3: null, l5: null, l10: null, l20: null, season: null, seasonN: 0, n: 0, h2h: null, h2hN: 0 });
  });
  test('the shuffle carries the windows and recentres the chance on the one picked', () => {
    const pf = { at: '2026-10-21T12:00:00Z', data: { players: [{ id: 'p1', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs, props: [prop] }], defense: null } };
    const b = nbaBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    const sh = nbaShuffle({ market: 'pts', board: b, pf, season: 2026 });
    const brown = sh.players[0];
    expect(brown.own).toEqual({ l3: 35, l5: 34, l10: 31.5, season: 31.5, seasonN: 10, blend: brown.exp });   // no table: no environment, the blend is the projection
    expect(brown.env).toBeNull();
    expect(READ_FROM.map(([k]) => k)).toEqual(['blend', 'l5', 'l10', 'season', 'line']);
    expect(centreOf(brown, 'blend')).toBeNull();
    expect(centreOf(brown, 'l5')).toBe(34);
    expect(centreOf(brown, 'line')).toBe(25.5);
    expect(centreOf({ ...brown, env: 1.1 }, 'l5')).toBe(37.4);
    const i = sh.heights.indexOf(30);
    const fromBlend = pAt(brown, sh.heights, i, 'blend');
    const fromL5 = pAt(brown, sh.heights, i, 'l5');
    const fromLine = pAt(brown, sh.heights, i, 'line');
    expect(fromBlend).toBe(brown.at[i].p);
    expect(fromL5).toBeGreaterThan(fromBlend);     // his last five (34 a game) sit over 30; the blend (31.5 with last season's 20s) does not by as much
    expect(fromLine).toBeLessThan(fromBlend);      // the line (25.5) sits under 30
    // The hit-rate half is the same in all three: only the model half moves.
    expect(fromL5 - fromBlend).toBeCloseTo(0.5 * (upperTail((29.5 - 34) / brown.sd) - brown.at[i].model), 2);
    const r = read(brown, sh.heights, 30, 'l5');
    expect(r).toMatchObject({ from: 'l5', centre: 34, p: fromL5 });
    expect(read(brown, sh.heights, 30).centre).toBe(brown.exp);
    // A window he does not have falls back to the blend.
    expect(pAt({ ...brown, own: { ...brown.own, l5: null } }, sh.heights, i, 'l5')).toBe(fromBlend);
    // The survivors move with the window: at 33+ he holds on his last five, not on the line.
    expect(survivors(sh.players, sh.heights, 33, 0.35, 'l5')).toHaveLength(1);
    expect(survivors(sh.players, sh.heights, 33, 0.35, 'line')).toHaveLength(0);
  });
  const { upperTail } = require('../lib/picks/projection');
});

describe('a stat he never records', () => {
  const { ladderOf, buildBoard, shuffleOf } = require('../lib/nfl/picks');
  const games = [{ id: 'g1', date: '2026-11-01T18:00Z', away: 'DAL', home: 'PHI', final: false, state: 'pre' }];
  const qb = Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-${String(10 + i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'DAL', passYds: 250 + i * 5, rec: 0, recYds: 0, rushYds: 12, rushTd: 0, recTd: 0, retTd: 0 }));
  test('no ladder, no shuffle row, no predictor row for a quarterback’s receiving yards', () => {
    expect(ladderOf(qb, { market: 'rec_yds', season: 2026 })).toEqual([]);
    expect(ladderOf(qb, { market: 'pass_yds', season: 2026 }).length).toBeGreaterThan(0);
    const pf = { at: '2026-10-28T14:00:00Z', data: { players: [{ id: 'q', name: 'Jalen Hurts', key: 'jalen hurts', team: 'PHI', pos: 'QB', games: qb, props: [] }], defense: null } };
    const b = buildBoard({ season: 2026, week: 9, games, sheets: [], pf, results: {} });
    const hurts = b.games[0].sides.PHI.players[0];
    expect(Object.keys(hurts.ladders)).toEqual(expect.arrayContaining(['pass_yds', 'rush_yds']));
    expect(hurts.ladders.rec_yds).toBeUndefined();
    expect(hurts.ranges.rec_yds).toBeUndefined();
    expect(shuffleOf({ market: 'rec_yds', board: b, pf, season: 2026 }).players).toEqual([]);
    expect(shuffleOf({ market: 'pass_yds', board: b, pf, season: 2026 }).players).toHaveLength(1);
  });
});

describe('which read the scorecard rates best', () => {
  const { bestReadFrom, READ_FROM_PREDICTOR, READ_FROM } = require('../lib/picks/shuffle');
  const rep = (market, briers, lined) => ({ key: market, common: { n: lined, predictors: Object.entries(briers).map(([key, brier]) => ({ key, brier, lined })) } });
  test('every read maps to a scorecard predictor', () => {
    expect(READ_FROM.map(([k]) => READ_FROM_PREDICTOR[k])).toEqual(['proj', 'own5x', 'own10x', 'ownSeasonx', 'line']);
  });
  test('the Brier of each read pooled over the markets, weighted by its plays; the lowest wins once enough plays are in', () => {
    const predictors = [
      rep('pts', { proj: 0.24, own5x: 0.25, own10x: 0.22, ownSeasonx: 0.23, line: 0.245, own5: 0.3 }, 300),
      rep('reb', { proj: 0.2, own5x: 0.26, own10x: 0.25, ownSeasonx: 0.21, line: 0.22 }, 100),
      rep('stl', { proj: 0.1, own5x: 0.1, own10x: 0.1, ownSeasonx: 0.1, line: 0.1 }, 1000),   // not one of the shuffle's markets
    ];
    const r = bestReadFrom(predictors, ['pts', 'reb']);
    expect(r.n).toBe(400);
    expect(r.scores.l10).toEqual({ brier: 0.2275, n: 400 });    // (0.22 × 300 + 0.25 × 100) / 400
    expect(r.scores.blend).toEqual({ brier: 0.23, n: 400 });
    expect(r.ranked).toEqual(['season', 'l10', 'blend', 'line', 'l5']);
    expect(r.best).toBe('season');
    expect(bestReadFrom(predictors, ['pts', 'reb'], { min: 500 })).toMatchObject({ best: null, n: 400 });
    expect(bestReadFrom([], ['pts'])).toEqual({ best: null, n: 0, scores: {}, ranked: [] });
    expect(bestReadFrom(predictors).n).toBe(1400);   // no market list: every market in the report
  });
});
