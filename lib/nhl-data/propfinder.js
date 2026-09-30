// PropFinder season stats from its CSV exports: skater per-game rates (the same
// TOI/G … IHDCF/G columns the model's "Player stats" workbook carries, but
// PropFinder's own numbers) and team per-game stats with PropFinder's league
// ranks. One snapshot per season:
//   data/propfinder/skaters-<year>.json   players keyed by normalised name (season rates)
//   data/propfinder/skaters-l5-<year>.json the same over the last five games (rolling)
//   data/propfinder/teams-<year>.json     32 teams + ranks (what each team produced)
//   data/propfinder/opponents-<year>.json the same columns as what each team allowed
//   data/propfinder/opponents-<pos>-<year>.json  … allowed to one position (lw, c, rw, d)
// The final 2025-26 exports ship with the site (seed/) so the tables are never
// empty; an imported CSV for the same or a newer season takes over.
import { readJson, writeJson } from '../nhl-store';
import { normName, nameResolver } from './names';
import { inspectPropfinderCsv, seasonYear } from './propfinder-csv';
import { PROPFINDER_SEED } from './seed/propfinder-2025';

export const PF_SKATERS = (year, windowGames = null) => `data/propfinder/skaters-${windowGames ? `l${windowGames}-` : ''}${year}.json`;
export const PF_TEAMS = (year) => `data/propfinder/teams-${year}.json`;
export const PF_OPPONENTS = (year, pos = 'All') => `data/propfinder/opponents-${pos === 'All' ? '' : `${pos.toLowerCase()}-`}${year}.json`;
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
    season: info.season, source: SOURCE, rate: 'Per Game', windowGames: info.windowGames ?? prev?.windowGames ?? null, updatedAt: at, asOf: later(prev?.asOf, date),
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
    season: info.season, source: SOURCE, statsType: info.statsType || prev?.statsType || 'team', position: info.position || prev?.position || 'All', window: info.window || prev?.window || null, updatedAt: at, asOf: later(prev?.asOf, date),
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
    const path = PF_SKATERS(info.season, info.windowGames);
    const { file, changed } = mergeSkaters(await readJson(path), info, { fileName, source, at });
    await writeJson(path, file);
    return { kind: 'skaters', windowGames: info.windowGames, season: info.season, date: info.date, players: info.players.length, updated: changed, total: Object.keys(file.players).length };
  }
  const path = info.statsType === 'opponent' ? PF_OPPONENTS(info.season, info.position) : PF_TEAMS(info.season);
  const { file, changed } = mergeTeams(await readJson(path), info, { fileName, source, at });
  await writeJson(path, file);
  return { kind: 'teams', statsType: info.statsType, position: info.position, season: info.season, date: info.date, teams: info.teams.length, updated: changed, total: Object.keys(file.teams).length };
}

let seedCache = null;
/** The bundled exports, parsed once into the same snapshot shape as stored files. */
export function seedSnapshots() {
  if (seedCache) return seedCache;
  let skaters = null;
  let skatersL5 = null;
  let teams = null;
  let opponents = null;
  const opponentsByPos = {};
  for (const f of PROPFINDER_SEED.files) {
    const info = inspectPropfinderCsv(f.text, f.name);
    const opts = { fileName: f.name, source: 'bundled', at: PROPFINDER_SEED.generatedAt };
    if (info.error) continue;
    if (info.kind === 'skaters' && info.windowGames === 5) skatersL5 = mergeSkaters(skatersL5, info, opts).file;
    else if (info.kind === 'skaters' && !info.windowGames) skaters = mergeSkaters(skaters, info, opts).file;
    if (info.kind === 'teams' && info.statsType === 'opponent' && info.position !== 'All') opponentsByPos[info.position] = mergeTeams(opponentsByPos[info.position], info, opts).file;
    else if (info.kind === 'teams' && info.statsType === 'opponent') opponents = mergeTeams(opponents, info, opts).file;
    else if (info.kind === 'teams') teams = mergeTeams(teams, info, opts).file;
  }
  seedCache = { skaters, skatersL5, teams, opponents, opponentsByPos };
  return seedCache;
}

/** Newest snapshot per kind: this season's, else last season's (stored beats bundled). */
export async function loadPropfinder(year = seasonYear()) {
  const seed = seedSnapshots();
  const pick = async (pathFor, seeded) => {
    for (const y of [year, year - 1]) {
      const stored = await readJson(pathFor(y));
      if (stored) return stored;
      if (seeded?.season === y) return seeded;
    }
    return null;
  };
  const [skaters, skatersL5, teams, opponents, ...byPos] = await Promise.all([
    pick(PF_SKATERS, seed.skaters), pick((y) => PF_SKATERS(y, 5), seed.skatersL5), pick(PF_TEAMS, seed.teams), pick(PF_OPPONENTS, seed.opponents),
    ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos), seed.opponentsByPos[pos])),
  ]);
  const opponentsByPos = Object.fromEntries(OPP_POS.map((pos, i) => [pos, byPos[i]]).filter(([, v]) => v));
  return { skaters, skatersL5, teams, opponents, opponentsByPos };
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
    seasonLabel: `${t.season}-${String(t.season + 1).slice(2)}`,
  };
}
