import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildSlate, slateWithBoardReads } from '@/lib/nhl-data/slate';
import { buildPicks } from '@/lib/nhl-data/picks';
import { boardReadsOf, boardReadsMeta } from '@/lib/nhl-data/board-reads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: tonight's games with per-position matchup edges, each game with its predicted score (`projected`,
// lib/nhl-data/score.js: built by the picks board, which reads the slate, so it costs the slate nothing twice),
// and every skater's model figures printed as Best bets prints them (`slateWithBoardReads`: the board's read over
// the run's, the run's own under `model.run`), so the rink's chips and plays strips say what the board says.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const slate = await buildSlate(date);
    const picks = await buildPicks(date, { withSkaters: true }).catch((err) => { console.error('[nhl-data] slate: the picks board failed:', err); return null; });
    const projected = Object.fromEntries((picks?.games || []).map((g) => [g.id, g.projected || null]));
    const reads = picks ? boardReadsOf(picks) : null;
    const read = slateWithBoardReads(slate, reads);
    return Response.json({ ...read, boardReads: picks ? { ...boardReadsMeta(picks, reads), ...(read.boardReads || { skaters: 0 }) } : null, games: read.games.map((g) => ({ ...g, projected: projected[g.id] || null })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] slate failed:', err);
    return Response.json({ error: 'slate_failed', detail: err.message }, { status: 500 });
  }
}
