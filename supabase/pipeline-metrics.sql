-- Per-stage pipeline timings for p50/p95 latency measurement.
-- Backs the marketing claims "under 30s for first verdict" and "under 5 minutes end-to-end".

create table if not exists pipeline_stage_timings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stage text not null,               -- 'validate' | 'deep_research' | 'build:designer' | 'build:launch' | 'build:infra' | 'build:builder' | 'build:prototype'
  duration_ms integer not null check (duration_ms >= 0),
  status text not null default 'ok' check (status in ('ok','error','timeout')),
  user_id uuid,
  session_id text,                   -- for correlating stages of one blueprint run
  commit_sha text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_stage_timings_created on pipeline_stage_timings (created_at desc);
create index if not exists idx_stage_timings_stage_created on pipeline_stage_timings (stage, created_at desc);

alter table pipeline_stage_timings enable row level security;
-- No policies = service-role only.

comment on table pipeline_stage_timings is 'Per-stage wall-clock timings for the wheel/blueprint pipeline. Retention: prune > 30 days manually.';
