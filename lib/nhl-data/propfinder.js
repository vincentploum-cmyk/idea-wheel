// PropFinder season stats from its CSV exports: skater per-game rates (the same
// TOI/G … IHDCF/G columns the model's "Player stats" workbook carries, but
// PropFinder's own numbers) and team per-game stats with PropFinder's league
// ranks. One snapshot per season:
//   data/propfinder/skaters-<year>.json   players keyed by normalised name (season rates)
//   data/propfinder/skaters-l5-<year>.json the same over the last five games (rolling)
//   data/propfinder/skaters-l5-home-<year>.json / -away-  … last five home / away games
//   data/propfinder/teams-<year>.json     32 teams + ranks (what each team produced)
//   data/propfinder/opponents-<year>.json the same columns as what each team allowed
//   data/propfinder/opponents-<pos>-<year>.json  … allowed to one position (lw, c, rw, d)
//   data/propfinder/opponents-<pos>-l10-<year>.json  … over the last 10 (or 5) games
// The final 2025-26 exports ship with the site (seed/) so the tables are never
// empty; an imported CSV for the same or a newer season takes over.
import { readJson, writeJson } from '../nhl-store';
import { normName, nameResolver } from './names';
import { inspectPropfinderCsv, seasonYear } from './propfinder-csv';
import { PROPFINDER_SEED } from './seed/propfinder-2025';

export const PF_SKATERS = (year, windowGames = null, split = null) => `data/propfinder/skaters-${windowGames ? `l${windowGames}-` : ''}${split === 'H' ? 'home-' : split === 'A' ? 'away-' : ''}${year}.json`;
// The skater tables the site reads: key → [windowGames, split].
export const SKATER_TABLES = { skaters: [null, null], skatersL5: [5, null], skatersL5Home: [5, 'H'], skatersL5Away: [5, 'A'] };
const skaterKey = (info) => Object.keys(SKATER_TABLES).find((k) => SKATER_TABLES[k][0] === (info.windowGames || null) && SKATER_TABLES[k][1] === (info.split || null)) || null;
export const PF_TEAMS = (year) => `data/propfinder/teams-${year}.json`;
export const PF_OPPONENTS = (year, pos = 'All', windowGames = null, split = null) => `data/propfinder/opponents-${pos === 'All' ? '' : `${pos.toLowerCase()}-`}${windowGames ? `l${windowGames}-` : ''}${split === 'H' ? 'home-' : split === 'A' ? 'away-' : ''}${year}.json`;
// Recent-games windows the rink toggle can show: key → [windowGames, split].
export const OPP_WINDOWS = { l5: [5, null], l10: [10, null], l15: [15, null], l5home: [5, 'H'], l5away: [5, 'A'] };
const windowKey = (info) => Object.keys(OPP_WINDOWS).find((k) => OPP_WINDOWS[k][0] === info.windowGames && OPP_WINDOWS[k][1] === (info.split || null)) || null;
export const OPP_POS = ['LW', 'C', 'RW', 'D'];
const SOURCE = 'PropFinder';
const FILES_KEPT = 20;

function noteFile(prev, info, { fileName, source, at }, rows) {
  const files = (prev?.files || []).filter((f) => f.name !== fileName);
  files.push({ name: fileName, date: info.date, receivedAt: at, source, rows });
  return files.slice(-FILES_KEPT);
}

const later = (a, b) => (!a || (b && b > a) ? b : a);

/** Upsert an export's skaters into the season snapshot; the newer export wins per player. */
export function mergeSkaters(prev, info, opts = {}) {
  const { fileName = '', source = 'upload', at = new Date().toISOString() } = opts;
  const date = info.date || at.slice(0, 10);
  const players = { ...(prev?.players || {}) };
  let changed = 0;
  for (const p of info.players) {
    const key = normName(p.name);
    if (!key) continue;
    if (players[key] && players[key].asOf > date) continue;
    players[key] = { ...p, asOf: date };
    changed++;
  }
  const file = {
    season: info.season, source: SOURCE, rate: 'Per Game', windowGames: info.windowGames ?? prev?.windowGames ?? null, split: info.split ?? prev?.split ?? null, updatedAt: at, asOf: later(prev?.asOf, date),
    files: noteFile(prev, info, { fileName, source, at }, info.players.length), players,
  };
  return { file, changed };
}

