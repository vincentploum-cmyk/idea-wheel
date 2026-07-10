// lib/fulfillment.js
// Shared fulfillment for a paid Stripe Checkout session. Called from two places:
// the Stripe webhook and /api/credits/confirm (success-page fallback), so a
// purchase completes even if only one of the two paths is working. Both grant
// helpers are idempotent by stripe session id, so double invocation is safe.

import { addCredits, addIdeaCredits, CREDIT_PACKS } from './credits';
import { createClient } from '@supabase/supabase-js';

export async function fulfillCheckoutSession(session) {
  const userId = session.metadata?.user_id || session.client_reference_id;
  const packId = session.metadata?.pack_id;
  if (!userId || !packId) return { ok: false, reason: 'missing_metadata' };

  const pack = CREDIT_PACKS.find(p => p.id === packId);

  let grant;
  if (pack?.type === 'idea' && pack.ideaCredits > 0) {
    grant = await addIdeaCredits(userId, pack.ideaCredits, { stripe_session_id: session.id });
  } else {
    // Always derive credit amount from server-side CREDIT_PACKS — never trust metadata.credits
    const credits = pack?.credits || 0;
    if (credits > 0) {
      grant = await addCredits(userId, credits, 'purchase', { stripe_session_id: session.id });
    } else {
      return { ok: false, reason: 'unknown_pack' };
    }
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: orderError } = await db.from('stripe_orders').upsert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
    pack_id: packId,
    credits_amount: pack?.credits || 0,
    amount_cents: Number(session.amount_total || 0),
    status: 'complete',
    fulfilled_at: new Date().toISOString(),
  }, { onConflict: 'stripe_session_id' });
  if (orderError) console.error('stripe_orders upsert failed:', orderError.message);

  return {
    ok: true,
    duplicate: !!grant.duplicate,
    pack,
    creditsGranted: pack.type === 'idea' ? pack.ideaCredits : pack.credits,
  };
}
