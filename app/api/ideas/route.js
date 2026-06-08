import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { listSavedIdeas } from '../../../lib/saved-ideas';

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
  if (!user) return Response.json({ ideas: [], error: 'not_authenticated' }, { status: 200 });
  const ideas = await listSavedIdeas(user.id);
  return Response.json({ ideas });
}
