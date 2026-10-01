// PropFinder's own API (api.propfinder.app), the one its pages call. Signed in with the
// account's credentials from the environment (PROPFINDER_EMAIL / PROPFINDER_PASSWORD,
// set in Render), it returns per-game skater logs and per-team stats rows; from those
// this module builds exactly what the CSV importer stores (skater per-game rates, team
// and opponent tables with PropFinder's ranks) and the two matchup workbooks the model
// reads, so nothing downstream changes: parsers, storage layout and the model's math.
//
//   GET /NHL/teams                      32 teams; stats[] rows: type Team | Opponent,
//                                       position All | LW | C | RW | D, seasonYear,
//                                       lastNGames (5 / 10 / 15) or the full season,
//                                       raw totals + PropFinder's <stat>Rank fields
//   GET /NHL/players?teamIds=…&hydrate=stats
//                                       players of those teams; stats[] = one row per
//                                       game (REG / PST) with shots, iCF, iFF, scoring
//                                       chances, TOI "mm:ss"; zero fields are omitted
//
// PropFinder's exports (checked against its CSVs): season rates = that season's
// regular-season games; "last 5" = the player's last five games of any type; team
// tables = totals / games played, percentages as given.
import * as XLSX from 'xlsx';
import { readJson, writeJson } from '../nhl-store';
import { fetchSchedule } from './api';
import { teamAbbrFromText, teamName } from './teams';
import { mergeSkaters, mergeTeams, PF_SKATERS, PF_TEAMS, PF_OPPONENTS, OPP_POS, SKATER_TABLES } from './propfinder';
import { seasonYear, STATUS } from './propfinder-csv';
import { ingestMatchupFile, slateMetaPath } from './matchups';
import { todayET } from './util';

export const PF_API = 'https://api.propfinder.app';
export const PF_PULL_META = 'data/meta/propfinder-pull.json';
export const SOURCE = 'propfinder-api';
const UA = 'Mozilla/5.0 (nhl-model; +https://ideareels.io)';
const DEF_WINDOW = 10;

export function propfinderConfigured() {
  return !!(process.env.PROPFINDER_EMAIL && process.env.PROPFINDER_PASSWORD);
}

// ── Pure mapping ────────────────────────────────────────────────────────────
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const byDateDesc = (a, b) => String(b.gameDate || '').localeCompare(String(a.gameDate || ''));

/** "20:59" → 20.98 minutes; "1:02:03" (goalies) → 62.05. */
export function toiMinutes(s) {
  const parts = String(s || '').split(':').map(Number);
  if (parts.some((x) => !Number.isFinite(x))) return 0;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return 0;
}

const icfOf = (g) => (g.iCF ?? g.totalShots ?? n(g.shots) + n(g.missedShots) + n(g.blockedAtt));
const iffOf = (g) => (g.iFF ?? n(g.shots) + n(g.missedShots));

/** Per-game rates over a list of game rows, in the skater CSV's columns. */
export function gameRates(games) {
  const gp = games.length;
  if (!gp) return null;
  const avg = (f) => r2(games.reduce((s, g) => s + n(f(g)), 0) / gp);
  const sog = avg((g) => g.shots);
  return {
    gp, toi: avg((g) => toiMinutes(g.totalTimeOnIce)), g: avg((g) => g.goals), a: avg((g) => g.assists), pts: avg((g) => g.points),
    sog, isf: sog, icf: avg(icfOf), iff: avg(iffOf), iscf: avg((g) => g.scoringChances), ihdcf: avg((g) => g.highDangerScoringChances),
  };
}

/** PropFinder's team code → the site's abbreviation (LA → LAK, NJ → NJD, SJ → SJS, TB → TBL). */
export function teamAbbr(t) {
  return teamAbbrFromText(t?.code) || teamAbbrFromText(t?.fullName) || null;
}

/**
 * The season the pull describes: the current one once the slate's players have
 * regular-season games in it, else the previous one (September, the preseason and
 * opening night show last season). Team rows alone do not count: PropFinder lists a
 * one-game row for the new season before its regular season has started.
 */
export function activeSeason(players, date) {
  const y = seasonYear(new Date(`${date}T12:00:00Z`));
  const played = (players || []).some((p) => (p.stats || []).some((g) => g.season === y && g.seasonType === 'REG'));
  return played ? y : y - 1;
}

