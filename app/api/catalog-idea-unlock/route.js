import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { spendIdeaCredit, hasUnlockedIdea } from '../../../lib/credits';
import { IDEA_EXAMPLES } from '../../../lib/idea-examples';

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

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const { slug } = await request.json();
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  const idea = IDEA_EXAMPLES.find(i => i.slug === slug);
  if (!idea) return Response.json({ error: 'unknown idea' }, { status: 404 });

  const result = await spendIdeaCredit(user.id, slug);
  if (!result.ok && !result.alreadyUnlocked) {
    return Response.json({ error: result.reason, balance: result.balance }, { status: 402 });
  }

  return Response.json({ ok: true, alreadyUnlocked: result.alreadyUnlocked ?? false, balance: result.balance });
}
