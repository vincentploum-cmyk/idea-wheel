-- Blueprint gate hardening: validation ownership + blueprint charge idempotency.
-- Idempotent: safe to run repeatedly.

-- 1) Validation ownership — the gate needs to check who owns the validation so a
--    user can't build a blueprint from someone else's validationId. Nullable so
--    older rows aren't invalidated; the gate treats null-owner rows as legacy
--    pass-through (never blocked, never claimed as anyone else's either).
alter table public.pipeline_validations add column if not exists user_id text;
create index if not exists pipeline_validations_user_idx on public.pipeline_validations (user_id);

-- 2) Blueprint credit idempotency — a concurrent/retried designer call must not
--    double-debit. Extend the unlock-style unique index to cover per-validation
--    blueprint reasons ("blueprint_started:<validationId>"), matching how
--    catalog_unlock_* / idea_blueprint_* already dedupe.
create unique index if not exists credits_blueprint_start_idem
  on public.credits (user_id, reason)
  where reason like 'blueprint_started:%';

-- 3) Blueprint charge lookup by (user, validation) — after a dedup returns
--    duplicate=true, we look up the ALREADY-authorized charge instead of
--    minting a new one or 500-ing. blueprint_charges stores the payload as
--    jsonb `data`; index the two keys we filter on.
create index if not exists blueprint_charges_user_validation_idx
  on public.blueprint_charges ((data->>'userId'), (data->>'validationId'));
