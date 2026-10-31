import { describe, expect, test } from '@jest/globals';
import { quantile, whereOf, reachOf, reachText, boardRead } from '../lib/picks/projection';
import { COCKTAIL_DEFAULTS } from '../lib/picks/board';
import { COCKTAIL, nbaBoard } from '../lib/nba/picks';
import { makeShuffle } from '../lib/picks/shuffle';
import { SHUFFLE_MARKETS } from '../lib/nba/markets';

// The ceiling read (lib/picks/board.js ladderOf, the cocktail's `reach`; Vincent, 2026-10-31: "look at what a player is
// capable of and then determine the ceiling … Dosunmu has a great matchup today. His line is over 3.5 rebounds but he is
// capable of getting more when the matchup is good"): in a soft matchup the ladder's centre moves from his rate × the
// matchup toward the top quarter of his nights.
const logs = (vals) => vals.map((v, i) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', reb: v, pts: 10, min: 30 }));
// Dosunmu's shape: 7 · 3 · 1 · 3 · 7 in his last five, a 4.2 mean, the top quarter of his nights well over it.
const streaky = logs([7, 3, 1, 3, 7, 4, 2, 6, 3, 5, 7, 2, 4, 3, 6, 1]);
// A steady big: 8 every night.
const steady = logs([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
const withReach = nbaBoard({ ...COCKTAIL, reach: 0.5, reachDown: 0.5, reachK: 0 });
const damped = nbaBoard({ ...COCKTAIL, reach: 0.5, reachDown: 0, reachK: 40 });
const plain = nbaBoard({ ...COCKTAIL, reach: 0, reachDown: 0 });

describe('his ceiling and the matchup', () => {
  test('quantiles and where a rank sits in the league', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(quantile([1, 3], 0.5)).toBe(2);
    expect(quantile([], 0.5)).toBeNull();
    expect(whereOf(1, 30)).toBe(1);
    expect(whereOf(30, 30)).toBe(-1);
    expect(whereOf(15.5, 30)).toBe(0);
    expect(whereOf(null, 30)).toBeNull();
  });
  test('reachOf: the cheat sheet’s tile in full, PropFinder’s rank by the games behind its table', () => {
    expect(reachOf({ value: 10.6, rank: 2 }, 30)).toMatchObject({ where: 0.931, rank: 2, from: 'propfinder', weight: null });
    // The sheets' table alone carries the tile as the rank too: the sheet's read.
    expect(reachOf({ rank: 2, sheet: 2 }, 30, { gp: null, k: 10 })).toMatchObject({ where: 0.931, from: 'sheet' });
    // Five games behind the table at k = 40: a ninth of the way.
    expect(reachOf({ value: 10.6, rank: 2 }, 30, { gp: 5, k: 40 })).toMatchObject({ where: 0.103, weight: 0.111, gp: 5 });
    // The sheet's tile says the same: in full, PropFinder's damped read beside it.
    expect(reachOf({ value: 10.6, rank: 2, sheet: 2, rankBlend: 2 }, 30, { gp: 5, k: 40 })).toMatchObject({ where: 0.931, from: 'blend' });
    // The sheet at the league's middle, PropFinder at the top on five games: the sheet leads.
    expect(reachOf({ value: 10.6, rank: 2, sheet: 15, rankBlend: 9 }, 30, { gp: 5, k: 40 }).where).toBe(0.124);
    expect(reachOf({ sheet: 1 }, 30, { gp: 5, k: 40 })).toMatchObject({ where: 1, from: 'sheet' });
    expect(reachOf(null).where).toBeNull();
    expect(reachOf({ value: 10 }).where).toBeNull();
    expect(reachOf({ rank: 3 }).where).toBeNull();   // a rank without a value and without a tile: nothing to read
  });
  test('a streaky player in the #2 matchup moves toward his ceiling; a steady one has none to move to', () => {
    const base = plain.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5, 4.5], env: 1.03 })[0];
    const rung = withReach.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5, 4.5], env: 1.03, reach: reachOf({ value: 10.6, rank: 2 }, 30) })[0];
    expect(base.proj).toBe(base.base);
    expect(base.reach.add).toBe(0);
    expect(rung.base).toBe(base.proj);
    // The top quarter of his nights: 6 against a 4 mean, × 1.5; the centre halfway (0.5 × 0.931) toward 1.5× the stated figure.
    expect(rung.reach).toMatchObject({ up: 1.5, where: 0.931, rank: 2, ceiling: Math.round(base.proj * 1.5 * 10) / 10 });
    expect(rung.reach.add).toBeCloseTo(Math.round(0.5 * 0.931 * 0.5 * base.proj * 10) / 10, 5);
    expect(rung.proj).toBeCloseTo(base.proj + rung.reach.add, 5);
    expect(rung.proj).toBeGreaterThan(base.proj);
    // The chance of clearing 3.5 rises with the centre.
    expect(rung.p).toBeGreaterThan(base.p);
    expect(rung.model).toBeGreaterThan(base.model);
    // The steady big: every night 8, no ceiling over his rate, nothing moves.
    const s = withReach.ladderOf(steady, { market: 'reb', season: 2026, lines: [7.5], env: 1, reach: reachOf({ value: 12, rank: 1 }, 30) })[0];
    expect(s.reach.up).toBe(1);
    expect(s.reach.add).toBe(0);
    expect(s.proj).toBe(s.base);
  });
  test('a tough matchup pulls toward his floor with reachDown; the middle of the league moves nothing', () => {
    const tough = withReach.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 0.97, reach: reachOf({ value: 6, rank: 29 }, 30) })[0];
    expect(tough.reach.add).toBeLessThan(0);
    expect(tough.proj).toBeLessThan(tough.base);
    expect(tough.reach.down).toBeLessThan(1);
    const noDown = nbaBoard({ ...COCKTAIL, reach: 0.5, reachDown: 0 }).ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 0.97, reach: reachOf({ value: 6, rank: 29 }, 30) })[0];
    expect(noDown.reach.add).toBe(0);
    const mid = withReach.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1, reach: reachOf({ value: 8.9, rank: 15.5 }, 30) })[0];
    expect(mid.reach.add).toBe(0);
  });
  test('damped by the games behind PropFinder’s table: a five-game table moves a ninth of the way', () => {
    const full = withReach.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1, reach: reachOf({ value: 10.6, rank: 2 }, 30) })[0];
    const five = damped.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1, reach: reachOf({ value: 10.6, rank: 2 }, 30, { gp: 5, k: 40 }) })[0];
    expect(five.reach.add).toBeLessThan(full.reach.add);
    expect(five.reach.add).toBeGreaterThan(0);
    expect(five.reach.weight).toBe(0.111);
  });
  test('the defaults carry no reach: the NFL board and the NBA cocktail without it read as before', () => {
    expect(COCKTAIL_DEFAULTS).toMatchObject({ reach: 0, reachDown: 0, reachK: 0 });
    const rung = nbaBoard({}).ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1.1, reach: reachOf({ value: 12, rank: 1 }, 30) })[0];
    expect(rung.proj).toBe(rung.base);
    expect(rung.reach.add).toBe(0);
  });
  test('in words, for the hovers', () => {
    expect(reachText({ add: 1.2, ceiling: 6.3, up: 1.43, rank: 2, count: 30, weight: 0.111, gp: 5 }, 'SG')).toBe(", +1.2 toward his ceiling of 6.3 (the top quarter of his nights runs 1.43× his rate) for the #2 of 30 matchup at SG, PropFinder's rank counted at 0.111 for the 5 games behind the table");
    expect(reachText({ add: -0.8, floorAt: 2.9, down: 0.6, rank: 28, count: 30 })).toBe(', −0.8 toward his floor of 2.9 (the bottom quarter of his nights runs 0.6× his rate) for the #28 of 30 matchup');
    expect(reachText({ add: 0 })).toBe('');
    expect(reachText(null)).toBe('');
  });
});

