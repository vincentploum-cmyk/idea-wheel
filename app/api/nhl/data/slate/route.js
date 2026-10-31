import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildSlate } from '@/lib/nhl-data/slate';
import { buildPicks, withBoardPlays } from '@/lib/nhl-data/picks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: tonight's games with per-position matchup edges. The plays strip above each rink is the team's rows on
// Best bets (withBoardPlays), so the two never disagree; the run's own strip stands in when the board fails.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const slate = await buildSlate(date);
    const board = await buildPicks(date).catch((err) => { console.error('[nhl-data] picks for the strip failed:', err); return null; });
    return Response.json(withBoardPlays(slate, board), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] slate failed:', err);
    return Response.json({ error: 'slate_failed', detail: err.message }, { status: 500 });
  }
}
