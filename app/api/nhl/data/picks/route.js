import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildPicks } from '@/lib/nhl-data/picks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: tonight's best shots and goal play per game (the list at the top of Best bets).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    return Response.json(await buildPicks(date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] picks failed:', err);
    return Response.json({ error: 'picks_failed', detail: err.message }, { status: 500 });
  }
}
