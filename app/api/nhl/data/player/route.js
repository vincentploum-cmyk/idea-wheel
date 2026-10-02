import { authorize, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { loadPlayers } from '@/lib/nhl-data/rosters';
import { playerProfile } from '@/lib/nhl-data/profile';
import { loadPropfinder, loadOpponentTables, propfinderDefenseTabs, skaterFor } from '@/lib/nhl-data/propfinder';
import { seasonYear } from '@/lib/nhl-data/propfinder-csv';

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
  const oppAbbr = /^[A-Z]{3}$/.test(opp || '') ? opp : null;
  const profile = playerProfile(mine, { opp: oppAbbr, venue: ['H', 'A'].includes(venue) ? venue : null });
  // The card's right-hand panel: what tonight's opponent allows per position (PropFinder's
  // tables, this season's plus last season's and the recent-games windows), as above the rinks.
  let defense = null;
  if (oppAbbr) {
    const pfSeason = pf.opponents?.season ?? Object.values(pf.opponentsByPos || {})[0]?.season ?? null;
    const prev = pfSeason && pfSeason >= seasonYear() ? await loadOpponentTables(pfSeason - 1).catch(() => null) : null;
    defense = propfinderDefenseTabs(pf, oppAbbr, prev);
  }
  const name = p?.name || profile.last?.name || String(id);
  const team = p?.team || profile.last?.team || null;
  return Response.json({
    id,
    name,
    team,
    pos: p?.pos || profile.last?.pos || null,
    number: p?.number ?? null,
    onRoster: !!p?.onRoster,
    opp: oppAbbr, venue,
    ...profile,
    defense,
    // PropFinder's own season rates for the same player (null until an export names them).
    propfinder: skaterFor(pf.skaters, { name, team }),
    propfinderL5: skaterFor(pf.skatersL5, { name, team }),
    propfinderL5Home: skaterFor(pf.skatersL5Home, { name, team }),
    propfinderL5Away: skaterFor(pf.skatersL5Away, { name, team }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
