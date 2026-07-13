import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { deductCredits, hasUnlockedIdea, getBalance, CREDIT_COSTS } from '../../../lib/credits';
import { IDEA_EXAMPLES } from '../../../lib/idea-examples';
import { getCatalogIdea } from '../../../lib/catalog-store';

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

  // Idempotent: if already unlocked, re-deliver the content without charging again.
  const already = await hasUnlockedIdea(user.id, slug);
  let balance;
  if (already) {
    balance = await getBalance(user.id);
  } else {
    // Charge the user's regular credit balance — the currency the packs actually sell.
    const charge = await deductCredits(user.id, CREDIT_COSTS.ideaUnlock, `catalog_unlock_${slug}`);
    if (!charge.ok) {
      return Response.json({ error: 'insufficient_credits', balance: charge.balance ?? 0 }, { status: 402 });
    }
    balance = charge.newBalance;
  }

  // Entitled — deliver the full research + blueprint (read via the service-role client)
  // so the page never has to ship it to locked visitors.
  const content = await getCatalogIdea(slug).catch(() => null);

  return Response.json({ ok: true, alreadyUnlocked: already, balance, content });
}
