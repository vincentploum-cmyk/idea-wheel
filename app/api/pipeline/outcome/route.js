import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ensureSessionId, recordOutcome } from '../../../../lib/moat-store';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request) {
  // Require auth: this writes to the shared learning store that feeds the public
  // /api/generator/config and /api/score. Left open, an anonymous caller could
  // poison every user's recommendations and inflate scores.
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const { signal, modeName, action, workflow, industry, payload } = body;
    if (!signal) {
      return NextResponse.json({ error: 'Missing signal' }, { status: 400 });
    }

    const sessionId = ensureSessionId(body.sessionId);
    await recordOutcome({
      sessionId,
      signal,
      modeName,
      action,
      workflow,
      industry,
      payload: payload || null,
    });

    return NextResponse.json({ ok: true, sessionId });
  } catch (err) {
    console.error('[pipeline/outcome]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
