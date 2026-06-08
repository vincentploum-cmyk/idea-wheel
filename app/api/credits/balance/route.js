import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function getUser() {
  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ balance: 0, transactions: [] });

  const db = getAdmin();

  // Balance = sum of all change values in credits table
  const { data: rows } = await db
    .from('credits')
    .select('change')
    .eq('user_id', user.id);

  const balance = (rows || []).reduce((sum, r) => sum + (r.change || 0), 0);

  // Recent transactions
  const { data: transactions } = await db
    .from('credits')
    .select('change, reason, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return Response.json({ balance, transactions: transactions || [] });
}
