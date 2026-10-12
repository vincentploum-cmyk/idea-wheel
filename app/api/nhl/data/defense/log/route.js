import { authorize, todayET, addDays } from '@/lib/nhl-data/util';
import { loadRows } from '@/lib/nhl-data/build';
import { gameLogAgainst } from '@/lib/nhl-data/defense';
import { seasonOfDate, shootingProfiles, similarProfile } from '@/lib/nhl-data/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: every stored skater-game against one team (?team=TOR), newest first, with the
// skater's line slot — the team page's box-score log per position. With ?like=<playerId>
// (the player card's own player) the reply also carries his shooting / scoring profile and
// the profiles of the logged skaters who shoot and score like him (`like.alike`), so the
// log can mark them.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const team = (url.searchParams.get('team') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(team)) return Response.json({ error: 'bad team' }, { status: 400 });
  const likeId = Number(url.searchParams.get('like')) || null;
  const rows = await loadRows(addDays(todayET(), 1));
  const log = gameLogAgainst(rows, team);
  let like = null;
  if (likeId) {
    const season = seasonOfDate(todayET());
    const profiles = shootingProfiles(rows, [likeId, ...new Set(log.map((r) => r.playerId))], season);
    const mine = profiles[likeId] || null;
    const alike = {};
    for (const [id, p] of Object.entries(profiles)) if (Number(id) !== likeId && similarProfile(mine, p)) alike[id] = p;
    like = { id: likeId, season, profile: mine, alike };
  }
  return Response.json({ team, games: new Set(log.map((r) => r.gameId)).size, rows: log, like }, { headers: { 'Cache-Control': 'no-store' } });
}
