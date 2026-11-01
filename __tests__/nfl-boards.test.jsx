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
import { markOf, roleOf, spreadOf, impliedPoints, scriptOf, scriptFactor, tdTier, tdCalibrated, RANGE, SCRIPT, TD_PER_POINT, H1_SHARE, LINE_WEIGHT, TD_CAL, PARAMS } from '../lib/nfl/projections';
import { reproject } from '../lib/nfl/picks';
import { envFactor } from '../lib/picks/projection';
import { NflMatchups, NflList, KINDS } from '../components/nfl/NflBoards';

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
    expect(t.p).toBeCloseTo(tdCalibrated(stated, TD_CAL), 2);
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
  test('the yards: tonight’s projection = skill × matchup × script, a floor and a ceiling around it', () => {
    const r = row('Puka Nacua');
    const y = r.yards.rec_yds;
    const side = b.games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua');
    const script = pj.games.find((g) => g.id === 'g1').teams.LAR.script;
    expect(y.exp).toBe(side.ranges.rec_yds.exp);
    expect(y.script).toBeCloseTo(scriptFactor(script, 'rec_yds'), 3);
    expect(y.proj).toBeCloseTo(y.exp * y.script, 1);
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
    expect(pj.games.find((x) => x.id === 'g2').lists).toEqual({ td: [], receiving: [], rushing: [] });
  });
  test('the words beside a name', () => {
    expect(row('Blake Corum').role).toEqual([expect.objectContaining({ kind: 'active', word: 'if active' })]);
    expect(row('Zach Charbonnet').role).toEqual([expect.objectContaining({ kind: 'role', word: 'if role confirmed', why: expect.stringMatching(/Walker out: his read leans on his 2 games without him/) })]);
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
    expect(b.projections.games.find((g) => g.id === 'g1').teams.SEA.defense).toBeNull();
    const html = renderToStaticMarkup(<NflMatchups board={b} />);
    expect(html).toContain('SEA defense</b> gives up the most to the pass (#2), short right (#2), short middle (#3)');
  });
});

describe('NFL projections: the panel and the script', () => {
  const snapshot = { of: 'SEA', ranks: { passYds: 31, rushYds: 22, rushYpp: 25, short: { l: 22, m: 30, r: 31 }, long: { l: 27, m: 21, r: 26 } }, coverage: { man: 11.1, zone: 88.9, c3: 33.3 }, tiles: 9 };
  const b = buildBoard({ season: 2026, week: 9, games: GAMES, sheets: [{ id: 's1', fileName: 'NFL_2026_W9_detailed.pdf', rows: [], meta: { defense: { LAR: snapshot } } }], pf, results: {} });
  test('the panel server-renders the games with their three lists and the week lists, no price', () => {
    const html = renderToStaticMarkup(<NflMatchups board={b} />);
    for (const [, label] of KINDS) expect(html).toContain(label);
    expect(html).toContain('Kyren Williams');
    expect(html).toContain('if active');
    expect(html).toContain('if role confirmed');
    expect(html).toContain('TDs expected');
    expect(html).toContain('SEA defense</b> gives up the most to the pass (#2)');
    expect(html).not.toContain('Kenneth Walker');
    expect(html).not.toMatch(/\bEV\b|edge/);
    for (const kind of ['td', 'receiving', 'rushing']) {
      const list = renderToStaticMarkup(<NflList board={b} kind={kind} />);
      expect(list).toContain(kind === 'receiving' ? 'Puka Nacua' : 'Kyren Williams');
      if (kind !== 'td') { expect(list).toContain('>Floor<'); expect(list).toContain('>Projected<'); expect(list).toContain('>Ceiling<'); expect(list).toContain('the matchup'); }
      else expect(list).toMatch(/ir-ml-tier is-(strong|lean|thin)/);
    }
    // With MOCK_OUT=<dir> the panel is written as standalone pages (dark, light) for a screenshot at 1440 and 390.
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `boards-nfl-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NFL boards</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}${renderToStaticMarkup(<NflList board={b} kind="receiving" />)}</section></main></body></html>`);
    }
  });
  test('the script prints each game’s three lists and the week’s', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfl-pj-'));
    const file = path.join(dir, 'picks.json');
    fs.writeFileSync(file, JSON.stringify(b));
    const text = execFileSync(process.execPath, [path.resolve(__dirname, '../tools/nfl-projections.mjs'), '--file', file], { encoding: 'utf8' });
    expect(text).toMatch(/^NFL week 9, 2026/);
    expect(text).toMatch(/LAR @ SEA · total 47\.5 · SEA -3/);
    expect(text).toMatch(/SEA defense gives up the most to the pass \(#2\)/);
    for (const t of [' TDs', ' Receiving', ' Rushing', 'All TDs', 'All Receiving', 'All Rushing']) expect(text).toContain(t);
    expect(text).toMatch(/1\. Kyren Williams \(LAR\) — \d+% \((strong|lean|thin)\) · 1st half \d+%/);
    expect(text).toMatch(/Puka Nacua \(LAR @ SEA\) — floor \d+ · proj \d+ · ceiling \d+ yds · rec \d+ \/ [\d.]+ \/ \d+/);
    expect(text).toMatch(/LAR script: 22\.3 points implied against its usual 26\.7 · 3-point underdog/);
    expect(text).toMatch(/Blake Corum \(LAR\) \[DTD, if active\]/);
    expect(text).not.toContain('Kenneth Walker');
  });
});
