import { createClient } from '@supabase/supabase-js';
import { addCredits } from '@/lib/credits';

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
    const { name, role, quote } = await request.json();
    if (!name?.trim() || !quote?.trim() || quote.trim().length < 20) {
      return Response.json({ error: 'invalid_input' }, { status: 400 });
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
    if (insertError) console.error('reviews insert failed:', insertError.message);

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
    console.error('reviews POST:', err);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
