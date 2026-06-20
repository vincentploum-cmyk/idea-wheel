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
