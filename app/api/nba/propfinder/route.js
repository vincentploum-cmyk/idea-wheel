import { authorize } from '@/lib/nhl-data/util';
import { resolveSlate, extraFor, defensiveMatchupsFor } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Everything the night's PropFinder pull carried beyond what the board reads (lib/picks/propfinder.js `extra`):
// ?player=<PropFinder id | name> his fields, every game's other figures (the other quarters, efficiency, passes, the
// rebounds' detail …), the lines of the markets the board does not settle (the fantasy score, the other quarters, the
// first basket) and, for a player the books have not priced (`offBoard`), his whole logs; ?team=ABBR its stats rows as
// published (each window and position, PropFinder's ranks in); neither: the counts and the players kept.
// ?part=defensive-matchups: the Defensive Matchups route's answer as stored with the pull (its rows read, the answer whole).
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const slate = await resolveSlate({ date: url.searchParams.get('date') });
  if (url.searchParams.get('part') === 'defensive-matchups') {
    const dm = await defensiveMatchupsFor(slate);
    if (!dm) return Response.json({ slate, error: 'no_defensive_matchups', detail: 'This night has no stored Defensive Matchups answer yet: the next pull writes it.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
    return Response.json({ slate, ...dm }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  }
  const out = await extraFor(slate, { player: url.searchParams.get('player'), team: url.searchParams.get('team') });
  if (!out) return Response.json({ slate, error: 'no_extra', detail: 'This night has no stored PropFinder extra yet: the next pull writes it.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return Response.json({ slate, ...out }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
