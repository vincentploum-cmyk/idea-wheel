import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// A fake Supabase Storage bucket that counts every call, so the tests can
// show which reads the in-process caches save.
const files = new Map(); // path → JSON string
const versions = new Map(); // path → upload count, the listing's version mark
const calls = { list: 0, download: 0, upload: 0, remove: 0 };
let gate = null; // { path, promise }: a download of `path` waits for the promise (simulates a slow read)
let listGate = null; // { prefix, promise }: the same for a listing
const store = {
  async list(prefix, { limit = 100 } = {}) {
    calls.list += 1;
    if (listGate?.prefix === prefix) await listGate.promise;
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    // Like the bucket: files carry updated_at + eTag + size, folders only a name.
    const entry = (name) => {
      const path = `${prefix}/${name}`;
      return files.has(path)
        ? { name, updated_at: `v${versions.get(path) || 0}`, metadata: { eTag: `etag-${versions.get(path) || 0}`, size: files.get(path).length } }
        : { name, updated_at: null, metadata: null };
    };
    return { data: [...names].sort().slice(0, limit).map(entry), error: null };
  },
  async download(path) {
    calls.download += 1;
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path); // what the bucket held when the read started
    if (gate?.path === path) await gate.promise;
    return { data: { text: async () => text }, error: null };
  },
  async upload(path, body) {
    calls.upload += 1;
    files.set(path, await body.text());
    versions.set(path, (versions.get(path) || 0) + 1);
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
const { loadPlayers, setOverride, PLAYERS_PATH } = require('../lib/nhl-data/rosters');

const manifest = (id, extra = {}) => JSON.stringify({ id, createdAt: `2026-10-0${id[7]}T00:00:00Z`, slateDate: '2026-10-01', hasResults: true, files: {}, ...extra });
const reset = () => { for (const k of Object.keys(calls)) calls[k] = 0; };
// Move the store's clock: its caches expire by Date.now().
const realNow = Date.now;
let skew = 0;
const advance = (ms) => { skew += ms; };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('run storage caches', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => realNow() + skew);
    files.clear();
    versions.clear();
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

  test('a value mutated in place and written back gets a fresh identity, so identity memos notice', async () => {
    files.set('data/reference/players.json', JSON.stringify({ updatedAt: 't1', players: { 1: { id: 1, name: 'A One', team: 'NYR', pos: 'LW' } } }));
    files.set('data/reference/seen-players.json', JSON.stringify({ players: { 9: { id: 9, name: 'Old Guy', team: 'BOS', pos: 'C', lastGame: '2026-01-01' } } }));
    const a = await loadPlayers();
    expect(a.players[1]).toMatchObject({ team: 'NYR', onRoster: true });
    expect(a.players[9]).toMatchObject({ onRoster: false });
    expect(await loadPlayers()).toBe(a);
    // The admin edits a player: setOverride mutates the cached overrides file in place and writes it.
    await setOverride(1, { team: 'FLA' });
    const b = await loadPlayers();
    expect(b).not.toBe(a);
    expect(b.players[1]).toMatchObject({ team: 'FLA', overridden: true });
    expect(await loadPlayers()).toBe(b);
    expect(JSON.parse(files.get(PLAYERS_PATH)).players[1].team).toBe('NYR');

    const o = await nhlStore.readJson('data/reference/overrides.json');
    o.players[1].note = 'traded';
    await nhlStore.writeJson('data/reference/overrides.json', o);
    const n = await nhlStore.readJson('data/reference/overrides.json');
    expect(n).not.toBe(o);
    expect(n.players[1].note).toBe('traded');
  });

  test('a write that lands while a read is in flight is not overwritten by the stale read', async () => {
    files.set('data/meta/x.json', JSON.stringify({ v: 1 }));
    let release;
    gate = { path: 'data/meta/x.json', promise: new Promise((r) => { release = r; }) };
    const slow = nhlStore.readJson('data/meta/x.json');
    await new Promise((r) => setTimeout(r, 0));
    await nhlStore.writeJson('data/meta/x.json', { v: 2 });
    release();
    expect(await slow).toEqual({ v: 1 });
    gate = null;
    expect(await nhlStore.readJson('data/meta/x.json')).toEqual({ v: 2 });
  });

  test('listings refresh for every ancestor of a written path', async () => {
    files.set('data/slates/2026-10-01/season.xlsx', 'x');
    expect(await nhlStore.listNames('data/slates')).toEqual(['2026-10-01']);
    await nhlStore.writeBlob('data/slates/2026-10-05/season.xlsx', new Blob(['y']), 'application/octet-stream');
    expect((await nhlStore.listNames('data/slates')).sort()).toEqual(['2026-10-01', '2026-10-05']);
    expect(await nhlStore.listNames('data/slates/2026-10-05')).toEqual(['season.xlsx']);
    expect(calls.list).toBe(3);
    expect(await nhlStore.listNames('data/slates')).toHaveLength(2);
    expect(calls.list).toBe(3);
  });

  test('concurrent reads of one path, one listing and one session check share a single call', async () => {
    advance(11 * 60 * 1000); // everything earlier tests cached has expired
    files.set('data/shared/a.json', JSON.stringify({ a: 1 }));
    const [x, y, z] = await Promise.all([nhlStore.readJson('data/shared/a.json'), nhlStore.readJson('data/shared/a.json'), nhlStore.readJson('data/shared/a.json')]);
    expect(x).toEqual({ a: 1 });
    expect(y).toBe(x);
    expect(z).toBe(x);
    expect(calls.download).toBe(1);
    const [n1, n2] = await Promise.all([nhlStore.listNames('data/shared'), nhlStore.listNames('data/shared')]);
    expect(n1).toEqual(['a.json']);
    expect(n2).toBe(n1);
    expect(calls.list).toBe(1);
    // The run list and the slate's run lookup ask for the same manifests at once: each is read once.
    await Promise.all([nhlStore.listRuns(), nhlStore.findRun((m) => m.slateDate === '2026-10-01')]);
    expect(calls.download).toBe(3); // the two real manifests
  });

  test('past its TTL a miss is re-checked through the folder listing, not a download', async () => {
    advance(11 * 60 * 1000);
    files.set('data/propfinder/teams-2025.json', JSON.stringify({ season: 2025 }));
    expect(await nhlStore.readJson('data/propfinder/teams-2026.json')).toBeNull();
    expect(await nhlStore.readJson('data/propfinder/opponents-2026.json')).toBeNull();
    expect(calls).toMatchObject({ download: 2, list: 0 });
    advance(31 * 1000); // misses expire after 30 s
    expect(await nhlStore.readJson('data/propfinder/teams-2026.json')).toBeNull();
    expect(await nhlStore.readJson('data/propfinder/opponents-2026.json')).toBeNull();
    expect(calls).toMatchObject({ download: 2, list: 1 }); // one listing answers every miss in the folder
    // A read asked to revalidate consults the listing from the start: no download for a name that is not there,
    // and the listing is reused across the folder's reads.
    expect(await nhlStore.readJson('data/propfinder/skaters-2026.json', { revalidate: true })).toBeNull();
    expect(await nhlStore.readJson('data/propfinder/teams-2025.json', { revalidate: true })).toEqual({ season: 2025 });
    expect(calls).toMatchObject({ download: 3, list: 1 });
    // The file appears (written through the store): the listing is refreshed and the read sees it.
    await nhlStore.writeJson('data/propfinder/teams-2026.json', { season: 2026 });
    advance(31 * 1000);
    expect(await nhlStore.readJson('data/propfinder/opponents-2026.json')).toBeNull();
    expect(await nhlStore.readJson('data/propfinder/teams-2026.json')).toEqual({ season: 2026 });
    expect(calls).toMatchObject({ download: 3, list: 2 });
  });

  test('a big file past its TTL is kept while the listing shows it unchanged, and re-read when it changed', async () => {
    advance(11 * 60 * 1000);
    const big = JSON.stringify({ updatedAt: 'a', rows: Array.from({ length: 20000 }, (_, i) => [`2026-01-0${(i % 9) + 1}`, i, i, `P${i}`]) });
    files.set('data/rows/20252026.json', big);
    versions.set('data/rows/20252026.json', 1);
    const first = await nhlStore.readJson('data/rows/20252026.json', { revalidate: true });
    expect(first.rows).toHaveLength(20000);
    expect(calls).toMatchObject({ download: 1, list: 1 }); // the listing first, so the file's version mark is known
    advance(11 * 60 * 1000); // past the JSON TTL
    expect(await nhlStore.readJson('data/rows/20252026.json', { revalidate: true })).toBe(first);
    expect(calls).toMatchObject({ download: 1, list: 2 });
    advance(11 * 60 * 1000);
    expect(await nhlStore.readJson('data/rows/20252026.json', { revalidate: true })).toBe(first);
    expect(calls).toMatchObject({ download: 1, list: 3 });
    // Written outside this process (a new version mark): downloaded again.
    files.set('data/rows/20252026.json', JSON.stringify({ updatedAt: 'b', rows: [] }));
    versions.set('data/rows/20252026.json', 2);
    advance(11 * 60 * 1000);
    const next = await nhlStore.readJson('data/rows/20252026.json', { revalidate: true });
    expect(next.updatedAt).toBe('b');
    expect(calls).toMatchObject({ download: 2, list: 4 });
    // A small file is simply re-downloaded past its TTL: the listing would cost as much.
    files.set('data/small/x.json', '{"v":1}');
    await nhlStore.readJson('data/small/x.json');
    advance(11 * 60 * 1000);
    await nhlStore.readJson('data/small/x.json');
    expect(calls).toMatchObject({ download: 4, list: 4 });
  });

  test('a stale entry is dropped by a write that lands while its listing is being checked', async () => {
    advance(11 * 60 * 1000);
    files.set('data/rows/20262027.json', JSON.stringify({ updatedAt: 'a', rows: [] }));
    versions.set('data/rows/20262027.json', 1);
    const v1 = await nhlStore.readJson('data/rows/20262027.json', { revalidate: true });
    advance(11 * 60 * 1000);
    // The revalidating read is in flight (waiting on the listing) when the store writes the file.
    let release;
    listGate = { prefix: 'data/rows', promise: new Promise((r) => { release = r; }) };
    const slow = nhlStore.readJson('data/rows/20262027.json', { revalidate: true });
    await tick();
    await nhlStore.writeJson('data/rows/20262027.json', { updatedAt: 'b', rows: [] });
    release();
    listGate = null;
    const got = await slow;
    expect(got).not.toBe(v1);
    expect(got.updatedAt).toBe('b');
    expect((await nhlStore.readJson('data/rows/20262027.json')).updatedAt).toBe('b');
  });

  test('findRun reads manifests newest first, a batch at a time, and stops at the first match', async () => {
    advance(11 * 60 * 1000);
    for (let i = 0; i < 25; i++) files.set(`runs/202509${String(10 + i)}-120000-cccccc/manifest.json`, manifest(`202509${String(10 + i)}-120000-cccccc`, { slateDate: i === 13 ? '2026-10-09' : '2026-10-01', createdAt: `2025-09-${10 + i}T12:00:00Z` }));
    reset();
    const run = await nhlStore.findRun((m) => m.slateDate === '2026-10-09', { batch: 10 });
    expect(run.id).toBe('20250923-120000-cccccc');
    expect(calls).toMatchObject({ list: 1, download: 20 }); // the newest 10 (no match), then the next 10
    expect(await nhlStore.findRun((m) => m.slateDate === '2027-01-01', { limit: 5 })).toBeNull();
    expect(calls.download).toBe(20);
  });

  test('the JSON cache keeps recently used entries over long-unused ones', async () => {
    for (let i = 0; i < 1000; i++) files.set(`data/fill/${i}.json`, '{}');
    files.set('data/hot.json', '{"hot":true}');
    const hot = await nhlStore.readJson('data/hot.json');
    for (let i = 0; i < 999; i++) await nhlStore.readJson(`data/fill/${i}.json`);
    expect(await nhlStore.readJson('data/hot.json')).toBe(hot); // touched: moves to the end
    reset();
    for (let i = 0; i < 20; i++) await nhlStore.readJson(`data/fill/${900 + i}.json`); // fresh hits, no eviction
    expect(calls.download).toBe(0);
    await nhlStore.readJson('data/fill/999.json'); // one new entry evicts the least recently used
    expect(await nhlStore.readJson('data/hot.json')).toBe(hot);
    expect(calls.download).toBe(1);
  });
});
