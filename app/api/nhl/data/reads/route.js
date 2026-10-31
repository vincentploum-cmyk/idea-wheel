import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildPicks } from '@/lib/nhl-data/picks';
import { boardReadsOf, boardReadsMeta } from '@/lib/nhl-data/board-reads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: the board's read of every skater on the slate, keyed by the model's own key (team + normalised name), with
// the run and the calibration behind it — what Best bets prints, for the Model tab to print the same figures on its
// rows (lib/nhl-data/board-reads.js). Built off the shuffle's board, so it costs nothing the shuffle has not paid.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const board = await buildPicks(date, { withSkaters: true });
    const reads = boardReadsOf(board);
    return Response.json({ ...boardReadsMeta(board, reads), reads: reads || {} }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] reads failed:', err);
    return Response.json({ error: 'reads_failed', detail: err.message }, { status: 500 });
  }
}
