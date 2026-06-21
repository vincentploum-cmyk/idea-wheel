import Stripe from 'stripe';
import { addCredits, addIdeaCredits, CREDIT_PACKS } from '@/lib/credits';
import { createClient } from '@supabase/supabase-js';

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
    const session = event.data.object;
    const userId = session.metadata?.user_id || session.client_reference_id;
    const packId = session.metadata?.pack_id;
    if (!userId || !packId) return new Response('ok', { status: 200 });

    const pack = CREDIT_PACKS.find(p => p.id === packId);
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    if (pack?.type === 'idea' && pack.ideaCredits > 0) {
      await addIdeaCredits(userId, pack.ideaCredits, { stripe_session_id: session.id });
    } else {
      // Always derive credit amount from server-side CREDIT_PACKS — never trust metadata.credits
      const credits = pack?.credits || 0;
      if (credits > 0) {
        await addCredits(userId, credits, 'purchase', { stripe_session_id: session.id });
      }
    }

    await db.from('stripe_orders').upsert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
      pack_id: packId || 'unknown',
      credits_amount: pack?.credits || 0,
      amount_cents: Number(session.amount_total || 0),
      status: 'complete',
      fulfilled_at: new Date().toISOString(),
    }, { onConflict: 'stripe_session_id' });
  }

  return new Response('ok', { status: 200 });
}
