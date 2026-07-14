-- Per-user record of every idea combination the wheel has landed on, so the
-- same (action · workflow · industry) never comes up twice for a given user.
-- Run once in the Supabase SQL editor. The app degrades gracefully without it
-- (it simply stops de-duping until the table exists).

create table if not exists public.user_spins (
  user_id    uuid not null,
  combo_key  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, combo_key)
);
alter table public.user_spins enable row level security;
-- No anon/authenticated policy: only the service role (which bypasses RLS)
-- touches this table (app/api/spins reads/writes with the service-role client).
