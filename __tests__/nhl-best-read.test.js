import { describe, expect, test, jest } from '@jest/globals';

// The in-process bucket mock the store tests use: files as JSON strings.
const files = new Map();
const store = {
  async list() { return { data: [], error: null }; },
  async download(path) {
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path);
    return { data: { text: async () => text, size: text.length }, error: null };
  },
  async upload(path, body) { files.set(path, await body.text()); return { data: { path }, error: null }; },
  async remove(paths) { for (const p of paths) files.delete(p); return { data: null, error: null }; },
};
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }) }));

const { bestReadOf, sameBestRead, saveBestRead, loadBestRead, BEST_READ_PATH } = require('../lib/nhl-data/best-read');
const { dataRevision } = require('../lib/nhl-store');

// A scorecard's predictors as summarize() lays them out: per stat, the common rows' Brier per predictor.
const report = (briers, n) => ({ common: { n, predictors: Object.entries(briers).map(([key, brier]) => ({ key, brier, n: brier == null ? 0 : n })) } });
const card = (n = 400, extra = {}) => ({
  from: '2026-09-01', to: '2026-10-27', slates: 20, players: 7000,
  predictors: {
    sog: report({ model: 0.231, study: 0.228, blend: 0.229, own5: 0.24, own10: 0.235, ownSeason: 0.25 }, n),
    g: report({ model: 0.12, study: 0.125, own5: 0.13, own10: 0.119, ownSeason: 0.14 }, n),
  },
  ...extra,
});

describe('the shuffle’s stored verdict', () => {
  test('one verdict per bar from a built scorecard, with when and what from', () => {
    const v = bestReadOf(card(), '2026-10-27T13:24:00Z');
    expect(v).toMatchObject({ at: '2026-10-27T13:24:00Z', from: '2026-09-01', to: '2026-10-27', slates: 20, players: 7000 });
    expect(v.bars.sog).toMatchObject({ best: 'study', n: 400, ranked: ['study', 'model', 'l10', 'l5', 'season'] });
    expect(v.bars.g).toMatchObject({ best: 'l10', n: 400 });
    // Under the 100-row minimum the bar has no best yet, but its scores ride along.
    expect(bestReadOf(card(40)).bars.sog).toMatchObject({ best: null, n: 40 });
    expect(bestReadOf(card(40)).bars.sog.scores.model).toEqual({ brier: 0.231, n: 40 });
    expect(bestReadOf(null)).toBeNull();
    expect(bestReadOf({ slates: 0 })).toBeNull();
  });
  test('the same verdict reads the same whenever it was built', () => {
    expect(sameBestRead(bestReadOf(card(), '2026-10-27T13:00:00Z'), bestReadOf(card(), '2026-10-28T13:00:00Z'))).toBe(true);
    expect(sameBestRead(bestReadOf(card()), bestReadOf(card(401)))).toBe(false);
    expect(sameBestRead(bestReadOf(card()), bestReadOf(card(400, { slates: 21 })))).toBe(false);
    expect(sameBestRead(null, bestReadOf(card()))).toBe(false);
  });
  test('stored once per change: the same verdict is not written again, so the per-state builds stay', async () => {
    expect(await loadBestRead()).toBeNull();
    const first = await saveBestRead(card());
    expect(files.has(BEST_READ_PATH)).toBe(true);
    expect(await loadBestRead()).toMatchObject({ slates: 20, bars: { sog: { best: 'study' }, g: { best: 'l10' } } });
    const rev = dataRevision();
    const again = await saveBestRead(card());
    expect(again).toEqual(first);         // the stored one, untouched (read back through the store's cache)
    expect(dataRevision()).toBe(rev);      // no write
    const changed = await saveBestRead(card(400, { slates: 21, players: 7350 }));
    expect(changed.slates).toBe(21);
    expect(dataRevision()).toBeGreaterThan(rev);
    expect((await loadBestRead()).slates).toBe(21);
    expect(await saveBestRead({ predictors: null })).toBeNull();
  });
});
