import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSavedIdea } from '../../../../lib/saved-ideas';

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

export async function GET(_request, { params }) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const { id } = await params;
  const idea = await getSavedIdea(user.id, id);
  if (!idea) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ idea });
}
