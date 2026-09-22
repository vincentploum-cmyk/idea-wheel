import { authorize, todayET, addDays, DATE_RE, syncTokenInfo } from '@/lib/nhl-data/util';
import { readJson } from '@/lib/nhl-store';
import { gamesPath, lineupsPath } from '@/lib/nhl-data/ingest';
import { slateMetaPath } from '@/lib/nhl-data/matchups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// What the automation has for a slate date, so the UI can fill the slots.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });

  const [slate, lineups, gamesSame, gamesPrev, defense, last, token] = await Promise.all([
    readJson(slateMetaPath(date)),
    readJson(lineupsPath(date)),
    readJson(gamesPath(date)),
    readJson(gamesPath(addDays(date, -1))),
    readJson('data/defense/latest.json'),
    readJson('data/meta/last-refresh.json'),
    syncTokenInfo(),
  ]);

  const lineupGames = (lineups?.games || []).filter((g) => g.rows?.length).length;
  return Response.json({
    date,
    today: todayET(),
    slots: {
      season: slate?.files?.season || null,
      l5: slate?.files?.l5 || null,
      lineups: lineupGames ? { games: lineupGames, of: lineups.games.length, complete: lineupGames === lineups.games.length, fetchedAt: lineups.fetchedAt } : null,
      boxScores: gamesSame?.games?.length ? { games: gamesSame.games.length, fetchedAt: gamesSame.fetchedAt } : null,
      hist: gamesPrev || last ? { asOf: date } : null,
      playerStats: gamesPrev || last ? { asOf: date } : null,
      rankings: defense && Object.keys(defense.teams || {}).length >= 2
        ? { teams: Object.keys(defense.teams).length, updatedAt: defense.updatedAt } : null,
    },
    lastRefresh: last?.ranAt || null,
    syncToken: token,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
