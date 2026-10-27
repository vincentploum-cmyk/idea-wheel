import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildShuffle } from '@/lib/nhl-data/picks';
import { loadBestRead } from '@/lib/nhl-data/best-read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: the shuffle for a date (the bars at the top of Best bets): every skater of every game with
// his λ shots / goals, his own windows and the opponent's rank at his position (lib/nhl-data/shuffle-pure.js),
// and `bestRead`, the stored verdict on which read the scorecard rates best per bar (lib/nhl-data/best-read.js).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const [shuffle, bestRead] = await Promise.all([buildShuffle(date), loadBestRead().catch(() => null)]);
    return Response.json({ ...shuffle, bestRead }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] shuffle failed:', err);
    return Response.json({ error: 'shuffle_failed', detail: err.message }, { status: 500 });
  }
}
