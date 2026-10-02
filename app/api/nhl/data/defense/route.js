import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { defenseByPosition, defenseBySlot } from '@/lib/nhl-data/defense';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: what every team allows to each position, at home and away, and the same per
// line slot (LW1 … RW4, D1 … D3) under `slots`, from the games logged with a line.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const asOf = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(asOf)) return Response.json({ error: 'bad date' }, { status: 400 });
  // loadRows is strictly-before; include games played on the date itself.
  const rows = await loadRows(addDays(asOf, 1));
  const season = defenseByPosition(rows);
  const l10 = defenseByPosition(rows, { lastN: 10 });
  const l5 = defenseByPosition(rows, { lastN: 5 });
  const slots = { season: defenseBySlot(rows), l10: defenseBySlot(rows, { lastN: 10 }), l5: defenseBySlot(rows, { lastN: 5 }) };
  return Response.json({ asOf, games: new Set(rows.map((r) => r.gameId)).size, season, l10, l5, slots }, { headers: { 'Cache-Control': 'no-store' } });
}
