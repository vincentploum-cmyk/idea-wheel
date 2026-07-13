-- Durable, cross-instance rate limiting for the expensive pipeline routes
-- (validate / build). Replaces the per-instance in-memory Map that reset on
-- every serverless cold start. Used by lib/rate-limit.js.
--
-- Run once in the Supabase SQL editor. Until it is applied, lib/rate-limit.js
-- transparently falls back to its in-memory limiter, so nothing breaks.

create table if not exists public.rate_limits (
  key           text primary key,
  count         integer not null default 0,
  window_start  timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- No anon/authenticated policy: only the service role (which bypasses RLS) and
-- the security-definer function below may touch this table.

-- Atomic increment-and-check. Row lock (FOR UPDATE) serializes concurrent
-- requests for the same key, so the count can't be undercounted under load.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  insert into public.rate_limits (key, count, window_start)
    values (p_key, 0, now())
  on conflict (key) do nothing;

  select count, window_start into v_count, v_start
    from public.rate_limits
    where key = p_key
    for update;

  if now() - v_start > make_interval(secs => p_window_seconds) then
    v_count := 0;
    v_start := now();
  end if;

  v_count := v_count + 1;

  update public.rate_limits
    set count = v_count, window_start = v_start
    where key = p_key;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
