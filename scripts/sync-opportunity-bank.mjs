#!/usr/bin/env node
import path from 'path';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const cwd = process.cwd();
const defaultBankPath = path.join(cwd, '..', '..', 'state', 'opportunity-radar', 'idea-bank.json');
const table = process.env.OPPORTUNITY_BANK_TABLE || 'opportunity_bank';

const starterSeeds = [
  {
    key: 'starter::b2b::Accelerates::product photo upload::Shopify owners',
    mode: 'b2b',
    action: 'Accelerates',
    workflow: 'product photo upload',
    industry: 'Shopify owners',
    title: 'Product photo upload accelerator for Shopify owners',
    one_liner: 'Reduce the manual drag, rename, crop, and publish loop that slows new SKU launches for Shopify merchants.',
    pain_signal: 'Uploading and organizing product photos is still a repetitive bottleneck before a product can go live.',
    why_now: 'Merchants ship more SKUs and channels than before, but listing operations are still painfully manual.',
    score: 18,
    source: 'starter_seed',
    source_url: '',
    first_seen_at: '2026-06-08T00:00:00.000Z',
    last_seen_at: '2026-06-08T00:00:00.000Z',
    times_seen: 1,
  },
];

function parseDotEnv(raw) {
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadLocalEnv() {
  const envPath = path.join(cwd, '.env.local');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    const parsed = parseDotEnv(raw);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

function normalizeSeed(seed) {
  const mode = String(seed?.mode || 'b2b').trim().toLowerCase();
  const action = String(seed?.action || '').trim();
  const workflow = String(seed?.workflow || '').trim().toLowerCase();
  const industry = String(seed?.industry || '').trim();
  if (!action || !workflow || !industry) return null;
  return {
    key: String(seed?.key || `${mode}::${action}::${workflow}::${industry}`).trim(),
    mode: mode === 'consumer' ? 'consumer' : 'b2b',
    action,
    workflow,
    industry,
    title: String(seed?.title || '').trim(),
    one_liner: String(seed?.one_liner || '').trim(),
    pain_signal: String(seed?.pain_signal || '').trim(),
    why_now: String(seed?.why_now || '').trim(),
    score: Number(seed?.score || 0),
    source: String(seed?.source || '').trim(),
    source_url: String(seed?.source_url || '').trim(),
    first_seen_at: String(seed?.first_seen_at || seed?.created_at || ''),
    last_seen_at: String(seed?.last_seen_at || seed?.updated_at || ''),
    times_seen: Number(seed?.times_seen || 1),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  await loadLocalEnv();
  const bankPath = process.env.OPPORTUNITY_BANK_PATH || defaultBankPath;
  let parsed = [];
  let bankFileFound = true;
  try {
    const raw = await fs.readFile(bankPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    bankFileFound = false;
  }
  const rows = [...starterSeeds, ...(Array.isArray(parsed) ? parsed : [])].map(normalizeSeed).filter(Boolean);

  if (dryRun) {
    console.log(JSON.stringify({ bankPath, bankFileFound, table, count: rows.length, sample: rows.slice(0, 3) }, null, 2));
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { error } = await db.from(table).upsert(rows, { onConflict: 'key' });
  if (error) throw error;

  console.log(`Synced ${rows.length} workflow-bank seeds to ${table}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
