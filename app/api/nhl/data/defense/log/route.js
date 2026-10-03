import { authorize, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { gameLogAgainst } from '@/lib/nhl-data/defense';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: every stored skater-game against one team (?team=TOR), newest first, with the
// skater's line slot — the team page's box-score log per position.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const team = (url.searchParams.get('team') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(team)) return Response.json({ error: 'bad team' }, { status: 400 });
  const rows = await loadRows(addDays(todayET(), 1));
  const log = gameLogAgainst(rows, team);
  return Response.json({ team, games: new Set(log.map((r) => r.gameId)).size, rows: log }, { headers: { 'Cache-Control': 'no-store' } });
}
