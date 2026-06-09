import { ensureWelcomeGrant, getBalance, getTransactions } from '@/lib/credits';

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

  await ensureWelcomeGrant(user.id);

  const balance = await getBalance(user.id);
  const transactions = await getTransactions(user.id, 10);

  return Response.json({
    balance,
    transactions: (transactions || []).map((transaction) => ({
      ...transaction,
      amount: Number(transaction.change || 0),
    })),
  });
}
