import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { deductCredits, hasUnlockedIdeas } from '../../../lib/credits';

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

export async function POST() {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  // Idempotent — already unlocked, no charge
  const already = await hasUnlockedIdeas(user.id);
  if (already) return Response.json({ ok: true, alreadyUnlocked: true });

  const result = await deductCredits(user.id, 1, 'ideas_unlock');
  if (!result.ok) return Response.json({ error: result.reason, balance: result.balance }, { status: 402 });

  return Response.json({ ok: true, newBalance: result.newBalance });
}
