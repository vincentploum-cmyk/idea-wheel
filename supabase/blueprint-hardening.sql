-- Blueprint gate hardening: validation ownership + blueprint charge idempotency.
-- SELF-CONTAINED: creates the two base tables if moat-v2.sql / credit-integrity.sql
-- were never applied (the app has been silently falling back to per-instance
-- JSONL, which is why the gate can 404 legit ideas after a redeploy).
-- Idempotent — safe to run repeatedly.

create extension if not exists pgcrypto;

-- Base: durable validation record the blueprint gate reads from.
create table if not exists public.pipeline_validations (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  mode_name    text,
  action       text,
  workflow     text,
  industry     text,
  agent_desc   text,
  retrieval    jsonb,
  scout        jsonb,
  skeptic      jsonb,
  judge        jsonb,
  eval         jsonb,
  verdict_type text,
  usage        jsonb,
  cost_usd     numeric,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pipeline_validations_session_id on public.pipeline_validations(session_id);
create index if not exists idx_pipeline_validations_mode_industry on public.pipeline_validations(mode_name, industry);
alter table public.pipeline_validations enable row level security;

-- Base: durable blueprint charge tokens (dedup + reuse across instances).
create table if not exists public.blueprint_charges (
  id          uuid primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.blueprint_charges enable row level security;

-- 1) OWNERSHIP — blueprint gate must reject other users' validationIds. Nullable
--    so pre-migration rows aren't invalidated; the gate treats null-owner rows
--    as legacy pass-through (never blocked, never claimed as anyone else's).
alter table public.pipeline_validations add column if not exists user_id text;
create index if not exists pipeline_validations_user_idx on public.pipeline_validations (user_id);

-- 2) IDEMPOTENT DEBIT — concurrent/retried designer calls must not double-charge.
--    Extend the unlock-style unique index to cover per-validation blueprint
--    reasons ("blueprint_started:<validationId>"), matching how
--    catalog_unlock_% / idea_blueprint_% already dedupe.
create unique index if not exists credits_blueprint_start_idem
  on public.credits (user_id, reason)
  where reason like 'blueprint_started:%';

-- 3) CHARGE LOOKUP by (user, validation) — after a dedup returns duplicate=true,
--    findBlueprintChargeByKey() looks up the ALREADY-authorized charge instead
--    of minting a new one or 500-ing. blueprint_charges stores payload as jsonb
--    `data`; a functional index makes the lookup fast.
create index if not exists blueprint_charges_user_validation_idx
  on public.blueprint_charges ((data->>'userId'), (data->>'validationId'));
