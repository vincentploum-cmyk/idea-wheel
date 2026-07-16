import Stripe from 'stripe';
import { fulfillCheckoutSession } from '@/lib/fulfillment';
import { logError } from '@/lib/error-log';

let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  _stripe = new Stripe(key);
  return _stripe;
}

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    await logError({
      scope: 'api:stripe-webhook',
      error: err,
      route: '/api/credits/webhook',
      severity: 'warning',
      meta: { stage: 'signature_verify', hasSig: !!sig },
    });
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  // 'completed' fires for immediate payments; 'async_payment_succeeded' fires when
  // a delayed method (Klarna, bank debit) finally settles. Fulfill on both.
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    // Grant errors throw → 500 → Stripe retries the delivery. Terminal outcomes are
    // acknowledged with 200 so Stripe stops retrying: missing metadata / unknown pack
    // can't be fixed by retrying, and 'unpaid' is the normal async case — the later
    // async_payment_succeeded event will fulfill once payment clears.
    const result = await fulfillCheckoutSession(event.data.object);
    const terminal = ['missing_metadata', 'unpaid', 'unknown_pack'];
    if (!result.ok && !terminal.includes(result.reason)) {
      await logError({
        scope: 'api:stripe-webhook',
        error: `fulfillment failed: ${result.reason}`,
        route: '/api/credits/webhook',
        meta: { sessionId: event.data.object.id, eventType: event.type, reason: result.reason },
      });
      return new Response(`Fulfillment error: ${result.reason}`, { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
}
