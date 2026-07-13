-- Credit-integrity hardening. Run once in the Supabase SQL editor.
-- The app code is written to work WITHOUT this migration (it degrades to the
-- previous check-then-write behavior); applying it closes the concurrency races
-- at the database level and makes blueprint charges durable across instances.

-- 1) Purchase idempotency: at most one 'purchase' grant per Stripe session.
--    Closes the webhook + success-confirm double-grant race.
create unique index if not exists credits_purchase_idem
  on public.credits (stripe_payment_intent)
  where reason = 'purchase' and stripe_payment_intent is not null;

-- 2) Unlock idempotency: at most one unlock row per (user, unlock-reason).
--    Closes the double-charge race on the catalog-idea / catalog-blueprint /
--    ideas-library unlock routes.
create unique index if not exists credits_unlock_idem
  on public.credits (user_id, reason)
  where reason like 'catalog_unlock_%'
     or reason like 'idea_blueprint_%'
     or reason = 'ideas_unlock';

-- 3) Review-bonus idempotency: at most one 'review_bonus' grant per user.
--    Closes the review-credit farming path.
create unique index if not exists credits_review_bonus_idem
  on public.credits (user_id)
  where reason = 'review_bonus';

-- If any CREATE INDEX above fails with a duplicate-key error, pre-existing
-- duplicate rows (created by the very races we're fixing) must be removed first.
-- Inspect, then de-dup keeping the earliest row per group, e.g.:
--   delete from public.credits a using public.credits b
--   where a.reason = 'purchase' and b.reason = 'purchase'
--     and a.stripe_payment_intent = b.stripe_payment_intent
--     and a.ctid > b.ctid;
-- (Repeat per group for the unlock/review indexes.) Deleting a duplicate credit
-- row corrects a balance that was over-granted by the race, so review before running.

-- 4) Durable blueprint charge tokens (replaces the per-instance /tmp JSONL,
--    which was lost on restart and invisible across serverless instances).
create table if not exists public.blueprint_charges (
  id          uuid primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.blueprint_charges enable row level security;
-- No anon/authenticated policy: only the service role (which bypasses RLS)
-- touches this table (lib/moat-store.js uses the service-role client).
