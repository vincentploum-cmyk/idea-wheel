import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { CREDIT_PACKAGE_BY_KEY } from '../../../../lib/pricing';

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = await request.json().catch(() => ({}));
    const pkg = CREDIT_PACKAGE_BY_KEY[body.packageKey] || CREDIT_PACKAGE_BY_KEY.builder;
    const priceId = body.priceId || process.env[pkg.priceEnvVar];
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    if (!priceId) {
      return NextResponse.json({ error: `Missing price id for ${pkg.label}` }, { status: 400 });
    }

    const successUrl = new URL('/pricing', origin);
    successUrl.searchParams.set('success', '1');
    successUrl.searchParams.set('package', pkg.key);
    successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');

    const cancelUrl = new URL('/pricing', origin);
    cancelUrl.searchParams.set('canceled', '1');
    cancelUrl.searchParams.set('package', pkg.key);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata: {
        packageKey: pkg.key,
        packageLabel: pkg.label,
        credits: String(pkg.credits),
      },
    });

    return NextResponse.json({
      url: session.url,
      id: session.id,
      package: { key: pkg.key, label: pkg.label, credits: pkg.credits },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Stripe checkout failed' }, { status: 500 });
  }
}
