import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildFirstGoalBoard } from '@/lib/nhl-data/firstgoal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: first-goal candidates for a slate date (the 1st goal tab).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    return Response.json(await buildFirstGoalBoard(date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] first goal board failed:', err);
    return Response.json({ error: 'firstgoal_failed', detail: err.message }, { status: 500 });
  }
}
