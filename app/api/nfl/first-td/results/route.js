import { authorize } from '@/lib/nhl-data/util';
import { firstTdResults, FIRST_TD_BACKFILL } from '@/lib/nfl/first-td-results';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The First TD picks' season record (lib/nfl/first-td-results.js): the stored weeks before this one added up, at most
// ?backfill=N (0–6, 2 by default) missing weeks built on the way; `missing` says how many are left for the next call.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const raw = url.searchParams.get('backfill');
  const n = raw == null || raw === '' ? FIRST_TD_BACKFILL : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 6) return Response.json({ error: 'bad backfill' }, { status: 400 });
  try {
    return Response.json(await firstTdResults({ backfill: n }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nfl] first TD record failed:', err);
    return Response.json({ error: 'first_td_results_failed', detail: err.message }, { status: 500 });
  }
}
