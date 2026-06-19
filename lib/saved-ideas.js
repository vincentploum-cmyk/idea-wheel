// lib/saved-ideas.js
// Persistence for user-saved ideas: an idea is saved when the user spends a
// credit on extended market research, and updated with its blueprint once one
// is generated. Keyed by (user_id, validation_id).
//
// Every function is resilient: if the table does not exist yet (migration not
// applied) or Supabase is unreachable, reads return [] / null and writes no-op,
// so the product never breaks on a missing table.

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function clip(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/\s+/g, ' ').trim();
  if (!str) return null;
  return str.length > max ? str.slice(0, max) : str;
}

// Fields safe to send to the profile list (no heavy comp/blueprint payloads).
const LIST_FIELDS =
  'id, validation_id, title, tagline, summary, score, verdict_type, research, blueprint_status, credits_spent, created_at, updated_at';

/**
 * Upsert the idea + its extended-research outcome onto the user's row.
 * Called when extended market research is paid for.
 */
export async function saveResearchedIdea({ userId, validationId, idea = {}, comp = {}, research = {}, creditsSpent = 0 }) {
  const db = getAdmin();
  if (!db || !userId || !validationId) return null;
  const row = {
    user_id: userId,
    validation_id: String(validationId),
    session_id: idea.sessionId || comp?.sessionId || null,
    action: clip(idea.action, 200),
    workflow: clip(idea.workflow, 200),
    industry: clip(idea.industry, 200),
    connector: clip(idea.connector, 200),
    mode_name: clip(idea.modeName || idea.label, 200),
    title: clip(idea.title || comp?.title, 200),
    tagline: clip(idea.tagline || comp?.verdict, 400),
    summary: clip(comp?.plainSummary || research?.plainSummary || comp?.verdict, 600),
    score: Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp.score)) : null,
    verdict_type: clip(comp?.verdictType, 40),
    comp,
    research,
    credits_spent: Math.max(0, Number(creditsSpent) || 0),
    updated_at: new Date().toISOString(),
  };
  try {
    // Add to existing credits_spent rather than overwrite (research, then later blueprint).
    const { data: existing } = await db
      .from('saved_ideas')
      .select('credits_spent')
      .eq('user_id', userId).eq('validation_id', String(validationId))
      .maybeSingle();
    if (existing) row.credits_spent = Math.max(0, Number(existing.credits_spent) || 0) + row.credits_spent;
    const { error } = await db.from('saved_ideas').upsert(row, { onConflict: 'user_id,validation_id' });
    if (error) return null;
    return true;
  } catch {
    return null;
  }
}

/**
 * Attach a completed blueprint to the idea row. If the idea was never saved via
 * research (e.g. a high-scoring idea that skipped extended research), this
 * creates the row so the blueprint is still persisted.
 */
