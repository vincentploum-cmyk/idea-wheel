import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

// Email the site owner about a new contact message via Resend's HTTP API.
// No-op unless RESEND_API_KEY is set. Notification failure must never fail
// the request — the message is already safely in contact_messages.
async function notifyOwner({ name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // resend.dev sandbox sender works without domain verification but only
        // delivers to the Resend account owner's address — set
        // CONTACT_NOTIFY_FROM to a verified-domain sender to lift that limit.
        from: process.env.CONTACT_NOTIFY_FROM || 'IdeaReels Contact <onboarding@resend.dev>',
        to: [process.env.CONTACT_NOTIFY_TO || 'vincentploum@gmail.com'],
        reply_to: email,
        subject: `IdeaReels contact: ${name}`,
        text: `New contact message on ideareels.io\n\nFrom: ${name} <${email}>\n\n${message}\n\n— Reply directly to answer them.`,
      }),
    });
    if (!res.ok) {
      console.error('contact notification failed:', res.status, (await res.text()).slice(0, 300));
    }
  } catch (err) {
    console.error('contact notification failed:', err.message);
  }
}

export async function POST(request) {
  try {
    const { name, email, message } = await request.json();
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(null, { status: 400 });
    }
    const db = getAdmin();
    // Supabase returns errors instead of throwing — without this check a
    // failed insert would still tell the visitor "Message received".
    const { error } = await db.from('contact_messages').insert({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    if (error) {
      console.error('contact_messages insert failed:', error.message);
      return new Response(null, { status: 500 });
    }
    await notifyOwner({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
