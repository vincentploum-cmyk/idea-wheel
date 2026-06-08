-- Saved ideas: every idea a user spent a credit on (extended market research)
-- is persisted here, together with its research outcome and — once generated —
-- its blueprint. Keyed by (user_id, validation_id) so research and a later
-- blueprint land on the same row.

create table if not exists public.saved_ideas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  validation_id    text,
  session_id       text,

  -- idea identity (enough to reconstruct and re-run a blueprint)
  action           text,
  workflow         text,
  industry         text,
  connector        text,
  mode_name        text,
  title            text,
  tagline          text,
  summary          text,            -- plain-English one-liner
  score            int,
  verdict_type     text,

  comp             jsonb,           -- the basic-research / validation package
  research         jsonb,           -- the extended market-research outcome
  blueprint        jsonb,           -- the generated blueprint (null until created)
  blueprint_status text not null default 'none',  -- none | complete

  credits_spent    int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, validation_id)
);

create index if not exists idx_saved_ideas_user on public.saved_ideas(user_id, updated_at desc);

alter table public.saved_ideas enable row level security;

-- Owners can read their own ideas directly; all writes go through the service
-- role (server routes), which bypasses RLS.
drop policy if exists "saved_ideas owner read" on public.saved_ideas;
create policy "saved_ideas owner read" on public.saved_ideas
  for select using (auth.uid() = user_id);
