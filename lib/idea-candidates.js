// lib/idea-candidates.js
// The canonical pre-scored pool (Option C). Every validation upserts its
// authoritative score here, keyed on the CANONICAL idea (mode + workflow +
// industry — action folded into copy). The "vetted ideas" surface then reads
// only rows that cleared the bar with a current score. This converges toward a
// fully pre-scored pool at zero upfront cost: users scoring their own ideas
// build the shared pool as a side effect.
//
// Every function degrades gracefully: no service-role key or missing table →
// writes no-op and reads return [], so the product never breaks.

import { createClient } from '@supabase/supabase-js';
import { SCORE_POLICY, hasPotential, meetsCatalog } from './score-policy';
import { isPubliclyEligible } from './idea-safety';

function getAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function norm(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function clip(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/\s+/g, ' ').trim();
  if (!str) return null;
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Canonical key for the pool. Deliberately excludes the action so that
 * "Automates client onboarding for dental practices" and "Streamlines client
 * onboarding for dental practices" are ONE candidate, not two.
 */
export function canonicalComboKey(mode, workflow, industry) {
  const m = norm(mode) === 'consumer' ? 'consumer' : 'b2b';
  return `${m}:${norm(workflow)}::${norm(industry)}`;
}

/**
 * Decide a candidate's eligibility from its score + safety, using the shared
 * policy so it can never drift from the rest of the app.
 *   clinical/high-risk  -> manual_review (a score never clears a safety concern)
 *   >= catalog (75)     -> catalog       (also eligible for the wheel)
 *   >= visible (60)     -> eligible
 *   below / unscored    -> rejected      (retained for analysis, never shown)
 */
export function eligibilityFor(score, safetyLevel) {
  if (!isPubliclyEligible(safetyLevel)) return 'manual_review';
  if (meetsCatalog(score)) return 'catalog';
  if (hasPotential(score)) return 'eligible';
  return 'rejected';
}

/**
 * Upsert one validation's authoritative result into the pool. Latest-score-wins
 * with the current score version, and times_scored is bumped on each pass.
 */
export async function recordCandidate({ mode, action, workflow, industry, score, safetyLevel = 'standard', title, summary, gap }) {
  const db = getAdmin();
  if (!db || !workflow || !industry) return null;
  const numScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(Number(score)))) : null;
  const comboKey = canonicalComboKey(mode, workflow, industry);
  const status = eligibilityFor(numScore, safetyLevel);
  const nowIso = new Date().toISOString();
  const row = {
    combo_key: comboKey,
    mode: norm(mode) === 'consumer' ? 'consumer' : 'b2b',
    action: clip(action, 80),
    workflow: clip(workflow, 200),
    industry: clip(industry, 200),
    title: clip(title, 200),
    summary: clip(summary, 600),
    gap: clip(gap, 400),
    viability_score: numScore,
    score_version: SCORE_POLICY.version,
    safety_level: safetyLevel || 'standard',
    eligibility_status: status,
    scored_at: numScore !== null ? nowIso : null,
    updated_at: nowIso,
  };
  try {
    const { data: existing } = await db
      .from('idea_candidates')
      .select('times_scored')
      .eq('combo_key', comboKey)
      .maybeSingle();
    if (existing) row.times_scored = Math.max(1, Number(existing.times_scored) || 1) + 1;
    const { error } = await db.from('idea_candidates').upsert(row, { onConflict: 'combo_key' });
    if (error) return null;
    return { comboKey, status };
  } catch {
    return null;
  }
}

/**
 * The vetted surface. Returns canonical ideas that cleared the bar with a
 * CURRENT score version. `tier: 'catalog'` restricts to the stricter 75+ set.
 */
export async function listVettedCandidates({ mode, tier = 'eligible', limit = 24 } = {}) {
  const db = getAdmin();
  if (!db) return [];
  const statuses = tier === 'catalog' ? ['catalog'] : ['eligible', 'catalog'];
  try {
    let query = db
      .from('idea_candidates')
      .select('combo_key, mode, action, workflow, industry, title, summary, gap, viability_score, safety_level, times_scored, scored_at')
      .in('eligibility_status', statuses)
      .eq('score_version', SCORE_POLICY.version)
      .order('viability_score', { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));
    if (mode) query = query.eq('mode', mode === 'consumer' ? 'consumer' : 'b2b');
    const { data, error } = await query;
    if (error) return [];
    // Belt-and-suspenders: never trust the stored status alone — re-check the
    // live policy so a threshold change takes effect on read without a backfill.
    return (data || []).filter((r) => hasPotential(r.viability_score) && isPubliclyEligible(r.safety_level));
  } catch {
    return [];
  }
}
