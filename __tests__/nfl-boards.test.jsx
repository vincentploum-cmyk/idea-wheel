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
import { markOf, roleOf, spreadOf, impliedPoints, marksOf, TD_PER_POINT, H1_SHARE } from '../lib/nfl/projections';
import { firstHalfOf } from '../lib/nfl/markets';
import { envFactor } from '../lib/picks/projection';
import NflBoards, { BOARDS } from '../components/nfl/NflBoards';

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
      [{ market: 'anytime_td', line: 0.5, odds: -150, isMain: true }, { market: 'first_half_td', line: 0.5, odds: 115, isMain: true }, { market: 'rush_yds', line: 79.5, odds: -110, underOdds: -110, isMain: true, lines: lines([[64.5, -220, 170], [79.5, -110, -110, true], [99.5, 170, -220], [124.5, 500, -900]]) }]),
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

describe('NFL boards: the first-half read on the board', () => {
  test('the first-half chance is derived from the anytime chance, priced by the book where it has a line, synthetic where not', () => {
    expect(firstHalfOf(0.5)).toBeCloseTo(1 - Math.sqrt(0.5), 3);
    expect(firstHalfOf(0)).toBe(0);
    expect(firstHalfOf(null)).toBeNull();
    const b = build();
    const g1 = b.games[0];
    const lar = g1.sides.LAR;
    const kyren = lar.players.find((p) => p.player === 'Kyren Williams');
    const atd = kyren.plays.find((x) => x.market === 'anytime_td');
    const half = kyren.plays.find((x) => x.market === 'first_half_td');
    expect(half).toMatchObject({ side: 'yes', line: 0.5, odds: 115, synthetic: false, derived: { from: 'anytime_td', p: atd.p, odds: -150 } });
    expect(half.p).toBeCloseTo(firstHalfOf(atd.p), 3);
    expect(half.edge).toBeCloseTo(half.p - 100 / 215, 3);
    // No first-half line on Nacua: the read stands alone, no price, no edge.
    const puka = lar.players.find((p) => p.player === 'Puka Nacua');
    const pukaHalf = puka.plays.find((x) => x.market === 'first_half_td');
    expect(pukaHalf).toMatchObject({ synthetic: true, odds: null, edge: null, ev: null, derived: { from: 'anytime_td' } });
    expect(pukaHalf.fair).toMatch(/^[+-]\d+$/);
    // A synthetic play is no table row, no count and no best bet; the priced one is a touchdowns row.
    const tdRows = g1.tables.touchdowns.rows.concat(g1.tables.touchdowns.marginal, g1.tables.touchdowns.next);
    expect(tdRows.some((r) => r.market === 'first_half_td' && r.player === 'Puka Nacua')).toBe(false);
    expect(b.best.some((x) => x.synthetic)).toBe(false);
    expect(g1.plays).toBe(lar.players.concat(g1.sides.SEA.players).filter((p) => !p.out).flatMap((p) => p.plays).filter((x) => !x.synthetic && !x.steep).length);
  });
  test('the market is graded on the scoring plays’ halves; a result stored before the field reads unknown', () => {
    const results = { g1: { id: 'g1', final: true, players: [
      { name: 'Kyren Williams', team: 'LAR', ...base, rushYds: 102, rushTd: 1, td: 1, firstTd: 0, firstHalfTd: 1 },
      { name: 'Puka Nacua', team: 'LAR', ...base, recYds: 131, recTd: 1, td: 1, firstTd: 1, firstHalfTd: 0 },
      { name: 'Matthew Stafford', team: 'LAR', ...base, passYds: 310, passTd: 2, rushYds: 11 },
    ] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 20, detail: 'Final' }, GAMES[1]];
    const b = build(results, games);
    const lar = b.games[0].sides.LAR;
    const play = (name, market) => lar.players.find((p) => p.player === name).plays.find((x) => x.market === market);
    expect(play('Kyren Williams', 'first_half_td')).toMatchObject({ actual: 1, hit: true });
    expect(play('Puka Nacua', 'first_half_td')).toMatchObject({ actual: 0, hit: false });
    expect(play('Puka Nacua', 'anytime_td')).toMatchObject({ actual: 1, hit: true });
    // A box score without the field (stored before 2026-11-01): the first-half row is not graded, the anytime one is.
    const old = { g1: { id: 'g1', final: true, players: [{ name: 'Kyren Williams', team: 'LAR', ...base, rushYds: 102, rushTd: 1, td: 1 }] } };
    const b2 = build(old, games);
    const k = b2.games[0].sides.LAR.players.find((p) => p.player === 'Kyren Williams');
    expect(k.plays.find((x) => x.market === 'first_half_td')).toMatchObject({ actual: null, hit: null });
    expect(k.plays.find((x) => x.market === 'anytime_td')).toMatchObject({ actual: 1, hit: true });
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
    expect(lar.tonight).toBeCloseTo((fromTable + fromLine) / 2, 2);
    expect(lar.factor).toBeCloseTo(lar.tonight / 2.8, 2);
    // The other game: no players in the pull, no line, its own rate alone.
    const g2 = pj.games.find((g) => g.id === 'g2').teams;
    expect(g2.DAL).toMatchObject({ passing: [], td: [], teamTd: { from: 'propfinder', points: null } });
  });
  test('a player’s touchdown chance: his rate pulled toward his volume, × the team, × where the defense gives them up', () => {
    const k = row('Kyren Williams');
    const t = k.td;
    expect(t.lambda).toBeCloseTo(t.own * t.teamFactor * t.posShift, 2);
    expect(t.p).toBeCloseTo(1 - Math.exp(-t.lambda), 3);
    expect(t.p1h).toBeCloseTo(1 - Math.exp(-H1_SHARE * t.lambda), 3);
    expect(t.n).toBe(10);
    expect(t.own).toBeGreaterThan(Math.min(t.rate, t.prior) - 0.001);
    expect(t.own).toBeLessThan(Math.max(t.rate, t.prior) + 0.001);
    expect(t.touches).toBeGreaterThan(18);
    // SEA gives backs more than its overall leakiness: the backs move up.
    expect(t.posShift).toBeGreaterThan(1);
    expect(t.spot).toMatchObject({ pos: 'RB', rank: 1 });
    // The quarterback's touchdown is a rushing one: carries alone behind it.
    expect(row('Matthew Stafford').td.targets).toBe(0);
    // Positions per touch across the pull.
    expect(pj.perTouch.RB).toBeGreaterThan(0);
  });
  test('the boards: one row a player, out players left off, the touchdown boards by chance, the yards by projection', () => {
    const rows = (key) => pj.boards[key].map((id) => pj.rows[id]);
    const td = rows('td');
    expect(td.map((r) => r.player)).not.toContain('Kenneth Walker');
    for (let i = 1; i < td.length; i++) expect(td[i - 1].td.p).toBeGreaterThanOrEqual(td[i].td.p);
    const half = rows('firstHalfTd');
    for (let i = 1; i < half.length; i++) expect(half[i - 1].td.p1h).toBeGreaterThanOrEqual(half[i].td.p1h);
    const rec = rows('receiving');
    expect(rec[0].player).toBe('Puka Nacua');
    for (let i = 1; i < rec.length; i++) expect(rec[i - 1].yards.rec_yds.exp).toBeGreaterThanOrEqual(rec[i].yards.rec_yds.exp);
    expect(rows('passing').map((r) => r.player)).toEqual(['Matthew Stafford']);
    expect(rows('rushing').map((r) => r.player)).toEqual(expect.arrayContaining(['Kyren Williams', 'Matthew Stafford', 'Zach Charbonnet']));
    expect(rows('teTd').map((r) => r.player)).toEqual(['Tyler Higbee']);
    expect(Object.values(pj.rows).every((r) => ['QB', 'RB', 'WR', 'TE'].includes(r.pos))).toBe(true);
    // No price anywhere on a row.
    expect(JSON.stringify(pj.rows)).not.toMatch(/"(ev|edge|odds|implied)"/);
  });
  test('the yards: the board’s projection, its range, the heights at 60 / 45 / 30%, the book’s line beside it', () => {
    const y = row('Puka Nacua').yards.rec_yds;
    const range = b.games[0].sides.LAR.players.find((p) => p.player === 'Puka Nacua').ranges.rec_yds;
    expect(y).toMatchObject({ exp: range.exp, floor: range.floor, ceiling: range.ceiling, line: 89.5 });
    expect(y.marks.length).toBeGreaterThan(0);
    for (const m of y.marks) expect(m.p).toBeGreaterThanOrEqual(m.at);
    for (let i = 1; i < y.marks.length; i++) expect(y.marks[i].line).toBeGreaterThan(y.marks[i - 1].line);
    expect(marksOf([{ line: 59.5, p: 0.7 }, { line: 69.5, p: 0.5 }, { line: 79.5, p: 0.31 }, { line: 89.5, p: 0.2 }]).map((m) => m.mark)).toEqual(['60+', '70+', '80+']);
    expect(marksOf([{ line: 59.5, p: 0.7 }])).toEqual([{ at: 0.6, line: 59.5, mark: '60+', p: 0.7 }]);
    expect(markOf(99.5)).toBe('100+');
    expect(markOf(100)).toBe('o100');
  });
  test('per game: each side’s passer, two runners, three receivers and four likeliest scorers', () => {
    const lar = pj.games.find((g) => g.id === 'g1').teams.LAR;
    expect(lar.passing.map((id) => pj.rows[id].player)).toEqual(['Matthew Stafford']);
    expect(lar.rushing).toHaveLength(2);
    expect(lar.receiving.map((id) => pj.rows[id].player)[0]).toBe('Puka Nacua');
    expect(lar.td).toHaveLength(4);
    const sea = pj.games.find((g) => g.id === 'g1').teams.SEA;
    expect(sea.td.map((id) => pj.rows[id].player)).toEqual(['Zach Charbonnet']);
  });
  test('the words beside a name', () => {
    expect(row('Blake Corum').role).toEqual([expect.objectContaining({ kind: 'active', word: 'if active' })]);
    expect(row('Zach Charbonnet').role).toEqual([expect.objectContaining({ kind: 'role', word: 'if role confirmed', why: expect.stringMatching(/Walker out: his read leans on his 2 games without him/) })]);
    expect(row('Kyren Williams').role).toEqual([]);
    expect(roleOf({ health: 'In', own: { rushAtt: { lift: 3.2, liftFrom: ['Josh Jacobs'] } } }, ['rushAtt'])).toEqual([{ kind: 'role', word: 'if role confirmed', why: 'Jacobs out: the production left behind lifts his rate (+3.2 rushAtt a game)' }]);
  });
  test('a stored game grades the touchdowns, the first half and the yards', () => {
    const results = { g1: { id: 'g1', final: true, players: [
      { name: 'Kyren Williams', team: 'LAR', ...base, rushYds: 102, rushTd: 1, td: 1, firstTd: 0, firstHalfTd: 1 },
      { name: 'Puka Nacua', team: 'LAR', ...base, recYds: 131, recTd: 1, td: 1, firstTd: 1, firstHalfTd: 0 },
      { name: 'Matthew Stafford', team: 'LAR', ...base, passYds: 210, passTd: 2, rushYds: 11 },
    ] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 20, detail: 'Final' }, GAMES[1]];
    const p2 = build(results, games).projections;
    const r = (name) => Object.values(p2.rows).find((x) => x.player === name);
    expect(r('Kyren Williams').td).toMatchObject({ actual: 1, actual1h: 1 });
    expect(r('Puka Nacua').td).toMatchObject({ actual: 1, actual1h: 0 });
    expect(r('Puka Nacua').yards.rec_yds.actual).toBe(131);
    expect(r('Puka Nacua').yards.rec_yds.marks.every((m) => m.hit === 131 > m.line)).toBe(true);
    expect(r('Tyler Higbee').td.actual).toBeNull();   // no box-score line: did not play
  });
});

