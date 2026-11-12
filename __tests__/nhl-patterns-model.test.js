import MODEL from '../lib/nhl-data/patterns-model.json';
import PARITY from './fixtures/patterns-model-parity.json';
import { modelInputs, lrChance, gbChance, modelChance, modelRecord } from '../lib/nhl-data/patterns-model-pure';
import { patternTable } from '../lib/nhl-data/patterns-pure';

// A model small enough to work by hand: two figures and his position; one tree splitting on the first figure.
const TINY = {
  mark: 's3', label: '3+ SOG', builtThrough: '2026-10-02',
  feats: ['sog_avg', 'toi_avg', 'pos_D'],
  lr: { med: [2, 15, 0], mu: [2, 16, 0.3], sd: [1, 2, 0.5], coef: [1, -0.5, -2], intercept: -1 },
  gb: { baseline: -1, trees: [[[0, 2.5, 1, 1, 2], [-0.4], [0.6]]] },
};
const sig = (z) => 1 / (1 + Math.exp(-z));

describe('patterns model: the scorer', () => {
  test('the regression: median-filled, standardised, clipped', () => {
    const x = modelInputs({ gp: 5, sog_avg: 3, toi_avg: null, pos: 'C' }, TINY);
    expect(x).toEqual([3, null, 0]);
    // sog (3-2)/1 = 1; toi filled with 15 → (15-16)/2 = -0.5; pos_D (0-0.3)/0.5 = -0.6
    expect(lrChance(x, TINY.lr)).toBeCloseTo(sig(-1 + 1 + 0.25 + 1.2), 10);
    expect(lrChance([100, 16, 0], TINY.lr)).toBeCloseTo(sig(-1 + 6 + 1.2), 10);   // 98 spreads clipped to 6
  });

  test('the trees: threshold goes left at or under, a missing figure follows its side', () => {
    expect(gbChance([2.5, 0, 0], TINY.gb)).toBeCloseTo(sig(-1.4), 10);
    expect(gbChance([2.6, 0, 0], TINY.gb)).toBeCloseTo(sig(-0.4), 10);
    expect(gbChance([null, 0, 0], TINY.gb)).toBeCloseTo(sig(-1.4), 10);
  });

  test('the chance is the two averaged; nothing without a game behind him', () => {
    const f = { gp: 4, sog_avg: 3, toi_avg: 17, pos: 'D' };
    const x = modelInputs(f, TINY);
    expect(modelChance(f, TINY)).toBeCloseTo((lrChance(x, TINY.lr) + gbChance(x, TINY.gb)) / 2, 12);
    expect(modelChance({ gp: 0, sog_avg: 3 }, TINY)).toBeNull();
    expect(modelChance(f, null)).toBeNull();
  });
});

describe('patterns model: the shipped fit', () => {
  test('shape', () => {
    const n = MODEL.feats.length;
    expect(MODEL.mark).toBe('s3');
    expect(MODEL.builtThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const k of ['med', 'mu', 'sd', 'coef']) expect(MODEL.lr[k]).toHaveLength(n);
    expect(MODEL.gb.trees.length).toBeGreaterThan(50);
    for (const tree of MODEL.gb.trees) for (const node of tree) if (node.length > 1) expect(node[0]).toBeLessThan(n);
    expect(MODEL.check.calls['50'].n).toBeGreaterThan(0);
  });

  test("matches scikit-learn's own chance on real skater-games", () => {
    for (const r of PARITY.rows) expect(Math.abs(modelChance(r.f, MODEL) - r.p)).toBeLessThan(1e-4);
  });
});

describe('patterns model: on the season walk and its record', () => {
  const row = (date, gameId, playerId, team, opp, venue, sog) => ({ date, gameId, playerId, name: `P${playerId}`, team, opp, venue, pos: 'LW', line: 1, toi: 18, g: 0, a: 0, sog, hits: 0, blk: 0, icf: sog + 2, iff: sog + 1, isf: sog, iscf: 1, ihdcf: 0 });
  const rows = [
    row('2026-10-01', 1, 1, 'BOS', 'TOR', 'H', 4), row('2026-10-01', 1, 2, 'TOR', 'BOS', 'A', 1),
    row('2026-10-03', 2, 1, 'BOS', 'TOR', 'A', 3), row('2026-10-03', 2, 2, 'TOR', 'BOS', 'H', 0),
    row('2026-10-05', 3, 1, 'BOS', 'TOR', 'H', 1), row('2026-10-05', 3, 2, 'TOR', 'BOS', 'A', 2),
  ];

  test('patternTable scores the rows the hook asks for, on the full figures, before the trim', () => {
    const seen = [];
    const { rows: table } = patternTable(rows, { date: '2026-10-06', keep: new Set(['gp']), score: (f, d) => { seen.push(Object.keys(f).length); return d > '2026-10-03' ? modelChance(f, TINY) : null; } });
    expect(Math.min(...seen)).toBeGreaterThan(100);
    expect(table.filter((r) => r.m != null).map((r) => r.date)).toEqual(['2026-10-05', '2026-10-05']);
    expect(table.every((r) => Object.keys(r.f).length === 1)).toBe(true);
  });

  test('the record: the games after the fit, the calls at the bar and at 60%', () => {
    const t = [
      { date: '2026-10-02', m: 0.9, o: { y_s3: 1 } },   // inside the fit: not counted
      { date: '2026-10-05', m: 0.65, o: { y_s3: 1 } },
      { date: '2026-10-05', m: 0.55, o: { y_s3: 0 } },
      { date: '2026-10-06', m: 0.2, o: { y_s3: 1 } },
      { date: '2026-10-06', o: { y_s3: 1 } },            // no score
    ];
    const r = modelRecord(t, TINY, 0.5);
    expect(r.from).toBe('2026-10-05');
    expect(r.games).toBe(3);
    expect(r.calls).toEqual({ picks: 2, landed: 1, said: 0.6 });
    expect(r.strong).toEqual({ picks: 1, landed: 1, said: 0.65 });
  });
});
