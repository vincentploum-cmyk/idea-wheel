create extension if not exists pgcrypto;

create table if not exists pipeline_validations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  mode_name text,
  action text,
  workflow text,
  industry text,
  agent_desc text,
  retrieval jsonb,
  scout jsonb,
  skeptic jsonb,
  judge jsonb,
  eval jsonb,
  verdict_type text,
  usage jsonb,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_validations_session_id on pipeline_validations(session_id);
create index if not exists idx_pipeline_validations_mode_industry on pipeline_validations(mode_name, industry);

create table if not exists pipeline_blueprints (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  validation_id uuid,
  mode_name text,
  action text,
  workflow text,
  industry text,
  agent_desc text,
  retrieval jsonb,
  comp jsonb,
  design jsonb,
  gtm jsonb,
  infra jsonb,
  proto_spec jsonb,
  eval jsonb,
  prototype_html_preview text,
  usage jsonb,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_blueprints_session_id on pipeline_blueprints(session_id);
create index if not exists idx_pipeline_blueprints_validation_id on pipeline_blueprints(validation_id);

create table if not exists pipeline_outcomes (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  signal text not null,
  mode_name text,
  action text,
  workflow text,
  industry text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_outcomes_session_id on pipeline_outcomes(session_id);
create index if not exists idx_pipeline_outcomes_signal on pipeline_outcomes(signal);
