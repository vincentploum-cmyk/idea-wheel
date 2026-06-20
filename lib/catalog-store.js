import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function getCatalogIdea(slug) {
  const db = getAdmin();
  if (!db) return null;
  const { data } = await db.from('catalog_ideas').select('research, blueprint').eq('slug', slug).single();
  return data || null;
}

export async function getAllCatalogData() {
  const db = getAdmin();
  if (!db) return {};
  const { data } = await db.from('catalog_ideas').select('slug, research, blueprint');
  if (!data) return {};
  return Object.fromEntries(data.map(r => [r.slug, { research: r.research, blueprint: r.blueprint }]));
}

export async function upsertCatalogIdea(slug, { research, blueprint }) {
  const db = getAdmin();
  if (!db) throw new Error('Admin client unavailable');
  const { error } = await db.from('catalog_ideas').upsert(
    { slug, research, blueprint, updated_at: new Date().toISOString() },
    { onConflict: 'slug' }
  );
  if (error) throw new Error(error.message);
}

/**
 * Returns unlock counts for the ideas page social proof.
 * - researchCount: total users who paid the 1-credit ideas_unlock
 * - blueprintCounts: { [slug]: number } of users who unlocked each blueprint
 */
export async function getUnlockCounts(slugs = []) {
  const db = getAdmin();
  if (!db) return { researchCount: 0, blueprintCounts: {} };

  const [researchRes, blueprintRes] = await Promise.all([
    db.from('credits').select('id', { count: 'exact', head: true }).eq('reason', 'ideas_unlock'),
    slugs.length
      ? db.from('credits').select('reason').in('reason', slugs.map(s => `idea_blueprint_${s}`))
      : Promise.resolve({ data: [] }),
  ]);

  const researchCount = researchRes.count ?? 0;
  const blueprintCounts = {};
  for (const slug of slugs) blueprintCounts[slug] = 0;
  for (const row of (blueprintRes.data || [])) {
    const slug = row.reason.replace('idea_blueprint_', '');
    blueprintCounts[slug] = (blueprintCounts[slug] ?? 0) + 1;
  }

  return { researchCount, blueprintCounts };
}

export async function hasUnlockedBlueprint(userId, slug) {
  const db = getAdmin();
  if (!db || !userId) return false;
  const { data } = await db
    .from('credits')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', `idea_blueprint_${slug}`)
    .limit(1);
  return !!data?.length;
}
