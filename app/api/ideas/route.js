import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { listSavedIdeas, saveValidatedIdea } from '../../../lib/saved-ideas';

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

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const { validationId, idea, comp } = await request.json();
  if (!validationId) return Response.json({ error: 'validationId required' }, { status: 400 });
  const result = await saveValidatedIdea({ userId: user.id, validationId, idea, comp });
  if (!result) return Response.json({ error: 'save_failed' }, { status: 500 });
  return Response.json({ id: result.id });
}
