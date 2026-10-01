/**
 * GET /api/health — liveness check for uptime monitors.
 */
import { getHeapStatistics } from 'node:v8';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'nhl-model',
    commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || null,
    supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    propfinderConfigured: !!(process.env.PROPFINDER_EMAIL && process.env.PROPFINDER_PASSWORD),
    memoryMb: { rss: Math.round(process.memoryUsage().rss / 1e6), heapUsed: Math.round(process.memoryUsage().heapUsed / 1e6), heapLimit: Math.round(getHeapStatistics().heap_size_limit / 1e6) },
    ts: new Date().toISOString(),
  });
}
