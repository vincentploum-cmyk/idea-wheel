import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveWeek, boardFor } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The NFL board for a week: ?season=2026&week=7[&type=2|3], or ?date=YYYY-MM-DD, or this week.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const wk = await resolveWeek({ date: date || undefined, season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
    const board = await boardFor(wk, { refresh: url.searchParams.get('refresh') !== '0' });
    return Response.json(board, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nfl] board failed:', err);
    return Response.json({ error: 'board_failed', detail: err.message }, { status: 500 });
  }
}
