import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPreferences, setPreferencesForUser } from '@/lib/user-preferences';

export const dynamic = 'force-dynamic';

async function getUserAndClient() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET() {
  const { user } = await getUserAndClient();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const prefs = await getPreferences(user.id);
  return Response.json({ prefs });
}

export async function PUT(request) {
  const { sb, user } = await getUserAndClient();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (typeof body.catalogOptOut === 'boolean') patch.catalogOptOut = body.catalogOptOut;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no_valid_fields' }, { status: 400 });
  }
  const result = await setPreferencesForUser(sb, user.id, patch);
  if (!result.ok) return Response.json({ error: result.error || 'update_failed' }, { status: 500 });
  const prefs = await getPreferences(user.id);
  return Response.json({ ok: true, prefs });
}
