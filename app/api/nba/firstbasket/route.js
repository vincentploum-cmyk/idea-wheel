import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, firstBasketFor, MAX_BACKFILL } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The night's first-basket board: ?date=YYYY-MM-DD, &backfill=0 to skip re-reading stored results
// that lack their opening plays (lib/nba/store.js firstBasketFor).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  const backfill = url.searchParams.get('backfill') === '0' ? 0 : MAX_BACKFILL;
  try {
    const slate = await resolveSlate({ date });
    const board = await firstBasketFor(slate, { backfill });
    return Response.json(board, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] first basket failed:', err);
    return Response.json({ error: 'firstbasket_failed', detail: err.message }, { status: 500 });
  }
}
