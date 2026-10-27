import { describe, expect, test } from '@jest/globals';
import { NHL_BARS, READ_FROM, HEIGHTS, heightsOf, ownOf, skaterRow, lambdaOf, chanceAt, readAt, thinsAt, survivorsAt, fallenAt, curveOf } from '../lib/nhl-data/shuffle-pure';
import { poissonAtLeast, fairOdds } from '../lib/nhl-data/picks-pure';

const row = (date, sog, g) => ({ date, sog, g, icf: sog * 1.8, iscf: 1.5, toi: 17 });
// This season: eight games, 4 / 2 / 5 / 3 / 1 / 4 / 2 / 6 shots, a goal in three of them; last season: twenty games of two shots and no goals.
const cur = [[4, 0], [2, 0], [5, 1], [3, 0], [1, 0], [4, 1], [2, 0], [6, 1]].map(([s, g], i) => row(`2026-10-${String(8 + i).padStart(2, '0')}`, s, g));
const prev = Array.from({ length: 20 }, (_, i) => row(`2026-03-${String(1 + i).padStart(2, '0')}`, 2, 0));
const cand = { id: 7, name: 'David Pastrnak', team: 'BOS', opp: 'DET', venue: 'H', pos: 'RW', line: 1, lamS: 4.2, lamG: 0.55, source: 'model', study: { lamS: 3.9, p3: 0.7, p4: 0.5, p1g: 0.4 },
  oppPos: { sog: 1.9, g: 0.3, rankSog: 3, rankG: 5, teams: 32, softSog: true, softG: true }, heat: { shots: 'hot', goals: null } };

