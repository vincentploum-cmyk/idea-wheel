import { authorize } from '@/lib/nhl-data/util';
import { resolveWeek, extraFor } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Everything the week's PropFinder pull carried beyond what the board reads (lib/picks/propfinder.js `extra`):
// ?player=<PropFinder id | name> his fields, every game's other figures (the other quarters and halves, the defense's and
// the kicker's details, the shares …) and the lines of the markets the board does not settle; ?team=ABBR its stats rows
// as published (each window, position and slot, with PropFinder's ranks); neither: the counts and the players kept.
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const wk = await resolveWeek({ date: url.searchParams.get('date') || undefined, season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
  const out = await extraFor(wk, { player: url.searchParams.get('player'), team: url.searchParams.get('team') });
  if (!out) return Response.json({ week: wk, error: 'no_extra', detail: 'This week has no stored PropFinder extra yet: the next pull writes it.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return Response.json({ week: wk, ...out }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