/** Upsert an export's teams (and PropFinder's ranks) into the season snapshot. */
export function mergeTeams(prev, info, opts = {}) {
  const { fileName = '', source = 'upload', at = new Date().toISOString() } = opts;
  const date = info.date || at.slice(0, 10);
  const teams = { ...(prev?.teams || {}) };
  const ranks = { ...(prev?.ranks || {}) };
  let changed = 0;
  for (const t of info.teams) {
    if (teams[t.abbr] && teams[t.abbr].asOf > date) continue;
    teams[t.abbr] = { name: t.name, gp: t.gp, ...t.values, asOf: date };
    ranks[t.abbr] = { ...t.ranks };
    changed++;
  }
  const file = {
    season: info.season, source: SOURCE, statsType: info.statsType || prev?.statsType || 'team', position: info.position || prev?.position || 'All', window: info.window || prev?.window || null, windowGames: info.windowGames ?? prev?.windowGames ?? null, split: info.split ?? prev?.split ?? null, updatedAt: at, asOf: later(prev?.asOf, date),
    files: noteFile(prev, info, { fileName, source, at }, info.teams.length), teams, ranks, count: Object.keys(teams).length,
  };
  return { file, changed };
}

/** Store one PropFinder CSV (skater or team stats) into its season snapshot. */
export async function ingestPropfinderCsv({ buffer, text, fileName, source = 'upload' }) {
  const csv = text ?? Buffer.from(buffer).toString('utf8');
  const info = inspectPropfinderCsv(csv, fileName);
  if (info.error) throw new Error(`${fileName}: ${info.error}`);
  const at = new Date().toISOString();
  if (info.kind === 'skaters') {
    const path = PF_SKATERS(info.season, info.windowGames, info.split);
    const { file, changed } = mergeSkaters(await readJson(path), info, { fileName, source, at });
    await writeJson(path, file);
    return { kind: 'skaters', windowGames: info.windowGames, split: info.split, season: info.season, date: info.date, players: info.players.length, updated: changed, total: Object.keys(file.players).length };
  }
  const path = info.statsType === 'opponent' ? PF_OPPONENTS(info.season, info.position, info.windowGames, info.split) : PF_TEAMS(info.season);
  const { file, changed } = mergeTeams(await readJson(path), info, { fileName, source, at });
  await writeJson(path, file);
  return { kind: 'teams', statsType: info.statsType, position: info.position, windowGames: info.windowGames, season: info.season, date: info.date, teams: info.teams.length, updated: changed, total: Object.keys(file.teams).length };
}

let seedCache = null;
/** The bundled exports, parsed once into the same snapshot shape as stored files. */
export function seedSnapshots() {
  if (seedCache) return seedCache;
  const skaterTables = {};
  let teams = null;
  let opponents = null;
  const opponentsByPos = {};
  const opponentsByPosWindow = {};
  const opponentsByWindow = {};
  for (const f of PROPFINDER_SEED.files) {
    const info = inspectPropfinderCsv(f.text, f.name);
    const opts = { fileName: f.name, source: 'bundled', at: PROPFINDER_SEED.generatedAt };
    if (info.error) continue;
    if (info.kind === 'skaters') { const k = skaterKey(info); if (k) skaterTables[k] = mergeSkaters(skaterTables[k], info, opts).file; }
    if (info.kind === 'teams' && info.statsType === 'opponent' && info.position !== 'All' && info.windowGames) {
      const k = windowKey(info);
      if (!k) continue;
      const w = (opponentsByPosWindow[k] = opponentsByPosWindow[k] || {});
      w[info.position] = mergeTeams(w[info.position], info, opts).file;
    } else if (info.kind === 'teams' && info.statsType === 'opponent' && info.position !== 'All') opponentsByPos[info.position] = mergeTeams(opponentsByPos[info.position], info, opts).file;
    else if (info.kind === 'teams' && info.statsType === 'opponent' && info.windowGames) { const k = windowKey(info); if (k) opponentsByWindow[k] = mergeTeams(opponentsByWindow[k], info, opts).file; }
    else if (info.kind === 'teams' && info.statsType === 'opponent') opponents = mergeTeams(opponents, info, opts).file;
    else if (info.kind === 'teams') teams = mergeTeams(teams, info, opts).file;
  }
  seedCache = { skaterTables, teams, opponents, opponentsByPos, opponentsByPosWindow, opponentsByWindow };
  return seedCache;
}

