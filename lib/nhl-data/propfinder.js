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
import { defenseByPosition } from './defense';
import { teamName } from './teams';
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
  const pick = async (pathFor, seeded) => {
    for (const y of [year, year - 1]) {
      const stored = await readJson(pathFor(y));
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
  // Recent-games windows of the same tables (l5, l10), when exports exist for them.
  const opponentsByPosWindow = {};
  const opponentsByWindow = {};
  for (const [k, [w, split]] of Object.entries(OPP_WINDOWS)) {
    const [all, ...tables] = await Promise.all([
      pick((y) => PF_OPPONENTS(y, 'All', w, split), seed.opponentsByWindow[k]),
      ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos, w, split), seed.opponentsByPosWindow[k]?.[pos])),
    ]);
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

// The exports call scoring chances SC; PropFinder's table shows them as ISCF.
const cellOf = (row, k) => (k === 'iscf' ? row.iscf ?? row.sc : row[k]) ?? null;
const rankOf = (ranks, k) => (k === 'iscf' ? ranks.iscf ?? ranks.sc : ranks[k]) ?? null;

/**
 * The table's cells without holes: PropFinder's API leaves a field out when its value is
 * zero (a position held to no goals arrives without `goals`), and its season-only "All" row
 * carries no scoring chances early in a season. A missing cell on a row with games played
 * reads 0; a missing "All" cell is the four positions' cells summed. A cell filled here is
 * ranked by value among the table's teams (1 = most allowed, ties sharing a rank).
 * Returns { pos: { teams: { abbr: { cells }, ranks: { abbr: { ranks } } } } for PF_DEFENSE_COLS.
 */
function filledDefense(tables) {
  const out = {};
  for (const pos of PF_DEFENSE_POS) {
    const t = tables[pos];
    if (!t?.teams) continue;
    const teams = {};
    const ranks = {};
    const filled = {};
    // Only a column the table carries (some team has it) is zero-filled: the CSV exports have no attempts at all.
    const carried = Object.fromEntries(PF_DEFENSE_COLS.map(([k]) => [k, Object.values(t.teams).some((row) => cellOf(row, k) != null)]));
    for (const [abbr, row] of Object.entries(t.teams)) {
      const r = t.ranks?.[abbr] || {};
      teams[abbr] = { gp: row.gp ?? null };
      ranks[abbr] = {};
      for (const [k] of PF_DEFENSE_COLS) {
        let v = cellOf(row, k);
        if (v == null && pos !== 'All' && carried[k] && row.gp > 0) { v = 0; (filled[k] = filled[k] || new Set()).add(abbr); }
        teams[abbr][k] = v;
        ranks[abbr][k] = rankOf(r, k);
      }
    }
    out[pos] = { teams, ranks, filled };
  }
  const all = out.All;
  if (all) {
    for (const [abbr, row] of Object.entries(all.teams)) {
      for (const [k] of PF_DEFENSE_COLS) {
        if (row[k] != null) continue;
        const parts = OPP_POS.map((pos) => out[pos]?.teams?.[abbr]?.[k]);
        if (parts.some((v) => v == null)) continue;
        row[k] = +parts.reduce((s, v) => s + v, 0).toFixed(2);
        (all.filled[k] = all.filled[k] || new Set()).add(abbr);
      }
    }
  }
  for (const t of Object.values(out)) {
    for (const [k, who] of Object.entries(t.filled)) {
      const values = Object.values(t.teams).map((r) => r[k]).filter((v) => v != null);
      for (const abbr of who) t.ranks[abbr][k] = values.filter((v) => v > t.teams[abbr][k]).length + 1;
    }
  }
  return out;
}

/** One tab: `tables` is { All: table, LW: table, … } for one season or window. */
function defenseTab(key, label, tables, abbr, extra = {}) {
  const rows = {};
  let count = 0;
  let asOf = null;
  const filled = filledDefense(tables);
  for (const pos of PF_DEFENSE_POS) {
    const t = tables[pos];
    const row = filled[pos]?.teams?.[abbr];
    if (!row) continue;
    const ranks = filled[pos].ranks[abbr];
    rows[pos] = { gp: row.gp, ...Object.fromEntries(PF_DEFENSE_COLS.map(([k]) => [k, row[k]])), ranks: Object.fromEntries(PF_DEFENSE_COLS.map(([k]) => [k, ranks[k]])) };
    count = Math.max(count, t.count || Object.keys(t.teams).length);
    asOf = later(asOf, t.asOf || null);
  }
  if (!Object.keys(rows).length) return null;
  const first = Object.values(tables).find(Boolean);
  const season = first?.season ?? null;
  return { key, label, season, count, asOf, rows, ...(first?.source === 'stored' ? { source: 'stored' } : {}), ...extra };
}

const r2 = (v) => +Number(v).toFixed(2);
const regularSeasonRow = (r) => String(r.gameId).slice(4, 6) === '02';

