import { authorize } from '@/lib/nhl-data/util';
import { firstBasketResults, FIRST_RESULTS_BACKFILL } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The First basket tab's season record (lib/picks/first-results.js): how often our top pick scored it, the top three and
// five, the stated chances against what landed, the games one by one. Each night is graded once from what was on record
// before it and stored; &backfill=0 reads the stored nights alone. The site token is accepted, as on the board's route.
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const backfill = url.searchParams.get('backfill') === '0' ? 0 : FIRST_RESULTS_BACKFILL;
  try {
    return Response.json(await firstBasketResults(undefined, { backfill }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] first basket results failed:', err);
    return Response.json({ error: 'firstbasket_results_failed', detail: err.message }, { status: 500 });
  }
}
