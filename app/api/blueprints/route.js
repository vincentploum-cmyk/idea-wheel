import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ blueprints: [], error: 'not_authenticated' }, { status: 200 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data, error } = await db
    .from('blueprints')
    .select('id, idea_title, idea_tagline, combo_label, reel_1, reel_2, reel_3, status, credits_spent, created_at')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ blueprints: data || [] });
}
