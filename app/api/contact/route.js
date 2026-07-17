import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { honeypotTripped, submittedTooFast, looksLikeSpam } from '@/lib/spam-heuristics';
import { logError } from '@/lib/error-log';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

async function notifyOwner({ name, email, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_NOTIFY_FROM || 'IdeaReels Contact <onboarding@resend.dev>',
        to: [process.env.CONTACT_NOTIFY_TO || 'vincentploum@gmail.com'],
        reply_to: email,
        subject: `IdeaReels contact: ${name}`,
        text: `New contact message on ideareels.io\n\nFrom: ${name} <${email}>\n\n${message}\n\n— Reply directly to answer them.`,
      }),
    });
    if (!res.ok) {
      await logError({
        scope: 'api:contact:notify',
        error: `resend ${res.status}: ${(await res.text()).slice(0, 300)}`,
        severity: 'warning',
      });
    }
  } catch (err) {
    await logError({ scope: 'api:contact:notify', error: err, severity: 'warning' });
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    // 15 messages / hour / IP — enough headroom for a real user who
    // mistypes an email and resubmits a few times, tight enough to shed
    // bot volume.
    const rl = await checkRateLimit(`contact:${ip}`, { limit: 15, windowSeconds: 3600 });
    if (!rl.ok) return Response.json({ error: 'rate_limited' }, { status: 429 });

    const body = await request.json();
    const { name, email, message, turnstileToken } = body || {};

    // Cheap heuristic guards. Return 204 (silent success) on bot-shaped input
    // so we don't tell bots which heuristic tripped them.
    if (honeypotTripped(body)) return new Response(null, { status: 204 });
    if (submittedTooFast(body)) return new Response(null, { status: 204 });
    if (looksLikeSpam(message) || looksLikeSpam(name)) return new Response(null, { status: 204 });

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return Response.json({ error: 'invalid_input' }, { status: 400 });
    }

    // Turnstile if configured. Fails closed.
    const ts = await verifyTurnstile(turnstileToken, ip);
    if (!ts.ok) {
      await logError({
        scope: 'api:contact:turnstile',
        error: `turnstile rejected: ${ts.reason || 'unknown'}`,
        severity: 'warning',
        meta: { codes: ts.codes || [], ip },
      });
      return Response.json({ error: 'verification_failed' }, { status: 403 });
    }

    const db = getAdmin();
    const { error } = await db.from('contact_messages').insert({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    if (error) {
      await logError({
        scope: 'api:contact:insert',
        error: error.message,
        route: '/api/contact',
        meta: { ip },
      });
      return Response.json({ error: 'storage_failed' }, { status: 500 });
    }

    await notifyOwner({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    await logError({ scope: 'api:contact', error: err, route: '/api/contact' });
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
