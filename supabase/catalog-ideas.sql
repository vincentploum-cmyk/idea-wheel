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

-- Lock the table down. The app reads catalog_ideas ONLY through the service-role
-- client (lib/catalog-store.js -> getAdmin), which bypasses RLS. With RLS enabled
-- and no anon/authenticated policy, the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY,
-- which ships in the browser bundle) can no longer read the paid research/blueprints
-- directly from the database.
alter table public.catalog_ideas enable row level security;

drop policy if exists "Service role manages catalog_ideas" on public.catalog_ideas;
create policy "Service role manages catalog_ideas"
  on public.catalog_ideas
  for all
  to service_role
  using (true)
  with check (true);
