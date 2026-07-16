/**
 * Cloudflare Turnstile server-side verification. No-op if TURNSTILE_SECRET_KEY
 * is unset (turnstile is opt-in). Public sites can still use the honeypot +
 * timing heuristics in lib/spam-heuristics.js as a fallback.
 */

export function turnstileEnabled() {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(token, remoteIp) {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = await res.json();
    if (data?.success) return { ok: true, hostname: data.hostname };
    return { ok: false, reason: 'turnstile_failed', codes: data?.['error-codes'] || [] };
  } catch (err) {
    // Fail closed on network error — safer than fail open on the abuse surface.
    return { ok: false, reason: 'turnstile_error', message: err?.message };
  }
}
