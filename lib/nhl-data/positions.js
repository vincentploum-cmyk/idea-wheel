// Pre-game position snapshots. The model looks at what a defense allows to
// each position, so a player's position for a game is fixed *before* the
// game from the projected lineup (LW / C / RW by line slot, D by pair, G) and
// frozen once the game starts. Later refreshes never overwrite a frozen game.
import { readJson, writeJson } from '../nhl-store';
import { teamAbbrFromText } from './teams';
import { normName } from './names';
import { loadPlayers } from './rosters';

export const positionsPath = (date) => `data/positions/${date}.json`;

const FWD = ['LW', 'C', 'RW'];
const SKIP = /^(scratched|injured|note|status report|suspended)\b/i;

/** Lineup text rows (one game preview) → { [abbrev]: { name → { name, pos, line } } }. */
export function parseLineupRows(rows) {
  const teams = {};
  let cur = null;
  let fwdLine = 0;
  let dPair = 0;
  for (const raw of rows || []) {
    const cell = String(raw || '').replace(/ /g, ' ').replace(/ +/g, ' ').trim();
    if (!cell) continue;
    if (/projected lineup/i.test(cell)) {
      const abbr = teamAbbrFromText(cell.replace(/projected lineup/i, ''));
      cur = abbr ? (teams[abbr] = teams[abbr] || {}) : null;
      fwdLine = 0;
      dPair = 0;
      continue;
    }
    if (!cur || SKIP.test(cell)) continue;
    const line = cell.replace(/\s+[–—-]{1,2}\s+/g, ' -- ').replace(/\s*--\s*/g, ' -- ');
    if (line.includes(' -- ')) {
      const names = line.split(' -- ').map((s) => s.trim()).filter(Boolean);
      if (names.length === 3 && fwdLine < 4) {
        fwdLine += 1;
        names.forEach((name, i) => { cur[normName(name)] = { name, pos: FWD[i], line: fwdLine }; });
      } else if (names.length === 2 && dPair < 4) {
        dPair += 1;
        names.forEach((name) => { cur[normName(name)] = { name, pos: 'D', line: dPair }; });
      }
    } else if (fwdLine > 0 && /^[A-Za-zÀ-ÿ'.-]+( [A-Za-zÀ-ÿ'.-]+){1,3}$/.test(line) && !/ at /i.test(line)) {
      // Single names after the lines are the goalies (starter first).
      const hasG = Object.values(cur).some((p) => p.pos === 'G');
      cur[normName(line)] = { name: line, pos: 'G', line: hasG ? 2 : 1 };
    }
  }
  return teams;
}

const started = (state) => !['FUT', 'PRE'].includes(state || 'FUT');

/**
 * Capture positions for every game on `date` from the stored lineups, falling
 * back to roster positions, and freeze games that have started.
 * `schedule` comes from the NHL schedule call; `lineups` is data/lineups/<date>.json.
 */
export async function snapshotPositions(date, schedule, lineups) {
  const file = (await readJson(positionsPath(date))) || { date, games: {} };
  const at = new Date().toISOString();
  const ref = await loadPlayers();
  const byTeam = {};
  for (const p of Object.values(ref.players)) {
    if (!p.onRoster || p.excluded || !p.team) continue;
    (byTeam[p.team] = byTeam[p.team] || {})[normName(p.name)] = { name: p.name, id: p.id, pos: p.pos, line: null };
  }
  const lineupOf = Object.fromEntries((lineups?.games || []).map((g) => [g.gameId, g]));

  for (const g of schedule) {
    const prev = file.games[g.id];
    if (prev?.frozen) continue;
    if (prev && started(g.state)) {
      // Last capture before the puck dropped is the one that counts.
      file.games[g.id] = { ...prev, frozen: true, frozenAt: at };
      continue;
    }
    const parsed = parseLineupRows(lineupOf[g.id]?.rows || []);
    const teams = {};
    for (const abbr of [g.away, g.home]) {
      const roster = byTeam[abbr] || {};
      const fromLineup = parsed[abbr] || {};
      const players = {};
      for (const [key, v] of Object.entries(fromLineup)) players[key] = { ...v, id: roster[key]?.id ?? null, team: abbr };
      // Roster players missing from the lineup keep their roster position (no line).
      for (const [key, v] of Object.entries(roster)) if (!players[key]) players[key] = { ...v, team: abbr, inLineup: false };
      teams[abbr] = { source: Object.keys(fromLineup).length ? 'lineup' : 'roster', players };
    }
    file.games[g.id] = {
      away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null,
      capturedAt: at, frozen: started(g.state), frozenAt: started(g.state) ? at : null, teams,
    };
  }
  file.updatedAt = at;
  await writeJson(positionsPath(date), file);
  return { date, games: Object.keys(file.games).length, frozen: Object.values(file.games).filter((g) => g.frozen).length };
}

/** Position a skater was frozen at for a game, or null. */
export function frozenPos(snapshot, gameId, team, name) {
  const p = snapshot?.games?.[gameId]?.teams?.[team]?.players?.[normName(name)];
  return p && p.inLineup !== false && ['LW', 'C', 'RW', 'D'].includes(p.pos) ? p.pos : null;
}

/** Skaters in a game record take the position they were frozen at pre-game. */
export function applyFrozenPositions(games, snapshot) {
  let applied = 0;
  for (const g of games) {
    for (const s of g.skaters) {
      const pos = frozenPos(snapshot, g.id, s.team, s.name);
      if (pos && pos !== s.pos) { s.boxPos = s.pos; s.pos = pos; applied += 1; }
    }
  }
  return applied;
}
