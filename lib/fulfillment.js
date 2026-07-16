// lib/fulfillment.js
// Shared fulfillment for a paid Stripe Checkout session. Called from two places:
// the Stripe webhook and /api/credits/confirm (success-page fallback), so a
// purchase completes even if only one of the two paths is working. Both grant
// helpers are idempotent by stripe session id, so double invocation is safe.

import { addCredits, addIdeaCredits, CREDIT_PACKS, getBalance } from './credits';
import { createClient } from '@supabase/supabase-js';
import { sendPurchaseEmail } from './purchase-email';

export async function fulfillCheckoutSession(session) {
  // Only fulfill a session Stripe has actually collected payment for. Wallets/async
  // methods (Klarna, Cash App, bank debit) fire checkout.session.completed with
  // payment_status 'unpaid' and settle — or fail — later via async_payment_* events.
  if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { ok: false, reason: 'unpaid' };
  }

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

  // Fire-and-forget purchase confirmation email. NEVER blocks or fails the
  // grant — a Resend outage cannot cost the customer their credits.
  if (!grant.duplicate && pack?.type !== 'idea') {
    (async () => {
      try {
        // Prefer the email Stripe collected at checkout; fall back to the
        // auth user's email if Stripe didn't include it.
        let toEmail = session.customer_details?.email || session.customer_email || null;
        if (!toEmail) {
          const { data: userRow } = await db.auth.admin.getUserById(userId);
          toEmail = userRow?.user?.email || null;
        }
        if (!toEmail) return;

        // First-purchase heuristic: count PRIOR completed grants (excluding
        // THIS session id) for this user.
        const { count: priorCount } = await db
          .from('stripe_orders')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'complete')
          .neq('stripe_session_id', session.id);
        const isFirstPurchase = (priorCount ?? 0) === 0;

        const newBalance = await getBalance(userId).catch(() => null);
        await sendPurchaseEmail({
          toEmail,
          credits: pack.credits,
          newBalance: newBalance ?? pack.credits,
          isFirstPurchase,
        });
      } catch {
        // swallowed — logError inside sendPurchaseEmail handles per-error reporting
      }
    })();
  }

  return {
    ok: true,
    duplicate: !!grant.duplicate,
    pack,
    creditsGranted: pack.type === 'idea' ? pack.ideaCredits : pack.credits,
  };
}
