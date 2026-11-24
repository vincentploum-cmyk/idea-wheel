#!/usr/bin/env node
// Copies the NBA nights out of the store's Supabase bucket into a local folder, byte for byte (a gzipped file stays
// gzipped; the readers tell by the magic bytes), for an offline replay of the boards as the site had them
// (docs/audits/2026-11-24-nba-top10.md). Read-only: it lists and downloads, never writes to the bucket.
//
//   node --env-file=.env.local tools/audit/nba-store-dump.mjs --from 2026-10-21 --to 2026-11-24 --out nba-store
//   zip -rq nba-store.zip nba-store
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the site's .env.local); the bucket is NHL_MODEL_BUCKET or
// 'nhl-model'. Resumable: a file already on disk is skipped.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg('--from', '2026-10-01'); const TO = arg('--to', '2099-12-31'); const OUT = arg('--out', 'nba-store');
const SPORT = arg('--sport', 'nba');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (run with --env-file=.env.local)'); process.exit(2); }
const store = createClient(url, key, { auth: { persistSession: false } }).storage.from(process.env.NHL_MODEL_BUCKET || 'nhl-model');

async function list(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await store.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

// A folder comes back with no id; a file with one.
async function walk(prefix, files) {
  for (const e of await list(prefix)) {
    const p = `${prefix}/${e.name}`;
    if (e.id == null) await walk(p, files); else files.push(p);
  }
  return files;
}

const dates = (await list(SPORT)).filter((e) => e.id == null && /^\d{4}-\d{2}-\d{2}$/.test(e.name) && e.name >= FROM && e.name <= TO).map((e) => e.name).sort();
console.error(`${dates.length} nights, ${dates[0] || '—'} to ${dates[dates.length - 1] || '—'}`);
let got = 0; let skipped = 0; let bytes = 0;
for (const d of dates) {
  const files = await walk(`${SPORT}/${d}`, []);
  for (const f of files) {
    if (f.endsWith('.pdf')) continue;   // the cheat sheets' PDFs: their parsed JSON is beside them
    const dest = path.join(OUT, f);
    if (fs.existsSync(dest)) { skipped++; continue; }
    const { data, error } = await store.download(f);
    if (error) { console.error(`  ${f}: ${error.message}`); continue; }
    const buf = Buffer.from(await data.arrayBuffer());
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    got++; bytes += buf.length;
  }
  console.error(`  ${d}: ${files.length} files`);
}
console.error(`done: ${got} downloaded (${(bytes / 1e6).toFixed(1)} MB), ${skipped} already on disk, in ${OUT}/`);
