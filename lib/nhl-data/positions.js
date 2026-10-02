// Per-game position snapshots. The model looks at what a defense allows to
// each position, so every skater in a game gets a position and line slot from
// the lineup (LW / C / RW by line slot, D by pair, G). Nothing is frozen: each
// read re-captures every game from the newest lineup dated at or before it, so a
// warm-up tweet or preview update that only turns up after the game still
// corrects the game, and stored box scores are re-stamped from the snapshot.
import { readJson, writeJson } from '../nhl-store';
import { teamAbbrFromText, teamName } from './teams';
import { normName } from './names';
import { loadPlayers } from './rosters';
import { fetchPreview } from './api';
import { lineupRows } from './lineups';
import { PF_DEPTH_PATH } from './propfinder-api';

export const positionsPath = (date) => `data/positions/${date}.json`;
// Each team's most recent captured lineup, so a game without one (or with holes in it)
// still fills every slot: data/lineups/last/<ABBR>.json.
export const lastLineupPath = (abbr) => `data/lineups/last/${abbr}.json`;

const FWD = ['LW', 'C', 'RW'];
// The slots a lineup fills: four forward lines of LW / C / RW and three defense pairs.
const SLOTS = [...[1, 2, 3, 4].flatMap((line) => FWD.map((pos) => [pos, line])), ...[1, 2, 3].flatMap((pair) => [['D', pair], ['D', pair]])];
const inLineup = (p) => p.inLineup !== false && !!p.line && ['LW', 'C', 'RW', 'D'].includes(p.pos);

/**
 * Fill the slots today's lineup leaves empty from the team's last known lineup
 * (`last` = the file lastLineupPath holds, or null): a player takes his old slot when
 * he is still on the roster and not already placed today. Carried players are in the
 * lineup (`inLineup: true`) and marked `carried` with the capture they came from.
 * Returns { players, carried } with the number of slots filled.
 */
export function fillFromLastLineup(players, roster, last) {
  if (!last?.players) return { players, carried: 0 };
  const out = { ...players };
  const taken = {};
  for (const p of Object.values(out)) if (inLineup(p)) taken[`${p.pos}|${p.line}`] = (taken[`${p.pos}|${p.line}`] || 0) + 1;
  const capacity = (pos) => (pos === 'D' ? 2 : 1);
  let carried = 0;
  for (const [pos, line] of SLOTS) {
    const key = `${pos}|${line}`;
    if ((taken[key] || 0) >= capacity(pos)) continue;
    const cand = Object.entries(last.players).find(([k, v]) => v.pos === pos && v.line === line && roster[k] && !(out[k] && inLineup(out[k])) && !out[k]?.carried);
    if (!cand) continue;
    const [k, v] = cand;
    out[k] = { ...(out[k] || {}), name: roster[k].name, id: roster[k].id ?? v.id ?? null, team: roster[k].team ?? out[k]?.team, pos, line, inLineup: true, carried: true, carriedFrom: last.date || null };
    taken[key] = (taken[key] || 0) + 1;
    carried += 1;
  }
  return { players: out, carried };
}

/** The lineup worth remembering from a team's capture: its own (not carried) placed skaters, when there are enough of them. */
export function lineupToRemember(team, date, gameId) {
  if (!team?.players || !['lineup', 'gamedaytweets', 'preview'].includes(team.source)) return null;
  const players = Object.fromEntries(Object.entries(team.players).filter(([, p]) => inLineup(p) && !p.carried).map(([k, p]) => [k, { name: p.name, id: p.id ?? null, pos: p.pos, line: p.line }]));
  return Object.keys(players).length >= 6 ? { date, gameId, source: team.source, capturedAt: team.meta?.capturedAt || null, players } : null;
}

