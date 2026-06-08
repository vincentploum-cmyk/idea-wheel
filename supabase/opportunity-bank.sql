create extension if not exists pgcrypto;

create table if not exists public.opportunity_bank (
  key text primary key,
  mode text not null check (mode in ('b2b', 'consumer')),
  action text not null,
  workflow text not null,
  industry text not null,
  title text,
  one_liner text,
  pain_signal text,
  why_now text,
  score integer not null default 0,
  source text,
  source_url text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  times_seen integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opportunity_bank_mode on public.opportunity_bank(mode);
create index if not exists idx_opportunity_bank_last_seen on public.opportunity_bank(last_seen_at desc);
create index if not exists idx_opportunity_bank_workflow on public.opportunity_bank(workflow);

alter table public.opportunity_bank enable row level security;

create policy "Service role can manage opportunity bank"
  on public.opportunity_bank
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