describe('NFL projections: the panel and the script', () => {
  const b = build();
  test('the panel server-renders the six boards and the games, no price', () => {
    const html = renderToStaticMarkup(<NflBoards board={b} />);
    for (const [, title] of BOARDS) expect(html).toContain(title);
    expect(html).toContain('By game');
    expect(html).toContain('Kyren Williams');
    expect(html).toContain('if active');
    expect(html).toContain('if role confirmed');
    expect(html).toContain('TDs expected');
    expect(html).not.toContain('Kenneth Walker');
    expect(html).not.toMatch(/\bEV\b|edge/);
    // With MOCK_OUT=<dir> the panel is written as standalone pages (dark, light) for a screenshot at 1440 and 390.
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `boards-nfl-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NFL boards</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}</section></main></body></html>`);
    }
  });
  test('the script prints the boards and the games from a saved payload', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfl-pj-'));
    const file = path.join(dir, 'picks.json');
    fs.writeFileSync(file, JSON.stringify(b));
    const text = execFileSync(process.execPath, [path.resolve(__dirname, '../tools/nfl-projections.mjs'), '--file', file], { encoding: 'utf8' });
    expect(text).toMatch(/^NFL week 9, 2026/);
    for (const t of ['Top TD Board', 'Best First-Half TD Board', 'Best Receiving Projections', 'Best Rushing Projections', 'Best Passing Projections', 'TE TDs Across Slate', 'By Game']) expect(text).toContain(t);
    expect(text).toMatch(/1\. Puka Nacua \(LAR @ SEA\) — \d+ yds/);
    expect(text).toMatch(/Blake Corum \(LAR @ SEA\), if active/);
    expect(text).toMatch(/LAR @ SEA · total 47\.5 · SEA -3/);
    expect(text).not.toContain('Kenneth Walker');
  });
});