describe('on the board and the shuffle', () => {
  // One game, MIN at SA; SA gives up the most rebounds in the league to shooting guards after five games.
  const games = [{ id: 'g1', date: '2026-10-31T23:00Z', away: 'MIN', home: 'SA', final: false, state: 'pre' }];
  const defense = {
    teams: { SA: { SG: { gp: 5, reb: 10.6, pts: 24 }, PG: { gp: 5, reb: 8, pts: 30 } }, MIN: { SG: { gp: 5, reb: 7, pts: 20 }, PG: { gp: 5, reb: 8, pts: 22 } } },
    ranks: { SA: { SG: { reb: 2, pts: 18 }, PG: { reb: 15, pts: 7 } }, MIN: { SG: { reb: 29, pts: 25 }, PG: { reb: 15, pts: 20 } } },
    count: 30, league: { SG: { reb: 8.9, pts: 24 }, PG: { reb: 8, pts: 23 } }, season: 2026,
  };
  const player = { id: 'd1', key: 'ayo dosunmu', name: 'Ayo Dosunmu', team: 'MIN', pos: 'SG', status: 'ACT', games: streaky, props: [{ market: 'reb', line: 3.5, odds: -208, underOdds: 160, book: 'dk', books: 3, isMain: true, lines: [] }] };
  const pf = { at: '2026-10-31T12:00Z', season: 2026, data: { players: [player], defense, depth: null, injuries: { rows: [] } } };
  const build = (board) => board.buildBoard({ season: 2026, date: '2026-10-31', games, sheets: [], pf, results: {} });
  test('the side’s range carries the read and the court, the card and the list print one figure', () => {
    const b = build(nbaBoard({ ...COCKTAIL, reach: 0.5, reachK: 0 }));
    const p = b.games[0].sides.MIN.players.find((x) => x.key === 'ayo dosunmu');
    const r = p.ranges.reb;
    expect(r.reach).toMatchObject({ rank: 2, where: 0.931, up: 1.5, count: 30 });
    expect(r.reach.add).toBeGreaterThan(0);
    expect(r.exp).toBeCloseTo(r.base + r.reach.add, 5);
    expect(r.exp).toBe(p.ladders.reb[0].proj);
    // boardRead (the court's chip, the card) carries it for the hover.
    const read = boardRead(p, 'reb', b.games[0].sides.MIN.allowed, p.envPos);
    expect(read.value).toBe(r.exp);
    expect(read.reach.add).toBe(r.reach.add);
    expect(reachText(read.reach, read.pos)).toContain('toward his ceiling of');
    // Without the reach the same board reads the stated centre.
    const b0 = build(nbaBoard({ ...COCKTAIL, reach: 0 }));
    const p0 = b0.games[0].sides.MIN.players.find((x) => x.key === 'ayo dosunmu');
    expect(p0.ranges.reb.exp).toBe(r.base);
    expect(p0.ranges.reb.reach.add).toBe(0);
    // The best list's projection names the move.
    const best = b.best?.find((x) => x.key === 'ayo dosunmu' && x.market === 'reb');
    if (best) expect(best.proj).toMatchObject({ exp: r.exp, base: r.base, reach: r.reach.add });
  });
  test('the shuffle row reads the same centre and names it', () => {
    const board = nbaBoard({ ...COCKTAIL, reach: 0.5, reachK: 0 });
    const b = build(board);
    const sh = makeShuffle({ board, markets: SHUFFLE_MARKETS });
    const payload = sh.shuffleOf({ market: 'reb', board: b, pf, season: 2026, results: {} });
    const row = payload.players.find((x) => x.key === 'ayo dosunmu');
    const r = b.games[0].sides.MIN.players.find((x) => x.key === 'ayo dosunmu').ranges.reb;
    expect(row.exp).toBe(r.exp);
    expect(row.base).toBe(r.base);
    expect(row.reach.add).toBe(r.reach.add);
    expect(row.own.blend).toBe(r.rate);
  });
});

