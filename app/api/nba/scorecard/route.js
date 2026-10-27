import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { scorecardFor, datesWithData, seasonOfDate } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_SLATES = 200;

// The scorecard over the stored nights in [from, to] (ET dates): ?from=YYYY-MM-DD&to=YYYY-MM-DD, the
// season to date by default. Every finished game's plays and ladders replayed and graded (lib/picks/scorecard.js).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || todayET();
  const from = url.searchParams.get('from') || `${seasonOfDate(to)}-10-01`;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const dates = (await datesWithData()).filter((d) => d >= from && d <= to).slice(-MAX_SLATES);
    const report = await scorecardFor(dates.map((date) => ({ date })), { from, to });
    return Response.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] scorecard failed:', err);
    return Response.json({ error: 'scorecard_failed', detail: err.message }, { status: 500 });
  }
}
