-- IdeaReels credit system migration
-- Run after moat-v2.sql

create table if not exists public.credits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  balance         integer not null default 0 check (balance >= 0),
  total_purchased integer not null default 0,
  updated_at      timestamptz default now() not null,
  unique(user_id)
);
alter table public.credits enable row level security;
create policy "Users can view own credits" on public.credits for select using (auth.uid() = user_id);
create policy "Service role can manage credits" on public.credits for all using (auth.role() = 'service_role');

create table if not exists public.credit_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);
alter table public.credit_transactions enable row level security;
create policy "Users can view own transactions" on public.credit_transactions for select using (auth.uid() = user_id);
create policy "Service role can manage transactions" on public.credit_transactions for all using (auth.role() = 'service_role');

create table if not exists public.free_spin_usage (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null unique,
  spin_count   integer not null default 0,
  last_spin_at timestamptz default now() not null
);
alter table public.free_spin_usage enable row level security;
create policy "Service role only on free spins" on public.free_spin_usage for all using (auth.role() = 'service_role');

create table if not exists public.stripe_orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_payment_id text,
  pack_id           text not null,
  credits_amount    integer not null,
  amount_cents      integer not null,
  status            text not null default 'pending',
  fulfilled_at      timestamptz,
  created_at        timestamptz default now() not null
);
alter table public.stripe_orders enable row level security;
create policy "Users can view own orders" on public.stripe_orders for select using (auth.uid() = user_id);
create policy "Service role can manage orders" on public.stripe_orders for all using (auth.role() = 'service_role');

-- Auto-create credits row when a new user signs up
create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.credits (user_id, balance, total_purchased)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute procedure public.handle_new_user_credits();

-- Indexes
create index if not exists idx_credits_user     on public.credits(user_id);
create index if not exists idx_txn_user         on public.credit_transactions(user_id);
create index if not exists idx_stripe_session   on public.stripe_orders(stripe_session_id);
create index if not exists idx_free_spin_fp     on public.free_spin_usage(fingerprint);
