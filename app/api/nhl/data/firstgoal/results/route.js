import { authorize } from '@/lib/nhl-data/util';
import { firstGoalResults, FIRST_GOAL_BACKFILL } from '@/lib/nhl-data/firstgoal-results';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Admin: the season's record of the 1st goal tab's own list (lib/nhl-data/firstgoal-results.js). Each call grades
// and stores a few of the nights still missing (`?backfill=`, 0–10); the rest are counted in `missing`.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const raw = new URL(request.url).searchParams.get('backfill');
  const n = raw == null || raw === '' ? FIRST_GOAL_BACKFILL : Number(raw);
  const backfill = Number.isFinite(n) ? Math.min(10, Math.max(0, Math.floor(n))) : FIRST_GOAL_BACKFILL;
  try {
    return Response.json(await firstGoalResults({ backfill }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] first goal record failed:', err);
    return Response.json({ error: 'firstgoal_results_failed', detail: err.message }, { status: 500 });
  }
}
