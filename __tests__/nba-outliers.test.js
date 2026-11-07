// The outlier nights (Vincent, 2026-11-07: "a few players were projected by us to get 4 or 5 rebounds but they actually got
// 10+"; docs/audits/2026-11-07-nba-outliers.md): the counts' rungs read a count's tail, and tonight's starting five moves the
// projection of a player whose role changed.
import { describe, expect, test } from '@jest/globals';
import { countTail, countQuantile, upperTail, lineupText } from '../lib/picks/projection';
import { nbaBoard, COCKTAIL, COCKTAIL_BEFORE_OUTLIERS, OUTLIERS, LINEUP_MINUTES } from '../lib/nba/picks';
import { nbaBigChance } from '../lib/nba/big';
import { tailOf } from '../lib/picks/shuffle';

describe('the count tail', () => {
  test('the negative binomial with the centre and the spread (checked against scipy), the Poisson where the spread is narrower', () => {
    // 4.5 rebounds at a spread of 2.5: 10+ is 3.8% as a count, 2.3% off the normal.
    expect(countTail(9.5, 4.5, 2.5)).toBeCloseTo(0.037718, 5);
    expect(upperTail((9.5 - 4.5) / 2.5)).toBeCloseTo(0.02275, 4);
    // 1.8 threes at 1.3 (narrower than √1.8): the Poisson, 3+ = 26.9%.
    expect(countTail(2.5, 1.8, 1.3)).toBeCloseTo(0.269379, 5);
    expect(countTail(0.5, 1.2, 0.8)).toBeCloseTo(0.698806, 5);
    // A whole line: over 4 is 5 or more; a line under 0 is cleared; a zero centre clears nothing.
    expect(countTail(4, 3, 3)).toBeCloseTo(countTail(4.5, 3, 3), 10);
    expect(countTail(-0.5, 2, 1)).toBe(1);
    expect(countTail(3.5, 0, 1)).toBe(0);
    // It falls as the bar rises.
    const ps = [0.5, 2.5, 4.5, 6.5, 8.5, 10.5].map((l) => countTail(l, 4.5, 2.5));
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeLessThan(ps[i - 1]);
  });
  test('the quartiles: the range he lands in half the nights', () => {
    expect(countQuantile(0.25, 4.5, 2.5)).toBe(3);
    expect(countQuantile(0.75, 4.5, 2.5)).toBe(6);
    expect(countQuantile(0.5, 0, 1)).toBe(0);
  });
});

