import { createClient } from '@supabase/supabase-js';
import { addCredits } from '@/lib/credits';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { honeypotTripped, submittedTooFast, looksLikeSpam } from '@/lib/spam-heuristics';
import { logError } from '@/lib/error-log';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

const REVIEW_CREDIT_REWARD = 3;

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`reviews:${ip}`, { limit: 3, windowSeconds: 3600 });
    if (!rl.ok) return Response.json({ error: 'rate_limited' }, { status: 429 });

    const body = await request.json();
    const { name, role, quote, turnstileToken } = body || {};
    if (!name?.trim() || !quote?.trim() || quote.trim().length < 20) {
      return Response.json({ error: 'invalid_input' }, { status: 400 });
    }

    // Silent bot drops — a review from a bot is dead weight and can't earn
    // credits (userId is required for the grant).
    if (honeypotTripped(body)) return Response.json({ ok: true, creditsGranted: 0 });
    if (submittedTooFast(body)) return Response.json({ ok: true, creditsGranted: 0 });
    if (looksLikeSpam(quote) || looksLikeSpam(name)) return Response.json({ ok: true, creditsGranted: 0 });

    const ts = await verifyTurnstile(turnstileToken, ip);
    if (!ts.ok) {
      await logError({ scope: 'api:reviews:turnstile', error: `turnstile: ${ts.reason}`, severity: 'warning' });
      return Response.json({ error: 'verification_failed' }, { status: 403 });
    }

    // Resolve authenticated user from Bearer token
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    let userId = null;
    if (token) {
      const db = getAdmin();
      const { data: { user } } = await db.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const db = getAdmin();

    // Store the review. Log failures instead of silently swallowing them.
    const { error: insertError } = await db.from('reviews').insert({
      name: name.trim().slice(0, 100),
      role: role?.trim().slice(0, 100) || null,
      quote: quote.trim().slice(0, 1000),
      user_id: userId,
      approved: false,
    });
    if (insertError) {
      await logError({
        scope: 'api:reviews:insert',
        error: insertError.message,
        userId: userId || undefined,
        route: '/api/reviews',
      });
    }

    // One review-bonus per user. Check the CREDITS ledger (not the reviews table)
    // so a failed review insert can't be replayed to farm repeat grants, and rely
    // on the credits_review_bonus_idem index + addCredits idempotency for the race.
    let creditsGranted = 0;
    if (userId) {
      const { data: prior } = await db
        .from('credits')
        .select('id')
        .eq('user_id', userId)
        .eq('reason', 'review_bonus')
        .limit(1);
      if (!prior?.length) {
        const grant = await addCredits(userId, REVIEW_CREDIT_REWARD, 'review_bonus');
        if (grant.ok && !grant.duplicate) creditsGranted = REVIEW_CREDIT_REWARD;
      }
    }

    return Response.json({ ok: true, creditsGranted });
  } catch (err) {
    await logError({ scope: 'api:reviews', error: err, route: '/api/reviews' });
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
