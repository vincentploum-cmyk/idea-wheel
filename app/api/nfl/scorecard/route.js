import { authorize, todayET, DATE_RE } from '@/lib/nhl-data/util';
import { scorecardFor, weeksWithData, weekFromKey, resolveWeek } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The scorecard over a season's stored weeks: ?season=2026&from=1&to=9 (week numbers, 19–22 the
// postseason), the season to this week by default. Every finished game's plays and ladders replayed
// and graded (lib/picks/scorecard.js). `?date=YYYY-MM-DD` grades only that ET day's games, in the week
// it belongs to (the daily results workflow); `?rows=1` adds every graded chance. Admin session or the sync token.
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  const rows = url.searchParams.get('rows') === '1';
  try {
    const ordinal = (wk) => (wk.type === 3 ? 18 + wk.week : wk.week);
    if (date) {
      const wk = await resolveWeek({ date });
      const n = String(ordinal(wk));
      const report = await scorecardFor([wk], { from: n, to: n }, { rows, day: date });
      return Response.json({ season: wk.season, date, ...report }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const now = await resolveWeek({ date: todayET() });
    const season = Number(url.searchParams.get('season')) || now.season;
    const from = Number(url.searchParams.get('from')) || 1;
    const to = Number(url.searchParams.get('to')) || (season === now.season ? ordinal(now) : 22);
    if (!(from >= 1 && to <= 22 && from <= to)) return Response.json({ error: 'bad range' }, { status: 400 });
    const weeks = (await weeksWithData(season)).map((n) => weekFromKey(season, n)).filter(Boolean).filter((wk) => ordinal(wk) >= from && ordinal(wk) <= to).sort((a, b) => ordinal(a) - ordinal(b));
    const report = await scorecardFor(weeks, { from: String(from), to: String(to) }, { rows });
    return Response.json({ season, ...report }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[nfl] scorecard failed:', err);
    return Response.json({ error: 'scorecard_failed', detail: err.message }, { status: 500 });
  }
}
