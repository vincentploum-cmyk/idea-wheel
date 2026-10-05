// Server-only storage for the NHL prop model.
//
// Everything lives in one private Supabase Storage bucket, written with the
// service-role key from API routes that first verify the caller is an NHL
// admin. No SQL migration is needed: the bucket is created on first use.
//
//   nhl-model/
//     runs/<runId>/manifest.json   summary shown in Run History
//     runs/<runId>/results.json    projection snapshot at save time
//     runs/<runId>/inputs/<slot>   original .xlsx uploads, one per slot
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isNhlAdmin, AUTH_COOKIE_RE } from './nhl-admin';

export { isNhlAdmin };

export const NHL_BUCKET = process.env.NHL_MODEL_BUCKET || 'nhl-model';

// Upload slots the model understands (keys match the client).
export const NHL_SLOTS = ['season', 'l5', 'hist', 'playerStats', 'lineups', 'pace', 'rankings', 'boxScores'];

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const RUN_ID_RE = /^\d{8}-\d{6}-[a-z0-9]{4,8}$/;

// Local development only: NHL_DEV_USER_EMAIL=you@x.com skips the Supabase
// session check, and NHL_STORE_DRIVER=fs keeps runs in ./.nhl-data instead of
// Supabase Storage. Both are ignored in production builds.
const DEV = process.env.NODE_ENV === 'development';

// ── In-process caches ───────────────────────────────────────────────────────
// Render runs one instance and every write goes through this module, so a
// short memory cache is safe: writes invalidate their own path, and the TTL
// bounds staleness if another process ever writes the bucket.
const SESSION_TTL_MS = 60 * 1000;
const JSON_TTL_MS = 10 * 60 * 1000;
const MISS_TTL_MS = 30 * 1000;  // a missing file is re-checked sooner than a stored one
const JSON_MAX = 1000;
const BLOB_TTL_MS = 30 * 60 * 1000;
const BLOB_MAX = 200;
const LIST_TTL_MS = 60 * 1000;
const LIST_LIMIT = 1000;        // a folder listed in full answers "is it there?" without a download
const BIG_BYTES = 256 * 1024;   // files worth a listing call to avoid re-downloading unchanged
const sessionCache = new Map(); // cookie fingerprint → { user, at }
const jsonCache = new Map();    // path → { value, at, size, stamp }, least recently used first
const blobCache = new Map();    // path → { blob, at }
const listCache = new Map();    // prefix → { names, entries, complete, at }
const writes = new Map();       // path → number of writes / invalidations seen (guards in-flight reads)
const pending = new Map();      // key → promise of a read in flight, so concurrent callers share one download
let runsVersion = 0;            // bumps when a run is created or deleted

function fresh(entry, ttl) {
  return entry && Date.now() - entry.at < ttl;
}

const writeSeq = (path) => writes.get(path) || 0;
// A miss is remembered as an entry that expires MISS_TTL_MS from now.
const missAt = () => Date.now() - JSON_TTL_MS + MISS_TTL_MS;

/** One promise per key while a read is in flight: concurrent callers share it. */
function share(key, run) {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const p = run().finally(() => { if (pending.get(key) === p) pending.delete(key); });
  pending.set(key, p);
  return p;
}

/** Keep a JSON value; the hottest entries survive because every hit moves them to the end.
 *  `size` is the file's byte length and `stamp` the bucket listing's version mark for it
 *  (updated_at + eTag), when known: both drive the revalidation in readJson(). */
function remember(path, value, at = Date.now(), { size = 0, stamp = null } = {}) {
  if (jsonCache.has(path)) jsonCache.delete(path);
  else if (jsonCache.size >= JSON_MAX) jsonCache.delete(jsonCache.keys().next().value);
  jsonCache.set(path, { value, at, size, stamp });
}

function recall(path) {
  const hit = jsonCache.get(path);
  if (!fresh(hit, JSON_TTL_MS)) return null;
  jsonCache.delete(path);
  jsonCache.set(path, hit);
  return hit;
}

export function invalidate(path) {
  writes.set(path, writeSeq(path) + 1);
  jsonCache.delete(path);
  blobCache.delete(path);
  // A write under a prefix may add a name to the listing of any ancestor.
  for (let i = path.indexOf('/'); i > 0; i = path.indexOf('/', i + 1)) {
    const prefix = path.slice(0, i);
    listCache.delete(prefix);
    writes.set(prefix, writeSeq(prefix) + 1);
  }
}

/** Changes whenever a run is created or deleted; cheap to compare across requests. */
export function runsRevision() {
  return runsVersion;
}

function runsChanged() {
  runsVersion += 1;
  listCache.delete('runs');
}

