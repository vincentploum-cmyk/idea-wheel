import { authorize } from '@/lib/nhl-data/util';
import { loadMoneyPuck, refreshMoneyPuck, mpYear, METRICS, SITUATIONS } from '@/lib/nhl-data/moneypuck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Admin: MoneyPuck team metrics per situation (season) and per venue (from game logs).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const year = Number(new URL(request.url).searchParams.get('year')) || mpYear();
  const { teams, games } = await loadMoneyPuck(year);
  return Response.json({ year, metrics: METRICS, situations: SITUATIONS, teams, games, source: 'MoneyPuck.com' }, { headers: { 'Cache-Control': 'no-store' } });
}

// Admin: pull the season summary now; ?games=1 also rebuilds the home/away splits from every team's game log.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    return Response.json({ ok: true, result: await refreshMoneyPuck({ year: Number(url.searchParams.get('year')) || mpYear(), games: url.searchParams.get('games') === '1' }) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
