import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, playerFor } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One player's card: ?key=<normalised name>&date=YYYY-MM-DD → his logs, lines, the night's game and
// what the opponent gives up at each position, from the slate's PropFinder pull.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const date = url.searchParams.get('date');
  if (!key || key.length > 80) return Response.json({ error: 'bad key' }, { status: 400 });
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const slate = await resolveSlate({ date });
    const card = await playerFor(slate, key);
    if (!card) return Response.json({ error: 'not_found', detail: 'No PropFinder player by that name on this slate' }, { status: 404 });
    return Response.json({ date: slate.date, ...card }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] player failed:', err);
    return Response.json({ error: 'player_failed', detail: err.message }, { status: 500 });
  }
}
