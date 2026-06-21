import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const metric = await request.json();
    const { name, value, rating, page } = metric;
    if (!name || value == null || !rating) {
      return new Response(null, { status: 400 });
    }

    const db = getAdmin();
    await db.from('web_vitals').insert({
      metric: name,
      value: Math.round(value * 100) / 100,
      rating,
      path: page ?? null,
    });

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
