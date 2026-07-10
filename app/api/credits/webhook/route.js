import Stripe from 'stripe';
import { fulfillCheckoutSession } from '@/lib/fulfillment';

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
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    // Grant errors throw → 500 → Stripe retries the delivery. A session with no
    // usable metadata is acknowledged with 200 so Stripe stops retrying it.
    const result = await fulfillCheckoutSession(event.data.object);
    if (!result.ok && result.reason !== 'missing_metadata') {
      console.error('webhook fulfillment failed:', result.reason, event.data.object.id);
      return new Response(`Fulfillment error: ${result.reason}`, { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
}
