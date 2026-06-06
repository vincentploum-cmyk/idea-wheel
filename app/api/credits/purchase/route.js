import Stripe from 'stripe';
import { CREDIT_PACKS } from '@/lib/credits';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please sign in to purchase credits.', code: 'AUTH_REQUIRED' }, { status: 401 });

  const { packId } = await request.json();
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) return Response.json({ error: 'Invalid pack' }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{ price_data: {
      currency: 'usd', unit_amount: pack.price_cents,
      product_data: { name: `IdeaReels ${pack.label} — ${pack.credits} Credits`, description: pack.tagline },
    }, quantity: 1 }],
    customer_email: user.email,
    metadata: { user_id: user.id, pack_id: pack.id, credits: String(pack.credits) },
    success_url: `${siteUrl}?credits=success&pack=${pack.id}`,
    cancel_url: `${siteUrl}?credits=cancelled`,
  });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await db.from('stripe_orders').insert({
    user_id: user.id, stripe_session_id: session.id, pack_id: pack.id,
    credits_amount: pack.credits, amount_cents: pack.price_cents, status: 'pending',
  });

  return Response.json({ ok: true, url: session.url });
}
