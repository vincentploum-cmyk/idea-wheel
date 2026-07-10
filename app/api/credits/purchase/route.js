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

// Server-side offer prices — never trust client-sent amounts
const OFFER_PRICES = {
  pro:   { price_cents: 499,  label: 'Pro — Limited Offer' },
  power: { price_cents: 999,  label: 'Power — Limited Offer' },
};

const CANCEL_PATH_ALLOWLIST = ['/pricing', '/pricing/offer', '/wheel'];

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please sign in to purchase credits.', code: 'AUTH_REQUIRED' }, { status: 401 });

  const { packId, offer, cancelPath } = await request.json();
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) return Response.json({ error: 'Invalid pack' }, { status: 400 });

  const offerOverride = offer ? OFFER_PRICES[packId] : null;
  const priceCents = offerOverride ? offerOverride.price_cents : pack.price_cents;
  const isIdeaPack = pack.type === 'idea';
  const productName = offerOverride
    ? `IdeaReels ${offerOverride.label}`
    : isIdeaPack
      ? `IdeaReels ${pack.label} — ${pack.ideaCredits} idea unlock${pack.ideaCredits !== 1 ? 's' : ''}`
      : `IdeaReels ${pack.label} — ${pack.credits} Credits`;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ideareels.io';

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      // No payment_method_types restriction — Stripe shows every method enabled
      // in the dashboard (Apple Pay, Link, Cash App, Bancontact, Klarna, …),
      // picked dynamically per buyer. Card-only was suppressing all wallets.
      mode: 'payment',
      client_reference_id: user.id,
      line_items: [{ price_data: {
        currency: 'usd', unit_amount: priceCents,
        product_data: { name: productName, description: pack.tagline },
      }, quantity: 1 }],
      customer_email: user.email,
      metadata: { user_id: user.id, pack_id: pack.id, credits: String(pack.credits), idea_credits: String(pack.ideaCredits || 0) },
      // session_id lets the success page confirm payment directly with Stripe,
      // so fulfillment doesn't depend on the webhook alone.
      success_url: `${siteUrl}/pricing?credits=success&pack=${pack.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${CANCEL_PATH_ALLOWLIST.includes(cancelPath) ? cancelPath : '/pricing'}`,
      custom_text: {
        submit: { message: 'One-time payment — no subscription. Credits never expire.' },
      },
    });
  } catch (err) {
    console.error('stripe checkout create failed:', err.message);
    return Response.json({ error: 'Could not start checkout. Please try again in a moment.' }, { status: 500 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: orderError } = await db.from('stripe_orders').insert({
    user_id: user.id, stripe_session_id: session.id, pack_id: pack.id,
    credits_amount: pack.credits, amount_cents: priceCents, status: 'pending',
  });
  // A failed pending record must not block checkout — fulfillment upserts it anyway.
  if (orderError) console.error('stripe_orders pending insert failed:', orderError.message);

  return Response.json({ ok: true, url: session.url });
}
