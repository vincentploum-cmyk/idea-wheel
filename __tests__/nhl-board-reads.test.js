import { describe, expect, test } from '@jest/globals';
import { boardReadsOf, boardReadsMeta, withBoardModel, withBoardRows, boardCoverage } from '../lib/nhl-data/board-reads';
import { modelKey, normName } from '../lib/nhl-data/model-key';
import { skaterRow } from '../lib/nhl-data/shuffle-pure';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';
import { calibratedChance } from '../lib/nhl-data/calibration-pure';

// A board candidate as computePicks shapes it: the board's chances (calibrated, the stated ones as `raw`) over the λ.
const fits = { sog: { 4: { a: 0, b: 0.5 }, 5: { a: -0.2, b: 0.5 } }, g: { 1: { a: 0, b: 0.9 }, 2: { a: -0.4, b: 0.8 } } };
const c2 = (v) => Math.round(v * 100) / 100;
// His 4+ and 1+ G as the board prints them: his λ through the fits (what calibrateProjection does), the run's own as `raw`.
const cand = (over = {}) => ({
  id: 8478402, name: 'Connor McDavid', team: 'EDM', opp: 'NYI', venue: 'A', pos: 'C', line: 1,
  lamS: 3.4, lamG: 0.36, source: 'model', p2: 0.83, p3: 0.52, p4: c2(calibratedChance(fits, 'sog', 3.4, 4)), p1g: c2(calibratedChance(fits, 'g', 0.36, 1)), raw: { p2: 0.85, p3: 0.66, p4: 0.44, p1g: 0.61 }, calibrated: 'board',
  ...over,
});
const payload = (rows, calibration = { read: 'board', games: 5371, to: '2026-10-30', at: '2026-10-31T06:00:00Z', fits }) => ({
  date: '2026-10-31', source: 'model', modelRun: { id: 'run-1', createdAt: '2026-10-31T14:00:00Z' }, studyWeight: null, studyWeightGoals: 1, calibration,
  games: [{ id: 1, all: rows }],
});

describe('the model key is pure and the same on both ends', () => {
  test('the team in any spelling, the name without accents, suffixes or a trailing position', () => {
    expect(modelKey('Oilers', 'Connor McDavid')).toBe('EDM|connor mcdavid');
    expect(modelKey('EDM', 'Connor McDavid C')).toBe('EDM|connor mcdavid');
    expect(modelKey('Rangers', 'Alexis Lafrenière')).toBe(modelKey('NYR', 'Alexis Lafreniere'));
    expect(normName('Pierre-Luc Dubois Jr.')).toBe('pierre luc dubois');
  });
  test('the shuffle row carries the key and the board’s chances', () => {
    const row = skaterRow(cand());
    expect(row.key).toBe('EDM|connor mcdavid');
    expect(row.chances).toEqual({ p2: 0.83, p3: 0.52, p4: cand().p4, p1g: cand().p1g, raw: { p2: 0.85, p3: 0.66, p4: 0.44, p1g: 0.61 }, calibrated: 'board' });
    expect(skaterRow(cand({ raw: undefined, calibrated: undefined })).chances).toMatchObject({ raw: null, calibrated: null });
  });
});

