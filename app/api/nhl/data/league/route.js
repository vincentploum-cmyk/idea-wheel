import { authorize } from '@/lib/nhl-data/util';
import { loadLeague, refreshLeague, groupStandings, shotLeaders } from '@/lib/nhl-data/league';
import { readJson } from '@/lib/nhl-store';
import { rowsPath, rowObj } from '@/lib/nhl-data/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STALE_MS = 6 * 3600 * 1000;

// The current season, or last season until this one has stored games.
async function latestRows(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  for (const season of [`${y}${y + 1}`, `${y - 1}${y}`]) {
    const file = await readJson(rowsPath(season));
    if (file?.rows?.length) return { season, rows: file.rows };
  }
  return { season: `${y}${y + 1}`, rows: [] };
}

// Admin: standings by division + scoring leaders (refreshed when stale or on ?refresh=1).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const force = new URL(request.url).searchParams.get('refresh') === '1';
  let { standings, leaders } = await loadLeague();
  let refreshed = null;
  const stale = !standings?.updatedAt || Date.now() - Date.parse(standings.updatedAt) > STALE_MS;
  if (force || stale) {
    try { refreshed = await refreshLeague(); ({ standings, leaders } = await loadLeague()); } catch (err) { refreshed = { error: err.message }; }
  }
  const { season, rows } = await latestRows();
  return Response.json({
    updatedAt: standings?.updatedAt || null,
    refreshed,
    conferences: groupStandings(standings?.rows || []),
    leaders: { points: leaders?.points || [], goals: leaders?.goals || [], assists: leaders?.assists || [], shots: shotLeaders(rows.map(rowObj)) },
    season,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