/**
 * Memoise a derived value on the identity of its inputs. readJson() hands back the
 * same object for a path until it is written or expires, so loaders that merge a
 * few files can skip the merge while every input is the object they saw last time.
 * The value is shared between requests: callers must treat it as read-only.
 */
export function memoizeByInputs(load, compute) {
  let last = null;
  return async (...args) => {
    const inputs = await load(...args);
    if (last && last.inputs.length === inputs.length && last.inputs.every((v, i) => v === inputs[i])) return last.value;
    const value = compute(...inputs);
    last = { inputs, value };
    return value;
  };
}

/** The signed-in user, verified with Supabase Auth at most once a minute per session cookie. */
export async function getSessionUser() {
  if (DEV && process.env.NHL_DEV_USER_EMAIL) return { id: 'dev', email: process.env.NHL_DEV_USER_EMAIL };
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const key = all.filter((c) => AUTH_COOKIE_RE.test(c.name)).map((c) => `${c.name}=${c.value}`).join(';');
  if (!key) return null;
  const hit = sessionCache.get(key);
  if (fresh(hit, SESSION_TTL_MS)) return hit.user;
  // The page and its first API calls arrive together: one Supabase check serves them all.
  return share(`session:${key}`, async () => {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return all; }, setAll() {} } }
    );
    let user = null;
    try {
      ({ data: { user } } = await supabase.auth.getUser());
    } catch {
      user = null;
    }
    // Only successful checks are cached; a failed one is retried on the next request.
    if (user) {
      if (sessionCache.size > 50) sessionCache.clear();
      sessionCache.set(key, { user, at: Date.now() });
    }
    return user || null;
  });
}

/** Returns { user } for an admin, or { response } to return immediately. */
export async function requireNhlAdmin() {
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: 'not_authenticated' }, { status: 401 }) };
  if (!isNhlAdmin(user)) return { response: Response.json({ error: 'forbidden' }, { status: 403 }) };
  return { user };
}

let admin = null;
function getAdmin() {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are not configured');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

let bucketReady = false;
async function bucket() {
  if (DEV && process.env.NHL_STORE_DRIVER === 'fs') {
    const { fsBucket } = await import('./nhl-store-fs');
    return fsBucket();
  }
  const db = getAdmin();
  if (!bucketReady) {
    const { data } = await db.storage.getBucket(NHL_BUCKET);
    if (!data) {
      const { error } = await db.storage.createBucket(NHL_BUCKET, {
        public: false,
        fileSizeLimit: MAX_FILE_BYTES,
      });
      if (error && !/already exists/i.test(error.message)) throw error;
    }
    bucketReady = true;
  }
  return db.storage.from(NHL_BUCKET);
}

export function isValidRunId(id) {
  return typeof id === 'string' && RUN_ID_RE.test(id);
}

export function newRunId(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `${stamp}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function putJson(store, path, value) {
  const text = JSON.stringify(value);
  const body = new Blob([text], { type: 'application/json' });
  // cacheControl 0: these JSON files are read-modify-write; a CDN-cached copy
  // would make the next update overwrite newer data with stale data.
  const { error } = await store.upload(path, body, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) throw error;
  return text;
}

/** Cache what was just written as a fresh copy: callers usually mutate the object
 *  readJson() gave them before writing it back, and the identity-based memos need a
 *  new object to notice the change. */
function rememberWritten(path, text) {
  invalidate(path);
  remember(path, JSON.parse(text), Date.now(), { size: text.length });
}

/** Download and parse one JSON file: { value, size } (value null when missing or unparsable). */
async function downloadJson(store, path) {
  const { data, error } = await store.download(path);
  if (error || !data) return { value: null, size: 0 };
  const text = await data.text();
  try { return { value: JSON.parse(text), size: text.length }; } catch { return { value: null, size: text.length }; }
}

async function getJson(store, path) {
  return (await downloadJson(store, path)).value;
}

/** Saves uploaded files for the given slots into a run; returns file metadata. */
async function putInputs(store, runId, files) {
  const meta = {};
  for (const [slot, file] of Object.entries(files)) {
    if (!NHL_SLOTS.includes(slot) || !file || typeof file.arrayBuffer !== 'function') continue;
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 15 MB`);
    const path = `runs/${runId}/inputs/${slot}`;
    const { error } = await store.upload(path, file, {
      upsert: true,
      cacheControl: '0',
      contentType: file.type || XLSX_TYPE,
    });
    if (error) throw error;
    meta[slot] = { name: file.name || `${slot}.xlsx`, size: file.size, path };
  }
  return meta;
}