/**
 * One recent-games window (`k` of OPP_WINDOWS) rolled from the stored box scores, in the
 * shape of a stored opponent table per position ({ All, LW, C, RW, D }): every team's last
 * N regular-season games regardless of season, the way PropFinder's own L5 counts last
 * April's games beside this week's. Its API only lists a season's windows once that season
 * has them, so early in a season the pulled file is still last season's; this stands in.
 * Ranks 1 = most allowed among the teams with games in the window. Null without rows.
 */
export function storedWindowTables(rows, k, { season = seasonYear() } = {}) {
  const [windowGames, split] = OPP_WINDOWS[k] || [];
  if (!windowGames || !Array.isArray(rows)) return null;
  const reg = rows.filter(regularSeasonRow);
  if (!reg.length) return null;
  const def = defenseByPosition(reg, { lastN: windowGames });
  const venue = split === 'H' ? 'H' : split === 'A' ? 'A' : 'ALL';
  const asOf = reg.reduce((m, r) => (r.date > m ? r.date : m), '');
  const out = {};
  for (const pos of ['All', ...OPP_POS]) {
    const teams = {};
    const ranks = {};
    for (const [abbr, t] of Object.entries(def.teams)) {
      const row = t[venue]?.[pos];
      if (!row?.gp) continue;
      teams[abbr] = { name: teamName(abbr) || abbr, gp: row.gp, g: r2(row.g), a: r2(row.a), sog: r2(row.sog), icf: r2(row.icf), iff: r2(row.iff), iscf: r2(row.iscf), asOf };
      const rk = def.ranks[abbr]?.[venue]?.[pos] || {};
      ranks[abbr] = { g: rk.g ?? null, a: rk.a ?? null, sog: rk.sog ?? null, icf: rk.icf ?? null, iff: rk.iff ?? null, iscf: rk.iscf ?? null };
    }
    if (!Object.keys(teams).length) continue;
    out[pos] = { season, source: 'stored', statsType: 'opponent', position: pos, window: `Last ${windowGames}`, windowGames, split, asOf, teams, ranks, count: Object.keys(teams).length };
  }
  return Object.keys(out).length ? out : null;
}

// A pulled window stands only once it covers the league: early in a season PropFinder's API
// lists a window row for the teams that have played that many games and no one else.
const FULL_WINDOW_TEAMS = 30;
const fullWindow = (t, season) => !!t && t.season >= season && (t.count || Object.keys(t.teams || {}).length) >= FULL_WINDOW_TEAMS;

/**
 * `pf` with every recent-games window that PropFinder has not published for its current
 * season (missing, still last season's file, or listing only the teams that have played
 * that many games this season) replaced by the one rolled from `rows` (loadRows() output:
 * the stored skater-games before the slate date). A window PropFinder holds for the
 * current season for the whole league is kept as pulled.
 */
export function withStoredWindows(pf, rows) {
  if (!Array.isArray(rows) || !rows.length) return pf;
  const season = pf?.opponents?.season ?? Object.values(pf?.opponentsByPos || {})[0]?.season ?? seasonYear();
  const byWindow = { ...(pf?.opponentsByWindow || {}) };
  const byPosWindow = { ...(pf?.opponentsByPosWindow || {}) };
  for (const k of Object.keys(OPP_WINDOWS)) {
    const have = [byWindow[k], ...Object.values(byPosWindow[k] || {})].filter(Boolean);
    if (have.length && have.every((t) => fullWindow(t, season))) continue;
    const built = storedWindowTables(rows, k, { season });
    if (!built) continue;
    const { All, ...pos } = built;
    byWindow[k] = All;
    byPosWindow[k] = pos;
  }
  return { ...(pf || {}), opponentsByWindow: byWindow, opponentsByPosWindow: byPosWindow };
}

/**
 * Tabs for `abbr`'s defense table, in PropFinder's order: the seasons oldest first (last
 * season's when `prev` carries it, then this season's), then the recent-games windows
 * the stored exports cover (L5, L10, L15, then the venue splits). With `rows` (the stored
 * skater-games), a window PropFinder has not published for the current season is rolled
 * from them instead (withStoredWindows), so L5 reads the last five games like PropFinder's.
 * `pf` / `prev` are loadPropfinder() results (or the subset loadOpponentTables returns).
 */
export function propfinderDefenseTabs(pf, abbr, prev = null, { rows = null } = {}) {
  if (rows) pf = withStoredWindows(pf, rows);
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
  const pick = async (pathFor, seeded) => (await readJson(pathFor(year))) || (seeded?.season === year ? seeded : null);
  const [opponents, ...byPos] = await Promise.all([pick(PF_OPPONENTS, seed.opponents), ...OPP_POS.map((pos) => pick((y) => PF_OPPONENTS(y, pos), seed.opponentsByPos[pos]))]);
  const opponentsByPos = Object.fromEntries(OPP_POS.map((pos, i) => [pos, byPos[i]]).filter(([, v]) => v));
  return opponents || Object.keys(opponentsByPos).length ? { opponents, opponentsByPos } : null;
}
