import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { fulfillCheckoutSession } from '@/lib/fulfillment';
import { getBalance, getIdeaCreditBalance } from '@/lib/credits';
import { logError } from '@/lib/error-log';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Success-page fallback fulfillment: verifies the checkout session directly with
// Stripe, so credits land even if the webhook never arrives. Idempotent — if the
// webhook already granted this session, fulfillCheckoutSession reports duplicate.
export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Please sign in.', code: 'AUTH_REQUIRED' }, { status: 401 });

  let sessionId = null;
  try {
    ({ session_id: sessionId } = await request.json());
  } catch {}
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const ownerId = session.metadata?.user_id || session.client_reference_id;
    if (ownerId !== user.id) {
      return Response.json({ error: 'This checkout session belongs to a different account.' }, { status: 403 });
    }
    if (session.payment_status !== 'paid') {
      return Response.json({ ok: false, status: session.payment_status || 'unpaid' });
    }

    const result = await fulfillCheckoutSession(session);
    if (!result.ok) {
      console.error('confirm fulfillment failed:', result.reason, sessionId);
      return Response.json({ error: 'We could not add your credits automatically. Please contact support.' }, { status: 500 });
    }

    const balance = result.pack.type === 'idea' ? await getIdeaCreditBalance(user.id) : await getBalance(user.id);
    return Response.json({
      ok: true,
      duplicate: result.duplicate,
      packId: result.pack.id,
      type: result.pack.type,
      credits: result.creditsGranted,
      balance,
    });
  } catch (err) {
    await logError({
      scope: 'api:credits-confirm',
      error: err,
      route: '/api/credits/confirm',
    });
    return Response.json({ error: 'We could not verify your payment yet. If you were charged, your credits will appear shortly.' }, { status: 500 });
  }
}