const isSkater = (p) => p.positionGroup !== 'G' && (p.positionAbbreviation || p.position) !== 'G';
const skaterPos = (p) => {
  const pos = String(p.positionAbbreviation || p.position || '').toUpperCase();
  return ['C', 'LW', 'RW', 'D'].includes(pos) ? pos : pos === 'F' ? 'C' : null;
};
const statusTag = (p) => { const s = String(p.status || '').toUpperCase(); return s !== 'ACT' && STATUS.has(s) ? s : null; };

/**
 * A player's game windows, newest first: the season's regular-season games (a player
 * without any yet, early in the season, carries last season's as his prior) and the
 * last 5 games of any type.
 */
export function skaterWindows(p, season) {
  const all = [...(p.stats || [])].sort(byDateDesc);
  const reg = (y) => all.filter((g) => g.season === y && g.seasonType === 'REG');
  const cur = reg(season);
  return {
    season: cur.length ? cur : reg(season - 1),
    seasonOf: cur.length ? season : season - 1,
    l5: all.slice(0, 5),
    l5Home: all.filter((g) => g.isHomeGame).slice(0, 5),
    l5Away: all.filter((g) => !g.isHomeGame).slice(0, 5),
  };
}

const WINDOW_OF = { skaters: 'season', skatersL5: 'l5', skatersL5Home: 'l5Home', skatersL5Away: 'l5Away' };

/** The four skater tables (season, L5, L5 home, L5 away) as the CSV inspector would return them. */
export function skaterTables(players, { season, date }) {
  const out = {};
  for (const [key, [windowGames, split]] of Object.entries(SKATER_TABLES)) {
    const rows = [];
    for (const p of players || []) {
      if (!isSkater(p) || !p.name) continue;
      const w = skaterWindows(p, season);
      const rates = gameRates(w[WINDOW_OF[key]]);
      if (!rates) continue;
      rows.push({ name: p.name, pos: skaterPos(p), status: statusTag(p), team: teamAbbr(p.team), ...rates, ...(key === 'skaters' && w.seasonOf !== season ? { seasonOf: w.seasonOf } : {}) });
    }
    out[key] = { kind: 'skaters', season, windowGames, split, date, file: SOURCE, players: rows, error: null };
  }
  return out;
}

// Team CSV column → [API field, per game?]. Percentages are taken as given.
const TEAM_FIELDS = {
  g: ['goals', true], a: ['assists', true], pts: ['points', true], sog: ['shots', true], shPct: ['shootingPct', false],
  hit: ['hits', true], blk: ['blockedShots', true], tk: ['takeaways', true], gv: ['giveaways', true],
  foPct: ['faceoffWinPct', false], ppPct: ['powerplayPct', false], pkPct: ['penaltyKillPct', false],
  sc: ['scoringChances', true], hdc: ['highDangerScoringChances', true], hdg: ['highDangerGoals', true],
};

