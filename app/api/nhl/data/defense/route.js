import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { defenseByPosition, defenseBySlot, firstGoalsAllowed } from '@/lib/nhl-data/defense';
import { gamesFor } from '@/lib/nhl-data/slate';
import { loadMoneyPuck } from '@/lib/nhl-data/moneypuck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: what every team allows to each position, at home and away, and the same per
// line slot (LW1 … RW4, D1 … D3) under `slots`, from the games logged with a line, and the
// first goals each team gives up under `firstGoals`.
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
  // First goals given up, by venue, position and line slot (`firstGoals.season.teams.NJD.H.bySlot.LW1`).
  const firstGoals = { season: firstGoalsAllowed(rows), l10: firstGoalsAllowed(rows, { lastN: 10 }) };
  // The Defense tab: the date's games (for tonight's matchup reads) and MoneyPuck's team rates.
  const [tonight, mp] = await Promise.all([gamesFor(asOf).catch(() => []), loadMoneyPuck().catch(() => ({ teams: null }))]);
  const all = mp?.teams?.situations?.all || {};
  const moneypuck = {
    year: mp?.teams?.year ?? null, updatedAt: mp?.teams?.updatedAt ?? null,
    teams: Object.fromEntries(Object.entries(all).map(([a, t]) => [a, { gp: t.gp ?? null, ga60: t.ga60 ?? null, sa60: t.sa60 ?? null, xga60: t.xga60 ?? null, hdsa60: t.hdsa60 ?? null, pace60: t.pace60 ?? null }])),
  };
  return Response.json({
    asOf, games: new Set(rows.map((r) => r.gameId)).size, season, l10, l5, slots, firstGoals,
    tonight: (tonight || []).map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null })),
    moneypuck,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
