import Stripe from 'stripe';
import { addCredits } from '@/lib/credits';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const packId = session.metadata?.pack_id;
    if (!userId || !credits) return new Response('ok', { status: 200 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: order } = await db.from('stripe_orders').select('status').eq('stripe_session_id', session.id).single();
    if (order?.status === 'complete') return new Response('ok', { status: 200 });

    await addCredits(userId, credits, 'purchase', { stripe_session_id: session.id, pack_id: packId });
    await db.from('stripe_orders').update({ status: 'complete', stripe_payment_id: session.payment_intent, fulfilled_at: new Date().toISOString() }).eq('stripe_session_id', session.id);
  }

  return new Response('ok', { status: 200 });
}
