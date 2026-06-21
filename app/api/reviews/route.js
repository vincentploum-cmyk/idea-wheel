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

    // One review credit per user — check before inserting
    let creditGranted = false;
    if (userId) {
      const { data: prior } = await db
        .from('reviews')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (!prior?.length) {
        creditGranted = true;
      }
    }

    await db.from('reviews').insert({
      name: name.trim().slice(0, 100),
      role: role?.trim().slice(0, 100) || null,
      quote: quote.trim().slice(0, 1000),
      user_id: userId,
      approved: false,
    });

    if (creditGranted) {
      await addCredits(userId, REVIEW_CREDIT_REWARD, 'review_bonus');
    }

    return Response.json({ ok: true, creditsGranted: creditGranted ? REVIEW_CREDIT_REWARD : 0 });
  } catch (err) {
    console.error('reviews POST:', err);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
