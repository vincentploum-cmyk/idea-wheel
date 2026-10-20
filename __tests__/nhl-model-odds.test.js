import { describe, expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { matchupWorkbooks } from '../lib/nhl-data/propfinder-api';
import { parseMatchups, buildProjections } from '../components/nhl/model-core';
import { TEAMS, PLAYERS } from './fixtures/propfinder-api';

const poissonAtLeast = (lambda, k) => {
  let p = Math.exp(-lambda); let cum = 0;
  for (let i = 0; i < k; i++) { cum += p; p *= lambda / (i + 1); }
  return 1 - cum;
};

describe('the published odds are the Poisson tails of the row’s λ (shots since 2026-10-13, goals since 2026-10-20)', () => {
  const books = matchupWorkbooks([{ away: 'PIT', home: 'PHI' }], TEAMS, PLAYERS, { season: 2025, date: '2026-09-30' });
  const bin = (wb) => XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const games = parseMatchups(XLSX.read(bin(books.season.wb), { type: 'buffer' }), XLSX.read(bin(books.l5.wb), { type: 'buffer' }));
  const rows = buildProjections(games, null, null, null, null);

  test('the run projects the fixture slate', () => {
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.find((r) => r.name === 'Sidney Crosby')).toBeTruthy();
  });

  test('p2s / p3s / p4s / p5s follow lambdaS and the ladder rides along', () => {
    for (const r of rows) {
      expect(r.p3s).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaS, 3)), 2);
      expect(r.p4s).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaS, 4)), 2);
      expect(r.p5s).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaS, 5)), 2);
      expect(r.p2s).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaS, 2)), 2);
      expect(typeof r.ladderP3s).toBe('number');
    }
  });

  test('p1g / p2g / p3g follow lambdaG; the goal ladder rides along as ladderP1g / P2g / P3g', () => {
    for (const r of rows) {
      expect(r.p1g).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaG, 1)), 2);
      expect(r.p2g).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaG, 2)), 2);
      expect(r.p3g).toBeCloseTo(Math.min(0.999, poissonAtLeast(r.lambdaG, 3)), 2);
      expect(r.p2g).toBeLessThanOrEqual(r.p1g);
      for (const k of ['ladderP1g', 'ladderP2g', 'ladderP3g']) {
        expect(typeof r[k]).toBe('number');
        expect(r[k]).toBeGreaterThanOrEqual(0);
        expect(r[k]).toBeLessThanOrEqual(0.999);
      }
    }
  });

  test('somewhere in the slate the ladder and the λ disagree, so the test tells them apart', () => {
    // If the ladder ever equalled the Poisson tail on every row this guard could not fail; make sure it can.
    const apart = rows.filter((r) => Math.abs(r.ladderP1g - r.p1g) > 0.02);
    expect(apart.length).toBeGreaterThan(0);
  });
});
