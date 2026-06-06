import { createClient } from '@supabase/supabase-js';
import { getBalance } from '@/lib/credits';

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function getUser(request) {
  const { createServerClient } = await import('@supabase/ssr');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request) {
  const user = await getUser(request);
  if (!user) return Response.json({ balance: 0, transactions: [] }, { status: 200 });
  const balance = await getBalance(user.id);
  const db = getAdmin();
  const { data: transactions } = await db.from('credit_transactions').select('amount,reason,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
  return Response.json({ balance, transactions: transactions || [] });
}
