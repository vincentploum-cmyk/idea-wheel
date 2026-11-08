/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBoard } from '../lib/nfl/picks';
import { bigChance, BIG, BIG_FILL, chanceAtMark, ladderTiers, LADDER_TIERS, markOf, markQuarterbacks, normPlayer, roleOf, spreadOf, impliedPoints, scriptOf, scriptFactor, tdTier, tdCalibrated, RANGE, SCRIPT, TD_PER_POINT, H1_SHARE, LINE_WEIGHT, TD_CAL, PARAMS, PASS, passRead, QB_RUSH, qbRushRead, RESID, RESID_UNSHRUNK, YARDS_SHRINK, TD_ENGINE, tdEngine, rzLooksOf, NFL_OUTLIERS, NFL_OUTLIER_LIST_MIN, nflOutlierMark, nflOutlierChance, TGT_SHARE, tgtShareRead, shareRead, shareText, RESID_POS, RANGE_POS, residFor } from '../lib/nfl/projections';
import { applyRosterStatus, ROSTER_OFF } from '../lib/nfl/roster-status';
import { reproject, makeBuild, nflBoard, COCKTAIL } from '../lib/nfl/picks';
import { envFactor } from '../lib/picks/projection';
import { NflMatchups, NflList, NflBigGames, NflTightEnds, KINDS } from '../components/nfl/NflBoards';

// The week's projections (Vincent, 2026-11-01: "I don't care about edge … the projected yards / TD candidates per game")
// on a board built from a synthetic pull: the team's touchdowns tonight from its rate, the defense and the book's total,
// each player's touchdown chance from his rate pulled toward his volume, the yards projections with the heights each
// clears, the per-game leaders, the words beside a name, the grading once a game is stored, the panel and the script.