/** The stats row for a season, type, position and window (null = full season). */
export function pickRow(stats, { season, type, position, lastN = null }) {
  const rows = (stats || []).filter((r) => r.seasonYear === season && r.type === type && r.position === position
    && (lastN ? r.lastNGames === lastN : !r.lastNGames) && n(r.gamesPlayed) > 0);
  // The full season comes as a season-only row ("" type) and, for some positions, as a REG row
  // that also counts playoff games: prefer the season-only one, then the newest.
  rows.sort((a, b) => (a.seasonType === '' ? 0 : 1) - (b.seasonType === '' ? 0 : 1) || String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')));
  return rows[0] || null;
}

/**
 * One team's CSV-style row from an API stats row: values per game (or %) and
 * PropFinder's own ranks (its <field>Rank), which is what the exports print. Giveaways
 * are the exception: the API ranks them 1 = fewest, the export 1 = most, so that rank
 * is left for rankRows to fill by value.
 */
export function teamRow(abbr, r) {
  const gp = n(r.gamesPlayed);
  const values = {};
  const ranks = {};
  for (const [key, [field, perGame]] of Object.entries(TEAM_FIELDS)) {
    if (r[field] == null) continue;
    values[key] = perGame ? r2(n(r[field]) / gp) : r1(n(r[field]));
    if (key !== 'gv' && n(r[`${field}Rank`]) > 0) ranks[key] = n(r[`${field}Rank`]);
  }
  // Attempts: the exports don't print them, but PropFinder's own defense table does
  // (ICF/G, IFF/G next to ISCF/G); ranks are filled by value in rankRows.
  if (r.shots != null && r.missedShots != null) {
    values.iff = r2((n(r.shots) + n(r.missedShots)) / gp);
    if (r.blockedAtt != null) values.icf = r2((n(r.shots) + n(r.missedShots) + n(r.blockedAtt)) / gp);
  }
  return { abbr, name: teamName(abbr), gp, values, ranks };
}

/** Fills the ranks a table still lacks by value, 1 = highest, ties sharing a rank (like the exports). */
export function rankRows(rows) {
  const keys = [...new Set(rows.flatMap((t) => Object.keys(t.values)))];
  for (const key of keys) {
    if (rows.every((t) => t.values[key] == null || t.ranks[key])) continue;
    const ranked = rows.filter((t) => t.values[key] != null).sort((a, b) => b.values[key] - a.values[key]);
    ranked.forEach((t, i) => { t.ranks[key] = ranked.findIndex((o) => o.values[key] === t.values[key]) + 1 || i + 1; });
  }
  return rows;
}

const TEAM_TABLES = [
  { type: 'Team', position: 'All', lastN: null },
  ...[null, 5, 10].flatMap((lastN) => ['All', ...OPP_POS].map((position) => ({ type: 'Opponent', position, lastN }))),
];

/** Team and opponent tables (full season, last 5, last 10; all positions and per position). */
export function teamTables(teams, { season, date }) {
  const out = [];
  for (const { type, position, lastN } of TEAM_TABLES) {
    const rows = [];
    for (const t of teams || []) {
      const abbr = teamAbbr(t);
      const r = abbr && pickRow(t.stats, { season, type, position, lastN });
      if (r) rows.push(teamRow(abbr, r));
    }
    if (rows.length < 2) continue;
    rankRows(rows);
    out.push({
      kind: 'teams', statsType: type === 'Opponent' ? 'opponent' : 'team', position, season, date, file: SOURCE,
      window: lastN ? `Last ${lastN}` : 'Full Season', windowGames: lastN, split: null, teams: rows, error: null,
    });
  }
  return out;
}

/** What each team allowed per position per game over its last N games, with ranks (1 = most allowed). */
export function defenseBlocks(teams, { season, lastN = DEF_WINDOW }) {
  const positions = ['All', ...OPP_POS];
  const metrics = ['g', 'a', 'sog', 'icf', 'iff', 'iscf'];
  const per = {};
  let windowed = 0;
  let total = 0;
  for (const t of teams || []) {
    const abbr = teamAbbr(t);
    if (!abbr) continue;
    const rows = {};
    for (const pos of positions) {
      const r = pickRow(t.stats, { season, type: 'Opponent', position: pos, lastN }) || pickRow(t.stats, { season, type: 'Opponent', position: pos });
      if (!r) continue;
      total++;
      if (r.lastNGames === lastN) windowed++;
      const gp = n(r.gamesPlayed);
      rows[pos] = {
        gp, g: r2(n(r.goals) / gp), a: r2(n(r.assists) / gp), sog: r2(n(r.shots) / gp),
        icf: r2((n(r.shots) + n(r.missedShots) + n(r.blockedAtt)) / gp), iff: r2((n(r.shots) + n(r.missedShots)) / gp), iscf: r2(n(r.scoringChances) / gp),
      };
    }
    if (Object.keys(rows).length) per[abbr] = rows;
  }
  const ranks = {};
  for (const pos of positions) {
    const abbrs = Object.keys(per).filter((a) => per[a][pos]);
    for (const m of metrics) {
      const sorted = [...abbrs].sort((x, y) => per[y][pos][m] - per[x][pos][m]);
      sorted.forEach((a, i) => {
        ranks[a] = ranks[a] || {};
        ranks[a][pos] = ranks[a][pos] || {};
        ranks[a][pos][m] = sorted.findIndex((b) => per[b][pos][m] === per[a][pos][m]) + 1 || i + 1;
      });
    }
  }
  // Only a window every team has is labelled as one; the parsers read both labels.
  const label = total && windowed === total ? `Defense (Last ${lastN} Games)` : 'Defense (Season)';
  return { teams: per, ranks, label };
}

const SKATER_HEAD = ['Player', 'Pos', 'GP', 'TOI/G', 'G/G', 'A/G', 'SOG/G', 'ICF/G', 'IFF/G', 'ISCF/G'];
const DEF_HEAD = ['Pos', 'G', 'A', 'SOG', 'ICF', 'IFF', 'ISCF', '', 'G rank', 'A rank', 'SOG rank', 'ICF rank', 'IFF rank', 'ISCF rank'];

/**
 * The season and last-5 matchup workbooks for a slate, one sheet per game
 * ("Penguins @ Flyers"), in the layout of PropFinder's NHL-Goal-Matchups exports:
 * each team's "Skaters (…)" block and "Defense (…)" block.
 */
export function matchupWorkbooks(slate, teams, players, { season, date }) {
  const def = defenseBlocks(teams, { season });
  const byTeam = {};
  for (const p of players || []) {
    if (!isSkater(p) || !p.name) continue;
    const abbr = teamAbbr(p.team);
    if (abbr) (byTeam[abbr] = byTeam[abbr] || []).push(p);
  }
  const skaterRows = (abbr, window) => (byTeam[abbr] || [])
    .map((p) => ({ p, r: gameRates(skaterWindows(p, season)[window]) }))
    .filter(({ r }) => r)
    .sort((a, b) => b.r.toi - a.r.toi)
    .map(({ p, r }) => [p.name, skaterPos(p), r.gp, r.toi, r.g, r.a, r.sog, r.icf, r.iff, r.iscf]);
  const defRows = (abbr) => ['All', ...OPP_POS].filter((pos) => def.teams[abbr]?.[pos]).map((pos) => {
    const d = def.teams[abbr][pos];
    const rk = def.ranks[abbr]?.[pos] || {};
    return [pos, d.g, d.a, d.sog, d.icf, d.iff, d.iscf, '', rk.g, rk.a, rk.sog, rk.icf, rk.iff, rk.iscf];
  });
  const build = (window, blockLabel) => {
    const wb = XLSX.utils.book_new();
    let sheets = 0;
    for (const g of slate) {
      const rows = [];
      for (const abbr of [g.away, g.home]) rows.push([`${teamName(abbr)} Skaters (${blockLabel})`], SKATER_HEAD, ...skaterRows(abbr, window), []);
      for (const abbr of [g.away, g.home]) rows.push([`${teamName(abbr)} ${def.label}`], DEF_HEAD, ...defRows(abbr), []);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `${teamName(g.away)} @ ${teamName(g.home)}`.slice(0, 31));
      sheets++;
    }
    return { wb, sheets };
  };
  return {
    season: { ...build('season', 'Season'), name: `NHL-Goal-Matchups-${date}.xlsx` },
    l5: { ...build('l5', 'Last 5 Games'), name: `NHL-Goal-Matchups-${date}-L5.xlsx` },
    defenseLabel: def.label,
    teamsWithSkaters: Object.keys(byTeam).length,
  };
}

