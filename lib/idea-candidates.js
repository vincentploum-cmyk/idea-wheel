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
export async function recordCandidate({ mode, action, workflow, industry, score, safetyLevel = 'standard', title, summary, gap, comp = null, agentDesc = null, catalogOptOut = false }) {
  const db = getAdmin();
  if (!db || !workflow || !industry) return null;
  const numScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(Number(score)))) : null;
  const comboKey = canonicalComboKey(mode, workflow, industry);
  // Honour the user's catalog opt-out: their contribution NEVER upgrades a
  // combo's public status beyond 'rejected'. If someone else validates the
  // same combo without opt-out, it can still enter the public pool via that
  // path — this is what the Terms describe (opting YOU out, not the combo).
  const status = catalogOptOut ? 'rejected' : eligibilityFor(numScore, safetyLevel);
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
    comp: comp || null,
    agent_desc: clip(agentDesc, 500),
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
 * Durable blueprint-eligibility for a canonical idea, read from the idea_candidates
 * pool. Used as a fallback by the build gate when the per-validation record can't
 * be found (e.g. the validation came from cache, or pipeline_validations wasn't
 * durably stored). Mirrors getValidationEligibility's shape. Fails closed.
 */
/**
 * Fallback blueprint eligibility from the durable candidate pool.
 *
 * Accepts either the object shape { mode, action, workflow, industry, minScore,
 * requiredVersion } or the legacy positional (mode, workflow, industry, opts).
 * ALWAYS enforces: score >= minScore, current score_version, canonical combo_key,
 * publicly eligible safety level, correct mode, AND eligibility_status is
 * 'eligible' or 'catalog' — never treats `found: true` alone as qualification.
 * Fails closed.
 */
export async function getCandidateEligibility(...args) {
  const fail = (reason) => ({ found: false, score: null, version: null, eligible: false, reason });
  // Normalize call signatures — object arg is the new shape the build route uses.
  const opts = typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])
    ? args[0]
    : { mode: args[0], workflow: args[1], industry: args[2], ...(args[3] || {}) };
  const { mode, workflow, industry, minScore = 60, requiredVersion = null } = opts;
  const db = getAdmin();
  if (!db || !workflow || !industry) return fail('candidate_lookup_unavailable');
  const modeKey = norm(mode) === 'consumer' ? 'consumer' : 'b2b';
  const comboKey = canonicalComboKey(modeKey, workflow, industry);
  try {
    const { data } = await db
      .from('idea_candidates')
      .select('mode, viability_score, score_version, safety_level, eligibility_status')
      .eq('combo_key', comboKey)
      .maybeSingle();
    if (!data) return fail('candidate_not_found');
    // Mode-collision guard: same workflow+industry may exist under both modes.
    if (data.mode && data.mode !== modeKey) return fail('mode_mismatch');
    const score = Number(data.viability_score);
    if (!Number.isFinite(score)) return fail('candidate_unscored');
    let eligible = true;
    let reason = 'eligible';
    if (!isPubliclyEligible(data.safety_level)) { eligible = false; reason = 'safety_review'; }
    else if (score < minScore) { eligible = false; reason = 'below_threshold'; }
    else if (requiredVersion && data.score_version !== requiredVersion) { eligible = false; reason = 'stale_score_version'; }
    // A resolved score is not enough — the stored status must also be eligible.
    // Catches rows marked 'rejected' / 'manual_review' / 'pending' whose score
    // happens to be numerically over the bar (e.g. a safety review pending).
    else if (data.eligibility_status !== 'eligible' && data.eligibility_status !== 'catalog') {
      eligible = false; reason = 'not_eligible_status';
    }
    return { found: true, score, version: data.score_version || null, eligible, reason };
  } catch {
    return fail('candidate_lookup_error');
  }
}

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Cache lookup for the validate pipeline: the stored full validation of a
 * canonical combo, if it exists, was scored under the CURRENT version, and is
 * still fresh. A hit lets a repeat spin skip the paid pipeline entirely.
 * Returns { comp, score, scoredAt } or null.
 */
export async function getCachedCandidate(mode, workflow, industry) {
  const db = getAdmin();
  if (!db || !workflow || !industry) return null;
  const comboKey = canonicalComboKey(mode, workflow, industry);
  try {
    const { data } = await db
      .from('idea_candidates')
      .select('comp, viability_score, score_version, scored_at')
      .eq('combo_key', comboKey)
      .maybeSingle();
    if (!data || !data.comp || data.score_version !== SCORE_POLICY.version) return null;
    const scoredMs = Date.parse(data.scored_at || '');
    if (!Number.isFinite(scoredMs) || (Date.now() - scoredMs) > CACHE_MAX_AGE_MS) return null;
    return { comp: data.comp, score: data.viability_score, scoredAt: data.scored_at };
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
