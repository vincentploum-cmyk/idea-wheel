-- Central error log for server + client unhandled exceptions.
-- Query pattern:
--   select scope, count(*) from error_events
--     where created_at > now() - interval '24 hours' group by 1 order by 2 desc;

create table if not exists error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scope text not null,              -- e.g. 'api:build', 'api:webhook', 'client:global'
  severity text not null default 'error' check (severity in ('error','warning','info')),
  message text not null,
  stack text,
  user_id uuid,                     -- nullable; anon errors welcome
  request_id text,                  -- correlate with logs when we have one
  route text,                       -- e.g. '/api/pipeline/build'
  meta jsonb not null default '{}'::jsonb,
  commit_sha text                   -- from RENDER_GIT_COMMIT
);

create index if not exists idx_error_events_created_at on error_events (created_at desc);
create index if not exists idx_error_events_scope_created on error_events (scope, created_at desc);

alter table error_events enable row level security;
-- No policies = service-role only. Anon key cannot read or write.

comment on table error_events is 'Unhandled exceptions + explicit logError() calls. Retention: prune > 30 days manually.';