/** Keep `team`'s capture as its last known lineup when it is newer than the one stored. */
export async function rememberLineup(abbr, team, date, gameId, prev = undefined) {
  const next = lineupToRemember(team, date, gameId);
  if (!next) return false;
  const last = prev === undefined ? await readJson(lastLineupPath(abbr)) : prev;
  if (last?.date && last.date > date) return false;
  await writeJson(lastLineupPath(abbr), { team: abbr, ...next });
  return true;
}
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

/**
 * Capture positions for every game on `date` from the stored lineups, falling
 * back to roster positions. Every game is re-captured on every call, started,
 * finished or not: the lineup sources are already limited to what was posted
 * before (or during) the game, so the newest read is the most accurate one.
 * `schedule` comes from the NHL schedule call; `lineups` is data/lineups/<date>.json.
 */
export async function snapshotPositions(date, schedule, lineups) {
  const [file, ref, depth] = await Promise.all([readJson(positionsPath(date)).then((f) => f || { date, games: {} }), loadPlayers(), readJson(PF_DEPTH_PATH).catch(() => null)]);
  const at = new Date().toISOString();
  const byTeam = {};
  for (const p of Object.values(ref.players)) {
    if (!p.onRoster || p.excluded || !p.team) continue;
    (byTeam[p.team] = byTeam[p.team] || {})[normName(p.name)] = { name: p.name, id: p.id, pos: p.pos, line: null };
  }
  const lineupOf = Object.fromEntries((lineups?.games || []).map((g) => [g.gameId, g]));
  // Each slate team's last known lineup, to fill whatever today's capture leaves empty.
  const abbrs = [...new Set(schedule.flatMap((g) => [g.away, g.home]))];
  const lastOf = Object.fromEntries(await Promise.all(abbrs.map(async (abbr) => [abbr, await readJson(lastLineupPath(abbr)).catch(() => null)])));

  for (const g of schedule) {
    const parsed = parseLineupRows(lineupOf[g.id]?.rows || []);
    const teams = {};
    for (const abbr of [g.away, g.home]) {
      const roster = byTeam[abbr] || {};
      // Newest word wins, by timestamp: the beat writers' tweet (its id carries the
      // posting time) against NHL.com's preview "updated" time. Without a tweet time,
      // a game-day tweet still beats the preview. Then an older tweet, then PropFinder's
      // depth chart from the last pull, then the roster.
      const gdt = lineups?.gdt?.[abbr]?.players ? lineups.gdt[abbr] : null;
      const nhl = parsed[abbr] ? lineupOf[g.id] : null;
      // PropFinder's depth chart is the chart of the day it was pulled: never for a game before that day.
      const pf = depth?.teams?.[abbr]?.players && !(depth.date && depth.date > date) ? depth.teams[abbr] : null;
      const nhlAt = nhl?.updated || null;
      const gdtAt = gdt?.meta?.at || null;
      const gdtWins = gdt && (!nhl || (gdtAt && nhlAt ? gdtAt > nhlAt : gdtAt ? true : gdt.meta?.date === date));
      const fromLineup = gdtWins ? gdt.players : nhl ? parsed[abbr] : gdt?.players || pf?.players || {};
      const source = gdtWins ? 'gamedaytweets' : nhl ? 'lineup' : gdt ? 'gamedaytweets' : pf ? 'propfinder' : 'roster';
      let players = {};
      for (const [key, v] of Object.entries(fromLineup)) players[key] = { ...v, id: v.id ?? roster[key]?.id ?? null, team: abbr };
      // Roster players missing from the lineup keep their roster position (no line).
      for (const [key, v] of Object.entries(roster)) if (!players[key]) players[key] = { ...v, team: abbr, inLineup: false };
      // Empty slots (no lineup yet, or a partial one) take the team's last known lineup,
      // unless that one is newer than the game (a past date settled after today's capture).
      const last = lastOf[abbr]?.date && lastOf[abbr].date > date ? null : lastOf[abbr];
      const filled = fillFromLastLineup(players, roster, last);
      players = filled.players;
      teams[abbr] = {
        source, players,
        carried: filled.carried ? { count: filled.carried, date: last.date || null, source: last.source || null } : null,
        // When each source last changed and when we read it, so the rink can say so.
        meta: {
          nhlUpdated: nhlAt, nhlFetchedAt: lineupOf[g.id]?.fetchedAt || lineups?.fetchedAt || null,
          gdtAt, gdtDate: gdt?.meta?.date || null, gdtFetchedAt: gdt?.meta?.fetchedAt || null,
          handle: gdt?.meta?.handle || null, url: gdt?.meta?.url || null, date: gdt?.meta?.date || null, at: gdtAt,
          pfAt: source === 'propfinder' ? depth?.at || null : null,
          capturedAt: at,
        },
      };
    }
    file.games[g.id] = { away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null, state: g.state || null, capturedAt: at, teams };
  }
  file.updatedAt = at;
  await writeJson(positionsPath(date), file);
  // Remember each team's own capture as its last known lineup (the newest capture wins).
  for (const [id, g] of Object.entries(file.games)) {
    for (const abbr of [g.away, g.home]) {
      if (g.teams?.[abbr]) await rememberLineup(abbr, g.teams[abbr], date, Number(id), lastOf[abbr] ?? null).catch(() => false);
    }
  }
  return { date, games: Object.keys(file.games).length, capturedAt: at };
}

