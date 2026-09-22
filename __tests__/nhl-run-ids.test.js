import { describe, expect, test, jest } from '@jest/globals';

jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const { newRunId, isValidRunId, sanitizeSummary, NHL_SLOTS } = require('../lib/nhl-store');

describe('run ids', () => {
  test('newRunId is sortable and valid', () => {
    const a = newRunId(new Date('2026-03-14T18:00:00Z'));
    const b = newRunId(new Date('2026-03-15T01:02:03Z'));
    expect(a.startsWith('20260314-180000-')).toBe(true);
    expect(isValidRunId(a)).toBe(true);
    expect(a < b).toBe(true);
  });

  test('rejects path tricks', () => {
    for (const bad of ['', '../x', '20260314-180000-ab/..', 'runs', null, 42]) {
      expect(isValidRunId(bad)).toBe(false);
    }
  });
});

describe('sanitizeSummary', () => {
  test('clips and coerces', () => {
    const s = sanitizeSummary({
      slateDate: '2026-03-14',
      games: Array.from({ length: 40 }, (_, i) => ({ label: `G${i}`, home: 'TOR', away: 'MTL', extra: 1 })),
      playerCount: '412',
      topPicks: [{ name: 'A', market: '4+ SOG', prob: 0.59, evil: '<script>' }],
    });
    expect(s.games).toHaveLength(24);
    expect(s.games[0]).toEqual({ label: 'G0', home: 'TOR', away: 'MTL' });
    expect(s.playerCount).toBe(412);
    expect(s.topPicks[0]).toEqual({ name: 'A', team: null, market: '4+ SOG', prob: 0.59 });
  });

  test('handles junk', () => {
    expect(sanitizeSummary(null)).toMatchObject({ games: [], topPicks: [], playerCount: null });
  });

  test('slot list matches the client', () => {
    expect(NHL_SLOTS).toEqual(['season', 'l5', 'hist', 'playerStats', 'lineups', 'pace', 'rankings', 'boxScores']);
  });
});
