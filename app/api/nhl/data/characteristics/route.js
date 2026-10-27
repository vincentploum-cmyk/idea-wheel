import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { loadMoneyPuck } from '@/lib/nhl-data/moneypuck';
import { loadPropfinder } from '@/lib/nhl-data/propfinder';
import { defenseTablesFor, opponentDefense, moneypuckBlock } from '@/lib/nhl-data/slate';
import { teamVerdict } from '@/lib/nhl-data/verdict';
import { shotProfiles, ratioRanks, teamCharacteristics } from '@/lib/nhl-data/characteristics';
import { seasonYearOf } from '@/lib/nhl-data/picks-pure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: one team's characteristics (strengths, weaknesses, style of play) at home and away, the
// Matchups card's builder on the same tables — what it allows at each venue from the stored box
// scores (PropFinder's table standing in while thin), MoneyPuck's rates, its own shooting profile
// — plus the defense verdict's headline per venue for the card's pill. ?team=NJD[&date=]; games
// through the date count.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const team = String(url.searchParams.get('team') || '').toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(team)) return Response.json({ error: 'bad team' }, { status: 400 });
  const asOf = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(asOf)) return Response.json({ error: 'bad date' }, { status: 400 });
  try {
    const [rows, mp, pf] = await Promise.all([loadRows(addDays(asOf, 1)), loadMoneyPuck().catch(() => ({ teams: null, games: null })), loadPropfinder().catch(() => ({ opponentsByPos: null }))]);
    const tables = defenseTablesFor(rows, pf, { season: seasonYearOf(asOf) });
    const moneypuck = moneypuckBlock(mp);
    const ratios = ratioRanks(moneypuck);
    const profiles = shotProfiles(rows, asOf);
    const at = (venue) => {
      const defense = opponentDefense(team, venue, tables);
      const verdict = teamVerdict({ team, venue, defense, teamCount: tables.season.teamCount, mp: moneypuck });
      return {
        characteristics: teamCharacteristics({ team, venue, defense, mp: moneypuck, ratios, profile: profiles.teams[team] || null, league: profiles.league, teamCount: tables.season.teamCount }),
        verdict: verdict ? { headline: verdict.headline, tier: verdict.tier } : null,
        games: defense.All?.season?.gp || 0,
      };
    };
    return Response.json({
      team, asOf, home: at('H'), away: at('A'),
      profile: profiles.teams[team] ? { games: profiles.teams[team].games, season: profiles.teams[team].season } : null,
      moneypuck: moneypuck ? { updatedAt: moneypuck.updatedAt, year: moneypuck.year } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] characteristics failed:', err);
    return Response.json({ error: 'characteristics_failed', detail: err.message }, { status: 500 });
  }
}