/** Position and line slot the snapshot holds for a skater in a game ({ pos, line }), or null. */
export function snapshotSlot(snapshot, gameId, team, name) {
  const p = snapshot?.games?.[gameId]?.teams?.[team]?.players?.[normName(name)];
  if (!p || p.inLineup === false || !['LW', 'C', 'RW', 'D'].includes(p.pos)) return null;
  const line = Number(p.line);
  return { pos: p.pos, line: Number.isInteger(line) && line >= 1 && line <= 4 ? line : null };
}

/** Position the snapshot holds for a skater in a game, or null. */
export function snapshotPos(snapshot, gameId, team, name) {
  return snapshotSlot(snapshot, gameId, team, name)?.pos || null;
}

/** The slot label a box-score row is logged under: LW1 … RW4 by forward line, D1 … D3 by pair; null without a line. */
export function slotLabel(pos, line) {
  return pos && line ? `${pos}${line}` : null;
}

/**
 * Skaters in a game record take the position and line slot the snapshot holds
 * for them and remember where it came from: 'lineup' (the lineup read for the
 * game, before or after it) or 'box' (the box score's roster code, no line).
 * The line slot (`line`: forward line 1-4 or defense pair 1-3) is what logs the
 * box score per line (an LW3 and an LW2 are kept apart). Re-applying with a newer
 * snapshot replaces what an earlier one set, and a skater the newer snapshot
 * no longer places goes back to his box-score code, so the stored game always
 * reads like the latest lineup information.
 * Returns { applied, changed }: skaters placed by the snapshot, and skaters whose
 * position, line or source differs from what the record held.
 */
export function applyPositions(games, snapshot, source = 'lineup') {
  let applied = 0;
  let changed = 0;
  for (const g of games) {
    for (const s of g.skaters) {
      const before = `${s.pos}|${s.line ?? ''}|${s.posSource || ''}`;
      const slot = snapshotSlot(snapshot, g.id, s.team, s.name);
      s.boxPos = s.boxPos ?? s.pos;
      if (slot) { s.pos = slot.pos; s.line = slot.line; s.posSource = source; applied += 1; } else { s.pos = s.boxPos; s.line = null; s.posSource = 'box'; }
      if (`${s.pos}|${s.line ?? ''}|${s.posSource}` !== before) changed += 1;
    }
  }
  return { applied, changed };
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
  return { games: { [game.id]: { away: game.away.abbrev, home: game.home.abbrev, teams, capturedAt: new Date().toISOString(), fromPreview: true } } };
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
