import { authorize } from '@/lib/nhl-data/util';
import { readJson } from '@/lib/nhl-store';
import { loadPlayers, setOverride, TEAMS_PATH, CHANGES_PATH } from '@/lib/nhl-data/rosters';
import { rowsPath } from '@/lib/nhl-data/ingest';
import { PRE_PLAYERS } from '@/lib/nhl-data/preseason';
import { matchNames, SOURCE_NAMES_PATH } from '@/lib/nhl-data/names';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function seasonIds(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return [`${y}${y + 1}`, `${y - 1}${y}`];
}

// Admin: the whole reference database (teams, players, changes, coverage).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const seasons = seasonIds();
  const [teamsFile, ref, changes, lastRoster, lastRefresh, sourceNames, pre, ...rowFiles] = await Promise.all([
    readJson(TEAMS_PATH),
    loadPlayers(),
    readJson(CHANGES_PATH),
    readJson('data/meta/last-roster-update.json'),
    readJson('data/meta/last-refresh.json'),
    readJson(SOURCE_NAMES_PATH),
    readJson(PRE_PLAYERS),
    ...seasons.map((s) => readJson(rowsPath(s))),
  ]);

  const gamesByPlayer = {};
  const gamesByTeam = {};
  const coverage = seasons.map((season, i) => {
    const rows = rowFiles[i]?.rows || [];
    const games = new Set();
    let first = null;
    let last = null;
    for (const r of rows) {
      games.add(r[1]);
      gamesByPlayer[r[2]] = (gamesByPlayer[r[2]] || 0) + 1;
      const key = `${r[4]}|${r[1]}`;
      if (!gamesByTeam[key]) { gamesByTeam[key] = 1; gamesByTeam[r[4]] = (gamesByTeam[r[4]] || 0) + 1; }
      if (!first || r[0] < first) first = r[0];
      if (!last || r[0] > last) last = r[0];
    }
    return { season, games: games.size, playerGames: rows.length, first, last };
  });

  const players = Object.values(ref.players).map((p) => ({
    id: p.id, name: p.name, team: p.team, pos: p.pos, number: p.number ?? null, shoots: p.shoots ?? null,
    birthDate: p.birthDate ?? null, headshot: p.headshot ?? null, games: gamesByPlayer[p.id] || 0,
    overridden: !!p.overridden, excluded: !!p.excluded, note: p.note || null,
    onRoster: p.onRoster !== false, lastGame: p.lastGame || null,
    preseason: pre?.players?.[p.id] ? { gp: pre.players[p.id].gp, last: pre.players[p.id].lastGame, team: pre.players[p.id].team, toi: pre.players[p.id].lastToi } : null,
  })).sort((a, b) => (a.team || '').localeCompare(b.team || '') || a.name.localeCompare(b.name));

  const teams = (teamsFile?.teams || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((t) => ({
    ...t,
    players: players.filter((p) => p.team === t.abbrev && !p.excluded).length,
    preseasonDressed: players.filter((p) => p.team === t.abbrev && p.preseason?.gp).length,
    gamesStored: gamesByTeam[t.abbrev] || 0,
  }));

  const matched = matchNames(ref.players, sourceNames?.names || {});
  const display = matched.display;
  players.forEach((p) => { if (display[p.id]) p.propfinderName = display[p.id]; });

  return Response.json({
    updatedAt: ref.updatedAt,
    propfinder: { names: Object.keys(sourceNames?.names || {}).length, unmatched: matched.unmatched.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')) },
    lastRoster,
    lastRefresh: lastRefresh?.ranAt || null,
    teams,
    players,
    changes: (changes?.changes || []).slice(0, 200),
    coverage,
    preseasonUpdatedAt: pre?.updatedAt || null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// Admin: override one player's team / position / name, exclude them, or clear.
export async function PATCH(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'bad id' }, { status: 400 });
  if (body.clear) return Response.json({ ok: true, override: await setOverride(id, null) });
  const patch = {};
  if (typeof body.team === 'string' && /^[A-Z]{3}$/.test(body.team)) patch.team = body.team;
  if (typeof body.pos === 'string' && ['C', 'LW', 'RW', 'D', 'G'].includes(body.pos)) patch.pos = body.pos;
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.note === 'string') patch.note = body.note.trim().slice(0, 200);
  if (typeof body.excluded === 'boolean') patch.excluded = body.excluded;
  if (!Object.keys(patch).length) return Response.json({ error: 'nothing to change' }, { status: 400 });
  return Response.json({ ok: true, override: await setOverride(id, patch) });
}
