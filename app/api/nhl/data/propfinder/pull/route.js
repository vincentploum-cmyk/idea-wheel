import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { pullPropfinder, propfinderConfigured } from '@/lib/nhl-data/propfinder-api';
import { autoRunModel } from '@/lib/nhl-data/autorun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

// Admin (or the sync token): pull today's slate from PropFinder's API now — the skater
// and team tables plus the two matchup workbooks — then run the model if the lines are in.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  if (!propfinderConfigured()) {
    return Response.json({ ok: false, error: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD in the server environment)' }, { status: 503 });
  }
  const result = await pullPropfinder(date);
  const model = result.ok && date >= todayET() ? await autoRunModel(date).catch((err) => ({ ran: false, error: String(err?.message || err) })) : null;
  return Response.json({ ok: result.ok, result, model }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}
