import { describe, expect, test } from '@jest/globals';
import { reliabilityOf, reliableFor, reliableTone, reliabilityText, RELIABLE_MIN } from '../lib/picks/reliability';
import { sameCalibration } from '../lib/picks/calibration';

// Three nights of graded plays: rebounds land from 65% up (break-even 62%), assists never clear their break-even, threes
// too few to say; the under side and an unknown chance are ignored.
const play = (market, p, hit, implied = 0.62, side = 'over') => ({ market, side, p, hit, implied });
const graded = [];
for (const night of ['2026-10-22', '2026-10-23', '2026-10-24']) {
  const plays = [];
  for (let k = 0; k < 20; k++) {
    const p = 0.55 + (k % 4) * 0.05;
    plays.push(play('reb', p, p >= 0.65 ? (k % 5 ? 1 : 0) : 0));   // 65%+ lands 80% (30 plays), under it nothing
    plays.push(play('ast', 0.6 + (k % 3) * 0.1, k % 2));   // lands 50% against a 62% break-even
  }
  plays.push(play('tpm', 0.7, 1), play('reb', 0.9, 1, null, 'under'), play('reb', NaN, 1));
  graded.push({ key: night, finals: 3, plays });
}

describe('the reliable chance per market', () => {
  const rel = reliabilityOf(graded, { at: '2026-10-25T06:00:00Z' });
  test('the lowest chance from which enough plays landed their break-even', () => {
    expect(rel).toMatchObject({ from: '2026-10-22', to: '2026-10-24', nights: 3, min: RELIABLE_MIN });
    expect(rel.plays).toBe(123);   // 60 reb + 60 ast + 3 tpm over / yes with a chance; the under and the NaN left out
    expect(rel.markets.reb.threshold).toBe(0.65);
    expect(rel.markets.reb.n).toBeGreaterThanOrEqual(RELIABLE_MIN);
    expect(rel.markets.reb.landed).toBeGreaterThanOrEqual(0.62);
    expect(rel.markets.reb.breakEven).toBe(0.62);
    expect(rel.markets.reb.table.find((r) => r.t === 0.5)).toMatchObject({ n: 60, ok: false });
    expect(rel.markets.ast.threshold).toBeNull();   // 50% landed, 62% asked
    expect(rel.markets.tpm.threshold).toBeNull();   // three plays
    expect(reliableFor(rel, 'reb')).toBe(0.65);
    expect(reliableFor(rel, 'pts')).toBeNull();
  });
  test('the tone: green at or over the threshold by the stated chance, red under, none without a threshold', () => {
    expect(reliableTone(rel, 'reb', 0.7)).toBe('yes');
    expect(reliableTone(rel, 'reb', 0.65)).toBe('yes');
    expect(reliableTone(rel, 'reb', 0.6)).toBe('no');
    expect(reliableTone(rel, 'reb', 0.7, 0.6)).toBe('no');   // printed 70% calibrated from a stated 60%: the stated chance decides
    expect(reliableTone(rel, 'ast', 0.9)).toBeNull();
    expect(reliableTone(null, 'reb', 0.9)).toBeNull();
    expect(reliableTone(rel, 'reb', null)).toBeNull();
  });
  test('the words', () => {
    expect(reliabilityText(rel, 'reb', 'REB')).toMatch(/^REB: reliable from 65% — \d+ plays at or over it landed \d+% against a 62% break-even$/);
    expect(reliabilityText(rel, 'ast', 'AST')).toMatch(/^AST: not reliable at any chance yet \(60 plays; at \d+%\+ \d+ landed \d+% against a 62% break-even\)$/);
    expect(reliabilityText(rel, 'pts', 'PTS')).toBe('PTS: no graded plays yet');
  });
  test('rides with the calibration: a copy that differs in it is not the same', () => {
    const a = { nights: 3, plays: 10, rungs: 20, reads: { plays: {}, rungs: {} } };
    expect(sameCalibration(a, { ...a })).toBe(true);
    expect(sameCalibration({ ...a, reliability: rel }, { ...a, reliability: rel })).toBe(true);
    expect(sameCalibration({ ...a, reliability: rel }, { ...a })).toBe(false);
  });
});
