import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildSlate } from '@/lib/nhl-data/slate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: tonight's games with per-position matchup edges.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    return Response.json(await buildSlate(date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] slate failed:', err);
    return Response.json({ error: 'slate_failed', detail: err.message }, { status: 500 });
  }
}
