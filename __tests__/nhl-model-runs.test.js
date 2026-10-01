import { describe, expect, test } from '@jest/globals';
import { indexModelRows, modelKey } from '../lib/nhl-data/model-runs';
import { isOnFire } from '../components/nhl/model-core';

describe('model run index', () => {
  test('rows are keyed by team abbreviation and normalised name', () => {
    const idx = indexModelRows([
      { name: 'Evan Bouchard', team: 'Oilers', pos: 'D', lambdaS: 2.9, lambdaG: 0.21, p3s: 0.41, p4s: 0.2, p1g: 0.18, gateOpen: true, todayLine: 1, signalScore: 61 },
      { name: 'Alexis Lafrenière', team: 'NYR', pos: 'LW', lambdaS: 2.4, lambdaG: 0.3 },
      { team: 'NYR' },
    ]);
    expect(idx[modelKey('EDM', 'Evan Bouchard')]).toMatchObject({ sog: 2.9, g: 0.21, p3s: 0.41, line: 1, pos: 'D' });
    expect(idx[modelKey('Rangers', 'Alexis Lafreniere')]).toMatchObject({ sog: 2.4 });
    expect(idx[modelKey('EDM', 'Evan Bouchard')].fire).toBe(false);
    expect(Object.keys(idx)).toHaveLength(2);
  });
  test('the model’s flame rides on the row: 1+ point ≥ 50%, 2.0+ iSCF/G, 16+ minutes', () => {
    const hot = { name: 'Nathan MacKinnon', team: 'COL', p1p: 0.62, playerIscf: 3.6, effectiveToi: 21.5 };
    expect(isOnFire(hot)).toBe(true);
    expect(isOnFire({ ...hot, p1p: 0.49 })).toBe(false);
    expect(isOnFire({ ...hot, playerIscf: 1.9 })).toBe(false);
    expect(isOnFire({ ...hot, effectiveToi: undefined, playerToi: 15.9 })).toBe(false);
    expect(isOnFire({ ...hot, effectiveToi: undefined, playerToi: 16 })).toBe(true);
    expect(isOnFire(null)).toBe(false);
    expect(indexModelRows([hot])[modelKey('COL', 'Nathan MacKinnon')]).toMatchObject({ fire: true, p1p: 0.62 });
  });
});
