import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

// GET → the combo keys this user has already landed on, so the wheel can avoid them.
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ combos: [] });
  try {
    const { data, error } = await getAdmin()
      .from('user_spins')
      .select('combo_key')
      .eq('user_id', user.id);
    if (error) throw error;
    return Response.json({ combos: (data || []).map((r) => r.combo_key) });
  } catch {
    // Table not provisioned yet (or transient) — degrade to no de-dup.
    return Response.json({ combos: [] });
  }
}

// POST { comboKey } → record a landed combo (idempotent by primary key).
export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  let comboKey = null;
  try { ({ comboKey } = await request.json()); } catch { /* noop */ }
  if (!comboKey || typeof comboKey !== 'string') {
    return Response.json({ ok: false, error: 'comboKey required' }, { status: 400 });
  }
  try {
    await getAdmin()
      .from('user_spins')
      .upsert({ user_id: user.id, combo_key: comboKey.slice(0, 300) }, { onConflict: 'user_id,combo_key', ignoreDuplicates: true });
  } catch {
    // Table missing — no-op; de-dup is simply inactive until the migration runs.
  }
  return Response.json({ ok: true });
}