/** Newest snapshot per kind: this season's, else last season's (stored beats bundled). */
export async function loadPropfinder(year = seasonYear()) {
  const seed = seedSnapshots();
  // Every table lives in one folder: its listing (one call, shared by all the reads below)
  // says which exports exist, so the many that do not cost no download.
  const pick = async (pathFor, seeded) => {
    for (const y of [year, year - 1]) {
      const stored = await readJson(pathFor(y), { revalidate: true });
      if (stored) return stored;
      if (seeded?.season === y) return seeded;
    }
    return null;
  };
  const skaterKeys = Object.keys(SKATER_TABLES);
  const [teams, opponents, ...rest] = await Promise.all([
    pick(PF_TEAMS, seed.teams), pick(PF_OPPONENTS, seed.opponents),
    ...skaterKeys.map((k) => pick((y) => PF_SKATERS(y, ...SKATER_TABLES[k]), seed.skaterTables[k])),
    ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos), seed.opponentsByPos[pos])),
  ]);
  const skaterTables = Object.fromEntries(skaterKeys.map((k, i) => [k, rest[i]]));
  const byPos = rest.slice(skaterKeys.length);
  const opponentsByPos = Object.fromEntries(OPP_POS.map((pos, i) => [pos, byPos[i]]).filter(([, v]) => v));
  // Recent-games windows of the same tables (l5, l10), when exports exist for them: every
  // window's files are read at once rather than one window after another.
  const opponentsByPosWindow = {};
  const opponentsByWindow = {};
  const windows = await Promise.all(Object.entries(OPP_WINDOWS).map(async ([k, [w, split]]) => {
    const [all, ...tables] = await Promise.all([
      pick((y) => PF_OPPONENTS(y, 'All', w, split), seed.opponentsByWindow[k]),
      ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos, w, split), seed.opponentsByPosWindow[k]?.[pos])),
    ]);
    return [k, all, tables];
  }));
  for (const [k, all, tables] of windows) {
    if (all) opponentsByWindow[k] = all;
    const got = Object.fromEntries(OPP_POS.map((pos, i) => [pos, tables[i]]).filter(([, v]) => v));
    if (Object.keys(got).length) opponentsByPosWindow[k] = got;
  }
  return { ...skaterTables, teams, opponents, opponentsByPos, opponentsByPosWindow, opponentsByWindow };
}

/** Snapshot players as a list with NHL ids and current teams, best shooters first. */
export function skatersWithIds(snapshot, players) {
  if (!snapshot) return null;
  const resolve = nameResolver(players);
  const list = Object.values(snapshot.players).map((p) => {
    const hit = resolve(p.name, {});
    return { ...p, id: hit?.id ?? null, team: hit?.team ?? null, pos: p.pos || hit?.pos || null };
  });
  list.sort((a, b) => (b.sog ?? 0) - (a.sog ?? 0) || a.name.localeCompare(b.name));
  return { ...snapshot, players: list, count: list.length, matched: list.filter((p) => p.id).length };
}

/** The snapshot row for one NHL player ({ name, team }), tolerating PropFinder's spelling. */
export function skaterFor(snapshot, player) {
  if (!snapshot || !player?.name) return null;
  const direct = snapshot.players[normName(player.name)];
  if (direct) return { season: snapshot.season, ...direct };
  const resolve = nameResolver(Object.values(snapshot.players).map((p, i) => ({ id: i + 1, name: p.name, team: null })));
  const hit = resolve(player.name, {});
  const row = hit ? Object.values(snapshot.players)[hit.id - 1] : null;
  return row ? { season: snapshot.season, ...row } : null;
}

/**
 * What `opp` allowed per game to `pos` last season, from PropFinder's per-position
 * opponent tables, in the shape the slate's defense cards use (rank 1 = most
 * allowed). Used while the stored games are too few to say anything.
 */
export function propfinderAllowed(byPos, opp, pos) {
  const t = byPos?.[pos];
  const row = t?.teams?.[opp];
  if (!row) return null;
  const teams = Object.values(t.teams);
  const mean = (k) => +(teams.reduce((s, r) => s + (Number(r[k]) || 0), 0) / teams.length).toFixed(2);
  const ranks = t.ranks?.[opp] || {};
  return {
    season: { gp: row.gp ?? null, sog: row.sog ?? null, g: row.g ?? null, iscf: row.sc ?? null, a: row.a ?? null },
    league: { sog: mean('sog'), g: mean('g'), iscf: mean('sc') },
    rank: { sog: ranks.sog ?? null, g: ranks.g ?? null, iscf: ranks.sc ?? null },
    teamCount: teams.length,
    source: 'propfinder',
    seasonLabel: `${t.season}-${String(t.season + 1).slice(2)}${t.windowGames ? ` L${t.windowGames}` : ''}${t.split === 'H' ? ' home' : t.split === 'A' ? ' away' : ''}`,
  };
}

