import path from 'path';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_BANK_PATH = path.join(process.cwd(), '..', '..', 'state', 'opportunity-radar', 'idea-bank.json');
const OPPORTUNITY_BANK_TABLE = process.env.OPPORTUNITY_BANK_TABLE || 'opportunity_bank';

const STARTER_SEEDS = [
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

let adminClient;

function getAdmin() {
  if (adminClient !== undefined) return adminClient;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminClient = null;
    return adminClient;
  }
  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return adminClient;
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
  };
}

function mergeSeeds(...collections) {
  const merged = new Map();
  for (const seed of collections.flat()) {
    const normalized = normalizeSeed(seed);
    if (!normalized) continue;
    const existing = merged.get(normalized.key);
    if (!existing) {
      merged.set(normalized.key, normalized);
      continue;
    }
    merged.set(normalized.key, {
      ...existing,
      ...normalized,
      score: Math.max(existing.score || 0, normalized.score || 0),
      times_seen: Math.max(existing.times_seen || 1, normalized.times_seen || 1),
      first_seen_at: existing.first_seen_at || normalized.first_seen_at,
      last_seen_at: normalized.last_seen_at || existing.last_seen_at,
    });
  }
  return Array.from(merged.values()).sort((a, b) => {
    const timeDiff = Date.parse(b.last_seen_at || '') - Date.parse(a.last_seen_at || '');
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    return (b.score || 0) - (a.score || 0);
  });
}

async function loadOpportunityBankFromFile() {
  const bankPath = process.env.OPPORTUNITY_BANK_PATH || DEFAULT_BANK_PATH;
  try {
    const raw = await fs.readFile(bankPath, 'utf8');
    const parsed = JSON.parse(raw);
    return mergeSeeds(STARTER_SEEDS, Array.isArray(parsed) ? parsed : []);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('[opportunity-bank/file]', err.message);
    }
    return mergeSeeds(STARTER_SEEDS);
  }
}

async function loadOpportunityBankFromSupabase(limit = 200) {
  const db = getAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from(OPPORTUNITY_BANK_TABLE)
    .select('key, mode, action, workflow, industry, title, one_liner, pain_signal, why_now, score, source, source_url, first_seen_at, last_seen_at, times_seen')
    .order('last_seen_at', { ascending: false })
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return mergeSeeds(Array.isArray(data) ? data : []);
}

export async function loadOpportunityBank() {
  try {
    const remote = await loadOpportunityBankFromSupabase();
    if (remote.length) return mergeSeeds(STARTER_SEEDS, remote);
  } catch (err) {
    const message = err?.message || '';
    if (!message.includes('Could not find the table') && !message.includes('schema cache')) {
      console.error('[opportunity-bank/supabase]', message);
    }
  }
  return loadOpportunityBankFromFile();
}

export async function syncOpportunityBankToSupabase(seeds = []) {
  const db = getAdmin();
  if (!db) throw new Error('Supabase service role not configured');

  const rows = mergeSeeds(seeds)
    .map((seed) => normalizeSeed(seed))
    .filter(Boolean)
    .map((seed) => ({
      ...seed,
      updated_at: new Date().toISOString(),
    }));

  if (!rows.length) {
    return { ok: true, count: 0 };
  }

  const { error } = await db
    .from(OPPORTUNITY_BANK_TABLE)
    .upsert(rows, { onConflict: 'key' });

  if (error) throw error;
  return { ok: true, count: rows.length };
}

export { DEFAULT_BANK_PATH, STARTER_SEEDS, mergeSeeds, normalizeSeed };
