// lib/credits.js
// Credit balance reads and atomic deductions.
// Always uses service-role client to bypass RLS.

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// Deep market research costs 1 credit, a full blueprint costs 2.
export const CREDIT_COSTS = { spin: 1, deepResearch: 1, blueprint: 2 };
export const FREE_SPIN_LIMIT = 3;

// Taglines assume the research (1) + blueprint (2) funnel.
export const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', credits: 5,  price_cents: 499,  price_display: '$4.99', tagline: '2 full blueprints' },
  { id: 'pro',     label: 'Pro',     credits: 10, price_cents: 900,  price_display: '$9',    tagline: '5 full blueprints' },
  { id: 'power',   label: 'Power',   credits: 25, price_cents: 1900, price_display: '$19',   tagline: '12 full blueprints' },
];

export async function getBalance(userId) {
  const db = getAdmin();
  const { data, error } = await db.from('credits').select('balance').eq('user_id', userId).single();
  if (error) return 0;
  return data?.balance ?? 0;
}

export async function deductCredits(userId, amount, reason, metadata = {}) {
  const db = getAdmin();
  const { data: row, error } = await db.from('credits').select('balance').eq('user_id', userId).single();
  if (error) return { ok: false, reason: 'no_credits_row' };
  const current = row.balance;
  if (current < amount) return { ok: false, reason: 'insufficient_credits', balance: current };
  const newBalance = current - amount;
  const { error: updateErr } = await db.from('credits')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', current);
  if (updateErr) throw new Error(`deductCredits failed: ${updateErr.message}`);
  await db.from('credit_transactions').insert({ user_id: userId, amount: -amount, reason, metadata });
  return { ok: true, newBalance };
}

export async function addCredits(userId, amount, reason, metadata = {}) {
  const db = getAdmin();
  const { data: row } = await db.from('credits').select('balance, total_purchased').eq('user_id', userId).single();
  const current = row?.balance ?? 0;
  const totalPurchased = row?.total_purchased ?? 0;
  const newBalance = current + amount;
  await db.from('credits').upsert({
    user_id: userId, balance: newBalance,
    total_purchased: reason === 'purchase' ? totalPurchased + amount : totalPurchased,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  await db.from('credit_transactions').insert({ user_id: userId, amount: +amount, reason, metadata });
  return { ok: true, newBalance };
}

// Every new account gets this many free credits — enough for one full funnel:
// 1 credit for deep market research + 2 credits for a blueprint.
export const WELCOME_CREDITS = 3;

// Grants the welcome credits exactly once: only when the user has no credits
// row yet. Idempotent — once a row exists (even at balance 0) we never re-grant.
export async function ensureWelcomeGrant(userId, amount = WELCOME_CREDITS) {
  const db = getAdmin();
  const { data: row } = await db.from('credits').select('user_id').eq('user_id', userId).maybeSingle();
  if (row) return { granted: false };
  await db.from('credits').upsert(
    { user_id: userId, balance: amount, total_purchased: 0, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  await db.from('credit_transactions').insert({ user_id: userId, amount, reason: 'welcome', metadata: {} });
  return { granted: true, balance: amount };
}

export async function checkAndIncrementFreeSpin(fingerprint) {
  const db = getAdmin();
  const { data: row } = await db.from('free_spin_usage').select('spin_count').eq('fingerprint', fingerprint).single();
  const count = row?.spin_count ?? 0;
  if (count >= FREE_SPIN_LIMIT) return { allowed: false, used: count, limit: FREE_SPIN_LIMIT };
  await db.from('free_spin_usage').upsert(
    { fingerprint, spin_count: count + 1, last_spin_at: new Date().toISOString() },
    { onConflict: 'fingerprint' }
  );
  return { allowed: true, used: count + 1, limit: FREE_SPIN_LIMIT };
}

export async function getFreeSpin(fingerprint) {
  const db = getAdmin();
  const { data } = await db.from('free_spin_usage').select('spin_count').eq('fingerprint', fingerprint).single();
  return data?.spin_count ?? 0;
}
