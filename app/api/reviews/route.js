import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

export async function POST(request) {
  try {
    const { name, role, quote } = await request.json();
    if (!name?.trim() || !quote?.trim() || quote.trim().length < 20) {
      return new Response(null, { status: 400 });
    }
    const db = getAdmin();
    await db.from('reviews').insert({
      name: name.trim().slice(0, 100),
      role: role?.trim().slice(0, 100) || null,
      quote: quote.trim().slice(0, 1000),
      approved: false,
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
