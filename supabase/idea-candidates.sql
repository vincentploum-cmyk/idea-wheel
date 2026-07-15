-- idea_candidates: the canonical, pre-scored pool behind the "vetted ideas"
-- surface. One row per canonical idea (mode + workflow + industry — the action
-- is folded into copy, so "Automates X for Y" and "Streamlines X for Y" collapse
-- to one candidate, per the audit's action-is-a-copy-variant finding).
--
-- Populated ORGANICALLY: every time someone validates an idea, the pipeline's
-- authoritative score is upserted here (lib/idea-candidates.js -> recordCandidate).
-- The first person to validate a combo scores it for everyone; nothing is batch
-- scored. Reads go only through the service-role client, so this table is never
-- exposed to the browser anon key.
--
-- Run once in the Supabase SQL editor. The app degrades gracefully until then
-- (recordCandidate no-ops, the vetted surface shows nothing).

create table if not exists public.idea_candidates (
  combo_key         text primary key,
  mode              text not null check (mode in ('b2b', 'consumer')),
  action            text,
  workflow          text not null,
  industry          text not null,
  title             text,
  summary           text,
  gap               text,
  viability_score   smallint check (viability_score is null or viability_score between 0 and 100),
  score_version     text,
  safety_level      text not null default 'standard',
  eligibility_status text not null default 'pending'
    check (eligibility_status in ('pending', 'eligible', 'catalog', 'manual_review', 'rejected')),
  times_scored      integer not null default 1,
  scored_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- An "eligible"/"catalog" row must actually clear the bar with a current score.
  check (
    eligibility_status not in ('eligible', 'catalog')
    or (viability_score is not null and score_version is not null and scored_at is not null)
  )
);

create index if not exists idea_candidates_surface_idx
  on public.idea_candidates (mode, eligibility_status, viability_score desc);

alter table public.idea_candidates enable row level security;

drop policy if exists "Service role manages idea_candidates" on public.idea_candidates;
create policy "Service role manages idea_candidates"
  on public.idea_candidates
  for all
  to service_role
  using (true)
  with check (true);