export async function attachBlueprint({ userId, validationId, idea = {}, comp = {}, blueprint = {}, creditsSpent = 0 }) {
  const db = getAdmin();
  if (!db || !userId || !validationId) return null;
  try {
    const { data: existing } = await db
      .from('saved_ideas')
      .select('id, credits_spent')
      .eq('user_id', userId).eq('validation_id', String(validationId))
      .maybeSingle();

    if (existing) {
      const { error } = await db.from('saved_ideas').update({
        blueprint,
        blueprint_status: 'complete',
        credits_spent: Math.max(0, Number(existing.credits_spent) || 0) + Math.max(0, Number(creditsSpent) || 0),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      return error ? null : true;
    }

    // No prior row (research skipped) — create one now from idea + comp.
    const { error } = await db.from('saved_ideas').upsert({
      user_id: userId,
      validation_id: String(validationId),
      session_id: idea.sessionId || comp?.sessionId || null,
      action: clip(idea.action, 200),
      workflow: clip(idea.workflow, 200),
      industry: clip(idea.industry, 200),
      connector: clip(idea.connector, 200),
      mode_name: clip(idea.modeName || idea.label, 200),
      title: clip(idea.title || comp?.title, 200),
      tagline: clip(idea.tagline || comp?.verdict, 400),
      summary: clip(comp?.plainSummary || comp?.verdict, 600),
      score: Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp.score)) : null,
      verdict_type: clip(comp?.verdictType, 40),
      comp,
      blueprint,
      blueprint_status: 'complete',
      credits_spent: Math.max(0, Number(creditsSpent) || 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,validation_id' });
    return error ? null : true;
  } catch {
    return null;
  }
}

/**
 * Persist an in-progress blueprint after each pipeline stage completes, so a
 * user who navigates away mid-generation still sees the idea in their shortlist
 * and can resume exactly where the pipeline left off. The partial `blueprint`
 * JSON carries the charge token, so resuming reuses the already-paid credit
 * instead of charging again. Creates the row if research was skipped.
 */
export async function saveBlueprintProgress({ userId, validationId, idea = {}, comp = {}, blueprint = {}, status = 'generating', creditsToAdd = 0 }) {
  const db = getAdmin();
  if (!db || !userId || !validationId) return null;
  try {
    const { data: existing } = await db
      .from('saved_ideas')
      .select('id, credits_spent')
      .eq('user_id', userId).eq('validation_id', String(validationId))
      .maybeSingle();

    if (existing) {
      const update = {
        blueprint,
        blueprint_status: status,
        updated_at: new Date().toISOString(),
      };
      if (creditsToAdd > 0) {
        update.credits_spent = Math.max(0, Number(existing.credits_spent) || 0) + Math.max(0, Number(creditsToAdd) || 0);
      }
      const { error } = await db.from('saved_ideas').update(update).eq('id', existing.id);
      return error ? null : true;
    }

    const { error } = await db.from('saved_ideas').upsert({
      user_id: userId,
      validation_id: String(validationId),
      session_id: idea.sessionId || comp?.sessionId || null,
      action: clip(idea.action, 200),
      workflow: clip(idea.workflow, 200),
      industry: clip(idea.industry, 200),
      connector: clip(idea.connector, 200),
      mode_name: clip(idea.modeName || idea.label, 200),
      title: clip(idea.title || comp?.title, 200),
      tagline: clip(idea.tagline || comp?.verdict, 400),
      summary: clip(comp?.plainSummary || comp?.verdict, 600),
      score: Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp.score)) : null,
      verdict_type: clip(comp?.verdictType, 40),
      comp,
      blueprint,
      blueprint_status: status,
      credits_spent: Math.max(0, Number(creditsToAdd) || 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,validation_id' });
    return error ? null : true;
  } catch {
    return null;
  }
}

/** List the user's saved ideas for the profile (lightweight fields only). */
export async function listSavedIdeas(userId, limit = 50) {
  const db = getAdmin();
  if (!db || !userId) return [];
  try {
    const { data, error } = await db
      .from('saved_ideas')
      .select(LIST_FIELDS)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Save a validated idea before the user spends any credits.
 * Does not overwrite an existing row (research/blueprint take priority).
 */
export async function saveValidatedIdea({ userId, validationId, idea = {}, comp = {} }) {
  const db = getAdmin();
  if (!db || !userId || !validationId) return null;
  try {
    const { data: existing } = await db
      .from('saved_ideas')
      .select('id')
      .eq('user_id', userId).eq('validation_id', String(validationId))
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data, error } = await db.from('saved_ideas').insert({
      user_id: userId,
      validation_id: String(validationId),
      session_id: idea.sessionId || comp?.sessionId || null,
      action: clip(idea.action, 200),
      workflow: clip(idea.workflow, 200),
      industry: clip(idea.industry, 200),
      connector: clip(idea.connector, 200),
      mode_name: clip(idea.modeName || idea.label, 200),
      title: clip(idea.title || comp?.title, 200),
      tagline: clip(idea.tagline || comp?.verdict, 400),
      summary: clip(comp?.plainSummary || comp?.verdict, 600),
      score: Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp.score)) : null,
      verdict_type: clip(comp?.verdictType, 40),
      comp,
      credits_spent: 0,
      updated_at: new Date().toISOString(),
    }).select('id').single();
    if (error) return null;
    return { id: data.id };
  } catch {
    return null;
  }
}

/** Delete a saved idea, enforcing ownership. */
export async function deleteSavedIdea(userId, id) {
  const db = getAdmin();
  if (!db || !userId || !id) return null;
  try {
    const { error } = await db
      .from('saved_ideas')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    return error ? null : true;
  } catch {
    return null;
  }
}

/** Fetch one full idea (idea fields + comp + research + blueprint) for its owner. */
export async function getSavedIdea(userId, id) {
  const db = getAdmin();
  if (!db || !userId || !id) return null;
  try {
    const { data, error } = await db
      .from('saved_ideas')
      .select('*')
      .eq('user_id', userId).eq('id', id)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}