describe('the board’s reads', () => {
  test('one read per skater: the board’s chances, 5+ and 2+ goals off the same λ through the same calibration, the stated figures beside them', () => {
    const rows = [skaterRow(cand()), skaterRow(cand({ id: 2, name: 'Leon Draisaitl', lamS: 3.9, lamG: 0.5, p2: 0.88, p3: 0.6, p4: 0.36, p1g: 0.39, raw: { p2: 0.9, p3: 0.75, p4: 0.56, p1g: 0.46 } }))];
    const reads = boardReadsOf(payload(rows));
    expect(Object.keys(reads).sort()).toEqual(['EDM|connor mcdavid', 'EDM|leon draisaitl']);
    const mc = reads['EDM|connor mcdavid'];
    expect(mc).toMatchObject({ id: 8478402, name: 'Connor McDavid', team: 'EDM', opp: 'NYI', lamS: 3.4, lamG: 0.36, p2: 0.83, p3: 0.52, p4: cand().p4, p1g: cand().p1g, calibrated: 'board', source: 'model' });
    expect(mc.p5).toBe(Math.round(calibratedChance(fits, 'sog', 3.4, 5) * 100) / 100);
    expect(mc.p2g).toBe(Math.round(calibratedChance(fits, 'g', 0.36, 2) * 100) / 100);
    expect(mc.p5).toBeLessThanOrEqual(mc.p4);
    expect(mc.p2g).toBeLessThanOrEqual(mc.p1g);
    // The run as stated: its own 2+ … 4+ and 1+ G, and the plain Poisson tails for 5+ and 2+ G, never above the rung below.
    expect(mc.raw).toMatchObject({ p2: 0.85, p3: 0.66, p4: 0.44, p1g: 0.61 });
    expect(mc.raw.p5).toBe(Math.min(0.44, Math.round(poissonAtLeast(3.4, 5) * 100) / 100));
    expect(mc.raw.p2g).toBe(Math.min(0.61, Math.round(poissonAtLeast(0.36, 2) * 100) / 100));
  });
  test('without a calibration the extra heights are the Poisson tails, capped by the board’s own rung below; the shuffle payload’s shape reads too', () => {
    const rows = [skaterRow(cand({ raw: undefined, calibrated: undefined, p4: 0.1, p1g: 0.05 }))];
    const reads = boardReadsOf({ ...payload(rows, null), games: [{ id: 1, skaters: rows }] });
    const mc = reads['EDM|connor mcdavid'];
    expect(mc.raw).toBeNull();
    expect(mc.calibrated).toBeNull();
    expect(mc.p5).toBe(0.1);                                   // the Poisson 5+ at 3.4 (0.26) capped by the board's 4+
    expect(mc.p2g).toBe(0.05);
  });
  test('nothing to read: null, and the meta says so', () => {
    expect(boardReadsOf(null)).toBeNull();
    expect(boardReadsOf({ games: [] })).toBeNull();
    expect(boardReadsOf({ games: [{ all: [{ id: 1, name: 'No Key' }] }] })).toBeNull();
    const p = payload([skaterRow(cand())]);
    expect(boardReadsMeta(p, boardReadsOf(p))).toEqual({ date: '2026-10-31', source: 'model', modelRun: p.modelRun, studyWeight: null, studyWeightGoals: 1, calibration: { read: 'board', games: 5371, from: null, to: '2026-10-30', at: '2026-10-31T06:00:00Z' }, skaters: 1 });
    expect(boardReadsMeta(null)).toBeNull();
  });
});

describe('the Model tab’s rows and the rink’s chips print the board’s read', () => {
  const reads = boardReadsOf(payload([skaterRow(cand({ p4: 0.3, p1g: 0.3 }))]));
  const runRow = { name: 'Connor McDavid', team: 'Oilers', pos: 'C', lambdaS: 3.4, lambdaG: 0.94, p2s: 0.85, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61, p2g: 0.24, p1p: 0.7, gateOpen: true, attackScore: 54 };
  test('a result row keeps everything the run said and prints the board’s figures, the run’s own under `run`', () => {
    const [row, other] = withBoardRows([runRow, { name: 'Zach Hyman', team: 'EDM', p1g: 0.3 }], reads);
    expect(row).toMatchObject({ name: 'Connor McDavid', team: 'Oilers', pos: 'C', gateOpen: true, attackScore: 54, p1p: 0.7, lambdaS: 3.4, lambdaG: 0.36, p2s: 0.83, p3s: 0.52, p4s: 0.3, p1g: 0.3, board: { calibrated: 'board', source: 'model' } });
    expect(row.p5s).toBe(reads['EDM|connor mcdavid'].p5);
    expect(row.p2g).toBe(reads['EDM|connor mcdavid'].p2g);
    expect(row.run).toEqual({ lambdaS: 3.4, lambdaG: 0.94, p2s: 0.85, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61, p2g: 0.24 });
    // A skater the board has no read for (not dressed tonight) stays as the run stated him.
    expect(other).toEqual({ name: 'Zach Hyman', team: 'EDM', p1g: 0.3, board: null });
    // Printing twice keeps the run's own figures, not the printed ones.
    expect(withBoardRows([row], reads)[0].run).toEqual(row.run);
    expect(boardCoverage([row, other])).toEqual({ rows: 2, read: 1 });
  });
  test('without reads the rows come back as they are', () => {
    const rows = [runRow];
    expect(withBoardRows(rows, null)).toBe(rows);
    expect(withBoardRows(null, reads)).toBeNull();
  });
  test('the slate’s compact model object the same way: λ and every chance the rink reads, the gate and the attack score the run’s', () => {
    const model = { sog: 3.4, g: 0.94, p2s: 0.85, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61, p2g: 0.24, gateOpen: true, attack: 54, line: 1, fire: false };
    const m = withBoardModel(model, reads['EDM|connor mcdavid']);
    expect(m).toMatchObject({ sog: 3.4, g: 0.36, p2s: 0.83, p3s: 0.52, p4s: 0.3, p1g: 0.3, gateOpen: true, attack: 54, line: 1, board: { calibrated: 'board', source: 'model' } });
    expect(m.run).toEqual({ sog: 3.4, g: 0.94, p2s: 0.85, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61, p2g: 0.24 });
    expect(withBoardModel(m, reads['EDM|connor mcdavid']).run).toEqual(m.run);
    expect(withBoardModel(null, reads['EDM|connor mcdavid'])).toBeNull();
    expect(withBoardModel(model, null)).toBe(model);
  });
});