// ── The API ─────────────────────────────────────────────────────────────────
function headers(token) {
  return {
    Accept: 'application/json, text/plain, */*', Origin: 'https://propfinder.app', Referer: 'https://propfinder.app/',
    'User-Agent': UA, 'X-PF-Client': 'web/ideareels',
    ...(token ? { Cookie: `accessToken=${token}`, Authorization: `Bearer ${token}` } : {}),
  };
}

/** The access token from a sign-in response: in its JSON (accessToken / token …) or its Set-Cookie. */
export function tokenFromLogin(body, setCookie = '') {
  const find = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 3) return null;
    for (const k of ['accessToken', 'access_token', 'token', 'jwt']) if (typeof o[k] === 'string' && o[k].length > 20) return o[k];
    for (const v of Object.values(o)) { const t = find(v, depth + 1); if (t) return t; }
    return null;
  };
  const m = String(setCookie || '').match(/accessToken=([^;,\s]+)/);
  return find(body) || (m ? decodeURIComponent(m[1]) : null);
}

/** Expiry of a JWT in ms, or null. */
export function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return Number.isFinite(payload?.exp) ? payload.exp * 1000 : null;
  } catch { return null; }
}

let session = null; // { token, exp } for this server process

async function signIn() {
  const res = await fetch(`${PF_API}/identity/authenticate`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { ...headers(null), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.PROPFINDER_EMAIL, password: process.env.PROPFINDER_PASSWORD }),
  });
  if (!res.ok) throw new Error(`PropFinder sign-in failed (${res.status})`);
  const body = await res.json().catch(() => null);
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie().join(', ') : res.headers.get('set-cookie') || '';
  const token = tokenFromLogin(body, cookies);
  if (!token) throw new Error('PropFinder sign-in returned no access token');
  session = { token, exp: tokenExpiry(token) || Date.now() + 30 * 60 * 1000 };
  return session.token;
}

async function token({ fresh = false } = {}) {
  if (!fresh && session && session.exp - Date.now() > 5 * 60 * 1000) return session.token;
  return signIn();
}