export async function createRun({ files, summary, results, user }) {
  const store = await bucket();
  const id = newRunId();
  const fileMeta = await putInputs(store, id, files);
  const now = new Date().toISOString();
  const manifest = {
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: user?.email || null,
    ...sanitizeSummary(summary),
    files: fileMeta,
    hasResults: false,
  };
  if (results !== undefined && results !== null) {
    await putJson(store, `runs/${id}/results.json`, results);
    manifest.hasResults = true;
  }
  const saved = await putManifest(store, id, manifest);
  runsChanged();
  return saved;
}

export async function addRunFiles(id, files) {
  const store = await bucket();
  const manifest = await getManifest(store, id);
  if (!manifest) return null;
  const fileMeta = await putInputs(store, id, files);
  // Attaching inputs changes neither the run list nor what the slate reads from a run.
  return putManifest(store, id, { ...manifest, files: { ...(manifest.files || {}), ...fileMeta }, updatedAt: new Date().toISOString() });
}

// Manifests are written only here, so the read cache stays coherent: a write
// refreshes its own entry and a delete drops it. Cached manifests are shared
// between requests: treat them as read-only.
const manifestPath = (id) => `runs/${id}/manifest.json`;

async function getManifest(store, id) {
  const path = manifestPath(id);
  const hit = recall(path);
  if (hit) return hit.value;
  // The run list and the slate's run lookup often ask for the same manifests at once.
  return share(path, async () => {
    const seq = writeSeq(path);
    const { value, size } = await downloadJson(store, path);
    // A write that landed while this read was in flight wins.
    if (value && seq === writeSeq(path)) remember(path, value, Date.now(), { size });
    return value;
  });
}

async function putManifest(store, id, manifest) {
  const text = await putJson(store, manifestPath(id), manifest);
  rememberWritten(manifestPath(id), text);
  return jsonCache.get(manifestPath(id)).value;
}

/** Every run id in the bucket, newest first (listed at most once a minute). */
async function listRunIds() {
  return (await listNames('runs')).filter(isValidRunId).sort().reverse();
}

export async function listRuns(limit = 60) {
  const store = await bucket();
  const ids = (await listRunIds()).slice(0, limit);
  const manifests = await Promise.all(ids.map((id) => getManifest(store, id)));
  return manifests.filter(Boolean);
}

/**
 * The newest run (by id, which is creation-stamped) whose manifest satisfies `match`, or
 * null among the newest `limit`. Manifests are read a batch at a time, newest first, so
 * finding tonight's run costs one small batch instead of every manifest in the bucket.
 */
export async function findRun(match, { limit = 80, batch = 10 } = {}) {
  const store = await bucket();
  const ids = (await listRunIds()).slice(0, limit);
  for (let i = 0; i < ids.length; i += batch) {
    const manifests = await Promise.all(ids.slice(i, i + batch).map((id) => getManifest(store, id)));
    const found = manifests.find((m) => m && match(m));
    if (found) return found;
  }
  return null;
}

export async function getRun(id) {
  const store = await bucket();
  return getManifest(store, id);
}

export async function getRunResults(id) {
  const store = await bucket();
  return getJson(store, `runs/${id}/results.json`);
}

export async function getRunFile(id, slot) {
  const store = await bucket();
  const manifest = await getManifest(store, id);
  const meta = manifest?.files?.[slot];
  if (!meta) return null;
  const { data, error } = await store.download(meta.path);
  if (error || !data) return null;
  return { blob: data, name: meta.name };
}

export async function deleteRun(id) {
  const store = await bucket();
  const paths = [`runs/${id}/manifest.json`, `runs/${id}/results.json`];
  const { data } = await store.list(`runs/${id}/inputs`, { limit: 100 });
  for (const f of data || []) paths.push(`runs/${id}/inputs/${f.name}`);
  const { error } = await store.remove(paths);
  if (error) throw error;
  invalidate(manifestPath(id));
  runsChanged();
  return true;
}

function clip(s, n) {
  return typeof s === 'string' ? s.slice(0, n) : null;
}

export function sanitizeSummary(summary) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const num = (v) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    label: clip(s.label, 120),
    autoKey: clip(s.autoKey, 200),
    source: clip(s.source, 20),
    slateDate: clip(s.slateDate, 20),
    games: Array.isArray(s.games)
      ? s.games.slice(0, 24).map((g) => ({
          label: clip(g?.label, 80),
          home: clip(g?.home, 40),
          away: clip(g?.away, 40),
        }))
      : [],
    playerCount: num(s.playerCount),
    topPicks: Array.isArray(s.topPicks)
      ? s.topPicks.slice(0, 8).map((p) => ({
          name: clip(p?.name, 60),
          team: clip(p?.team, 40),
          market: clip(p?.market, 30),
          prob: num(p?.prob),
        }))
      : [],
  };
}

