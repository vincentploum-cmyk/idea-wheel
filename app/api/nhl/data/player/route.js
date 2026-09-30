import { authorize, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { loadPlayers } from '@/lib/nhl-data/rosters';
import { playerProfile } from '@/lib/nhl-data/profile';
import { loadPropfinder, skaterFor } from '@/lib/nhl-data/propfinder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: one player's game log, splits, hit rates and form (?id=&opp=&venue=).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  const opp = url.searchParams.get('opp') || null;
  const venue = url.searchParams.get('venue') || null;
  if (!id) return Response.json({ error: 'bad id' }, { status: 400 });
  const [rows, ref, pf] = await Promise.all([loadRows(addDays(todayET(), 1)), loadPlayers(), loadPropfinder().catch(() => ({ skaters: null }))]);
  const mine = rows.filter((r) => r.playerId === id);
  const p = ref.players[id] || null;
  const profile = playerProfile(mine, { opp: /^[A-Z]{3}$/.test(opp || '') ? opp : null, venue: ['H', 'A'].includes(venue) ? venue : null });
  const name = p?.name || profile.last?.name || String(id);
  const team = p?.team || profile.last?.team || null;
  return Response.json({
    id,
    name,
    team,
    pos: p?.pos || profile.last?.pos || null,
    number: p?.number ?? null,
    onRoster: !!p?.onRoster,
    opp, venue,
    ...profile,
    // PropFinder's own season rates for the same player (null until an export names them).
    propfinder: skaterFor(pf.skaters, { name, team }),
    propfinderL5: skaterFor(pf.skatersL5, { name, team }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