// The PropFinder-style defense table above each rink: what one team allowed per game
// to every position, in PropFinder's own columns, one tab per table the site holds.
export const PF_DEFENSE_COLS = [['g', 'Goals/G'], ['a', 'Assists/G'], ['sog', 'Shots/G'], ['icf', 'ICF/G'], ['iff', 'IFF/G'], ['iscf', 'ISCF/G']];
const PF_DEFENSE_POS = ['All', ...OPP_POS];
const WINDOW_LABEL = { l5: 'L5', l10: 'L10', l15: 'L15', l5home: 'L5 home', l5away: 'L5 away' };

/** One tab: `tables` is { All: table, LW: table, … } for one season or window. */
function defenseTab(key, label, tables, abbr, extra = {}) {
  const rows = {};
  let count = 0;
  let asOf = null;
  for (const pos of PF_DEFENSE_POS) {
    const t = tables[pos];
    const row = t?.teams?.[abbr];
    if (!row) continue;
    const ranks = t.ranks?.[abbr] || {};
    // The exports call scoring chances SC; PropFinder's table shows them as ISCF.
    const val = (k) => (k === 'iscf' ? row.iscf ?? row.sc : row[k]) ?? null;
    const rank = (k) => (k === 'iscf' ? ranks.iscf ?? ranks.sc : ranks[k]) ?? null;
    rows[pos] = { gp: row.gp ?? null, ...Object.fromEntries(PF_DEFENSE_COLS.map(([k]) => [k, val(k)])), ranks: Object.fromEntries(PF_DEFENSE_COLS.map(([k]) => [k, rank(k)])) };
    count = Math.max(count, t.count || Object.keys(t.teams).length);
    asOf = later(asOf, t.asOf || null);
  }
  if (!Object.keys(rows).length) return null;
  const season = Object.values(tables).find(Boolean)?.season ?? null;
  return { key, label, season, count, asOf, rows, ...extra };
}

/**
 * Tabs for `abbr`'s defense table, in PropFinder's order: the seasons oldest first (last
 * season's when `prev` carries it, then this season's), then the recent-games windows
 * the stored exports cover (L5, L10, L15, then the venue splits).
 * `pf` / `prev` are loadPropfinder() results (or the subset loadOpponentTables returns).
 */
export function propfinderDefenseTabs(pf, abbr, prev = null) {
  const tabs = [];
  const seasonTab = (src) => {
    if (!src) return null;
    const tables = { All: src.opponents, ...(src.opponentsByPos || {}) };
    const season = Object.values(tables).find(Boolean)?.season;
    return season ? defenseTab(`season-${season}`, String(season), tables, abbr, { kind: 'season' }) : null;
  };
  const cur = seasonTab(pf);
  const old = seasonTab(prev);
  if (old && old.season !== cur?.season) tabs.push(old);
  if (cur) tabs.push(cur);
  for (const k of Object.keys(OPP_WINDOWS)) {
    const tables = { All: pf?.opponentsByWindow?.[k], ...(pf?.opponentsByPosWindow?.[k] || {}) };
    const tab = defenseTab(k, WINDOW_LABEL[k], tables, abbr, { kind: 'window', windowGames: OPP_WINDOWS[k][0], split: OPP_WINDOWS[k][1] });
    if (tab) tabs.push(tab);
  }
  return tabs.length ? { cols: PF_DEFENSE_COLS, tabs } : null;
}

/** Just one season's opponent tables (all positions + per position), stored beating bundled. */
export async function loadOpponentTables(year) {
  const seed = seedSnapshots();
  const pick = async (pathFor, seeded) => (await readJson(pathFor(year), { revalidate: true })) || (seeded?.season === year ? seeded : null);
  const [opponents, ...byPos] = await Promise.all([pick(PF_OPPONENTS, seed.opponents), ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos), seed.opponentsByPos[pos]))]);
  const opponentsByPos = Object.fromEntries(OPP_POS.map((pos, i) => [pos, byPos[i]]).filter(([, v]) => v));
  return opponents || Object.keys(opponentsByPos).length ? { opponents, opponentsByPos } : null;
}
