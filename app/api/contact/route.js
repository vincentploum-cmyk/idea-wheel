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
    const { name, email, message } = await request.json();
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(null, { status: 400 });
    }
    const db = getAdmin();
    await db.from('contact_messages').insert({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