// ── Generic helpers used by the data automation (lib/nhl-data) ─────────────
// Values from readJson() are shared between requests and with the identity-based
// memos (loadPlayers, loadRows, …): read-modify-write callers get a fresh copy
// cached on write, but should not otherwise mutate what they are handed.
//
// Past its TTL an entry is revalidated from the folder's listing before anything is
// downloaded again: a stale miss stays a miss while the name is absent, and a stale file
// is kept while the listing's version mark (updated_at + eTag) is the one it was
// downloaded under. The listing is fetched for misses and for big files (where it is
// much cheaper than the download); small files are simply re-downloaded. Listings are
// shared per folder and cached a minute, so the slate's few dozen PropFinder lookups cost
// one call and a season of rows is re-downloaded only when it changed.
//
// `revalidate: true` asks for the listing before the first download too, so the file's
// version mark is known from the start (for the big files read on every request).
export async function readJson(path, { revalidate = false } = {}) {
  const hit = recall(path);
  if (hit) return hit.value;
  return share(path, () => fetchJson(path, revalidate));
}

const folderOf = (path) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);

async function fetchJson(path, revalidate) {
  const stale = jsonCache.get(path) || null; // expired entry, if any
  const seq = writeSeq(path);
  const store = await bucket();
  const useListing = revalidate || (stale && (stale.value === null || stale.stamp || stale.size >= BIG_BYTES));
  let entry;
  if (useListing) {
    const listing = await listEntries(folderOf(path)).catch(() => null);
    if (listing?.complete && seq === writeSeq(path)) {
      entry = listing.entries.get(nameOf(path)) || null;
      // Absent from a complete listing: a miss, with nothing to download.
      if (!entry) { remember(path, null, missAt()); return null; }
      if (stale?.value != null && stale.stamp && entry.stamp === stale.stamp) { remember(path, stale.value, Date.now(), stale); return stale.value; }
    }
  }
  // The listing was read before the download, so its mark is never newer than the content.
  const { value, size } = await downloadJson(store, path);
  // A write that landed while this read was in flight wins. Misses are cached
  // too (a missing file is a common, cheap answer), but briefly.
  if (seq === writeSeq(path)) remember(path, value, value === null ? missAt() : Date.now(), { size, stamp: value === null ? null : entry?.stamp || null });
  return value;
}

export async function writeJson(path, value) {
  invalidate(path);
  const text = await putJson(await bucket(), path, value);
  rememberWritten(path, text);
}

export async function writeBlob(path, blob, contentType) {
  invalidate(path);
  const store = await bucket();
  const { error } = await store.upload(path, blob, { upsert: true, contentType: contentType || 'application/octet-stream', cacheControl: '0' });
  if (error) throw error;
}

/** Small files (logos, headshots) are kept in memory; bigger ones stream through. */
export async function readBlob(path, { cache = false } = {}) {
  const hit = cache ? blobCache.get(path) : null;
  if (fresh(hit, BLOB_TTL_MS)) return hit.blob;
  const store = await bucket();
  const { data, error } = await store.download(path);
  if (error || !data) return null;
  if (cache && data.size <= 512 * 1024) {
    if (blobCache.size >= BLOB_MAX) blobCache.delete(blobCache.keys().next().value);
    blobCache.set(path, { blob: data, at: Date.now() });
  }
  return data;
}

/**
 * One folder's listing, at most once a minute (writes through this module refresh it):
 * { names, entries: Map(name → { stamp, size }), complete }. `stamp` is the bucket's
 * version mark for the file (updated_at + eTag; null when the driver gives none) and
 * `complete` says the folder fit in one page, so an absent name means a missing file.
 */
async function listEntries(prefix) {
  const hit = listCache.get(prefix);
  if (fresh(hit, LIST_TTL_MS)) return hit;
  return share(`list:${prefix}`, async () => {
    const store = await bucket();
    const seq = writeSeq(prefix);
    const { data, error } = await store.list(prefix, { limit: LIST_LIMIT });
    if (error) throw error;
    const entries = new Map();
    for (const e of data || []) {
      const stamp = e.updated_at || e.metadata?.eTag ? `${e.updated_at || ''}|${e.metadata?.eTag || ''}` : null;
      entries.set(e.name, { stamp, size: Number(e.metadata?.size) || 0 });
    }
    const listing = { names: [...entries.keys()], entries, complete: entries.size < LIST_LIMIT, at: Date.now() };
    // Only keep it if nothing under the prefix changed while the listing was in flight.
    if (seq === writeSeq(prefix)) listCache.set(prefix, listing);
    return listing;
  });
}

/** File names directly under `prefix` (listed at most once a minute; writes through this module refresh it). */
export async function listNames(prefix) {
  return (await listEntries(prefix)).names;
}
