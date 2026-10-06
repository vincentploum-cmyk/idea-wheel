import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { buildScorecard } from '@/lib/nhl-data/scorecard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: the model's saved projections graded against the stored box scores — per
// market (calls, hit rate, Brier, calibration buckets, by position / line / gate, the
// best-bet calls), the Model tab's boards replayed, the window predictors (own L5 /
// L10 / L15 / season, PropFinder L5 / season) beside the model's λ on the same rows,
// and per slate. `?from=&to=` (defaults: September 1 of the season → today);
// `?rows=1` adds every graded player-game.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const card = await buildScorecard({ from, to, rows: url.searchParams.get('rows') === '1' });
    return Response.json(card, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl] scorecard failed:', err);
    return Response.json({ error: 'scorecard_failed', detail: err.message }, { status: 500 });
  }
}
