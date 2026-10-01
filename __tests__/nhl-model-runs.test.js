import { describe, expect, test } from '@jest/globals';
import { indexModelRows, modelKey } from '../lib/nhl-data/model-runs';

describe('model run index', () => {
  test('rows are keyed by team abbreviation and normalised name', () => {
    const idx = indexModelRows([
      { name: 'Evan Bouchard', team: 'Oilers', pos: 'D', lambdaS: 2.9, lambdaG: 0.21, p3s: 0.41, p4s: 0.2, p1g: 0.18, gateOpen: true, todayLine: 1, signalScore: 61 },
      { name: 'Alexis Lafrenière', team: 'NYR', pos: 'LW', lambdaS: 2.4, lambdaG: 0.3 },
      { team: 'NYR' },
    ]);
    expect(idx[modelKey('EDM', 'Evan Bouchard')]).toMatchObject({ sog: 2.9, g: 0.21, p3s: 0.41, line: 1, pos: 'D' });
    expect(idx[modelKey('Rangers', 'Alexis Lafreniere')]).toMatchObject({ sog: 2.4 });
    expect(Object.keys(idx)).toHaveLength(2);
  });
});
