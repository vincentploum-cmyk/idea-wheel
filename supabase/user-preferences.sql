-- Per-user preferences the app needs to honour.
-- Currently: opt-out of contributing to the public /ideas "vetted by founders"
-- catalog. Terms + Privacy Policy explicitly promise this control; storing it
-- here lets recordCandidate skip publication for that user.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  catalog_opt_out boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- A user can read their own row.
drop policy if exists "read own prefs" on public.user_preferences;
create policy "read own prefs" on public.user_preferences
  for select using (auth.uid() = user_id);

-- A user can insert their own row.
drop policy if exists "insert own prefs" on public.user_preferences;
create policy "insert own prefs" on public.user_preferences
  for insert with check (auth.uid() = user_id);

-- A user can update their own row.
drop policy if exists "update own prefs" on public.user_preferences;
create policy "update own prefs" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.user_preferences is 'Per-user app preferences (currently just catalog opt-out).';
