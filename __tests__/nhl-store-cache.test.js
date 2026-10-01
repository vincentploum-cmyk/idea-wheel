import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// A fake Supabase Storage bucket that counts every call, so the tests can
// show which reads the in-process caches save.
const files = new Map(); // path → JSON string
const calls = { list: 0, download: 0, upload: 0, remove: 0 };
const store = {
  async list(prefix) {
    calls.list += 1;
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    return { data: [...names].map((name) => ({ name })), error: null };
  },
  async download(path) {
    calls.download += 1;
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path);
    return { data: { text: async () => text }, error: null };
  },
  async upload(path, body) {
    calls.upload += 1;
    files.set(path, await body.text());
    return { data: { path }, error: null };
  },
  async remove(paths) {
    calls.remove += 1;
    for (const p of paths) files.delete(p);
    return { data: null, error: null };
  },
};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }),
}));

const nhlStore = require('../lib/nhl-store');

const manifest = (id, extra = {}) => JSON.stringify({ id, createdAt: `2026-10-0${id[7]}T00:00:00Z`, slateDate: '2026-10-01', hasResults: true, files: {}, ...extra });
const reset = () => { for (const k of Object.keys(calls)) calls[k] = 0; };

describe('run storage caches', () => {
  beforeEach(() => {
    files.clear();
    files.set('runs/20250901-120000-aaaaaa/manifest.json', manifest('20250901-120000-aaaaaa'));
    files.set('runs/20250902-120000-bbbbbb/manifest.json', manifest('20250902-120000-bbbbbb'));
    files.set('runs/20250902-120000-bbbbbb/results.json', '[]');
    files.set('runs/not-a-run/manifest.json', '{}');
    reset();
  });

  test('listRuns lists the bucket and reads each manifest once, newest first', async () => {
    const first = await nhlStore.listRuns();
    expect(first.map((r) => r.id)).toEqual(['20250902-120000-bbbbbb', '20250901-120000-aaaaaa']);
    expect(calls).toMatchObject({ list: 1, download: 2 });
    const again = await nhlStore.listRuns(1);
    expect(again).toHaveLength(1);
    expect(again[0]).toBe(first[0]);
    expect(calls).toMatchObject({ list: 1, download: 2 });
    // getRun and getRunFile share the manifest cache.
    expect(await nhlStore.getRun('20250902-120000-bbbbbb')).toBe(first[0]);
    expect(await nhlStore.getRunFile('20250902-120000-bbbbbb', 'season')).toBeNull();
    expect(calls.download).toBe(2);
  });

  test('saving a run refreshes the list and serves its manifest from memory', async () => {
    await nhlStore.listRuns();
    const rev = nhlStore.runsRevision();
    reset();
    const run = await nhlStore.createRun({ files: {}, summary: { label: 'Tonight', slateDate: '2026-10-03' }, results: [{ name: 'x' }], user: { email: 'a@b.c' } });
    expect(nhlStore.isValidRunId(run.id)).toBe(true);
    expect(nhlStore.runsRevision()).toBe(rev + 1);
    expect(calls.upload).toBe(2); // results + manifest
    const runs = await nhlStore.listRuns();
    expect(runs[0]).toBe(run);
    expect(runs).toHaveLength(3);
    expect(calls).toMatchObject({ list: 1, download: 0 });
  });

  test('attaching files updates the cached manifest; deleting drops it', async () => {
    const id = '20250902-120000-bbbbbb';
    await nhlStore.listRuns();
    reset();
    const blob = new Blob(['xlsx'], { type: 'application/octet-stream' });
    const file = Object.assign(blob, { name: 'Box Scores.xlsx' });
    const updated = await nhlStore.addRunFiles(id, { boxScores: file });
    expect(updated.files.boxScores).toMatchObject({ name: 'Box Scores.xlsx', path: `runs/${id}/inputs/boxScores` });
    expect(await nhlStore.getRun(id)).toBe(updated);
    expect(calls.download).toBe(0);
    expect(JSON.parse(files.get(`runs/${id}/manifest.json`)).files.boxScores.name).toBe('Box Scores.xlsx');

    const rev = nhlStore.runsRevision();
    await nhlStore.deleteRun(id);
    expect(nhlStore.runsRevision()).toBe(rev + 1);
    expect(files.has(`runs/${id}/manifest.json`)).toBe(false);
    expect((await nhlStore.listRuns()).map((r) => r.id)).toEqual(['20250901-120000-aaaaaa']);
    expect(await nhlStore.getRun(id)).toBeNull();
  });

  test('readJson caches hits and misses, writeJson refreshes', async () => {
    files.set('data/x.json', JSON.stringify({ a: 1 }));
    const v = await nhlStore.readJson('data/x.json');
    expect(v).toEqual({ a: 1 });
    expect(await nhlStore.readJson('data/x.json')).toBe(v);
    expect(await nhlStore.readJson('data/missing.json')).toBeNull();
    expect(await nhlStore.readJson('data/missing.json')).toBeNull();
    expect(calls.download).toBe(2);
    await nhlStore.writeJson('data/x.json', { a: 2 });
    expect(await nhlStore.readJson('data/x.json')).toEqual({ a: 2 });
    expect(calls.download).toBe(2);
  });
});
