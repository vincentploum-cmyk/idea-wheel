import { createClient } from '@supabase/supabase-js';

let admin = null;
function getAdmin() {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

/**
 * Returns the effective prefs for a user. Missing row = defaults
 * (opt-in / feature-on). Never throws.
 */
export async function getPreferences(userId) {
  const defaults = { catalogOptOut: false };
  if (!userId) return defaults;
  const db = getAdmin();
  if (!db) return defaults;
  try {
    const { data, error } = await db
      .from('user_preferences')
      .select('catalog_opt_out')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return defaults;
    return { catalogOptOut: !!data.catalog_opt_out };
  } catch {
    return defaults;
  }
}

/**
 * Upsert the caller's preferences. Uses the anon-scoped supabase client passed
 * by the caller so RLS enforces "only your own row".
 */
export async function setPreferencesForUser(userSupabase, userId, prefs) {
  const patch = {
    user_id: userId,
    ...(typeof prefs.catalogOptOut === 'boolean' ? { catalog_opt_out: prefs.catalogOptOut } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = await userSupabase
    .from('user_preferences')
    .upsert(patch, { onConflict: 'user_id' });
  return { ok: !error, error: error?.message };
}
