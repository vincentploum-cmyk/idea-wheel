/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBoard } from '../lib/nfl/picks';
import { weekBoards, markOf, roleOf, boardFails, BOARDS } from '../lib/nfl/boards';
import { firstHalfOf } from '../lib/nfl/markets';
import NflBoards, { BoardTable } from '../components/nfl/NflBoards';

// The week's boards (Vincent, 2026-11-01) on a board built from a synthetic pull: the Top TD board, the first-half
// board read off the anytime chances (priced where the book has a line, the fair price alone where not), the three
// ladders naming the rungs worth playing, the TE board, the words beside a name, and the grading once a game is stored.

const GAMES = [
  { id: 'g1', date: '2026-11-01T21:25Z', away: 'LAR', home: 'SEA', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 4:25 PM' },
  { id: 'g2', date: '2026-11-01T18:00Z', away: 'DAL', home: 'PHI', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 1:00 PM' },
];
const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0 };
const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(30 - i * 3).padStart(2, '0')}`);
const logs = (f, ids = null) => dates.map((date, i) => ({ ...base, date, opp: 'ARI', gameId: ids ? ids[i] : `lar-${i}`, ...f(i) }));
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

describe('NFL boards: the six boards', () => {
  const b = build();
  const boards = weekBoards(b);
  test('the boards ride on the board payload in Vincent’s order', () => {
    expect(Object.keys(b.boards)).toEqual(BOARDS.map(([k]) => k));
    expect(BOARDS.map(([, t]) => t)).toEqual(['Top TD board', 'Best first-half TD board', 'Best receiving ladders', 'Best rushing ladders', 'Best passing ladders', 'TE touchdowns across the slate']);
    expect(b.boards.td.rows.map((r) => r.id)).toEqual(boards.td.rows.map((r) => r.id));
  });
  test('the Top TD board: one row a player, the best value first, the out player off it, the words beside a name', () => {
    const rows = boards.td.rows;
    expect(rows.every((r) => r.market === 'anytime_td' && r.side === 'yes')).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(rows.map((r) => r.player)).not.toContain('Kenneth Walker');
    const passing = rows.filter((r) => !r.fails);
    for (let i = 1; i < passing.length; i++) expect(passing[i - 1].ev).toBeGreaterThanOrEqual(passing[i].ev);
    expect(rows.findIndex((r) => r.fails) === -1 || rows.slice(rows.findIndex((r) => r.fails)).every((r) => r.fails)).toBe(true);
    const corum = rows.find((r) => r.player === 'Blake Corum');
    expect(corum.role).toEqual([expect.objectContaining({ kind: 'active', word: 'if active' })]);
    expect(corum.health).toBe('DTD');
    const charbonnet = rows.find((r) => r.player === 'Zach Charbonnet');
    expect(charbonnet.role).toEqual([expect.objectContaining({ kind: 'role', word: 'if role confirmed', why: expect.stringMatching(/Walker out: his read leans on his 2 games without him/) })]);
    const kyren = rows.find((r) => r.player === 'Kyren Williams');
    expect(kyren.role).toEqual([]);
    expect(kyren).toMatchObject({ odds: -150, spot: { pos: 'RB', rank: 1, count: 3 }, volume: { rushYds: expect.any(Number) } });
    expect(kyren.ev).toBeCloseTo(kyren.p * (100 / 150) - (1 - kyren.p), 3);
  });
  test('the first-half board: the priced row carries its value, the unpriced rows keep their place on the chance', () => {
    const rows = boards.firstHalfTd.rows;
    expect(rows.every((r) => r.market === 'first_half_td')).toBe(true);
    const kyren = rows.find((r) => r.player === 'Kyren Williams');
    expect(kyren).toMatchObject({ odds: 115, synthetic: false, derived: { from: 'anytime_td' } });
    const puka = rows.find((r) => r.player === 'Puka Nacua');
    expect(puka).toMatchObject({ synthetic: true, odds: null, ev: null, fails: null });
    expect(boardFails({ ...puka, synthetic: true }, { minChance: 0.9 })).toBe('chance');
    expect(boardFails({ ...puka, synthetic: false })).toBe('price');
    // A priced +EV row before the unpriced ones; the unpriced ones by the chance.
    const unpriced = rows.filter((r) => r.synthetic && !r.fails);
    for (let i = 1; i < unpriced.length; i++) expect(unpriced[i - 1].p).toBeGreaterThanOrEqual(unpriced[i].p);
    if (!kyren.fails) expect(rows.indexOf(kyren)).toBeLessThan(rows.indexOf(puka));
  });
  test('the ladders: the priced rungs worth playing, "100+" for o99.5, the best value ringed, quarterbacks on the rushing board', () => {
    expect(markOf(99.5)).toBe('100+');
    expect(markOf(100)).toBe('o100');
    expect(markOf(null)).toBe('—');
    const puka = boards.receiving.rows.find((r) => r.player === 'Puka Nacua');
    expect(puka).toBeTruthy();
    expect(puka.rungsPriced).toBe(5);
    expect(puka.rungs.length).toBeLessThanOrEqual(3);
    expect(puka.rungs.filter((x) => x.best)).toHaveLength(1);
    expect(puka.rungs.map((x) => x.mark)).toEqual(puka.rungs.map((x) => `${Math.ceil(x.line)}+`));
    for (let i = 1; i < puka.rungs.length; i++) expect(puka.rungs[i].line).toBeGreaterThan(puka.rungs[i - 1].line);
    if (!puka.fails) for (const x of puka.rungs) { expect(x.ev).toBeGreaterThanOrEqual(0.05); expect(x.odds).toBeGreaterThanOrEqual(-200); }
    expect(puka.proj).toMatchObject({ exp: expect.any(Number), floor: expect.any(Number), ceiling: expect.any(Number) });
    expect(puka.mainLine).toBe(89.5);
    expect(boards.receiving.rows.map((r) => r.player)).not.toContain('Kyren Williams');   // no receiving-yards line on him
    const stafford = boards.passing.rows.find((r) => r.player === 'Matthew Stafford');
    expect(stafford).toMatchObject({ market: 'pass_yds', mainLine: 274.5 });
    expect(boards.passing.rows.every((r) => r.pos === 'QB')).toBe(true);
    const rushing = boards.rushing.rows.map((r) => r.player);
    expect(rushing).toContain('Kyren Williams');
    expect(rushing).toContain('Matthew Stafford');
    expect(rushing).not.toContain('Kenneth Walker');
  });
  test('the TE board: the tight ends’ touchdown rows with the volume and the matchup behind each', () => {
    const rows = boards.teTd.rows;
    expect(rows.map((r) => r.player)).toEqual(['Tyler Higbee']);
    expect(rows[0]).toMatchObject({ market: 'anytime_td', pos: 'TE', odds: 240 });
    expect(rows[0].why).toMatch(/targets projected/);
    expect(rows[0].why).toMatch(/rec yds/);
    expect(rows[0].why).toMatch(/SEA #1 of 3 to TEs for TDs/);
    expect(boards.teTd.shown).toBe(3);
  });
  test('the user’s floors re-rank the boards: a stricter EV floor fails rows, "chance" sorts by the chance', () => {
    const strict = weekBoards(b, { minEv: 0.5 });
    expect(strict.td.rows.every((r) => r.fails === 'ev' || r.fails === 'juice' || r.fails === 'price')).toBe(true);
    expect(strict.td.passing).toBe(0);
    const byChance = weekBoards(b, { sort: 'chance' });
    const passing = byChance.td.rows.filter((r) => !r.fails);
    for (let i = 1; i < passing.length; i++) expect(passing[i - 1].p).toBeGreaterThanOrEqual(passing[i].p);
  });
  test('roleOf reads a game-time decision and a read leaning on a teammate out', () => {
    expect(roleOf({ health: 'In' }, 'td')).toEqual([]);
    expect(roleOf({ health: 'DTD', injury: 'Questionable', injuryDetail: 'Ankle' }, 'td')).toEqual([{ kind: 'active', word: 'if active', why: 'Questionable: Ankle — a game-time decision' }]);
    expect(roleOf({ health: 'In', own: { td: { lift: 0.3, liftFrom: ['Josh Jacobs'] } } }, 'td')).toEqual([{ kind: 'role', word: 'if role confirmed', why: 'Jacobs out: the production left behind lifts his rate (+0.3 a game)' }]);
    expect(roleOf({ health: 'In', without: { names: ['Jacobs'], n: 3, weight: 0.429 } }, 'td')[0].why).toMatch(/Jacobs out: his read leans on his 3 games without him \(43% of the way\)/);
  });
  test('the panel server-renders every board with its rows', () => {
    const html = renderToStaticMarkup(<NflBoards board={b} />);
    for (const [, title] of BOARDS) expect(html).toContain(title);
    expect(html).toContain('Kyren Williams');
    expect(html).toContain('if active');
    expect(html).toContain('if role confirmed');
    expect(html).toContain('100+');
    expect(html).toContain('no line');
    expect(html).not.toContain('Kenneth Walker');
    // With MOCK_OUT=<dir> the panel is written as standalone pages (dark, light) for a screenshot at 1440 and 390.
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    const marginal = { marginal: true };
    const mock = html.split('<section class="ir-slate ir-bd"')[0] + BOARDS.map(([key]) => renderToStaticMarkup(<BoardTable b={weekBoards(b, marginal)[key]} filters={marginal} />)).join('') + '</div>';
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `boards-nfl-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NFL boards</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${mock.replace('aria-pressed="false" title="Show the rows', 'aria-pressed="true" title="Show the rows')}</section></main></body></html>`);
    }
  });
});
