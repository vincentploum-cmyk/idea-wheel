import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { readJson } from '@/lib/nhl-store';
import { gamesPath } from '@/lib/nhl-data/ingest';
import { positionsPath } from '@/lib/nhl-data/positions';
import { auditDate, owedSides } from '@/lib/nhl-data/lineup-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DAYS = 45;

// Admin: which stored games still owe a post-game lineup read. `?from=&to=` (ET dates; the default
// is the last 14 days through yesterday, at most 45 days): per date every stored game with, per team,
// where its positions came from, the tweet's time from puck drop, and what a re-stamp would change;
// `owed` lists the sides a post-game read could still improve. Update them with the lineups
// workflow: dispatch nhl-lineups.yml with `backfill_from=<first date>` and `date=<last date>`.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || addDays(todayET(), -1);
  const from = url.searchParams.get('from') || addDays(to, -13);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return Response.json({ error: 'bad date range' }, { status: 400 });
  const dates = [];
  for (let d = from; d <= to && dates.length < MAX_DAYS; d = addDays(d, 1)) dates.push(d);
  const out = [];
  for (const date of dates) {
    const [games, snapshot] = await Promise.all([readJson(gamesPath(date)), readJson(positionsPath(date))]);
    if (!games?.games?.length) continue;
    out.push(auditDate(date, games, snapshot));
  }
  const totals = { dates: out.length, games: 0, sides: 0, byVerdict: {}, owed: 0, pendingRestamp: 0, skaters: 0, fromLineup: 0 };
  for (const d of out) {
    totals.games += d.summary.games; totals.sides += d.summary.sides; totals.owed += d.summary.owed; totals.pendingRestamp += d.summary.pendingRestamp;
    totals.skaters += d.summary.skaters; totals.fromLineup += d.summary.fromLineup;
    for (const [k, v] of Object.entries(d.summary.byVerdict)) totals.byVerdict[k] = (totals.byVerdict[k] || 0) + v;
  }
  return Response.json({
    from, to, totals, owed: owedSides(out), dates: out,
    howToUpdate: 'Dispatch the "NHL lineups" workflow with backfill_from=<first date> and date=<last date>: it posts each date\'s GameDayTweets pages and runs the post-game settle, which re-captures the snapshot and re-stamps the stored box scores.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
