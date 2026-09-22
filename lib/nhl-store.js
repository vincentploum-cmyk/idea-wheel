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
import { isNhlAdmin } from './nhl-admin';

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

export async function getSessionUser() {
  if (DEV && process.env.NHL_DEV_USER_EMAIL) return { id: 'dev', email: process.env.NHL_DEV_USER_EMAIL };
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
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
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' });
  const { error } = await store.upload(path, body, { upsert: true, contentType: 'application/json' });
  if (error) throw error;
}

async function getJson(store, path) {
  const { data, error } = await store.download(path);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()); } catch { return null; }
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
  await putJson(store, `runs/${id}/manifest.json`, manifest);
  return manifest;
}

export async function addRunFiles(id, files) {
  const store = await bucket();
  const manifest = await getJson(store, `runs/${id}/manifest.json`);
  if (!manifest) return null;
  const fileMeta = await putInputs(store, id, files);
  manifest.files = { ...(manifest.files || {}), ...fileMeta };
  manifest.updatedAt = new Date().toISOString();
  await putJson(store, `runs/${id}/manifest.json`, manifest);
  return manifest;
}

export async function listRuns(limit = 60) {
  const store = await bucket();
  const { data, error } = await store.list('runs', {
    limit: 1000,
    sortBy: { column: 'name', order: 'desc' },
  });
  if (error) throw error;
  const ids = (data || [])
    .map((e) => e.name)
    .filter(isValidRunId)
    .sort()
    .reverse()
    .slice(0, limit);
  const manifests = await Promise.all(ids.map((id) => getJson(store, `runs/${id}/manifest.json`)));
  return manifests.filter(Boolean);
}

export async function getRun(id) {
  const store = await bucket();
  return getJson(store, `runs/${id}/manifest.json`);
}

export async function getRunResults(id) {
  const store = await bucket();
  return getJson(store, `runs/${id}/results.json`);
}

export async function getRunFile(id, slot) {
  const store = await bucket();
  const manifest = await getJson(store, `runs/${id}/manifest.json`);
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