describe('the NHL shuffle', () => {
  test('two bars, shots 1 to 8 and goals 1 to 4, with their floors', () => {
    expect(NHL_BARS.map((b) => [b.market, b.start, b.floor])).toEqual([['sog', 3, 0.5], ['g', 1, 0.35]]);
    expect(heightsOf(NHL_BARS[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(HEIGHTS.g).toEqual([1, 2, 3, 4]);
    expect(READ_FROM.map(([k]) => k)).toEqual(['model', 'study', 'l5', 'l10', 'season']);
  });
  test('his own windows and how often he reached each height', () => {
    const own = ownOf(cur, prev);
    expect(own.l5).toEqual({ sog: 3.2, g: 0.4, n: 5 });        // 3, 1, 4, 2, 6
    expect(own.l10).toEqual({ sog: 3.1, g: 0.3, n: 10 });      // two of last season's 2s under the eight
    expect(own.season).toEqual({ sog: 3.38, g: 0.38, n: 8 });
    expect(own.cleared.l10).toEqual({ sog: [10, 9, 5, 4, 2, 1, 0, 0], g: [3, 0, 0, 0], n: 10 });   // the one-shot game fails 2+
    expect(own.cleared.season).toEqual({ sog: [8, 7, 5, 4, 2, 1, 0, 0], g: [3, 0, 0, 0], n: 8 });
    // Two games this season: no season window yet; the rest from last season.
    const thin = ownOf(cur.slice(0, 2), prev);
    expect(thin.season).toBeNull();
    expect(thin.l5.n).toBe(5);
    expect(ownOf([], []).l5).toBeNull();
  });
  test('a skater’s row: the board’s λ, the study’s, his windows, the matchup, the grade', () => {
    const r = skaterRow({ ...cand, actual: { sog: 5, g: 1 } }, { study: { lamS: 3.9, lamG: 0.41 }, cur, prev });
    expect(r).toMatchObject({ id: 7, name: 'David Pastrnak', pos: 'RW', line: 1, lamS: 4.2, lamG: 0.55, study: { lamS: 3.9, lamG: 0.41 }, oppPos: { rankSog: 3, teams: 32, softSog: true }, actual: { sog: 5, g: 1 } });
    expect(r.own.l5.sog).toBe(3.2);
    expect(skaterRow(cand).actual).toBeUndefined();                      // before the game
    expect(skaterRow(cand, { cur, prev }).study.lamG).toBeNull();       // the candidate's study carries no goals λ; the full projection does
  });
  test('the λ per source, and the chance as the Poisson tail of it', () => {
    const r = skaterRow(cand, { study: { lamS: 3.9, lamG: 0.41 }, cur, prev });
    expect(lambdaOf(r, 'sog', 'model')).toBe(4.2);
    expect(lambdaOf(r, 'sog', 'study')).toBe(3.9);
    expect(lambdaOf(r, 'sog', 'l5')).toBe(3.2);
    expect(lambdaOf(r, 'g', 'season')).toBe(0.38);
    expect(chanceAt(r, 'sog', 3)).toBeCloseTo(poissonAtLeast(4.2, 3), 3);
    expect(chanceAt(r, 'sog', 3, 'l5')).toBeCloseTo(poissonAtLeast(3.2, 3), 3);
    expect(chanceAt(r, 'g', 1)).toBeCloseTo(1 - Math.exp(-0.55), 3);
    // A window he does not have falls back to the board's λ.
    const young = skaterRow(cand, { cur: cur.slice(0, 2), prev: [] });
    expect(lambdaOf(young, 'sog', 'season')).toBeNull();
    expect(chanceAt(young, 'sog', 3, 'season')).toBeCloseTo(poissonAtLeast(4.2, 3), 3);
    expect(readAt(young, 'sog', 3, 'season')).toMatchObject({ from: 'model', fellBack: true });
  });
  test('the read at a height: chance, break-even, how often he reached it, the grade', () => {
    const r = skaterRow({ ...cand, actual: { sog: 5, g: 1 } }, { study: { lamS: 3.9, lamG: 0.41 }, cur, prev });
    const at4 = readAt(r, 'sog', 4);
    expect(at4).toMatchObject({ height: 4, lambda: 4.2, from: 'model', fellBack: false, cleared: { n: 4, of: 10 }, season: { n: 4, of: 8 }, got: 5, hit: true });
    expect(at4.p).toBeCloseTo(poissonAtLeast(4.2, 4), 3);
    expect(at4.fair).toBe(fairOdds(at4.p));
    expect(readAt(r, 'sog', 6)).toMatchObject({ hit: false, cleared: { n: 1, of: 10 } });
    expect(readAt(r, 'g', 2)).toMatchObject({ got: 1, hit: false, cleared: { n: 0, of: 10 } });
    const dnp = skaterRow({ ...cand, actual: null }, { cur, prev });
    expect(readAt(dnp, 'sog', 3)).toMatchObject({ got: null, hit: null });
    expect(readAt(skaterRow(cand), 'sog', 3).got).toBeUndefined();
  });
  test('survivors, the fallen and the curve at a floor', () => {
    const rows = [
      skaterRow(cand, { cur, prev }),
      skaterRow({ ...cand, id: 8, name: 'Charlie McAvoy', pos: 'D', lamS: 2.1, lamG: 0.12 }, { cur: prev.slice(0, 5), prev }),
      skaterRow({ ...cand, id: 9, name: 'Pavel Zacha', pos: 'C', lamS: 1.6, lamG: 0.25 }),
    ];
    const at3 = survivorsAt(rows, 'sog', 3, 0.5);
    expect(at3.map((x) => x.row.name)).toEqual(['David Pastrnak']);
    expect(at3[0].thins).toBe(thinsAt(rows[0], 'sog', 0.5));
    expect(at3[0].thins).toBeGreaterThanOrEqual(3);
    const at2 = survivorsAt(rows, 'sog', 2, 0.5);
    expect(at2.map((x) => x.row.name)).toEqual(['David Pastrnak', 'Charlie McAvoy']);   // the best chance first
    expect(fallenAt(rows, 'sog', 3, 0.5).map((x) => x.row.name)).toEqual(['Charlie McAvoy', 'Pavel Zacha']);
    const curve = curveOf(rows, 'sog', 0.5);
    expect(curve[0]).toEqual({ height: 1, n: 3 });
    for (let i = 1; i < curve.length; i++) expect(curve[i].n).toBeLessThanOrEqual(curve[i - 1].n);
    expect(curve[curve.length - 1].n).toBe(0);
    expect(survivorsAt(rows, 'g', 1, 0.35).map((x) => x.row.name)).toEqual(['David Pastrnak']);
    // Reading from his last five moves the field: 3.2 a game instead of the board's 4.2.
    expect(survivorsAt(rows, 'sog', 4, 0.5, 'l5')).toHaveLength(0);
    expect(survivorsAt(rows, 'sog', 4, 0.5, 'model')).toHaveLength(1);
  });
});
