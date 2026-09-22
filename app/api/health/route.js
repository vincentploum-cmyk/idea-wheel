/**
 * GET /api/health — liveness check for uptime monitors.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'nhl-model',
    commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || null,
    supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    ts: new Date().toISOString(),
  });
}
