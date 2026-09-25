// Teams + players reference database (Supabase Storage, data/reference/*).
// Rebuilt from the NHL API roster endpoints; every difference from the last
// snapshot is written to a change log, and admin overrides sit on top.
import { readJson, writeJson } from '../nhl-store';
import { TEAMS, teamLogo } from './teams';

const WEB = 'https://api-web.nhle.com/v1';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)', Accept: 'application/json' };
export const TEAMS_PATH = 'data/reference/teams.json';
export const PLAYERS_PATH = 'data/reference/players.json';
export const CHANGES_PATH = 'data/reference/changes.json';
export const OVERRIDES_PATH = 'data/reference/overrides.json';
const POS = { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: UA, cache: 'no-store' });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw new Error(`NHL API unavailable: ${url}`);
}

async function fetchTeams() {
  const j = await get(`${WEB}/standings/now`).catch(() => null);
  const list = (j?.standings || []).map((s) => ({
    abbrev: s.teamAbbrev?.default,
    name: s.teamCommonName?.default,
    full: s.teamName?.default,
    place: s.placeName?.default,
    conference: s.conferenceName || null,
    division: s.divisionName || null,
  })).filter((t) => t.abbrev).map((t) => ({ ...t, logo: teamLogo(t.abbrev) }));
  if (list.length >= 32) return list;
  // Fallback to the static list if standings are unavailable.
  return Object.entries(TEAMS).map(([abbrev, t]) => ({ abbrev, name: t.name, full: t.full, place: null, conference: null, division: null, logo: teamLogo(abbrev) }));
}

function mapPlayer(p, team) {
  const first = p.firstName?.default || '';
  const last = p.lastName?.default || '';
  return {
    id: p.id,
    name: `${first} ${last}`.trim(),
    first,
    last,
    team,
    pos: POS[p.positionCode] || p.positionCode,
    number: p.sweaterNumber ?? null,
    shoots: p.shootsCatches || null,
    birthDate: p.birthDate || null,
    country: p.birthCountry || null,
    headshot: p.headshot || null,
  };
}

/** Apply admin overrides (team/pos/name/excluded) on top of fetched data. */
export function applyOverrides(players, overrides) {
  const out = { ...players };
  for (const [id, o] of Object.entries(overrides || {})) {
    const base = out[id] || { id: Number(id), name: o.name || String(id), team: null, pos: null, source: 'manual' };
    out[id] = { ...base, ...Object.fromEntries(Object.entries(o).filter(([k, v]) => ['team', 'pos', 'name', 'excluded', 'note'].includes(k) && v !== undefined && v !== '')), overridden: true, ...(o.team ? { onRoster: true } : {}) };
  }
  return out;
}

const TRACKED = ['team', 'pos', 'number', 'name'];

export function diffPlayers(prev, next, at) {
  const changes = [];
  for (const [id, p] of Object.entries(next)) {
    const o = prev[id];
    if (!o) { changes.push({ at, id: p.id, name: p.name, type: 'added', to: p.team }); continue; }
    for (const k of TRACKED) {
      if ((o[k] ?? null) !== (p[k] ?? null)) {
        changes.push({ at, id: p.id, name: p.name, type: k === 'team' ? 'moved' : `${k}-changed`, from: o[k] ?? null, to: p[k] ?? null });
      }
    }
  }
  for (const [id, o] of Object.entries(prev)) {
    if (!next[id]) changes.push({ at, id: o.id, name: o.name, type: 'removed', from: o.team });
  }
  return changes;
}

/** Pull all 32 rosters, store teams + players, and log what changed. */
export async function updateRosters() {
  const at = new Date().toISOString();
  const teams = await fetchTeams();
  const players = {};
  const counts = {};
  let failed = [];
  const queue = [...teams];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        const r = await get(`${WEB}/roster/${t.abbrev}/current`);
        const list = [...(r?.forwards || []), ...(r?.defensemen || []), ...(r?.goalies || [])];
        counts[t.abbrev] = list.length;
        for (const p of list) players[p.id] = mapPlayer(p, t.abbrev);
      } catch {
        failed.push(t.abbrev);
      }
    }
  }));
  if (failed.length > 4) throw new Error(`Roster fetch failed for ${failed.join(', ')}`);

  const previous = await readJson(PLAYERS_PATH);
  // Keep last known data for teams whose roster call failed this time.
  if (failed.length && previous?.players) {
    for (const p of Object.values(previous.players)) if (failed.includes(p.team) && !players[p.id]) players[p.id] = p;
  }
  const changes = previous?.players ? diffPlayers(previous.players, players, at) : [];

  await writeJson(TEAMS_PATH, { updatedAt: at, teams: teams.map((t) => ({ ...t, rosterSize: counts[t.abbrev] ?? null })) });
  await writeJson(PLAYERS_PATH, { updatedAt: at, count: Object.keys(players).length, players });
  if (changes.length) {
    const log = (await readJson(CHANGES_PATH)) || { changes: [] };
    log.changes = [...changes, ...log.changes].slice(0, 1000);
    log.updatedAt = at;
    await writeJson(CHANGES_PATH, log);
  }
  await writeJson('data/meta/last-roster-update.json', { at, teams: teams.length, players: Object.keys(players).length, changes: changes.length, failed });
  return { at, teams: teams.length, players: Object.keys(players).length, changes: changes.length, failed, firstLoad: !previous };
}

/** Players with overrides applied, keyed by id. */
export async function loadPlayers() {
  const [file, overrides, seen] = await Promise.all([readJson(PLAYERS_PATH), readJson(OVERRIDES_PATH), readJson('data/reference/seen-players.json')]);
  const base = {};
  // Players seen in stored games but not on a current roster (waived, retired, AHL).
  for (const p of Object.values(seen?.players || {})) base[p.id] = { ...p, onRoster: false };
  for (const p of Object.values(file?.players || {})) base[p.id] = { ...(base[p.id] || {}), ...p, onRoster: true };
  return { updatedAt: file?.updatedAt || null, players: applyOverrides(base, overrides?.players || {}) };
}

export async function setOverride(id, patch) {
  const file = (await readJson(OVERRIDES_PATH)) || { players: {} };
  if (patch === null) delete file.players[id];
  else file.players[id] = { ...(file.players[id] || {}), ...patch, updatedAt: new Date().toISOString() };
  await writeJson(OVERRIDES_PATH, file);
  return file.players[id] || null;
}
