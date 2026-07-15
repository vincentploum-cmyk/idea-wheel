-- Adds score integrity + eligibility tracking to saved_ideas, per the audit.
-- The authoritative blueprint gate lives in the build route (it reads the stored
-- validation, not this table) — these columns give saved rows a durable,
-- queryable record of how/when each idea was scored and whether it qualifies.
--
-- Idempotent: safe to run more than once.

alter table public.saved_ideas add column if not exists score_version text;
alter table public.saved_ideas add column if not exists scored_at timestamptz;
alter table public.saved_ideas add column if not exists eligibility_status text not null default 'pending';
alter table public.saved_ideas add column if not exists qualification_reasons jsonb not null default '[]'::jsonb;

-- Constraints (drop-then-add so re-running is idempotent — PG has no
-- ADD CONSTRAINT IF NOT EXISTS).
alter table public.saved_ideas drop constraint if exists saved_ideas_score_range;
alter table public.saved_ideas
  add constraint saved_ideas_score_range
  check (score is null or score between 0 and 100);

alter table public.saved_ideas drop constraint if exists saved_ideas_eligibility_status;
alter table public.saved_ideas
  add constraint saved_ideas_eligibility_status
  check (eligibility_status in ('pending', 'eligible', 'rejected', 'manual_review'));

-- An "eligible" row must actually clear the bar with a current, dated score.
alter table public.saved_ideas drop constraint if exists saved_ideas_eligible_requires_score;
alter table public.saved_ideas
  add constraint saved_ideas_eligible_requires_score
  check (
    eligibility_status <> 'eligible'
    or (score >= 60 and score_version is not null and scored_at is not null)
  );
