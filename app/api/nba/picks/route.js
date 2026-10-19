import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, boardFor } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The NBA board for a date: ?date=YYYY-MM-DD (ET), or today.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const slate = await resolveSlate({ date });
    const board = await boardFor(slate, { refresh: url.searchParams.get('refresh') !== '0' });
    return Response.json(board, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] board failed:', err);
    return Response.json({ error: 'board_failed', detail: err.message }, { status: 500 });
  }
}
