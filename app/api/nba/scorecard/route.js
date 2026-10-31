import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { scorecardFor, datesWithData, seasonOfDate } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_SLATES = 200;

// The scorecard over the stored nights in [from, to] (ET dates): ?from=YYYY-MM-DD&to=YYYY-MM-DD, the
// season to date by default. Every finished game's plays and ladders replayed and graded (lib/picks/scorecard.js).
// The season to date also stores the board's calibration learned from those nights (lib/picks/calibration.js; the
// refresh that stores new box scores relearns it in the background); `rows=1` adds every graded chance as the board
// stated it (the sync token reads it too, for a look offline).
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || todayET();
  const seasonFrom = `${seasonOfDate(to)}-10-01`;
  const from = url.searchParams.get('from') || seasonFrom;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const dates = (await datesWithData()).filter((d) => d >= from && d <= to).slice(-MAX_SLATES);
    const save = from <= seasonFrom && to >= todayET();
    const report = await scorecardFor(dates.map((date) => ({ date })), { from, to }, { save, rows: url.searchParams.get('rows') === '1' });
    return Response.json(report, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nba] scorecard failed:', err);
    return Response.json({ error: 'scorecard_failed', detail: err.message }, { status: 500 });
  }
}