async function getJson(path, { retry = true } = {}) {
  const res = await fetch(`${PF_API}${path}`, { headers: headers(await token()), cache: 'no-store', signal: AbortSignal.timeout(90000) });
  if ((res.status === 401 || res.status === 403) && retry) {
    await token({ fresh: true });
    return getJson(path, { retry: false });
  }
  if (!res.ok) throw new Error(`PropFinder ${res.status} for ${path.split('?')[0]}`);
  return res.json();
}

const chunks = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

/**
 * Pull PropFinder for a slate date: the team tables (32 teams), the skaters of the
 * teams playing, then store the CSV-equivalent tables and the two matchup workbooks
 * (through the same ingest the uploads use, so the defense table and the PropFinder
 * spellings update too). Records the outcome in data/meta/propfinder-pull.json.
 */
export async function pullPropfinder(date, { source = SOURCE } = {}) {
  const at = new Date().toISOString();
  const done = async (result) => { await writeJson(PF_PULL_META, { at, date, ...result }); return { at, date, ...result }; };
  if (!propfinderConfigured()) return { ok: false, at, date, skipped: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD)' };
  try {
    const schedule = await fetchSchedule(date);
    const slate = schedule.map((g) => ({ away: g.away, home: g.home })).filter((g) => g.away && g.home);
    if (!slate.length) return done({ ok: false, skipped: 'no games on this date' });

    const teams = await getJson('/NHL/teams');
    if (!Array.isArray(teams) || !teams.length) throw new Error('PropFinder returned no teams');
    const byAbbr = {};
    for (const t of teams) { const a = teamAbbr(t); if (a) byAbbr[a] = t; }
    const slateAbbrs = [...new Set(slate.flatMap((g) => [g.away, g.home]))];
    const missingTeams = slateAbbrs.filter((a) => !byAbbr[a]);
    const ids = slateAbbrs.map((a) => byAbbr[a]?.id).filter(Boolean);
    const players = [];
    for (const ch of chunks(ids, 8)) {
      const got = await getJson(`/NHL/players?${ch.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')}&hydrate=stats&withOddsOnly=true`);
      if (Array.isArray(got)) players.push(...got);
    }
    const season = activeSeason(players, date);

    const skaters = {};
    for (const [key, info] of Object.entries(skaterTables(players, { season, date }))) {
      if (!info.players.length) continue;
      const path = PF_SKATERS(season, info.windowGames, info.split);
      const { file, changed } = mergeSkaters(await readJson(path), info, { fileName: `PropFinder API · ${key} · ${date}`, source, at });
      await writeJson(path, file);
      skaters[key] = changed;
    }
    let teamTableCount = 0;
    for (const info of teamTables(teams, { season, date })) {
      const path = info.statsType === 'opponent' ? PF_OPPONENTS(season, info.position, info.windowGames) : PF_TEAMS(season);
      const { file } = mergeTeams(await readJson(path), info, { fileName: `PropFinder API · ${info.statsType} ${info.position} ${info.window} · ${date}`, source, at });
      await writeJson(path, file);
      teamTableCount++;
    }

    const books = matchupWorkbooks(slate, teams, players, { season, date });
    const files = {};
    for (const kind of ['season', 'l5']) {
      const buffer = XLSX.write(books[kind].wb, { type: 'buffer', bookType: 'xlsx' });
      files[kind] = await ingestMatchupFile({ buffer, fileName: books[kind].name, date, source });
    }
    return done({
      ok: true, season, games: slate.length, teams: slateAbbrs.length, missingTeams, players: players.length,
      teamsWithSkaters: books.teamsWithSkaters, skaters, teamTables: teamTableCount, defense: books.defenseLabel, files,
    });
  } catch (err) {
    console.error('[propfinder-api] pull failed:', err);
    return done({ ok: false, error: String(err?.message || err) });
  }
}

/**
 * Pull only when the slate's matchup workbooks are still missing (and not tried in
 * the last `minGapMin`): the hourly lineup reads call this so a failed morning pull
 * is retried without hammering PropFinder.
 */
export async function ensurePropfinderSlate(date, { minGapMin = 30 } = {}) {
  if (!propfinderConfigured() || date < todayET()) return null;
  const meta = await readJson(slateMetaPath(date));
  if (meta?.files?.season && meta?.files?.l5) return null;
  const last = await readJson(PF_PULL_META);
  if (last?.date === date && last.at && Date.now() - Date.parse(last.at) < minGapMin * 60 * 1000) return { ok: false, skipped: 'tried recently' };
  return pullPropfinder(date);
}
