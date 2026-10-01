// Pre-game position snapshots. The model looks at what a defense allows to
// each position, so a player's position for a game is fixed *before* the
// game from the projected lineup (LW / C / RW by line slot, D by pair, G) and
// frozen once the game starts. Later refreshes never overwrite a frozen game.
import { readJson, writeJson } from '../nhl-store';
import { teamAbbrFromText, teamName } from './teams';
import { normName } from './names';
import { loadPlayers } from './rosters';
import { fetchPreview } from './api';
import { lineupRows } from './lineups';

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
      // Newest word wins, by timestamp: the beat writers' tweet (its id carries the
      // posting time) against NHL.com's preview "updated" time. Without a tweet time,
      // a game-day tweet still beats the preview. Then the roster.
      const gdt = lineups?.gdt?.[abbr]?.players ? lineups.gdt[abbr] : null;
      const nhl = parsed[abbr] ? lineupOf[g.id] : null;
      const nhlAt = nhl?.updated || null;
      const gdtAt = gdt?.meta?.at || null;
      const gdtWins = gdt && (!nhl || (gdtAt && nhlAt ? gdtAt > nhlAt : gdtAt ? true : gdt.meta?.date === date));
      const fromLineup = gdtWins ? gdt.players : nhl ? parsed[abbr] : gdt?.players || {};
      const source = gdtWins ? 'gamedaytweets' : nhl ? 'lineup' : gdt ? 'gamedaytweets' : 'roster';
      const players = {};
      for (const [key, v] of Object.entries(fromLineup)) players[key] = { ...v, id: v.id ?? roster[key]?.id ?? null, team: abbr };
      // Roster players missing from the lineup keep their roster position (no line).
      for (const [key, v] of Object.entries(roster)) if (!players[key]) players[key] = { ...v, team: abbr, inLineup: false };
      teams[abbr] = {
        source, players,
        // When each source last changed and when we read it, so the rink can say so.
        meta: {
          nhlUpdated: nhlAt, nhlFetchedAt: lineupOf[g.id]?.fetchedAt || lineups?.fetchedAt || null,
          gdtAt, gdtDate: gdt?.meta?.date || null, gdtFetchedAt: gdt?.meta?.fetchedAt || null,
          handle: gdt?.meta?.handle || null, url: gdt?.meta?.url || null, date: gdt?.meta?.date || null, at: gdtAt,
          capturedAt: at,
        },
      };
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

/**
 * Skaters in a game record take the position they were frozen at pre-game and
 * remember where it came from: 'lineup' (projected lineup, frozen or fetched
 * from the preview afterwards) or 'box' (the box score's roster code).
 */
export function applyFrozenPositions(games, snapshot, source = 'lineup') {
  let applied = 0;
  for (const g of games) {
    for (const s of g.skaters) {
      if (s.posSource && s.posSource !== 'box') continue;
      const pos = frozenPos(snapshot, g.id, s.team, s.name);
      s.boxPos = s.boxPos ?? s.pos;
      if (pos) { s.pos = pos; s.posSource = source; applied += 1; } else s.posSource = 'box';
    }
  }
  return applied;
}

/**
 * The NHL.com game preview stays online after the game, so a game that was
 * never snapshotted (a backfill, a missed refresh) can still get its
 * projected pre-game positions. Returns a snapshot for that one game or null.
 */
export async function snapshotFromPreview(game) {
  const preview = await fetchPreview(game.id).catch(() => null);
  if (!preview) return null;
  const parsed = parseLineupRows(lineupRows(preview.markdown));
  const teams = {};
  for (const abbr of [game.away.abbrev, game.home.abbrev]) {
    if (!parsed[abbr]) continue;
    teams[abbr] = { source: 'preview', players: Object.fromEntries(Object.entries(parsed[abbr]).map(([k, v]) => [k, { ...v, team: abbr }])) };
  }
  if (!Object.keys(teams).length) return null;
  return { games: { [game.id]: { away: game.away.abbrev, home: game.home.abbrev, teams, frozen: true, capturedAt: new Date().toISOString(), fromPreview: true } } };
}

/**
 * A snapshot team → the text rows the model's lineup parser reads
 * ("Ducks projected lineup", "LW -- C -- RW" per line, "D -- D" per pair).
 * `display` maps player id → the spelling the matchup workbook uses.
 */
export function lineupRowsFromSnapshot(abbr, team, display = {}) {
  const players = Object.values(team?.players || {}).filter((p) => p.inLineup !== false && p.line);
  if (!players.length) return [];
  const nm = (p) => (p.id != null && display[p.id]) || p.name;
  const rows = [`${teamName(abbr)} projected lineup`];
  const order = { LW: 0, C: 1, RW: 2 };
  for (let line = 1; line <= 4; line++) {
    const f = players.filter((p) => p.line === line && order[p.pos] != null).sort((a, b) => order[a.pos] - order[b.pos]);
    if (f.length === 3) rows.push(f.map(nm).join(' -- '));
  }
  for (let pair = 1; pair <= 4; pair++) {
    const d = players.filter((p) => p.line === pair && p.pos === 'D');
    if (d.length === 2) rows.push(d.map(nm).join(' -- '));
  }
  return rows.length > 1 ? rows : [];
}
