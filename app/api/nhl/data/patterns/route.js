import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildPatterns } from '@/lib/nhl-data/patterns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin: the Patterns tab for a date (lib/nhl-data/patterns.js): every skater in the lineups with a pill per line
// (3+ / 4+ / 5+ / 6+ SOG, 1+ / 2+ / 3+ goals), the rules behind the filled ones, and the record since the study.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    return Response.json(await buildPatterns(date), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] patterns failed:', err);
    return Response.json({ error: 'patterns_failed', detail: err.message }, { status: 500 });
  }
}
