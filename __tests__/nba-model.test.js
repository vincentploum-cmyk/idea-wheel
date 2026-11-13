import { describe, expect, test } from '@jest/globals';
import { modelFeatures, predictTrees, modelRead, modelFactor, MODEL_STATS } from '../lib/nba/model';
import { buildBoard } from '../lib/nba/picks';
import MODEL from '../lib/nba/model-trees.json';
import ROWS from './fixtures/nba-model-rows.json';

// The learned read (Vincent, 2026-11-13; docs/audits/2026-11-13-nba-model.md): the trees the fit wrote, read by the site.
const day = (i) => `2026-10-${String(1 + i).padStart(2, '0')}`;
const logs = (n, f) => Array.from({ length: n }, (_, i) => ({ date: day(i), gameId: `g${i}`, season: 2026, type: 'REG', min: 30, pts: 18, reb: 5, ast: 4, tpm: 2, stl: 1, blk: 0, tov: 2, fga: 14, fgm: 7, tpa: 6, fta: 3, ftm: 2, starter: 1, ...f(i) }));

describe('the NBA learned read', () => {
  test('the site reads the trees as the fit did (LightGBM\'s own answers on eight player-nights)', () => {
    expect(Object.keys(MODEL.stats)).toEqual(MODEL_STATS);
    for (const row of ROWS) for (const stat of MODEL_STATS) {
      const p = predictTrees(MODEL.stats[stat], row.feats);
      expect(Math.abs(p - row.pred[stat]) / row.pred[stat]).toBeLessThan(1e-4);
    }
  });
  test('the features: his rates, his role, and the teammates out and back', () => {
    const mine = logs(12, () => ({}));
    // A scorer who played beside him every night and is out tonight; another who missed his last eight and is back.
    const star = { key: 'star', playing: false, games: logs(12, () => ({ pts: 28, fga: 20, min: 35 })) };
    const back = { key: 'back', playing: true, games: logs(4, () => ({ pts: 22, fga: 17, min: 33 })) };
    const bench = { key: 'bench', playing: true, games: logs(12, () => ({ pts: 3, min: 8 })) };
    const f = modelFeatures({ games: mine, season: 2026, pos: 'SG', starter: true, mates: [star, back, bench] });
    expect(f.nSeason).toBe(12); expect(f.posN).toBe(0); expect(f.starter).toBe(1); expect(f.minRole).toBe(30);
    expect(f.pm8_pts).toBeCloseTo(0.6, 5); expect(f.l10_pts).toBe(18); expect(f.s_tpa).toBe(6);
    expect(f.out_pts).toBeCloseTo(28 / 113, 5); expect(f.outTop).toBeCloseTo(28, 5);
    expect(f.back_pts).toBeGreaterThan(0.1); expect(f.back_pts).toBeLessThan(22 / 113);
    // The same night with everyone in his usual place: nothing out, nothing back.
    const usual = modelFeatures({ games: mine, season: 2026, pos: 'SG', starter: true, mates: [{ ...star, playing: true }, bench] });
    expect(usual.out_pts).toBe(0); expect(usual.back_pts).toBe(0);
    // Unknown five: his usual role; under five games: no read.
    expect(modelFeatures({ games: mine, season: 2026, mates: [] }).starter).toBe(1);
    expect(modelFeatures({ games: mine.slice(0, 4), season: 2026, mates: [] })).toBeNull();
    for (const name of MODEL.stats.pts.features) expect(name in f).toBe(true);
  });
  test('the blend: half the board, half the model, held to ± 40 / 60%', () => {
    expect(modelFactor({ blend: { default: 0.5 } }, 'pts', 20, 24)).toBe(1.1);
    expect(modelFactor({ blend: { default: 0.5, reb: 0 } }, 'reb', 5, 9)).toBeNull();
    expect(modelFactor({ blend: { default: 1 } }, 'pts', 10, 30)).toBe(1.6);
    expect(modelRead(MODEL, ROWS[0].feats).pts).toBeGreaterThan(0);
  });
  test('on the board: the projection moves to the blend, the ladder and the range with it; without the trees nothing moves', () => {
    const games = [{ id: 'g1', date: '2026-11-02T00:00Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
    const pl = (id, name, team, pos, f) => ({ id, name, key: name.toLowerCase(), team, pos, games: logs(12, f), props: [] });
    const pf = { at: '2026-11-01T14:00:00Z', data: { players: [
      pl('p1', 'Lead Guard', 'BOS', 'PG', (i) => ({ pts: 22 + (i % 5), ast: 7 })), pl('p2', 'Second Man', 'BOS', 'SF', () => ({ pts: 15 })),
      pl('p3', 'Other Side', 'NY', 'C', () => ({ reb: 10 })),
    ], defense: null, injuries: { rows: [] } } };
    const args = { date: '2026-11-01', season: 2026, games, sheets: [], pf, results: {} };
    const plain = buildBoard(args); const withModel = buildBoard({ ...args, model: MODEL });
    const a = plain.games[0].sides.BOS.players.find((p) => p.key === 'lead guard');
    const b = withModel.games[0].sides.BOS.players.find((p) => p.key === 'lead guard');
    expect(a.ranges.pts.model).toBeUndefined();
    const m = b.ranges.pts.model;
    expect(m.pred).toBeGreaterThan(0); expect(m.before).toBe(a.ranges.pts.exp);
    // Half way between the board and the model, within a rounding step.
    expect(Math.abs(b.ranges.pts.exp - (a.ranges.pts.exp + m.pred) / 2)).toBeLessThan(0.15);
    expect(b.ladders.pts[0].proj).toBe(b.ranges.pts.exp);
    // PRA moves by its parts.
    const parts = ['pts', 'reb', 'ast'].reduce((t, k) => t + b.ranges[k].exp, 0);
    expect(Math.abs(b.ranges.pra.exp - parts)).toBeLessThan(Math.abs(a.ranges.pra.exp - parts) + 0.3);
  });
});
