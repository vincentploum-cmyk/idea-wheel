import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { gradeDefenseReads } from '@/lib/nhl-data/defense-grade';
import { seasonYearOf } from '@/lib/nhl-data/picks-pure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: the Defense tab's track record. Every stored skater-game of the season (through `to`,
// default today; from `from` when given) graded against the cheat-sheet tables as they stood
// that morning: by third of the opponent's table at the skater's position, and at the shooting
// side's softest spot, for the Season (blended), Last 10 and Last 5 spans, shots and goals.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || todayET();
  const from = url.searchParams.get('from') || null;
  if (!DATE_RE.test(to) || (from && !DATE_RE.test(from))) return Response.json({ error: 'bad date' }, { status: 400 });
  // loadRows is strictly-before; include games played on the date itself.
  const rows = await loadRows(addDays(to, 1));
  const season = seasonYearOf(to);
  return Response.json(gradeDefenseReads(rows, { season, from, to }), { headers: { 'Cache-Control': 'no-store' } });
}
