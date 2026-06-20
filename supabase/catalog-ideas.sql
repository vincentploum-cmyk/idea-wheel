-- catalog_ideas: pre-generated research and blueprint for curated ideas on /ideas page.
-- Run once in Supabase SQL editor before calling /api/admin/seed-catalog.

create table if not exists public.catalog_ideas (
  slug          text primary key,
  research      jsonb,
  blueprint     jsonb,
  generated_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Per-idea blueprint unlocks are tracked in the credits table with
-- reason = 'idea_blueprint_<slug>' (no extra table needed).
