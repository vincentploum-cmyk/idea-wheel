import { authorize, todayET } from '@/lib/nhl-data/util';
import { scorecardFor, weeksWithData, weekFromKey, resolveWeek } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The scorecard over a season's stored weeks: ?season=2026&from=1&to=9 (week numbers, 19–22 the
// postseason), the season to this week by default. Every finished game's plays and ladders replayed
// and graded (lib/picks/scorecard.js).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    const now = await resolveWeek({ date: todayET() });
    const season = Number(url.searchParams.get('season')) || now.season;
    const ordinal = (wk) => (wk.type === 3 ? 18 + wk.week : wk.week);
    const from = Number(url.searchParams.get('from')) || 1;
    const to = Number(url.searchParams.get('to')) || (season === now.season ? ordinal(now) : 22);
    if (!(from >= 1 && to <= 22 && from <= to)) return Response.json({ error: 'bad range' }, { status: 400 });
    const weeks = (await weeksWithData(season)).map((n) => weekFromKey(season, n)).filter(Boolean).filter((wk) => ordinal(wk) >= from && ordinal(wk) <= to).sort((a, b) => ordinal(a) - ordinal(b));
    const report = await scorecardFor(weeks, { from: String(from), to: String(to) });
    return Response.json({ season, ...report }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nfl] scorecard failed:', err);
    return Response.json({ error: 'scorecard_failed', detail: err.message }, { status: 500 });
  }
}
