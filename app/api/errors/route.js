import { logError } from '@/lib/error-log';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/errors — client-side error reporter.
 * Called from app/global-error.js and any custom client boundary.
 * Rate-limited per IP to prevent flooding.
 */
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`errors:${ip}`, { limit: 20, windowSeconds: 60 });
    if (!rl.ok) return new Response(null, { status: 204 });

    const body = await request.json().catch(() => ({}));
    const { message, stack, route, meta } = body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return new Response(null, { status: 204 });
    }

    await logError({
      scope: 'client:global',
      error: { message, stack: typeof stack === 'string' ? stack : null },
      route: typeof route === 'string' ? route : null,
      meta: {
        ...(meta && typeof meta === 'object' ? meta : {}),
        ua: request.headers.get('user-agent') || null,
        ip,
      },
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