const GAMES = [
  { id: 'g1', date: '2026-11-01T21:25Z', away: 'LAR', home: 'SEA', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 4:25 PM', odds: { spread: 'SEA -3', total: 47.5 } },
  { id: 'g2', date: '2026-11-01T18:00Z', away: 'DAL', home: 'PHI', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 1:00 PM' },
];
const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0 };
const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(30 - i * 3).padStart(2, '0')}`);
// PropFinder's game rows carry `td` (rushing + receiving + returns, propfinder-nfl.js derive).
const withTd = (g) => ({ ...g, td: g.rushTd + g.recTd + g.retTd });
const logs = (f, ids = null) => dates.map((date, i) => withTd({ ...base, date, opp: 'ARI', gameId: ids ? ids[i] : `lar-${i}`, ...f(i) }));
const lines = (list) => list.map(([line, odds, underOdds, main]) => ({ line, odds, underOdds: underOdds ?? null, books: 2, main: !!main }));
const player = (id, name, team, pos, games, props, extra = {}) => ({ id, name, key: name.toLowerCase(), team, pos, games, props, ...extra });

const pf = { at: '2026-10-31T14:00:00Z', data: {
  players: [
    // The lead back: scores most weeks, a priced first-half line.
    player('p1', 'Kyren Williams', 'LAR', 'RB', logs((i) => ({ rushAtt: 18, rushYds: 80 + (i % 4) * 10, rushTd: i % 3 === 2 ? 0 : 1, rec: 3, recYds: 20, tgt: 4 })),
      [{ market: 'anytime_td', line: 0.5, odds: -150, isMain: true }, { market: 'h1_anytime_td', line: 0.5, odds: 115, isMain: true }, { market: 'rush_yds', line: 79.5, odds: -110, underOdds: -110, isMain: true, lines: lines([[64.5, -220, 170], [79.5, -110, -110, true], [99.5, 170, -220], [124.5, 500, -900]]) }]),
    // The receiver with a ladder the book prices up to 125.
    player('p2', 'Puka Nacua', 'LAR', 'WR', logs((i) => ({ rec: 8, recYds: 95 + (i % 5) * 12, recTd: i % 4 === 0 ? 1 : 0, tgt: 11 })),
      [{ market: 'anytime_td', line: 0.5, odds: 120, isMain: true }, { market: 'rec_yds', line: 89.5, odds: -110, underOdds: -110, isMain: true, lines: lines([[74.5, -180, 140], [89.5, -110, -110, true], [99.5, 140, -180], [109.5, 220, -300], [124.5, 400, -600]]) }]),
    // The quarterback: a passing ladder and a rushing line.
    player('p3', 'Matthew Stafford', 'LAR', 'QB', logs((i) => ({ passAtt: 36, passCmp: 24, passYds: 270 + (i % 5) * 15, passTd: 2, rushAtt: 2, rushYds: 4 + (i % 3) * 3 })),
      [{ market: 'pass_yds', line: 274.5, odds: -110, underOdds: -110, isMain: true, lines: lines([[249.5, -160, 125], [274.5, -110, -110, true], [299.5, 155, -200], [324.5, 300, -450]]) }, { market: 'rush_yds', line: 5.5, odds: -115, underOdds: -115, isMain: true, lines: lines([[5.5, -115, -115, true], [9.5, 150, -200]]) }]),
    // The tight end with a price and volume.
    player('p4', 'Tyler Higbee', 'LAR', 'TE', logs((i) => ({ rec: 4, recYds: 38 + (i % 3) * 6, recTd: i % 3 === 0 ? 1 : 0, tgt: 5 + (i % 2) })),
      [{ market: 'anytime_td', line: 0.5, odds: 240, isMain: true }, { market: 'rec_yds', line: 34.5, odds: -110, underOdds: -110, isMain: true, lines: lines([[34.5, -110, -110, true], [49.5, 180, -240]]) }]),
    // A back questionable for the game.
    player('p5', 'Blake Corum', 'LAR', 'RB', logs((i) => ({ rushAtt: 7, rushYds: 30, rushTd: i % 5 === 0 ? 1 : 0 })), [{ market: 'anytime_td', line: 0.5, odds: 320, isMain: true }], { injury: 'Questionable', injuryDetail: 'Ankle' }),
    // The other side: the starter out, his backup with eight games beside him and two without.
    player('p6', 'Kenneth Walker', 'SEA', 'RB', logs((i) => ({ rushAtt: 15, rushYds: 70, rushTd: 1 }), ['sea-0', 'sea-1', 'sea-2', 'sea-3', 'sea-4', 'sea-5', 'sea-6', 'sea-7', 'sea-8', 'sea-9']).slice(2), [{ market: 'anytime_td', line: 0.5, odds: -120, isMain: true }], { injury: 'Out', injuryDetail: 'Knee' }),
    player('p7', 'Zach Charbonnet', 'SEA', 'RB', logs((i) => ({ rushAtt: i < 2 ? 18 : 8, rushYds: i < 2 ? 90 : 35, rushTd: i < 2 || i % 4 === 0 ? 1 : 0 }), ['sea-0', 'sea-1', 'sea-2', 'sea-3', 'sea-4', 'sea-5', 'sea-6', 'sea-7', 'sea-8', 'sea-9']), [{ market: 'anytime_td', line: 0.5, odds: 110, isMain: true }]),
  ],
  injuries: { at: '2026-10-31T14:00:00Z', source: 'espn', rows: [{ id: 'p6', name: 'Kenneth Walker', key: 'kenneth walker', team: 'SEA', pos: 'RB', status: 'Out', detail: 'Knee' }, { id: 'p5', name: 'Blake Corum', key: 'blake corum', team: 'LAR', pos: 'RB', status: 'Questionable', detail: 'Ankle' }] },
  defense: { count: 3,
    league: { RB: { td: 0.9, rushYds: 100 }, WR: { td: 0.8, recYds: 160 }, TE: { td: 0.45, recYds: 47 }, QB: { passYds: 235 } },
    totals: { LAR: { for: { td: 2.8 }, against: { td: 2.2 } }, SEA: { for: { td: 2.5 }, against: { td: 2.9 } }, PHI: { for: { td: 2.6 }, against: { td: 2.1 } }, DAL: { for: { td: 2.3 }, against: { td: 2.6 } } },
    leagueFor: { td: 2.4 },
    teams: { SEA: { RB: { td: 1.3, rushYds: 130 }, WR: { recYds: 190, td: 1.1 }, TE: { td: 0.6, recYds: 55 }, QB: { passYds: 265 } }, LAR: { RB: { td: 0.8, rushYds: 95 }, WR: { recYds: 150, td: 0.7 }, TE: { td: 0.3, recYds: 40 }, QB: { passYds: 230 } }, PHI: { RB: { td: 0.5, rushYds: 80 }, WR: { recYds: 140, td: 0.6 }, TE: { td: 0.4, recYds: 45 }, QB: { passYds: 210 } } },
    ranks: { SEA: { RB: { td: 1, rushYds: 1 }, WR: { recYds: 1, td: 1 }, TE: { td: 1, recYds: 1 }, QB: { passYds: 1 } }, LAR: { RB: { td: 2, rushYds: 2 }, WR: { recYds: 2, td: 2 }, TE: { td: 3, recYds: 3 }, QB: { passYds: 2 } }, PHI: { RB: { td: 3, rushYds: 3 }, WR: { recYds: 3, td: 3 }, TE: { td: 2, recYds: 2 }, QB: { passYds: 3 } } } },
} };

const build = (results = {}, games = GAMES) => buildBoard({ season: 2026, week: 9, games, sheets: [], pf, results });

describe('NFL boards: the first-half touchdown line', () => {
  test('the book’s first-half line is a play of its own, graded on the scoring plays’ halves', () => {
    const results = { g1: { id: 'g1', final: true, players: [
      { name: 'Kyren Williams', team: 'LAR', ...base, rushYds: 102, rushTd: 1, td: 1, firstTd: 0, h1RushTd: 1, h1RecTd: 0 },
      { name: 'Puka Nacua', team: 'LAR', ...base, recYds: 131, recTd: 1, td: 1, firstTd: 1, h1RushTd: 0, h1RecTd: 0 },
    ] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 20, detail: 'Final' }, GAMES[1]];
    const lar = build(results, games).games[0].sides.LAR;
    const half = lar.players.find((p) => p.player === 'Kyren Williams').plays.find((x) => x.market === 'h1_anytime_td');
    expect(half).toMatchObject({ side: 'yes', line: 0.5, odds: 115, actual: 1, hit: true });
    expect(half.implied).toBeCloseTo(100 / 215, 3);
  });
});

describe('NFL projections: the ladders and the touchdown reads (2026-11-01)', () => {
  test('a mark’s chance falls as the mark rises, the projection is cleared about half the time, the tiers are the highest marks at 60 / 45 / 30%', () => {
    const y = { proj: 72, sd: 28 };
    const ps = [40, 50, 60, 70, 80, 90, 100].map((m) => chanceAtMark(y, m, 'rec_yds'));
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeLessThan(ps[i - 1]);
    // The curve is fitted on the shrunk projection (YARDS_SHRINK, 2026-11-03): the middle game lands on it.
    expect(chanceAtMark(y, 72, 'rec_yds')).toBeCloseTo(0.5, 1);
    // Before the shrink the board's own projection ran over the middle game: its curve put the projection under half.
    expect(chanceAtMark(y, 72, 'rec_yds', { ...RESID, ...RESID_UNSHRUNK })).toBeLessThan(0.5);
    const t = ladderTiers(y, 'rec_yds');
    for (const [tier, at] of LADDER_TIERS) {
      expect(t[tier].p).toBeGreaterThanOrEqual(at);
      expect(t[tier].mark % 10).toBe(0);   // 72 projected: by 10
      expect(chanceAtMark(y, t[tier].mark + 10, 'rec_yds')).toBeLessThan(at);
    }
    expect(t.strong.mark).toBeLessThan(t.lean.mark);
    expect(t.lean.mark).toBeLessThan(t.thin.mark);
    expect(ladderTiers({ proj: 3.2, sd: 1.5 }, 'receptions').strong.mark).toBeGreaterThanOrEqual(1);
    expect(ladderTiers({ proj: null, sd: 10 }, 'rec_yds')).toEqual({ strong: null, lean: null, thin: null });
  });
  test('every row carries the ladder; the touchdowns carry the first half, the first touchdown and two or more', () => {
    const b = build();
    const rows = Object.values(b.projections.rows);
    const puka = rows.find((r) => r.player === 'Puka Nacua');
    expect(puka.yards.rec_yds.tiers.strong).toMatchObject({ mark: expect.any(Number), p: expect.any(Number) });
    const k = rows.find((r) => r.player === 'Kyren Williams').td;
    expect(k.p2).toBeCloseTo(1 - Math.exp(-k.lambda) * (1 + k.lambda), 3);
    expect(k.pFirst).toBeGreaterThan(0);
    expect(k.pFirst).toBeLessThan(k.p1h);
    // The first touchdown is shared over the game's expected touchdowns (the book's total × TD_PER_POINT and the others').
    const g1 = rows.filter((r) => r.game === 'g1' && r.td);
    const sum = g1.reduce((s, r) => s + r.td.pFirst, 0);
    expect(sum).toBeLessThan(1);
  });
  test('once the game is in, each rung is graded on what he got', () => {
    const results = { g1: { id: 'g1', final: true, players: [{ name: 'Puka Nacua', team: 'LAR', ...base, rec: 9, recYds: 131, recTd: 1, td: 1 }] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 20, detail: 'Final' }, GAMES[1]];
    const y = Object.values(build(results, games).projections.rows).find((r) => r.player === 'Puka Nacua').yards.rec_yds;
    for (const [tier] of LADDER_TIERS) if (y.tiers[tier]) expect(y.hits[tier]).toBe(131 >= y.tiers[tier].mark);
  });
});

describe('NFL projections: the passing read (2026-11-02)', () => {
  const start = (date, passYds, passAtt = 34) => ({ date, passYds, passAtt });
  const starts = Array.from({ length: 10 }, (_, i) => start(`2026-10-${String(28 - i * 2).padStart(2, '0')}`, 280));
  test('his starts alone: a game he sat or a relief appearance is no start', () => {
    const plain = passRead(starts);
    const withBench = passRead([...starts, start('2026-10-29', 0, 0), start('2026-10-09', 41, 4)]);
    expect(withBench.proj).toBe(plain.proj);
    expect(plain.n).toBe(10);
    expect(plain.avg).toBe(280);
    // Pulled toward the league at n / (n + K): one start reads close to the league, ten most of the way to his own.
    expect(plain.own).toBeCloseTo((10 * 280 + PASS.K * PASS.league) / (10 + PASS.K), 1);
    expect(passRead([start('2026-10-28', 400)]).own).toBeLessThan(260);
    expect(passRead([start('2026-10-28', 0, 0)])).toBeNull();
    expect(passRead([])).toBeNull();
  });
  test('rows on or after the game are left out', () => {
    const later = [start('2026-11-02', 500), ...starts];
    expect(passRead(later, { before: '2026-11-02T18:00Z' }).proj).toBe(passRead(starts, { before: '2026-11-02T18:00Z' }).proj);
  });
  test('the total, the favourite and a soft pass defense each lift it; a thin or last-season table moves nothing', () => {
    const at = (o) => passRead(starts, o).proj;
    const even = { spread: 'PK', total: 44.5 };
    expect(at({ odds: { spread: 'PK', total: 52.5 }, team: 'LAR' })).toBeGreaterThan(at({ odds: even, team: 'LAR' }));
    // ESPN names the favourite ("LAR -7"): the favourite throws for more than the underdog at the same total.
    expect(at({ odds: { spread: 'LAR -7', total: 44.5 }, team: 'LAR' })).toBeGreaterThan(at({ odds: { spread: 'SEA -7', total: 44.5 }, team: 'LAR' }));
    // No line: the league's usual total, no favourite.
    expect(at({})).toBe(at({ odds: even, team: 'LAR' }));
    const soft = { cell: { value: 275 }, league: 235, gp: 7 };
    expect(at(soft)).toBeGreaterThan(at({}));
    expect(passRead(starts, soft).matchup).toBeGreaterThan(1);
    expect(at({ ...soft, gp: 2 })).toBe(at({}));
    expect(at({ ...soft, held: true })).toBe(at({}));
  });
  test('the board: the starter takes the read, his ladder on its flat spread', () => {
    const b = build();
    const row = Object.values(b.projections.rows).find((r) => r.player === 'Matthew Stafford');
    const y = row.yards.pass_yds;
    const want = passRead(pf.data.players.find((p) => p.name === 'Matthew Stafford').games, { before: GAMES[0].date, odds: GAMES[0].odds, team: 'LAR', cell: { value: 265 }, league: 235, gp: null });
    expect(y.proj).toBe(want.proj);
    expect(y.sd).toBe(PASS.sd);
    expect(y.pass.n).toBe(10);
    expect(y.tiers.strong.mark).toBeLessThan(y.proj);
    // A backup start in his log would have dragged the board's average; the read does not see it.
    const zeros = { ...pf, data: { ...pf.data, players: pf.data.players.map((p) => (p.name === 'Matthew Stafford' ? { ...p, games: [...p.games, { ...p.games[0], date: '2026-10-02', passAtt: 0, passYds: 0, passCmp: 0 }] } : p)) } };
    const b2 = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [], pf: zeros, results: {} });
    expect(Object.values(b2.projections.rows).find((r) => r.player === 'Matthew Stafford').yards.pass_yds.proj).toBe(y.proj);
  });
});

describe('NFL projections: the two engines (2026-11-03)', () => {
  test('the touchdown engine: more red-zone looks and more team points lift the chance; the board\'s order holds', () => {
    expect(tdEngine(0.3, 3, 22)).toBeGreaterThan(tdEngine(0.3, 0, 22));
    expect(tdEngine(0.3, 1, 28)).toBeGreaterThan(tdEngine(0.3, 1, 18));
    expect(tdEngine(0.4, 1, 22)).toBeGreaterThan(tdEngine(0.3, 1, 22));
    expect(tdEngine(null, 1, 22)).toBeNull();
    expect(tdEngine(0.3, 1, null)).toBeCloseTo(tdEngine(0.3, 1, TD_ENGINE.points), 6);
  });
  test('red-zone looks: his last five games with a touch, before the game', () => {
    const g = (date, rzAtt, rzTgt, rushAtt = 10, tgt = 3) => ({ date, rzAtt, rzTgt, rushAtt, tgt });
    const logs = [g('2026-10-26', 4, 1), g('2026-10-19', 2, 0), g('2026-10-12', 0, 0, 0, 0), g('2026-10-05', 3, 1), g('2026-09-28', 1, 1), g('2026-09-21', 2, 2), g('2026-09-14', 9, 9)];
    expect(rzLooksOf(logs)).toBeCloseTo((5 + 2 + 4 + 2 + 4) / 5, 6);   // the game without a touch left out, the sixth oldest too
    expect(rzLooksOf([g('2026-11-02', 9, 9), ...logs], '2026-11-02T18:00Z')).toBeCloseTo(rzLooksOf(logs), 6);
    expect(rzLooksOf([])).toBe(0);
  });
  test('the big games read the projection before the shrink', () => {
    const b = build();
    const r = Object.values(b.projections.rows).find((x) => x.player === 'Puka Nacua');
    const y = r.yards.rec_yds;
    expect(r.big.rec_yds.proj).toBe(y.proj);
    expect(r.big.rec_yds.p[100]).toBe(bigChance(y, 'rec_yds', 100, { points: impliedPoints(GAMES[0].odds, 'LAR'), total: 47.5, tgtShare: r.big.rec_yds.ctx.tgtShare }));
    // the shrink moves no big-game chance: the read without it gives the same figure
    expect(bigChance(y, 'rec_yds', 100, { tgtShare: 0.3 })).toBe(bigChance({ ...y, proj: y.unshrunk + 40 }, 'rec_yds', 100, { tgtShare: 0.3 }));
  });
});

describe('NFL projections: PropFinder\'s Team Share on the receiving read (2026-11-08)', () => {
  const g = (date, tgtShare, tgt = 6, rushAtt = 0) => ({ date, tgtShare, tgt, rushAtt, rec: tgt ? 4 : 0 });
  test('his target share: his last five games with a touch before the game, rows without the share left out', () => {
    const logs = [g('2026-10-26', 0.3), g('2026-10-19', 0.2), g('2026-10-12', 0.9, 0), g('2026-10-05', null), g('2026-09-28', 0.25), g('2026-09-21', 0.15), g('2026-09-14', 0.5)];
    // the game without a touch is off; the five newest with one are 10-26, 10-19, 10-05 (no share), 09-28, 09-21
    expect(tgtShareRead(logs)).toBeCloseTo((0.3 + 0.2 + 0.25 + 0.15) / 4, 3);
    expect(tgtShareRead([g('2026-11-02', 0.9), ...logs], '2026-11-02T18:00Z')).toBe(tgtShareRead(logs));
    expect(tgtShareRead([g('2026-10-26', null)])).toBeNull();
    expect(tgtShareRead([])).toBeNull();
  });
  test('the read: c + b × the board\'s + w × the share, receivers, tight ends and backs from the fit\'s floor', () => {
    const k = TGT_SHARE.rec_yds;
    expect(shareRead('rec_yds', 'WR', 60, 0.25).proj).toBeCloseTo(k.c + k.b * 60 + k.share * 0.25, 6);
    // a bigger share reads up at the same board figure; the same share keeps the board's order
    expect(shareRead('rec_yds', 'WR', 60, 0.3).proj).toBeGreaterThan(shareRead('rec_yds', 'WR', 60, 0.2).proj);
    expect(shareRead('rec_yds', 'TE', 70, 0.2).proj).toBeGreaterThan(shareRead('rec_yds', 'TE', 50, 0.2).proj);
    expect(shareRead('receptions', 'RB', 3, 0.1).proj).toBeCloseTo(TGT_SHARE.receptions.c + TGT_SHARE.receptions.b * 3 + TGT_SHARE.receptions.share * 0.1, 6);
    expect(shareRead('rec_yds', 'QB', 60, 0.2)).toBeNull();
    expect(shareRead('rush_yds', 'RB', 60, 0.2)).toBeNull();
    expect(shareRead('rec_yds', 'WR', 9, 0.2)).toBeNull();      // under the lists' floor: the board's read
    expect(shareRead('rec_yds', 'WR', 60, null)).toBeNull();    // no share in his logs: the board's read
  });
  test('on the board: the share moves a receiver\'s yards and receptions, the board\'s read rides along', () => {
    const share = (x) => ({ ...x, data: { ...x.data, players: x.data.players.map((p) => (p.name === 'Puka Nacua' ? { ...p, games: p.games.map((r) => ({ ...r, tgtShare: 0.34 })) } : p)) } });
    const plain = Object.values(build().projections.rows).find((x) => x.player === 'Puka Nacua');
    const b = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [], pf: share(pf), results: {} });
    const r = Object.values(b.projections.rows).find((x) => x.player === 'Puka Nacua');
    const y = r.yards.rec_yds;
    expect(plain.yards.rec_yds.tgtShare).toBeNull();
    expect(y.board).toBe(plain.yards.rec_yds.proj);
    expect(y.tgtShare).toBe(0.34);
    expect(y.proj).toBeCloseTo(TGT_SHARE.rec_yds.c + TGT_SHARE.rec_yds.b * y.board + TGT_SHARE.rec_yds.share * 0.34, 0);
    expect(r.yards.receptions.tgtShare).toBe(0.34);
    // the ladder and the floor / ceiling read the new figure
    expect(y.tiers.strong.mark).toBe(ladderTiers({ proj: y.proj, sd: y.sd }, 'rec_yds').strong.mark);
    expect(shareText(y)).toMatch(/^34% of his team's targets over his last 5 games/);
    // the big games still read the projection before the shrink and the share
    expect(r.big.rec_yds.p[100]).toBe(plain.big.rec_yds.p[100]);
    // a quarterback and a back's rushing take no share
    const s = Object.values(b.projections.rows).find((x) => x.player === 'Matthew Stafford');
    expect(s.yards.pass_yds.tgtShare ?? null).toBeNull();
  });
});

describe('NFL projections: the rungs on a curve of their own (2026-11-08, the pick rules)', () => {
  test('a back\'s receiving and a back\'s and a quarterback\'s rushing read their own curve; everyone else the pool\'s', () => {
    expect(residFor('rec_yds', 'RB').rec_yds).toBe(RESID_POS.rec_yds.RB);
    expect(residFor('rush_yds', 'QB').rush_yds).toBe(RESID_POS.rush_yds.QB);
    expect(residFor('rush_yds', 'RB').rush_yds).toBe(RESID_POS.rush_yds.RB);
    expect(residFor('rec_yds', 'WR')).toBe(RESID);
    expect(residFor('rec_yds', 'TE')).toBe(RESID);
    expect(residFor('receptions', 'RB')).toBe(RESID);
    // the other markets ride along untouched
    expect(residFor('rec_yds', 'RB').rush_yds).toBe(RESID.rush_yds);
    for (const q of [RESID_POS.rec_yds.RB, RESID_POS.rush_yds.RB, RESID_POS.rush_yds.QB]) {
      expect(q).toHaveLength(19);
      expect([...q].sort((a, b) => a - b)).toEqual(q);
    }
  });
  test('a back\'s receiving rung sits lower than a receiver\'s at the same read (his curve lands under the pool\'s)', () => {
    const y = { proj: 40, sd: 22 };
    expect(chanceAtMark(y, 40, 'rec_yds', residFor('rec_yds', 'RB'))).toBeLessThan(chanceAtMark(y, 40, 'rec_yds'));
    expect(ladderTiers(y, 'rec_yds', residFor('rec_yds', 'RB')).strong.mark).toBeLessThanOrEqual(ladderTiers(y, 'rec_yds').strong.mark);
  });
  test('on the board: the backs\' and the quarterback\'s rushing rungs and range read their curves', () => {
    const b = build();
    const k = Object.values(b.projections.rows).find((x) => x.player === 'Kyren Williams').yards.rush_yds;
    expect(k.tiers).toEqual(ladderTiers({ proj: k.proj, sd: k.sd }, 'rush_yds', residFor('rush_yds', 'RB')));
    expect(k.floor).toBe(Math.round(Math.max(0, k.proj - RANGE_POS.rush_yds.RB[0] * k.sd)));
    expect(k.ceiling).toBe(Math.round(k.proj + RANGE_POS.rush_yds.RB[1] * k.sd));
    const s = Object.values(b.projections.rows).find((x) => x.player === 'Matthew Stafford').yards.rush_yds;
    if (s) expect(s.tiers).toEqual(ladderTiers({ proj: s.proj, sd: s.sd }, 'rush_yds', residFor('rush_yds', 'QB')));
    const n = Object.values(b.projections.rows).find((x) => x.player === 'Puka Nacua').yards.rec_yds;
    expect(n.tiers).toEqual(ladderTiers({ proj: n.proj, sd: n.sd }, 'rec_yds'));
  });
});

describe('NFL board: no injury hand-over (2026-11-03)', () => {
  test('a teammate out moves no read on the NFL; the old cocktail would have', () => {
    expect(COCKTAIL).toEqual(expect.objectContaining({ vacatedShare: 0, withoutSplit: false }));
    const proj = (b) => Object.values(b.projections.rows).find((r) => r.player === 'Zach Charbonnet').yards.rush_yds.proj;
    const shipped = build();
    const old = makeBuild(nflBoard({ ...COCKTAIL, vacatedShare: 0.6, withoutSplit: true }))({ season: 2026, week: 9, games: GAMES, sheets: [], pf, results: {} });
    const side = shipped.games.find((g) => g.id === 'g1').sides.SEA.players.find((p) => p.player === 'Zach Charbonnet');
    expect(side.own.rushYds.lift ?? 0).toBe(0);
    expect(side.own.rushYds.without ?? null).toBeNull();
    expect(proj(old)).toBeGreaterThan(proj(shipped));
  });
});

describe('NFL board: PropFinder\'s roster status (2026-11-02)', () => {
  const withStatus = (map) => ({ ...pf, data: { ...pf.data, players: pf.data.players.map((p) => (map[p.name] ? { ...p, status: map[p.name] } : { ...p, status: 'ACT' })) } });
  test('a player off the active roster is no row, no list, no ladder', () => {
    const b = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [], pf: withStatus({ 'Puka Nacua': 'IR', 'Tyler Higbee': 'OFF_ROSTER', 'Kyren Williams': 'PRA' }), results: {} });
    const names = Object.values(b.projections.rows).map((r) => r.player);
    for (const gone of ['Puka Nacua', 'Tyler Higbee', 'Kyren Williams']) expect(names).not.toContain(gone);
    expect(names).toContain('Matthew Stafford');
    const listed = Object.values(b.projections.lists).flatMap((x) => (Array.isArray(x) ? x : Object.values(x).flat())).map((id) => b.projections.rows[id]?.player);
    expect(listed).not.toContain('Puka Nacua');
  });
  test('ACT, no status and an unknown status stay; a player the feed already has out is left as he was', () => {
    const out = applyRosterStatus(withStatus({ 'Puka Nacua': 'ACT', 'Tyler Higbee': 'IR' }));
    expect(out.data.players.map((p) => p.name)).toContain('Puka Nacua');
    expect(out.data.players.map((p) => p.name)).not.toContain('Tyler Higbee');
    expect(out.data.rosterStatus).toEqual({ dropped: 1, by: { IR: 1 } });
    expect(applyRosterStatus(pf)).toBe(pf);
    const walker = applyRosterStatus(withStatus({ 'Kenneth Walker': 'IR' })).data.players.find((p) => p.name === 'Kenneth Walker');
    expect(walker.injury).toBe('Out');
    expect(Object.keys(ROSTER_OFF)).toEqual(expect.arrayContaining(['IR', 'IRD', 'PUP', 'OFF_ROSTER', 'PRA', 'SUS']));
  });
});

describe('NFL projections: the quarterback\'s rushing read (2026-11-02)', () => {
  const g = (date, rushYds, passAtt = 30) => ({ date, rushYds, passAtt });
  test('his starts, pulled toward the league; a relief game or a week on the bench is no start', () => {
    const starts = Array.from({ length: 12 }, (_, i) => g(`2026-10-${String(28 - i * 2).padStart(2, '0')}`, 40));
    const r = qbRushRead(starts);
    expect(r.n).toBe(12);
    expect(r.proj).toBeCloseTo((12 * 40 + QB_RUSH.K * QB_RUSH.league) / (12 + QB_RUSH.K), 1);
    expect(qbRushRead([...starts, g('2026-10-29', 0, 0), g('2026-10-03', 30, 3)]).proj).toBe(r.proj);
    expect(qbRushRead([g('2026-10-28', 0, 0)])).toBeNull();
  });
  test('the board: the starter\'s rushing reads it', () => {
    const b = build();
    const y = Object.values(b.projections.rows).find((r) => r.player === 'Matthew Stafford').yards.rush_yds;
    const want = qbRushRead(pf.data.players.find((p) => p.name === 'Matthew Stafford').games, { before: GAMES[0].date });
    expect(y.proj).toBe(want.proj);
    expect(y.qbRush.n).toBe(10);
  });
});

describe('NFL projections: the big games (2026-11-01)', () => {
  test('the chance rises with the board’s own chance and with the context each model reads', () => {
    const y = { proj: 85, sd: 35 };
    const lo = bigChance(y, 'rush_yds', 100, { points: 18 });
    const hi = bigChance(y, 'rush_yds', 100, { points: 30 });
    expect(hi).toBeGreaterThan(lo);
    expect(bigChance({ proj: 95, sd: 35 }, 'rush_yds', 100, { points: 24 })).toBeGreaterThan(bigChance(y, 'rush_yds', 100, { points: 24 }));
    expect(bigChance(y, 'rush_yds', 150, { points: 24 })).toBeLessThan(bigChance(y, 'rush_yds', 100, { points: 24 }));
    expect(bigChance({ proj: 70, sd: 30 }, 'rec_yds', 100, { tgtShare: 0.3 })).toBeGreaterThan(bigChance({ proj: 70, sd: 30 }, 'rec_yds', 100, { tgtShare: 0.15 }));
    // Passing reads the ladder's own chance: the passing read (PASS) has the total in the projection already.
    expect(bigChance({ proj: 250, sd: 70 }, 'pass_yds', 300, { total: 52 })).toBe(bigChance({ proj: 250, sd: 70 }, 'pass_yds', 300, { total: 40 }));
    expect(bigChance({ proj: 250, sd: 70 }, 'pass_yds', 300, {})).toBe(chanceAtMark({ proj: 250, sd: 70 }, 300, 'pass_yds'));
    // Under the market's projection floor, no read; a missing context reads the league's usual.
    expect(bigChance({ proj: 10, sd: 10 }, 'rush_yds', 100, {})).toBeNull();
    expect(bigChance(y, 'rush_yds', 100, {})).toBe(bigChance(y, 'rush_yds', 100, { points: BIG_FILL.points }));
    expect(Object.keys(BIG)).toEqual(['rush_yds', 'rec_yds', 'pass_yds']);
  });
  test('the rows carry it, the list ranks it, the tab draws it', () => {
    const b = build();
    const pj = b.projections;
    const k = Object.values(pj.rows).find((r) => r.player === 'Kyren Williams');
    expect(k.big.rush_yds).toMatchObject({ marks: [100, 150], ctx: { points: expect.any(Number) } });
    expect(k.big.rush_yds.p[100]).toBeGreaterThan(k.big.rush_yds.p[150]);
    const puka = Object.values(pj.rows).find((r) => r.player === 'Puka Nacua');
    expect(puka.big.rec_yds.ctx.tgtShare).toBeGreaterThan(0);
    const first = (id, m) => pj.rows[id].big[m].p[pj.rows[id].big[m].marks[0]];
    for (const m of ['rush_yds', 'rec_yds']) { const ids = pj.lists.big[m]; for (let i = 1; i < ids.length; i++) expect(first(ids[i - 1], m)).toBeGreaterThanOrEqual(first(ids[i], m)); }
    const html = renderToStaticMarkup(<NflBigGames board={b} />);
    expect(html).toContain('Kyren Williams');
    expect(html).toMatch(/team expected [\d.]+ pts/);
    expect(html).toContain('>100+<');
    expect(html).not.toMatch(/\bEV\b|edge|juice/i);
  });
});

describe('NFL outliers: double his projection (2026-11-08)', () => {
  test('the mark: double his projection and the stat’s add over it', () => {
    expect(nflOutlierMark(35, 'rec_yds')).toBe(75);       // 70 → 75 (35 + 40)
    expect(nflOutlierMark(62, 'rush_yds')).toBe(124);     // 124 > 102
    expect(nflOutlierMark(4.2, 'receptions')).toBe(9);    // 8.4 → 9
    expect(nflOutlierMark(250, 'pass_yds')).toBeNull();
  });
  test('the chance: half on his own spread, half on the spread usual for his projection; under the floor, none', () => {
    const y = { proj: 45, sd: 30 };
    const c = nflOutlierChance(y, 'rec_yds');
    expect(c.mark).toBe(90);
    expect(c.raw).toBe(chanceAtMark(y, 90, 'rec_yds'));
    const { c: k, e } = NFL_OUTLIERS.rec_yds.typical;
    expect(c.typical).toBe(chanceAtMark({ proj: 45, sd: k * 45 ** e }, 90, 'rec_yds'));
    expect(c.p).toBe(Math.round(((c.raw + c.typical) / 2) * 1000) / 1000);
    // A star's double is a long shot whatever the board's own spread says (2026-11-08: Nacua's 209+ at 8% on a flat fit).
    expect(nflOutlierChance({ proj: 104, sd: 40 }, 'rec_yds').p).toBeLessThan(0.06);
    expect(nflOutlierChance({ proj: 104, sd: 40 }, 'rec_yds').p).toBeLessThan(nflOutlierChance({ proj: 40, sd: 25 }, 'rec_yds').p);
    expect(nflOutlierChance({ proj: 10, sd: 10 }, 'rec_yds')).toBeNull();
    expect(nflOutlierChance({ proj: 45, sd: 0 }, 'rec_yds')).toBeNull();
  });
  test('the rows carry it, the list ranks it, the tab’s Outliers view draws it and sorts', () => {
    const b = build();
    const pj = b.projections;
    const puka = Object.values(pj.rows).find((r) => r.player === 'Puka Nacua');
    const o = puka.outliers.rec_yds;
    expect(o).toMatchObject({ proj: puka.yards.rec_yds.proj, floor: puka.yards.rec_yds.floor, ceiling: puka.yards.rec_yds.ceiling, mark: nflOutlierMark(puka.yards.rec_yds.proj, 'rec_yds') });
    expect(o.p).toBe(nflOutlierChance({ proj: puka.yards.rec_yds.proj, sd: puka.yards.rec_yds.sd }, 'rec_yds').p);
    expect(o.record.season.n + o.record.last.n).toBeLessThanOrEqual(17);
    for (const m of Object.keys(NFL_OUTLIERS)) { const ids = pj.lists.outliers[m]; for (let i = 1; i < ids.length; i++) expect(pj.rows[ids[i - 1]].outliers[m].p).toBeGreaterThanOrEqual(pj.rows[ids[i]].outliers[m].p); for (const id of ids) expect(pj.rows[id].outliers[m].p).toBeGreaterThanOrEqual(NFL_OUTLIER_LIST_MIN); }
    // The star's 200+ is under the list's floor; a tight end at 39 is on it.
    expect(o.p).toBeLessThan(NFL_OUTLIER_LIST_MIN);
    const top = pj.rows[pj.lists.outliers.rec_yds[0]];
    const html = renderToStaticMarkup(<NflBigGames board={b} initialView="outliers" />);
    expect(html).toContain(top.player);
    expect(html).not.toContain('Puka Nacua');
    for (const h of ['>Floor<', '>Ceiling<', '>Outlier<', '>Book<']) expect(html).toContain(h);
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain(`>${top.outliers.rec_yds.mark}+<`);
    expect(html).toContain('about double their projection');
    // The Big games view stays the default.
    expect(renderToStaticMarkup(<NflBigGames board={b} />)).toContain('>100+<');
  });
});

describe('NFL projections: the read', () => {
  const b = build();
  const pj = b.projections;
  const row = (name) => Object.values(pj.rows).find((r) => r.player === name);
  test('the spread and the total give each side its implied points', () => {
    expect(spreadOf('SEA -3')).toEqual({ team: 'SEA', pts: 3 });
    expect(spreadOf('EVEN')).toEqual({ team: null, pts: 0 });
    expect(spreadOf('')).toBeNull();
    expect(impliedPoints({ spread: 'SEA -3', total: 47.5 }, 'SEA')).toBe(25.3);
    expect(impliedPoints({ spread: 'SEA -3', total: 47.5 }, 'LAR')).toBe(22.3);
    expect(impliedPoints({ spread: null, total: 44 }, 'LAR')).toBe(22);
    expect(impliedPoints(null, 'LAR')).toBeNull();
  });
  test('the team’s touchdowns tonight: its own rate through the defense, beside the book’s implied points', () => {
    const lar = pj.games.find((g) => g.id === 'g1').teams.LAR.teamTd;
    const fromTable = Math.round(2.8 * envFactor(2.9, 2.4) * 100) / 100;
    const fromLine = Math.round(22.3 * TD_PER_POINT * 100) / 100;
    expect(lar).toMatchObject({ own: 2.8, oppAgainst: 2.9, points: 22.3, from: 'both' });
    expect(lar.fromTable).toBeCloseTo(fromTable, 2);
    expect(lar.fromLine).toBeCloseTo(fromLine, 2);
    expect(lar.tonight).toBeCloseTo((1 - LINE_WEIGHT) * fromTable + LINE_WEIGHT * fromLine, 2);
    expect(lar.factor).toBeCloseTo(lar.tonight / 2.8, 2);
    // The other game: no players in the pull, no line, its own rate alone.
    const g2 = pj.games.find((g) => g.id === 'g2').teams;
    expect(g2.DAL).toMatchObject({ teamTd: { from: 'propfinder', points: null } });
  });
  test('a player’s touchdown chance: his rate pulled toward his volume, × the team, × where the defense gives them up', () => {
    const k = row('Kyren Williams');
    const t = k.td;
    // The stated chance off λ = his rate × the team × the position, through the touchdown calibration (fitted on 2025).
    const stated = 1 - Math.exp(-(t.own * t.teamFactor * t.posShift));
    expect(t.raw).toBeCloseTo(stated, 2);
    // The board's chance through the calibration, then the touchdown engine: his red-zone looks and the team's points.
    expect(t.board).toBeCloseTo(tdCalibrated(stated, TD_CAL), 2);
    expect(t.p).toBeCloseTo(tdEngine(tdCalibrated(stated, TD_CAL), t.rz, t.points), 2);
    expect(t.rz).toBe(0);   // the fixture's rows carry no red-zone looks
    expect(t.p).toBeCloseTo(1 - Math.exp(-t.lambda), 2);
    expect(t.p1h).toBeCloseTo(1 - Math.exp(-H1_SHARE * t.lambda), 3);
    expect(t.n).toBe(10);
    expect(t.own).toBeGreaterThan(Math.min(t.rate, t.prior) - 0.001);
    expect(t.own).toBeLessThan(Math.max(t.rate, t.prior) + 0.001);
    expect(t.touches).toBeGreaterThan(18);
    // Where the defense gives its touchdowns up read nothing in the backtest: the shift is off by default (posShift 1)…
    expect(t.posShift).toBe(1);
    // …and SEA giving backs more than its overall leakiness moves them up when the clamp lets it.
    const open = reproject(b, { pf, results: {}, season: 2026 }, { ...PARAMS, POS_CLAMP: [0.7, 1.4] });
    expect(Object.values(open.rows).find((r) => r.player === 'Kyren Williams').td.posShift).toBeGreaterThan(1);
    expect(t.spot).toMatchObject({ pos: 'RB', rank: 1 });
    // The quarterback's touchdown is a rushing one: carries alone behind it.
    expect(row('Matthew Stafford').td.targets).toBe(0);
    // Positions per touch across the pull.
    expect(pj.perTouch.RB).toBeGreaterThan(0);
  });
  test('the lists: touchdowns by chance with their word, receiving and rushing by projection, the out player left off', () => {
    const rows = (key) => pj.lists[key].map((id) => pj.rows[id]);
    const td = rows('td');
    expect(td.map((r) => r.player)).not.toContain('Kenneth Walker');
    expect(td.map((r) => r.player)).not.toContain('Matthew Stafford');   // a 0% rushing touchdown is no candidate
    for (let i = 1; i < td.length; i++) expect(td[i - 1].td.p).toBeGreaterThanOrEqual(td[i].td.p);
    for (const r of td) expect(r.td.tier).toBe(tdTier(r.td.p));
    expect([tdTier(0.5), tdTier(0.45), tdTier(0.3), tdTier(0.29), tdTier(null)]).toEqual(['strong', 'strong', 'lean', 'thin', null]);
    const rec = rows('receiving');
    expect(rec[0].player).toBe('Puka Nacua');
    expect(rec.every((r) => ['WR', 'TE', 'RB'].includes(r.pos))).toBe(true);
    for (let i = 1; i < rec.length; i++) expect(rec[i - 1].yards.rec_yds.proj).toBeGreaterThanOrEqual(rec[i].yards.rec_yds.proj);
    const rush = rows('rushing').map((r) => r.player);
    expect(rush).toEqual(expect.arrayContaining(['Kyren Williams', 'Zach Charbonnet']));
    expect(rush).not.toContain('Matthew Stafford');   // 7 rushing yards projected: under the list's 10
    expect(rush).not.toContain('Kenneth Walker');
    expect(Object.values(pj.rows).every((r) => ['QB', 'RB', 'WR', 'TE'].includes(r.pos))).toBe(true);
    // No price anywhere on a row.
    expect(JSON.stringify(pj.rows)).not.toMatch(/"(ev|edge|odds|implied)"/);
  });
  test('the game script: the book’s points against the team’s usual, the spread’s lean to the run or the pass', () => {
    // Measured to move no yards projection for the better: off by default (every factor 1).
    expect(SCRIPT).toMatchObject({ volume: 0, rush: 0, pass: 0 });
    expect(scriptOf({ spread: 'SEA -3', total: 47.5 }, 'LAR', 2.8)).toMatchObject({ volume: 1, rush: 1, pass: 1, points: 22.3 });
    // With weights it reads as the first cut did. LAR: 22.3 points implied against its usual 2.8 / 0.105 = 26.7, a 3-point underdog.
    const W = { SCRIPT: { ...SCRIPT, volume: 0.5, rush: 0.012, pass: 0.008 } };
    const lar = scriptOf({ spread: 'SEA -3', total: 47.5 }, 'LAR', 2.8, W);
    expect(lar).toMatchObject({ points: 22.3, usual: 26.7, spread: -3, from: 'line' });
    expect(lar.volume).toBeCloseTo(1 + 0.5 * (22.3 / (2.8 / TD_PER_POINT) - 1), 3);
    expect(lar.rush).toBeCloseTo(1 - 3 * 0.012, 3);
    expect(lar.pass).toBeCloseTo(1 + 3 * 0.008, 3);
    expect(lar.words).toEqual(['22.3 points implied against its usual 26.7', '3-point underdog']);
    const sea = scriptOf({ spread: 'SEA -3', total: 47.5 }, 'SEA', 2.5, W);
    expect(sea.rush).toBeGreaterThan(1);
    expect(sea.pass).toBeLessThan(1);
    expect(scriptOf(null, 'LAR', 2.8)).toMatchObject({ volume: 1, rush: 1, pass: 1, from: null });
    expect(scriptOf({ spread: 'LAR -40', total: 90 }, 'LAR', 1, W)).toMatchObject({ volume: 1.15, rush: 1.1, pass: 0.9 });
    expect(scriptFactor(lar, 'rush_yds')).toBeCloseTo(lar.volume * lar.rush, 3);
    expect(scriptFactor(lar, 'rec_yds')).toBeCloseTo(lar.volume * lar.pass, 3);
    expect(scriptFactor(null, 'rec_yds')).toBe(1);
  });
  test('the yards: tonight’s projection = (skill × matchup × script) shrunk, a floor and a ceiling around it', () => {
    const r = row('Puka Nacua');
    const y = r.yards.rec_yds;
    const side = b.games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua');
    const script = pj.games.find((g) => g.id === 'g1').teams.LAR.script;
    expect(y.exp).toBe(side.ranges.rec_yds.exp);
    expect(y.script).toBeCloseTo(scriptFactor(script, 'rec_yds'), 3);
    expect(y.unshrunk).toBeCloseTo(y.exp * y.script, 1);
    expect(y.proj).toBeCloseTo(YARDS_SHRINK.rec_yds.c + YARDS_SHRINK.rec_yds.b * y.unshrunk, 1);
    expect(y.proj).toBeLessThan(y.unshrunk);
    const sd = side.ladders.rec_yds[0].sd * y.script;
    expect(y.floor).toBe(Math.round(Math.max(0, y.proj - RANGE.rec_yds[0] * sd)));
    expect(y.ceiling).toBe(Math.round(y.proj + RANGE.rec_yds[1] * sd));
    expect(y.floor).toBeLessThan(y.proj);
    expect(y.ceiling).toBeGreaterThan(y.proj);
    expect(y).toMatchObject({ line: 89.5, matchupFrom: expect.any(String) });
    // The script carries no weight by default; with the first cut's weights the underdog's receiving goes up, its rushing down.
    expect(y.script).toBe(1);
    const W = reproject(b, { pf, results: {}, season: 2026 }, { ...PARAMS, SCRIPT: { ...SCRIPT, volume: 0.5, rush: 0.012, pass: 0.008 } });
    const wr = (name) => Object.values(W.rows).find((x) => x.player === name);
    expect(wr('Puka Nacua').yards.rec_yds.script).toBeGreaterThan(wr('Kyren Williams').yards.rush_yds.script);
    // Receptions read the same way, to a tenth.
    const c = r.yards.receptions;
    expect(c.floor).toBeLessThanOrEqual(c.proj);
    expect(c.ceiling).toBeGreaterThanOrEqual(c.proj);
    expect(markOf(99.5)).toBe('100+');
  });
  test('per game: the same three lists for the game’s two teams', () => {
    const g = pj.games.find((x) => x.id === 'g1');
    expect(g.lists.td.map((id) => pj.rows[id].team)).toEqual(expect.arrayContaining(['LAR', 'SEA']));
    expect(g.lists.receiving.map((id) => pj.rows[id].player)[0]).toBe('Puka Nacua');
    expect(g.lists.rushing.map((id) => pj.rows[id].player)).toEqual(['Kyren Williams', 'Zach Charbonnet', 'Blake Corum']);
    expect(pj.games.find((x) => x.id === 'g2').lists).toEqual({ td: [], receiving: [], rushing: [], passing: [], big: { rush_yds: [], rec_yds: [], pass_yds: [] }, outliers: { rec_yds: [], rush_yds: [], receptions: [] } });
  });
  test('the words beside a name', () => {
    expect(row('Blake Corum').role).toEqual([expect.objectContaining({ kind: 'active', word: 'if active' })]);
    // No hand-over on the NFL (2026-11-03): the regular out at his group is a word, the projection reads his own games.
    expect(row('Zach Charbonnet').role).toEqual([expect.objectContaining({ kind: 'role', word: 'if role confirmed', why: expect.stringMatching(/Walker out: his role may grow; the projection reads his own last games/) })]);
    expect(row('Kyren Williams').role).toEqual([]);
    expect(roleOf({ health: 'In', own: { rushAtt: { lift: 3.2, liftFrom: ['Josh Jacobs'] } } }, ['rushAtt'])).toEqual([{ kind: 'role', word: 'if role confirmed', why: 'Jacobs out: the production left behind lifts his rate (+3.2 rushAtt a game)' }]);
  });
  test('a stored game grades the touchdowns, the first half and the yards', () => {
    const results = { g1: { id: 'g1', final: true, players: [
      { name: 'Kyren Williams', team: 'LAR', ...base, rushYds: 102, rushTd: 1, td: 1, firstTd: 0, h1RushTd: 1, h1RecTd: 0 },
      { name: 'Puka Nacua', team: 'LAR', ...base, recYds: 131, recTd: 1, td: 1, firstTd: 1, h1RushTd: 0, h1RecTd: 0 },
      { name: 'Matthew Stafford', team: 'LAR', ...base, passYds: 210, passTd: 2, rushYds: 11 },
    ] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 20, detail: 'Final' }, GAMES[1]];
    const p2 = build(results, games).projections;
    const r = (name) => Object.values(p2.rows).find((x) => x.player === name);
    expect(r('Kyren Williams').td).toMatchObject({ actual: 1, actual1h: 1 });
    expect(r('Puka Nacua').td).toMatchObject({ actual: 1, actual1h: 0 });
    expect(r('Puka Nacua').yards.rec_yds.actual).toBe(131);
    const y = r('Puka Nacua').yards.rec_yds;
    expect(y.grade).toBe(131 > y.ceiling ? 'over' : 131 < y.floor ? 'under' : 'inside');
    expect(r('Tyler Higbee').td.actual).toBeNull();   // no box-score line: did not play
  });
});

describe('NFL projections: one quarterback a team, the starter on ESPN’s depth chart (2026-11-01)', () => {
  // Vincent: "Lamar Jackson is the QB, why am I seeing Tyler Huntley?" — the backup had three starts in his logs.
  const backup = player('p8', 'Jimmy Garoppolo', 'LAR', 'QB', logs((i) => ({ passAtt: 34, passCmp: 23, passYds: 290 + (i % 4) * 10, passTd: 2, rushAtt: 1, rushYds: 2 }), dates.map((_, i) => `lar-b${i}`)), []);
  const depth = { LAR: { qb: [{ id: '12483', name: 'Matthew Stafford' }, { id: '2969939', name: 'Jimmy Garoppolo' }] } };
  const buildWith = (extra) => buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [], pf: { ...pf, data: { ...pf.data, players: [...pf.data.players, backup] }, ...extra }, results: {} }).projections;
  const rowIn = (pj, name) => Object.values(pj.rows).find((x) => x.player === name);
  test('the starter alone is on the lists, labelled QB1; the backup keeps his row (the search) as QB2 and backup', () => {
    const pj = buildWith({ espnDepth: depth });
    expect(rowIn(pj, 'Matthew Stafford')).toMatchObject({ slot: 'QB', depth: 1 });
    expect(rowIn(pj, 'Matthew Stafford').backup).toBeUndefined();
    expect(rowIn(pj, 'Jimmy Garoppolo')).toMatchObject({ slot: 'QB', depth: 2, backup: true });
    const listed = (ids) => ids.map((id) => pj.rows[id].player);
    expect(listed(pj.lists.passing)).toEqual(['Matthew Stafford']);
    for (const k of ['td', 'receiving', 'rushing']) expect(listed(pj.lists[k])).not.toContain('Jimmy Garoppolo');
    for (const m of Object.keys(pj.lists.big)) expect(listed(pj.lists.big[m])).not.toContain('Jimmy Garoppolo');
  });
  test('without a chart both stand as before', () => {
    const pj = buildWith({});
    expect(pj.lists.passing.map((id) => pj.rows[id].player)).toEqual(expect.arrayContaining(['Matthew Stafford', 'Jimmy Garoppolo']));
  });
  test('the starter out: the next on the chart starts', () => {
    const rows = [{ id: 'a', pos: 'QB', player: 'Tyler Huntley' }, { id: 'b', pos: 'QB', player: 'Joe Fagnano' }];
    const chart = [{ id: '1', name: 'Lamar Jackson' }, { id: '2', name: 'Tyler Huntley' }, { id: '3', name: 'Joe Fagnano' }];
    expect(markQuarterbacks(rows, chart, rows)).toBe('a');
    expect(rows[1]).toMatchObject({ backup: true, depth: 3 });
  });
  test('a starter who plays without a row (no log yet) still makes the rows backups', () => {
    const rows = [{ id: 'a', pos: 'QB', player: 'Tyler Huntley' }];
    const chart = [{ id: '1', name: 'Lamar Jackson' }, { id: '2', name: 'Tyler Huntley' }];
    expect(markQuarterbacks(rows, chart, [{ player: 'Lamar Jackson' }, { player: 'Tyler Huntley' }])).toBeNull();
    expect(rows[0]).toMatchObject({ backup: true, depth: 2 });
  });
  test('names match across feeds', () => {
    expect(normPlayer('Odell Beckham Jr.')).toBe('odell beckham');
    expect(normPlayer('Amon-Ra St. Brown')).toBe('amon ra st brown');
  });
});

describe('NFL projections: the role word reads an absence at his own position group', () => {
  const posOf = (n) => ({ 'Elijah Sarratt': 'WR', 'Derrick Henry': 'RB' })[n] || null;
  test('a receiver out moves no quarterback’s or back’s word, a receiver’s yes', () => {
    const sp = (pos) => ({ pos, health: 'In', without: { names: ['Elijah Sarratt'], n: 2, weight: 0.33 } });
    expect(roleOf(sp('QB'), [], posOf)).toEqual([]);
    expect(roleOf(sp('RB'), [], posOf)).toEqual([]);
    expect(roleOf(sp('TE'), [], posOf)).toEqual([expect.objectContaining({ kind: 'role' })]);
  });
  test('a lift from another group is no word, from his own it is', () => {
    expect(roleOf({ pos: 'WR', own: { tgt: { lift: 1.1, liftFrom: ['Derrick Henry'] } } }, ['tgt'], posOf)).toEqual([]);
    expect(roleOf({ pos: 'RB', own: { rushAtt: { lift: 3, liftFrom: ['Derrick Henry'] } } }, ['rushAtt'], posOf)).toEqual([expect.objectContaining({ why: expect.stringMatching(/^Henry out/) })]);
  });
});

describe('NFL projections: the cheat sheet’s defense snapshot', () => {
  // SEA's defense as page 1 of the detailed sheet prints it, in LAR's column (for evaluating LAR's offense).
  const snapshot = { of: 'SEA', ranks: { passYds: 31, rushYds: 22, rushYpp: 25, short: { l: 22, m: 30, r: 31 }, long: { l: 27, m: 21, r: 26 } }, coverage: { man: 11.1, zone: 88.9, c3: 33.3 }, tiles: 9 };
  const sheets = [{ id: 's1', fileName: 'NFL_2026_W9_detailed.pdf', at: '2026-10-31T12:00:00Z', rows: [], meta: { defense: { LAR: snapshot } } }];
  const b = buildBoard({ season: 2026, week: 9, games: GAMES, sheets, pf, results: {} });
  test('the tiles sit beside PropFinder’s cells and move the yards projections', () => {
    const allowed = b.games[0].sides.LAR.allowed;
    expect(allowed.rows.WR.recYds).toMatchObject({ rank: 1, sheet: 2 });
    expect(allowed.rows.QB.passYds).toMatchObject({ rank: 1, sheet: 2 });
    const nacua = b.games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua');
    expect(nacua.ranges.rec_yds.matchupFrom).toMatchObject({ from: 'blend' });
    // A tile that disagrees with PropFinder moves the figure: SEA printed #2 against the pass (the stingiest but one).
    const plain = build().games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua');
    const stingy = { ...snapshot, ranks: { ...snapshot.ranks, passYds: 2, short: { l: 2, m: 2, r: 2 }, long: { l: 2, m: 2, r: 2 } } };
    const b2 = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [{ ...sheets[0], meta: { defense: { LAR: stingy } } }], pf, results: {} });
    const tight = b2.games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua');
    expect(b2.games[0].sides.LAR.allowed.rows.WR.recYds).toMatchObject({ rank: 1, sheet: 31 });
    expect(tight.ranges.rec_yds.exp).toBeLessThan(plain.ranges.rec_yds.exp);
    expect(b2.sheetDefense.teams.SEA.strong[0]).toMatchObject({ word: 'the pass', rank: 31 });
  });
  test('the defense’s weak spots and the players they open up, per side and on the board', () => {
    expect(b.sheetDefense.teams.SEA.weak[0]).toEqual({ key: 'passYds', word: 'the pass', rank: 2 });
    const lar = b.projections.games.find((g) => g.id === 'g1').teams.LAR;
    expect(lar.defense).toMatchObject({ of: 'SEA', style: ['zone-heavy (88.9% zone)', 'Cover 3 33.3%'] });
    const who = (key) => lar.defense.attack.find((w) => w.key === key)?.ids.map((id) => b.projections.rows[id].player);
    expect(who('passYds')).toEqual(['Matthew Stafford']);
    expect(who('shortR')).toEqual(expect.arrayContaining(['Puka Nacua']));
    expect(who('shortM')).toEqual(['Tyler Higbee']);
    expect(b.projections.sheetDirection).toMatchObject({ convention: 'fewest', from: 'default' });
    // LAR has no snapshot: SEA's side reads LAR's defense off PropFinder's table (no weak third among three teams, its TE strong).
    expect(b.projections.games.find((g) => g.id === 'g1').teams.SEA.defense).toMatchObject({ of: 'LAR', from: 'propfinder', weak: [], strong: [{ key: 'recTE', rank: 3 }] });
    const html = renderToStaticMarkup(<NflMatchups board={b} openFirst />);
    expect(html).toContain('SEA defense</b> gives up the most to the pass (#2), short right (#2), short middle (#3)');
  });
});

describe('NFL projections: the weak spots without a cheat sheet (PropFinder’s table)', () => {
  // Vincent, 2026-11-04: "I will not get the cheat sheet anymore". SEA gives up the most of the three teams everywhere.
  const b = build();
  test('pfSpots: the pass, the run, receiving by slot (the receivers as one without slot rows), in thirds', () => {
    const lar = b.projections.games.find((g) => g.id === 'g1').teams.LAR;
    expect(lar.defense).toMatchObject({ of: 'SEA', from: 'propfinder', count: 3, style: [], coverage: null });
    expect(lar.defense.weak.map((w) => [w.key, w.word, w.rank])).toEqual([['passYds', 'the pass', 1], ['rushYds', 'the run', 1], ['recTE', 'the tight end', 1], ['recWR', 'the receivers', 1]]);
    const who = (key) => lar.defense.attack.find((w) => w.key === key)?.ids.map((id) => b.projections.rows[id].player);
    expect(who('passYds')).toEqual(['Matthew Stafford']);
    expect(who('recTE')).toEqual(['Tyler Higbee']);
    expect(who('recWR')).toEqual(expect.arrayContaining(['Puka Nacua']));
    const html = renderToStaticMarkup(<NflMatchups board={b} openFirst />);
    expect(html).toContain('SEA defense</b> gives up the most to the pass (#1), the run (#1), the tight end (#1)');
    expect(html).toContain('PropFinder’s table: what SEA gives up per game at each position and slot this season, #1 = the most of 3');
  });
  test('with slot rows: the WR1, the WR2 and the slot receiver apart', () => {
    const { pfSpots } = require('../lib/nfl/projections');
    const allowed = { count: 30, rows: { QB: { passYds: { value: 250, rank: 20 } }, RB: { rushYds: { value: 90, rank: 25 }, recYds: { value: 40, rank: 3 } }, WR1: { recYds: { value: 95, rank: 2 } }, WR2: { recYds: { value: 60, rank: 15 } }, WR3: { recYds: { value: 55, rank: 9 } }, TE1: { recYds: { value: 30, rank: 28 } } } };
    const s = pfSpots(allowed);
    expect(s.weak.map((w) => [w.key, w.word, w.rank])).toEqual([['recWR1', 'the WR1', 2], ['recRB', 'passes to the backs', 3], ['recWR3', 'the slot receiver', 9]]);
    expect(s.strong.map((w) => [w.key, w.rank])).toEqual([['recTE', 28], ['rushYds', 25]]);   // the bottom third: ranks 21–30
    expect(pfSpots(null)).toBeNull();
  });
});

describe('NFL projections: the panel and the script', () => {
  const snapshot = { of: 'SEA', ranks: { passYds: 31, rushYds: 22, rushYpp: 25, short: { l: 22, m: 30, r: 31 }, long: { l: 27, m: 21, r: 26 } }, coverage: { man: 11.1, zone: 88.9, c3: 33.3 }, tiles: 9 };
  const b = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [{ id: 's1', fileName: 'NFL_2026_W9_detailed.pdf', rows: [], meta: { defense: { LAR: snapshot } } }], pf, results: {} });
  test('the panel server-renders the games with their three lists and the week lists, no price', () => {
    // The games as a sportsbook lists them: closed, the matchup, the kickoff in ET, the spread and the total a team, no price.
    const list = renderToStaticMarkup(<NflMatchups board={b} />);
    expect(list).toContain('LAR Rams @ SEA Seahawks');
    expect(list).toMatch(/Sun 4:25PM ET/);
    expect(list).toMatch(/Rams<\/span><span><\/span><span class="ir-gm-box">\+3<\/span><span class="ir-gm-box">O 47\.5/);
    expect(list).toMatch(/Seahawks<\/span><span><\/span><span class="ir-gm-box">-3<\/span><span class="ir-gm-box">U 47\.5/);
    expect(list).not.toContain('Kyren Williams');
    const html = renderToStaticMarkup(<NflMatchups board={b} openFirst />);
    for (const [, label] of KINDS) expect(html).toContain(label);
    expect(html).toContain('Kyren Williams');
    expect(html).toContain('if active');
    expect(html).toContain('if role confirmed');
    for (const col of ['Anytime', '1st half', 'First TD', '2+ TDs']) expect(html).toContain(col);
    expect(html).toContain('SEA defense</b> gives up the most to the pass (#2)');
    expect(html).not.toContain('Kenneth Walker');
    expect(html).not.toMatch(/\bEV\b|edge|juice|implied/i);
    for (const kind of ['td', 'passing', 'receiving', 'rushing']) {
      const list = renderToStaticMarkup(<NflList board={b} kind={kind} />);
      expect(list).toContain(kind === 'receiving' ? 'Puka Nacua' : kind === 'passing' ? 'Matthew Stafford' : 'Kyren Williams');
      expect(list).toContain('>Proj<');
      if (kind !== 'td') { for (const t of ['>Strong<', '>Lean<', '>Thin<']) expect(list).toContain(t); expect(list).toMatch(/\d+\+ yds<\/b><small>\d+%/); }
      else expect(list).toMatch(/ir-ml-tier is-(strong|lean|thin)/);
    }
    // The tight ends' tab (2026-11-03): the tight ends alone, the receiving ladder first, the same reads as the lists.
    const te = renderToStaticMarkup(<NflTightEnds board={b} />);
    expect(te).toContain('Tyler Higbee');
    for (const other of ['Puka Nacua', 'Kyren Williams', 'Matthew Stafford']) expect(te).not.toContain(other);
    expect(te).toContain('>Receiving Yards<');
    expect(te).toContain('>TDs<');
    for (const t of ['>Strong<', '>Lean<', '>Thin<']) expect(te).toContain(t);
    expect(te).not.toMatch(/\bEV\b|edge|juice|implied/i);
    // With MOCK_OUT=<dir> the panel is written as standalone pages (dark, light) for a screenshot at 1440 and 390.
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `boards-nfl-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NFL boards</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}${renderToStaticMarkup(<NflList board={b} kind="passing" />)}${te}${renderToStaticMarkup(<NflBigGames board={b} />)}</section></main></body></html>`);
    }
  });
  test('the script prints each game’s three lists and the week’s', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfl-pj-'));
    const file = path.join(dir, 'picks.json');
    fs.writeFileSync(file, JSON.stringify(b));
    const text = execFileSync(process.execPath, [path.resolve(__dirname, '../tools/nfl-projections.mjs'), '--file', file], { encoding: 'utf8' });
    expect(text).toMatch(/^NFL week 9, 2026/);
    expect(text).toMatch(/LAR @ SEA\n/);
    expect(text).toMatch(/SEA defense gives up the most to the pass \(#2\)/);
    for (const t of [' TDs', ' Receiving', ' Rushing', 'All TDs', 'All Receiving', 'All Rushing']) expect(text).toContain(t);
    expect(text).toMatch(/1\. Kyren Williams \(LAR\) — anytime \d+% \((strong|lean|thin)\) · 1st half \d+% · first TD \d+% · 2\+ TDs \d+%/);
    expect(text).toMatch(/Puka Nacua \(LAR @ SEA\) — strong \d+\+ yds \(\d+%\) · lean \d+\+ yds \(\d+%\)/);
    expect(text).not.toMatch(/implied|script/);
    expect(text).toMatch(/Blake Corum \(LAR\) \[DTD, if active\]/);
    expect(text).not.toContain('Kenneth Walker');
  });
});
