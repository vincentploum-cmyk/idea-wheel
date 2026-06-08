import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { deductCredits, getBalance, ensureWelcomeGrant } from '@/lib/credits';

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

// Atomically charges the signed-in user for a blueprint. This is the single
// place a blueprint is paid for — the build pipeline never charges again, so
// resuming a blueprint costs nothing.
export async function POST(request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Please sign in.', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { cost, validationId, reason } = await request.json().catch(() => ({}));
  const amount = Math.max(1, Math.min(3, Math.round(Number(cost) || 1)));
  const kind = reason === 'deep_research' ? 'deep_research' : 'blueprint';

  await ensureWelcomeGrant(user.id);   // brand-new users get their 3 free credits before the first charge

  const result = await deductCredits(user.id, amount, kind, { validationId: validationId || null });
  if (!result.ok) {
    const balance = result.balance ?? (await getBalance(user.id));
    return Response.json(
      { error: 'Not enough credits.', code: result.reason || 'insufficient_credits', balance },
      { status: 402 }
    );
  }

  return Response.json({ ok: true, charged: amount, balance: result.newBalance });
}
