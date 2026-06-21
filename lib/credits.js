// lib/credits.js
// Works with the actual credits table schema:
// credits(id, created_at, user_id, change, reason, blueprint_id, stripe_payment_intent)
// Balance = sum of all change values for a user

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export const CREDIT_COSTS = { spin: 1, blueprint: 5 };
export const FREE_SPIN_LIMIT = 3;
export const WELCOME_CREDIT_GRANT = 3;

export const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', type: 'spin', credits: 5,  ideaCredits: 0, price_cents: 399,  price_display: '$3.99',  tagline: 'Best for spinning, testing, and building your own ideas' },
  { id: 'pro',     label: 'Pro',     type: 'idea', credits: 0,  ideaCredits: 1, price_cents: 999,  price_display: '$9.99',  tagline: 'Skip the blank page and unlock 1 ready-made idea' },
  { id: 'power',   label: 'Power',   type: 'idea', credits: 0,  ideaCredits: 2, price_cents: 1999, price_display: '$19.99', tagline: 'Unlock 2 ready-made ideas and chase the best one' },
];

// Get spin credit balance — excludes idea credit rows
export async function getBalance(userId) {
  const db = getAdmin();
  const { data, error } = await db
    .from('credits')
    .select('change, reason')
    .eq('user_id', userId);
  if (error || !data) return 0;
  return data
    .filter(r => r.reason !== 'idea_credit_grant' && !r.reason?.startsWith('idea_unlock_'))
    .reduce((sum, row) => sum + (row.change || 0), 0);
}

// Get remaining idea unlock credits (Pro = 1, Power = 2, minus ideas already unlocked)
export async function getIdeaCreditBalance(userId) {
  const db = getAdmin();
  if (!db || !userId) return 0;
  const { data } = await db
    .from('credits')
    .select('change, reason')
    .eq('user_id', userId);
  if (!data) return 0;
  return data
    .filter(r => r.reason === 'idea_credit_grant' || r.reason?.startsWith('idea_unlock_'))
    .reduce((sum, row) => sum + (row.change || 0), 0);
}

// Check if user has unlocked a specific catalog idea
export async function hasUnlockedIdea(userId, slug) {
  const db = getAdmin();
  if (!db || !userId || !slug) return false;
  const { data } = await db
    .from('credits')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', `idea_unlock_${slug}`)
    .limit(1);
  return !!data?.length;
}

// Grant idea credits on Pro/Power purchase (idempotent by stripe session)
export async function addIdeaCredits(userId, amount, metadata = {}) {
  const db = getAdmin();
  const stripeRef = metadata.stripe_session_id || null;

  if (stripeRef) {
    const { data: existing } = await db
      .from('credits')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'idea_credit_grant')
      .eq('stripe_payment_intent', stripeRef)
      .limit(1);
    if (existing?.length) {
      return { ok: true, duplicate: true, balance: await getIdeaCreditBalance(userId) };
    }
  }

  const { error } = await db.from('credits').insert({
    user_id: userId,
    change: +amount,
    reason: 'idea_credit_grant',
    stripe_payment_intent: stripeRef,
  });
  if (error) throw new Error(`addIdeaCredits failed: ${error.message}`);
  return { ok: true, balance: await getIdeaCreditBalance(userId) };
}

// Spend 1 idea credit to unlock a specific catalog idea (idempotent)
export async function spendIdeaCredit(userId, slug) {
  const db = getAdmin();
  const already = await hasUnlockedIdea(userId, slug);
  if (already) return { ok: true, alreadyUnlocked: true };

  const balance = await getIdeaCreditBalance(userId);
  if (balance < 1) return { ok: false, reason: 'insufficient_idea_credits', balance };

  const { error } = await db.from('credits').insert({
    user_id: userId,
    change: -1,
    reason: `idea_unlock_${slug}`,
  });
  if (error) throw new Error(`spendIdeaCredit failed: ${error.message}`);
  return { ok: true, balance: balance - 1 };
}

// Deduct credits atomically — checks balance first
export async function deductCredits(userId, amount, reason, metadata = {}) {
  const db = getAdmin();
  const balance = await getBalance(userId);
  if (balance < amount) {
    return { ok: false, reason: 'insufficient_credits', balance };
  }
  const { error } = await db.from('credits').insert({
    user_id: userId,
    change: -amount,
    reason,
    blueprint_id: metadata.blueprintId || null,
    stripe_payment_intent: metadata.stripe_payment_intent || null,
  });
  if (error) throw new Error(`deductCredits failed: ${error.message}`);
  return { ok: true, newBalance: balance - amount };
}

// Add credits (purchase fulfillment)
export async function addCredits(userId, amount, reason, metadata = {}) {
  const db = getAdmin();
  const stripeRef = metadata.stripe_session_id || metadata.stripe_payment_intent || null;

  if (reason === 'purchase' && stripeRef) {
    const { data: existing } = await db
      .from('credits')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'purchase')
      .eq('stripe_payment_intent', stripeRef)
      .limit(1);

    if (existing?.length) {
      return { ok: true, duplicate: true, newBalance: await getBalance(userId) };
    }
  }

  const { error } = await db.from('credits').insert({
    user_id: userId,
    change: +amount,
    reason,
    stripe_payment_intent: stripeRef,
  });
  if (error) throw new Error(`addCredits failed: ${error.message}`);
  const newBalance = await getBalance(userId);
  return { ok: true, newBalance };
}

export async function ensureWelcomeGrant(userId) {
  const db = getAdmin();
  const { data: existing } = await db
    .from('credits')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', 'welcome_grant')
    .limit(1);

  if (existing?.length) {
    return { ok: true, alreadyGranted: true, newBalance: await getBalance(userId) };
  }

  const { error } = await db.from('credits').insert({
    user_id: userId,
    change: WELCOME_CREDIT_GRANT,
    reason: 'welcome_grant',
  });

  if (error) throw new Error(`ensureWelcomeGrant failed: ${error.message}`);
  return { ok: true, alreadyGranted: false, newBalance: await getBalance(userId) };
}


// Get recent transactions for profile page
export async function getTransactions(userId, limit = 10) {
  const db = getAdmin();
  const { data } = await db
    .from('credits')
    .select('change, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// Free spin tracking — uses free_spin_usage table
export async function checkAndIncrementFreeSpin(fingerprint) {
  const db = getAdmin();
  const { data: row } = await db
    .from('free_spin_usage')
    .select('spin_count')
    .eq('fingerprint', fingerprint)
    .single();
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
  const { data } = await db
    .from('free_spin_usage')
    .select('spin_count')
    .eq('fingerprint', fingerprint)
    .single();
  return data?.spin_count ?? 0;
}