describe('the site’s cocktail', () => {
  test('reach 0.3 toward his ceiling, none toward his floor, PropFinder’s rank counted at gp / (gp + 10)', () => {
    expect(COCKTAIL).toMatchObject({ reach: 0.3, reachDown: 0, reachK: 10 });
    const site = nbaBoard();
    // Dosunmu's shape against the #2 matchup on a five-game table: a third of 0.931 of the way (0.31), × 0.3 of the half he has over his rate.
    const rung = site.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1.013, reach: reachOf({ value: 10.6, rank: 2 }, 30, { gp: 5, k: COCKTAIL.reachK }) })[0];
    expect(rung.reach.where).toBe(0.31);
    expect(rung.reach.add).toBeCloseTo(Math.round(0.3 * 0.31 * 0.5 * rung.base * 10) / 10, 5);
    expect(rung.proj).toBeGreaterThan(rung.base);
    // The cheat sheet's tile at #2 beside it: in full.
    const sheet = site.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 1.013, reach: reachOf({ value: 10.6, rank: 2, sheet: 2, rankBlend: 2 }, 30, { gp: 5, k: COCKTAIL.reachK }) })[0];
    expect(sheet.reach.add).toBeCloseTo(Math.round(0.3 * 0.931 * 0.5 * sheet.base * 10) / 10, 5);
    // A tough spot moves nothing on the site's board.
    const tough = site.ladderOf(streaky, { market: 'reb', season: 2026, lines: [3.5], env: 0.98, reach: reachOf({ value: 6, rank: 30 }, 30, { gp: 5, k: COCKTAIL.reachK }) })[0];
    expect(tough.reach.add).toBe(0);
  });
});