describe('the ladder and the shuffle read the count tail for the counts', () => {
  const log = (i, reb, pts) => ({ date: `2026-10-${String(30 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', min: 24, pts, reb, ast: 2, tpm: 1, stl: 1, blk: 0, tov: 1, pra: pts + reb + 2 });
  const logs = [3, 5, 4, 9, 2, 4, 6, 3, 5, 4, 11, 3].map((r, i) => log(i, r, 8 + (i % 5)));
  test('rebounds read a count, points keep the normal; the board before it read the normal everywhere', () => {
    const { ladderOf } = nbaBoard(COCKTAIL);
    const reb = ladderOf(logs, { market: 'reb', season: 2026 });
    expect(reb.every((r) => r.tail === 'count')).toBe(true);
    const r = reb[reb.length - 1];
    expect(r.model).toBeCloseTo(countTail(r.line, r.proj, r.sd), 3);
    const pts = ladderOf(logs, { market: 'pts', season: 2026 });
    expect(pts.some((x) => x.tail)).toBe(false);
    const before = nbaBoard(COCKTAIL_BEFORE_OUTLIERS).ladderOf(logs, { market: 'reb', season: 2026 });
    expect(before.some((x) => x.tail)).toBe(false);
    // The top rung: the count puts more on the big night than the normal over the same centre and spread.
    expect(r.model).toBeGreaterThan(before[before.length - 1].model);
  });
  test('the shuffle recentres the same tail', () => {
    expect(tailOf({ sd: 2.5, tail: 'count' }, 9.5, 4.5)).toBeCloseTo(countTail(9.5, 4.5, 2.5), 10);
    expect(tailOf({ sd: 2.5 }, 9.5, 4.5)).toBeCloseTo(upperTail(2), 10);
  });
  test("the big games: a mark without a model reads the board's count tail, a fitted mark keeps the normal it was fitted on", () => {
    expect(nbaBigChance(6, 3, 'reb', 15, { tail: 'count' })).toBeCloseTo(countTail(14.5, 6, 3), 3);
    expect(nbaBigChance(6, 3, 'reb', 15, {})).toBeCloseTo(upperTail((14.5 - 6) / 3), 3);
    expect(nbaBigChance(6, 3, 'reb', 12, { tail: 'count', big: { 12: 0 } })).toBe(nbaBigChance(6, 3, 'reb', 12, { big: { 12: 0 } }));
  });
  test('the site carries both reads', () => {
    expect(COCKTAIL.countTail).toEqual(['reb', 'ast', 'tpm', 'stl', 'blk']);
    expect(COCKTAIL.lineup).toEqual(LINEUP_MINUTES);
    expect(LINEUP_MINUTES.model.promoted).toBeGreaterThan(0);
  });
});

describe("tonight's starting five", () => {
  const games = [{ id: 'g1', date: '2026-11-06T23:30Z', away: 'MIN', home: 'NO', final: false, state: 'pre' }];
  // Ten games: `starts` of them started (PropFinder's sparse flag: 1 a start, absent off the bench).
  const logsOf = (starts, { flag = true } = {}) => Array.from({ length: 10 }, (_, i) => ({
    date: `2026-11-${String(5 - Math.floor(i / 2)).padStart(2, '0')}`, gameId: `x${i}`, season: 2027, type: 'REG', opp: 'DAL', min: 22, pts: 9, reb: 5, ast: 1, tpm: 1, tpa: 3, stl: 1, blk: 0, tov: 1, pra: 15,
    ...(flag ? (i < starts ? { starter: 1 } : {}) : { starter: null }),
  }));
  const player = (name, team, starts, opts) => ({ id: name, name, key: name.toLowerCase(), team, pos: 'PF', games: logsOf(starts, opts), props: [{ market: 'reb', line: 4.5, odds: 120, underOdds: -150 }] });
  const pfWith = (players) => ({ at: '2026-11-06T14:00:00Z', data: { players } });
  const five = (names) => ({ teams: { MIN: { status: 'Expected', starters: names.map((name) => ({ name })) } } });
  const sideOf = (b, key) => b.games[0].sides.MIN.players.find((p) => p.key === key);
  const build = (pf, lineups) => nbaBoard(COCKTAIL).buildBoard({ date: '2026-11-06', season: 2027, games, sheets: [], pf, results: {}, lineups });
  const players = [player('Trey Lyles', 'MIN', 1), player('Rudy Gobert', 'MIN', 10), player('Anthony Edwards', 'MIN', 10)];
  const fiveWithLyles = five(['Trey Lyles', 'Anthony Edwards', 'Mike Conley', 'Jaden McDaniels', 'Julius Randle']);

  test('off the bench and in the five tonight: his minutes with the five over his minutes without it, on every market', () => {
    const plain = build(pfWith(players), null);
    const b = build(pfWith(players), fiveWithLyles);
    const lyles = sideOf(b, 'trey lyles'); const gobert = sideOf(b, 'rudy gobert'); const ant = sideOf(b, 'anthony edwards');
    // 22 minutes every game, one start in ten, no teammate out: dec 22, split (22 + 3 · 22) / 4 = 22.
    // With the five: 1.3259 + 0.62 · 22 + 0.2333 · 22 + 2.268 + 2.6584 = 25.0; without: 0.4915 + 0.9304 · 22 = 21.0.
    expect(lyles.lineup).toMatchObject({ factor: 1.19, role: 'promoted', share: 0.1, n: 10, status: 'Expected', minutes: { tonight: 25, before: 21, dec: 22, split: 22, vac: 0 } });
    expect(lyles.minutes).toMatchObject({ tonight: 25, lineup: { tonight: 25, before: 21, role: 'promoted' } });
    expect(lyles.ranges.reb.lineup).toBe(1.19);
    expect(lyles.ranges.reb.exp).toBeCloseTo(sideOf(plain, 'trey lyles').ranges.reb.exp * 1.19, 0);
    expect(lyles.ranges.reb.exp).toBeGreaterThan(sideOf(plain, 'trey lyles').ranges.reb.exp);
    // A starter every game out of the five: 1.3259 + 0.62 · 22 + 0.2333 · 22 − 1.3018 = 18.8 against 21.0.
    expect(gobert.lineup).toMatchObject({ factor: 0.895, role: 'demoted', share: 1, minutes: { tonight: 18.8, before: 21 } });
    expect(gobert.ranges.pts.lineup).toBe(0.895);
    expect(gobert.ranges.reb.exp).toBeLessThan(sideOf(plain, 'rudy gobert').ranges.reb.exp);
    expect(ant.lineup).toMatchObject({ factor: 1, role: 'starter' });
    expect(ant.lineup.minutes).toBeUndefined();
    expect(ant.ranges.reb.lineup).toBeNull();
    // Without the minutes model (the first cut, OUTLIERS alone): the flat × 1.1 / × 0.9.
    const flat = nbaBoard({ ...COCKTAIL_BEFORE_OUTLIERS, ...OUTLIERS }).buildBoard({ date: '2026-11-06', season: 2027, games, sheets: [], pf: pfWith(players), results: {}, lineups: fiveWithLyles });
    expect(sideOf(flat, 'trey lyles').lineup).toMatchObject({ factor: 1.1, role: 'promoted' });
    expect(sideOf(flat, 'rudy gobert').lineup).toMatchObject({ factor: 0.9, role: 'demoted' });
    expect(lineupText({ lineup: 1.19, role: 'promoted', lineupStatus: 'Expected', lineupMinutes: { tonight: 25, before: 21 } })).toMatch(/starts tonight in RotoWire's expected five, off the bench in most of his last games: 25 minutes tonight against 21 without the lineup/);
    expect(lineupText({ lineup: 0.9, role: 'demoted' })).toMatch(/out of RotoWire's five/);
    expect(lineupText({ lineup: null })).toBe('');
  });
  test("the teammates out add to the minutes with the five and without it", () => {
    // A 30-minute starter out tonight (3 of the last 5 dates at 20+): his decayed minutes join `vac` on both sides.
    const out = { ...player('Julius Randle', 'MIN', 10), injury: 'Out', games: logsOf(10).map((g) => ({ ...g, min: 30 })) };
    const pf = { at: '2026-11-06T14:00:00Z', data: { players: [...players, out], injuries: { source: 'v2', rows: [{ id: 'Julius Randle', name: 'Julius Randle', key: 'julius randle', team: 'MIN', pos: 'PF', status: 'Out', date: '2026-11-06' }] } } };
    const lyles = sideOf(build(pf, fiveWithLyles), 'trey lyles');
    expect(lyles.lineup.minutes.vac).toBeCloseTo(30, 0);
    expect(lyles.lineup.minutes.tonight).toBeCloseTo(25 + 0.0425 * 30, 0);
    expect(lyles.lineup.minutes.before).toBeCloseTo(21 + 0.0558 * 30, 0);
  });
  test('no read without the five, without the flag on the pull, or with fewer than five flagged games', () => {
    expect(sideOf(build(pfWith(players), null), 'trey lyles').lineup).toBeUndefined();
    // Four names: no five.
    expect(sideOf(build(pfWith(players), five(['Trey Lyles', 'Anthony Edwards', 'Mike Conley', 'Julius Randle'])), 'trey lyles').lineup).toBeUndefined();
    // A pull whose rows never carry the flag (null on every row): nothing to read his role from.
    const unflagged = [player('Trey Lyles', 'MIN', 0, { flag: false }), player('Rudy Gobert', 'MIN', 0, { flag: false })];
    expect(sideOf(build(pfWith(unflagged), fiveWithLyles), 'trey lyles').lineup).toBeUndefined();
    // Four flagged games: too few.
    const short = { ...player('Trey Lyles', 'MIN', 1), games: logsOf(1).map((g, i) => (i < 6 ? { ...g, starter: null } : g)) };
    expect(sideOf(build(pfWith([short, players[1]]), fiveWithLyles), 'trey lyles').lineup).toBeUndefined();
    // The board before the read: no lineup on any player.
    const off = nbaBoard(COCKTAIL_BEFORE_OUTLIERS).buildBoard({ date: '2026-11-06', season: 2027, games, sheets: [], pf: pfWith(players), results: {}, lineups: fiveWithLyles });
    expect(sideOf(off, 'trey lyles').lineup).toBeUndefined();
  });
});
