// PropFinder's injury report and the without-teammate splits, pure and shared by the sports.
//
// The report comes from the live API, not from a file: the games payload PropFinder's own pages
// load (GET /<LEAGUE>/v2?sportsbooks=…, read from the site's bundle 2026-10-27) carries
// `injuryReport`, a JSON string whose `data` lists { team: { id }, player: { id, name, position },
// status, type }; a league without it answers per team at /injuries/<league>/<teamId> with
// { id, name, status, description, position, date }. Every status is read into one spelling
// (`statusOf`: Out, Doubtful, Questionable, Probable, DTD, GTD, IR, LTIR, Suspended, PUP, NFI, the
// site's own mapping) and `isOut` names the ones that keep a player off tonight's floor.
//
// The splits are PropFinder's "w/o" filter: a player's games in which a teammate did not take part.
// They are read here from the logs the pull already carries, no stored file: a teammate's game
// rows say which games he played (`gameId` on every row, `gamesPlayed`), so a player's games
// without him are the rows whose game the teammate has no row for (`withoutGames`). Only a
// teammate who took part in a real share of the player's games counts (`keyAbsences`: a regular
// whose absence changes his role, not a deep reserve), and the split is blended into the season
// read at n / (n + WITHOUT_K = 4) (`blendWithout`, `ownRate`): four games without the star move the read
// halfway, one a fifth of the way.
import { normName } from '../nhl-data/names';
import { WITHOUT_K, withoutWeight } from './projection';

export { WITHOUT_K, withoutWeight };

const STATUS = {
  out: 'Out', o: 'Out', doubtful: 'Doubtful', d: 'Doubtful', questionable: 'Questionable', q: 'Questionable',
  probable: 'Probable', p: 'Probable', 'day-to-day': 'DTD', 'day to day': 'DTD', dtd: 'DTD',
  'game time decision': 'GTD', 'game-time decision': 'GTD', gtd: 'GTD', ir: 'IR', 'injured reserve': 'IR', 12: 'IR',
  ltir: 'LTIR', suspended: 'Suspended', susp: 'Suspended', pup: 'PUP', 'physically unable to perform': 'PUP',
  nfi: 'NFI', 'non-football injury': 'NFI', 'non-football illness': 'NFI', active: 'Active', act: 'Active', available: 'Available', healthy: 'Available',
};

/** A status as the site reads it, one spelling; a detail naming "probable" / "questionable" sets it (PropFinder's own rule). */
export function statusOf(status, detail = null) {
  const d = String(detail ?? '').trim().toLowerCase();
  if (/\bprobable\b/.test(d)) return 'Probable';
  if (/\bquestionable\b/.test(d)) return 'Questionable';
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return null;
  if (STATUS[s]) return STATUS[s];
  if (s.startsWith('long-term') || s.startsWith('long term')) return 'LTIR';
  if (s.startsWith('injured reserve')) return 'IR';
  if (s.startsWith('day-to-day') || s.startsWith('day to day')) return 'DTD';
  if (s.startsWith('out')) return 'Out';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The statuses that keep a player off tonight's floor. */
export const OUT = new Set(['Out', 'Doubtful', 'IR', 'LTIR', 'Suspended', 'PUP', 'NFI']);
export const isOut = (status) => OUT.has(statusOf(status) || '');

/** The statuses that say he plays, as listed. */
export const IN = new Set(['Active', 'Available']);
/**
 * A player's health in one word, the shuffle's Health column: 'Out' (`OUT`: out, doubtful, suspended
 * or on an injured list), 'In' (nothing listed, or listed active / available), else 'DTD' (on the
 * report but not ruled out: day-to-day, questionable, probable, a game-time decision).
 */
export function healthOf(status, detail = null) {
  const s = statusOf(status, detail);
  if (!s || IN.has(s)) return 'In';
  return OUT.has(s) ? 'Out' : 'DTD';
}

/**
 * The report's rows as the boards store them: [{ id, name, key, team, pos, status, detail, date }].
 * `raw` is the v2 payload's `injuryReport` (a JSON string or the parsed object with `data`), the
 * per-team list, or either's array; `teamOf(id, code)` names a team's abbreviation from the
 * teams list, `team` fixes it for a per-team list.
 */
export function parseInjuryReport(raw, { teamOf = () => null, team = null } = {}) {
  let body = raw;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return []; } }
  const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.injuries) ? body.injuries : Array.isArray(body?.items) ? body.items : [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const pl = e.player && typeof e.player === 'object' ? e.player : e;
    const id = pl.id ?? e.playerId ?? null;
    const name = pl.name || pl.fullName || pl.full_name || e.playerName || null;
    if (!name) continue;
    const tm = e.team && typeof e.team === 'object' ? e.team : null;
    const abbr = team || teamOf(tm?.id ?? e.teamId ?? null, tm?.code || tm?.abbreviation || (typeof e.team === 'string' ? e.team : null)) || null;
    const detail = e.type ?? e.description ?? e.injury ?? e.detail ?? e.comment ?? null;
    const rawStatus = e.status ?? e.injuryStatus ?? pl.status ?? null;
    const date = e.date || e.gameDate || e.game?.date || e.reportDate || e.updated || e.updatedAt || e.createdAt || null;
    out.push({
      id: id == null ? null : String(id), name: String(name), key: normName(name), team: abbr,
      pos: pl.position || pl.positionAbbreviation || e.position || null,
      status: statusOf(rawStatus, detail), detail: detail == null || detail === '' ? null : String(detail),
      raw: rawStatus == null ? null : String(rawStatus), date: date == null ? null : String(date),
    });
  }
  return latestReport(out);
}

/**
 * One row a player: the report can list him more than once (one line a game, or an older entry
 * beside the current one), and the newest dated row is his status; without dates the last listed.
 */
export function latestReport(rows) {
  const byKey = new Map();
  for (const r of rows || []) {
    const k = `${r.team || ''}|${r.id ?? r.key}`;
    const prev = byKey.get(k);
    if (!prev || String(r.date || '') >= String(prev.date || '')) byKey.set(k, r);
  }
  return [...byKey.values()];
}

/** The ET calendar date of a log row or a report entry: the first ten characters of its date. */
const dayOf = (d) => String(d || '').slice(0, 10);

/**
 * A report row that the logs have overtaken: the player has a game row with minutes dated after
 * the entry (he played since it was written — a listing that outlived the injury, Dončić read
 * as out on 2026-10-27 while he had played). Marked `stale: { playedOn }` on the row, in place;
 * `absentByTeam`, `applyInjuries` and the boards leave a stale row aside. Rows without a date
 * cannot be judged and stand as listed.
 */
export function markStale(rows, players) {
  const byId = new Map(); const byKey = new Map();
  for (const p of players || []) { if (p.id != null) byId.set(String(p.id), p); byKey.set(`${p.team || ''}|${p.key}`, p); }
  for (const r of rows || []) {
    if (!r?.date || !isOut(r.status)) continue;
    const day = dayOf(r.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const p = (r.id != null && byId.get(String(r.id))) || byKey.get(`${r.team || ''}|${r.key}`) || null;
    const played = (p?.games || []).filter((g) => g?.date && dayOf(g.date) > day && (g.min == null || g.min > 0)).map((g) => dayOf(g.date)).sort();
    if (played.length) r.stale = { playedOn: played[played.length - 1] };
  }
  return rows;
}

/**
 * The admin's word over the report, per slate ({ "<TEAM>|<key>": { status, detail, name, at } },
 * `<sport>/<slate>/injury-overrides.json`): a player the report reads wrong is marked playing
 * (status 'Active') or out ('Out') by hand. Returns a pull with the overrides applied — the
 * players' `injury` / `injuryDetail` (`injuryFrom: 'override'`) and the report's rows (the
 * player's row replaced, or added) — never the stored pull itself; the same object back without
 * overrides.
 */
export function applyOverrides(pf, overrides) {
  const entries = Object.entries(overrides || {}).filter(([, o]) => o && o.status);
  if (!pf?.data || !entries.length) return pf;
  const map = new Map(entries);
  const players = (pf.data.players || []).map((p) => {
    const o = map.get(`${p.team || ''}|${p.key}`);
    return o ? { ...p, injury: statusOf(o.status), injuryDetail: o.detail ?? null, injuryFrom: 'override', injuryOverride: { ...o } } : p;
  });
  const rows = (pf.data.injuries?.rows || []).filter((r) => !map.has(`${r.team || ''}|${r.key}`));
  for (const [k, o] of entries) {
    const [team, key] = k.split('|');
    const p = players.find((x) => x.team === team && x.key === key) || null;
    rows.push({ id: p?.id ?? null, name: o.name || p?.name || key, key, team, pos: p?.pos ?? null, status: statusOf(o.status), detail: o.detail ?? null, raw: o.status, date: o.at || null, override: true });
  }
  return { ...pf, data: { ...pf.data, players, injuries: { ...(pf.data.injuries || {}), rows } } };
}

/**
 * ESPN's league injury feed over PropFinder's report (Vincent, 2026-10-31: "Can't we just find another source for the
 * confirmed NBA lineups?"; lib/nba/espn.js parseInjuries, stored per slate by the store and read again every
 * INJURIES_FRESH_MS while the slate is live). The feed is league-wide and each entry is dated, so it says two things
 * about a pulled player: listed, his word for tonight (Out, or GTD = a game-time decision, not out); not listed, he is
 * in. The newer word wins: PropFinder's listing stands only when its own date is after the feed entry's (ESPN's
 * absence counts from the feed's time, so a stale PropFinder "Out" on a player ESPN no longer lists is cleared).
 * `injuryFrom: 'espn'`, `injuryEspn` { status, raw, fantasy, returnDate, comment, date }, the listing it replaced as
 * `injuryListed`; the report's rows follow (a replaced row marked `stale: { espn: true }`, ESPN's rows added with
 * `source: 'espn'`). A fresh pull object, never the stored one; the same object back without a feed or when nothing
 * changes. Run before the admin's overrides (the hand beats the feed) and before the box scores (the game beats both).
 */
export function applyEspnInjuries(pf, feed) {
  if (!pf?.data?.players?.length || !Array.isArray(feed?.rows)) return pf;
  const at = feed.at || feed.fetchedAt || null;
  const byTeamKey = new Map(); const byKey = new Map();
  for (const r of feed.rows) {
    if (!r?.name) continue;
    const key = r.key || normName(r.name);
    const row = { ...r, key };
    if (r.team) byTeamKey.set(`${r.team}|${key}`, row);
    byKey.set(key, byKey.has(key) ? null : row);   // a name on two teams is nobody's without the team
  }
  const newer = (a, b) => a && b && String(a).slice(0, 16) > String(b).slice(0, 16);
  let changed = false;
  const replaced = new Map();   // "TEAM|key" → the ESPN row (or null: cleared)
  const players = pf.data.players.map((p) => {
    const row = byTeamKey.get(`${p.team || ''}|${p.key}`) || byKey.get(p.key) || null;
    if (row) {
      const status = statusOf(row.status);
      if (!status) return p;
      if (p.injuryFrom === 'espn' && p.injury === status && p.injuryDate === row.date) return p;
      // PropFinder's own listing, dated after ESPN's entry, stands.
      if (p.injury && p.injuryFrom !== 'espn' && newer(p.injuryDate, row.date)) return p;
      // The same word (or the same health class) from PropFinder's own report: its attribution stands.
      if (p.injury && p.injuryFrom !== 'espn' && healthOf(p.injury, p.injuryDetail) === healthOf(status)) return p;
      changed = true;
      replaced.set(`${p.team || ''}|${p.key}`, row);
      const listed = p.injury && p.injuryFrom !== 'espn' ? { status: p.injury, detail: p.injuryDetail ?? null, from: p.injuryFrom ?? null, date: p.injuryDate ?? null } : p.injuryListed || null;
      return { ...p, injury: status, injuryDetail: row.detail || null, injuryFrom: 'espn', injuryRaw: row.raw || row.status, injuryDate: row.date || at, injuryStale: null, injuryEspn: { status, raw: row.raw || null, fantasy: row.fantasy || null, returnDate: row.returnDate || null, comment: row.comment || null, date: row.date || null }, ...(listed ? { injuryListed: listed } : {}) };
    }
    // Not on ESPN's list: in, unless PropFinder's listing is newer than the feed.
    if (!p.injury) return p;
    if (p.injuryFrom !== 'espn' && newer(p.injuryDate, at)) return p;
    changed = true;
    replaced.set(`${p.team || ''}|${p.key}`, null);
    const listed = p.injuryFrom !== 'espn' ? { status: p.injury, detail: p.injuryDetail ?? null, from: p.injuryFrom ?? null, date: p.injuryDate ?? null } : p.injuryListed || null;
    return { ...p, injury: null, injuryDetail: null, injuryFrom: 'espn', injuryRaw: null, injuryDate: at, injuryStale: null, injuryEspn: { status: null, listed: false, date: at }, ...(listed ? { injuryListed: listed } : {}) };
  });
  if (!changed) return pf;
  const rows = (pf.data.injuries?.rows || []).map((r) => {
    const k = `${r.team || ''}|${r.key}`;
    if (!replaced.has(k) || r.source === 'espn') return r;
    return r.stale ? r : { ...r, stale: { ...(r.stale || {}), espn: true, at } };
  });
  for (const [k, row] of replaced) {
    if (!row) continue;
    const [team, key] = k.split('|');
    const i = rows.findIndex((r) => r.source === 'espn' && `${r.team || ''}|${r.key}` === k);
    const next = { id: row.espnId ?? null, name: row.name, key, team, pos: row.pos ?? null, status: statusOf(row.status), detail: row.detail || null, raw: row.raw || row.status, date: row.date || at, source: 'espn', comment: row.comment || null, returnDate: row.returnDate || null };
    if (i >= 0) rows[i] = next; else rows.push(next);
  }
  return { ...pf, data: { ...pf.data, players, injuries: { ...(pf.data.injuries || {}), rows, espnAt: at } } };
}

/**
 * The stored box scores over the report (Vincent, 2026-10-31: Nembhard played for IND on Oct 30 and the board
 * still showed him out — the report's row was read at the pull, hours before tip-off, and nothing read the box
 * score back). Once a slate game is stored, who played is settled: a pulled player with minutes in it played,
 * whatever the report, the depth chart's flag or an override said (`injury` cleared, `injuryFrom: 'boxscore'`,
 * the listing kept as `injuryListed` for the card), and a player on the box score who did not play is out
 * ('Out', detail "did not play", `injuryFrom: 'boxscore'`). The report's rows follow: a row a played player
 * carries is marked `stale: { playedOn }` (so `absentByTeam` and the notes leave it aside), a DNP without a row
 * gets one (`boxscore: true`). A fresh pull object, never the stored one; the same object back when no slate
 * game has a stored result or nothing changes. `games` [{ id, away, home, date }], `results` { gameId: { players:
 * [{ name, team, played, min }] } } (lib/nba/espn.js parseSummary's shape).
 */
export function applyBoxScores(pf, games, results) {
  if (!pf?.data?.players?.length) return pf;
  const played = new Map(); const sat = new Map();   // "TEAM|key" → the box-score line
  for (const g of games || []) {
    const r = results?.[g.id];
    if (!r?.players?.length) continue;
    const day = dayOf(g.date || r.date || '');
    for (const line of r.players) {
      if (!line?.name) continue;
      const team = line.team || null;
      if (team && team !== g.away && team !== g.home) continue;
      const k = `${team || ''}|${normName(line.name)}`;
      if (line.played === false) { if (!played.has(k)) sat.set(k, { ...line, day }); }
      else if (line.played === true && (line.min == null || line.min > 0)) { sat.delete(k); played.set(k, { ...line, day }); }
    }
  }
  if (!played.size && !sat.size) return pf;
  let changed = false;
  const players = pf.data.players.map((p) => {
    const k = `${p.team || ''}|${p.key}`;
    const line = played.get(k);
    if (line) {
      if (!p.injury) return p;   // nothing to correct: he was listed in, or corrected already
      changed = true;
      const listed = p.injury ? { status: p.injury, detail: p.injuryDetail ?? null, from: p.injuryFrom ?? null, date: p.injuryDate ?? null } : null;
      return { ...p, injury: null, injuryDetail: null, injuryFrom: 'boxscore', injuryRaw: null, injuryDate: null, injuryStale: null, injuryPlayed: { min: line.min ?? null, date: line.day || null }, ...(listed ? { injuryListed: listed } : {}) };
    }
    const dnp = sat.get(k);
    if (dnp && !isOut(p.injury)) {
      changed = true;
      const listed = p.injury ? { status: p.injury, detail: p.injuryDetail ?? null, from: p.injuryFrom ?? null, date: p.injuryDate ?? null } : null;
      return { ...p, injury: 'Out', injuryDetail: 'did not play', injuryFrom: 'boxscore', injuryRaw: 'DNP', injuryDate: dnp.day || null, injuryStale: null, ...(listed ? { injuryListed: listed } : {}) };
    }
    return p;
  });
  // The report's rows: a played player's out row is left aside, a DNP without a row gets one.
  const rows = (pf.data.injuries?.rows || []).map((r) => {
    const line = played.get(`${r.team || ''}|${r.key}`);
    if (line && isOut(r.status) && !r.stale) { changed = true; return { ...r, stale: { playedOn: line.day || null, boxscore: true } }; }
    return r;
  });
  const have = new Set(rows.map((r) => `${r.team || ''}|${r.key}`));
  for (const p of players) {
    const k = `${p.team || ''}|${p.key}`;
    if (p.injuryFrom === 'boxscore' && p.injury === 'Out' && !have.has(k)) { changed = true; rows.push({ id: p.id ?? null, name: p.name, key: p.key, team: p.team, pos: p.pos ?? null, status: 'Out', detail: 'did not play', raw: 'DNP', date: p.injuryDate || null, boxscore: true }); }
  }
  if (!changed) return pf;
  return { ...pf, data: { ...pf.data, players, injuries: { ...(pf.data.injuries || {}), rows } } };
}

/**
 * PropFinder's Injury Splits page from the logs (Vincent, 2026-10-27): for the players out tonight,
 * how every active teammate has performed in the games they sat — the out players together as a
 * combination (every one of them absent) and, with more than one out, each alone — against his
 * games with them, from one game. [{ out: [{ key, name, pos, status }], combo, rows: [{ key, name,
 * pos, with: { gp, min, pts… }, without: { gp, … }, delta: {…} }] }], the rows by games without.
 * `players` the team's pulled players (their logs by gameId), `absent` the team's out list
 * (`absentByTeam`'s rows with `played`); season-first windows as `teammateSplits`.
 */
export function injurySplits(players, absent, { season = null, seasonMin = 1, stats = ['pts', 'reb', 'ast', 'tpm', 'pra'] } = {}) {
  const outs = (absent || []).filter((a) => a?.played instanceof Set && a.played.size);
  if (!outs.length) return [];
  const fields = ['min', ...stats];
  const avg = (list) => { const o = { gp: list.length }; for (const f of fields) { const v = list.map((g) => Number(g?.[f])).filter((x) => Number.isFinite(x)); o[f] = v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; } return o; };
  const sets = outs.length > 1 ? [outs, ...outs.map((a) => [a])] : [outs];
  const out = [];
  for (const set of sets) {
    const rows = [];
    for (const p of players || []) {
      if (set.some((a) => a.key === p.key) || (absent || []).some((a) => a.key === p.key)) continue;
      const all = (p.games || []).filter((g) => g?.gameId != null);
      const szn = season == null ? [] : all.filter((g) => g.season === season && (g.type === 'REG' || !g.type));
      const games = szn.length >= seasonMin ? szn : all;
      const without = games.filter((g) => set.every((a) => !a.played.has(String(g.gameId))));
      const withG = games.filter((g) => set.every((a) => a.played.has(String(g.gameId))));
      if (!without.length) continue;
      const w = withG.length ? avg(withG) : null; const wo = avg(without);
      const delta = {}; for (const f of fields) delta[f] = w && w[f] != null && wo[f] != null ? Math.round((wo[f] - w[f]) * 10) / 10 : null;
      rows.push({ key: p.key, name: p.name, pos: p.pos || null, with: w, without: wo, delta });
    }
    if (rows.length) out.push({ out: set.map((a) => ({ key: a.key, name: a.name, pos: a.pos || null, status: a.status || null })), combo: set.length > 1, rows: rows.sort((a, b) => b.without.gp - a.without.gp || (b.without.min || 0) - (a.without.min || 0)) });
  }
  return out;
}

/**
 * The player with and without each regular teammate (PropFinder's Lineup Lab, as far as the
 * logs reach: the team's pulled players, their game rows by gameId): for every teammate who
 * took part in `minTogether` of his logged games at least, his averages (`stats`, plus minutes)
 * over the games they shared and over his games the teammate sat, and the gap. Season-first:
 * this season's rows when he has `seasonMin` of them, else all his logged games. Sorted by games
 * together. [{ key, name, pos, injury, health, together, apart, with: { min, pts… }, without: {…}, delta: {…} }]
 */
export function teammateSplits(player, teammates, { season = null, seasonMin = 1, stats = ['pts', 'reb', 'ast', 'tpm'], minTogether = 3 } = {}) {
  const all = (player?.games || []).filter((g) => g?.gameId != null);
  const szn = season == null ? [] : all.filter((g) => g.season === season && (g.type === 'REG' || !g.type));
  const games = szn.length >= seasonMin ? szn : all;
  if (!games.length) return [];
  const fields = ['min', ...stats];
  const avg = (list) => { const o = {}; for (const f of fields) { const v = list.map((g) => Number(g?.[f])).filter((x) => Number.isFinite(x)); o[f] = v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; } return o; };
  const out = [];
  for (const t of teammates || []) {
    if (!t || t.key === player.key || t.team !== player.team) continue;
    const played = gamesPlayed(t);
    if (!played.size) continue;
    const withG = games.filter((g) => played.has(String(g.gameId)));
    const without = games.filter((g) => !played.has(String(g.gameId)));
    if (withG.length < minTogether) continue;
    const w = avg(withG); const wo = without.length ? avg(without) : null;
    const delta = {}; for (const f of fields) delta[f] = wo && w[f] != null && wo[f] != null ? Math.round((wo[f] - w[f]) * 10) / 10 : null;
    out.push({ key: t.key, name: t.name, pos: t.pos || null, injury: t.injury || null, injuryDetail: t.injuryDetail || null, health: healthOf(t.injury, t.injuryDetail), together: withG.length, apart: without.length, with: w, without: wo, delta });
  }
  return out.sort((a, b) => b.together - a.together || String(a.name).localeCompare(String(b.name)));
}

/** The games a player took part in: the gameIds of his rows with minutes (or any row when the sport logs none). */
export function gamesPlayed(player) {
  const ids = new Set();
  for (const g of player?.games || []) {
    if (g?.gameId == null) continue;
    if (g.min != null && !(g.min > 0)) continue;
    ids.add(String(g.gameId));
  }
  return ids;
}

/**
 * The absent teammates who matter to a player: of the team's players out tonight (each with
 * `played`, the games he took part in, or his logs), those who took part in at least `minShare` of
 * the player's logged games (and `minTogether` of them) — a regular whose absence changes his
 * role, not a deep reserve. Newest-first games; rows without a gameId do not count.
 */
export function keyAbsences(games, absent, { minShare = 0.4, minTogether = 2 } = {}) {
  const ids = (games || []).map((g) => g?.gameId).filter((x) => x != null).map(String);
  if (!ids.length) return [];
  const out = [];
  for (const a of absent || []) {
    if (!a) continue;
    const played = a.played instanceof Set ? a.played : gamesPlayed(a);
    if (!played.size) continue;
    const together = ids.filter((id) => played.has(id)).length;
    if (together >= minTogether && together / ids.length >= minShare) out.push({ id: a.id ?? null, name: a.name, key: a.key || normName(a.name), status: a.status ?? null, detail: a.detail ?? null, together, of: ids.length, played });
  }
  return out.sort((x, y) => y.together - x.together || String(x.name).localeCompare(String(y.name)));
}

/** The player's games (newest first) none of the absent teammates took part in; rows without a gameId are left out. */
export function withoutGames(games, absent) {
  const sets = (absent || []).map((a) => (a.played instanceof Set ? a.played : gamesPlayed(a))).filter((s) => s.size);
  if (!sets.length) return [];
  return (games || []).filter((g) => g?.gameId != null && !sets.some((s) => s.has(String(g.gameId))));
}

/** `all` moved toward `without` by the split's weight (WITHOUT_K in lib/picks/projection.js, the client-safe module). */
export function blendWithout(all, without, n, k = WITHOUT_K) {
  if (without == null || !(n > 0)) return all ?? null;
  if (all == null) return without;
  const w = n / (n + k);
  return Math.round((w * without + (1 - w) * all) * 1000) / 1000;
}

/**
 * The share of an out teammate's production the players the pull carries pick up between them:
 * the rest goes to the bench the odds-only pull never lists. A 10-assist point guard out leaves 6
 * assists to be shared by the priced teammates, each by his own share of their assists.
 */
export const VACATED_SHARE = 0.6;

/**
 * How much of a player's own window an absent teammate was part of: the share of his logged games
 * (this season's regular-season games when he has `seasonMin` of them, else his last `cap`) the
 * teammate took part in. 1 = the teammate played every one of them, so none of his average was
 * earned without him; 0 = he was already out for all of them (a season-long absence: his average
 * carries nothing to hand over). Rows without a gameId count as games the teammate played.
 */
export function playedShare(games, played, { season = null, seasonMin = 1, cap = 10 } = {}) {
  if (!(played instanceof Set) || !played.size) return 0;
  const sorted = games || [];
  const szn = season == null ? [] : sorted.filter((g) => g?.season === season && (g.type === 'REG' || !g.type));
  const window = szn.length >= seasonMin ? szn : sorted.slice(0, cap);
  if (!window.length) return 0;
  const n = window.filter((g) => g?.gameId == null || played.has(String(g.gameId))).length;
  return Math.round((n / window.length) * 1000) / 1000;
}

/**
 * The production the team's out players leave on the table tonight, handed to the active players
 * the pull carries: per stat, each out player's own rate × how much of each active player's window
 * he was part of (`playedShare`) × VACATED_SHARE, shared by the active players' own rates. A player's
 * lift is the sum over the out players; `from` names them. { key: { [stat]: { lift, from: [names] } } }
 * Callers: `active` [{ key, games, own: { [stat]: windows } }], `absent` [{ key, name, played: Set, own }].
 */
export function vacatedLifts(active, absent, rateOf, { season = null, seasonMin = 1, share = VACATED_SHARE } = {}) {
  const out = {};
  const outs = (absent || []).filter((a) => a?.own && a.played instanceof Set && a.played.size);
  if (!outs.length || !active?.length) return out;
  const stats = new Set(outs.flatMap((a) => Object.keys(a.own)));
  for (const stat of stats) {
    const rates = new Map(active.map((p) => [p.key, rateOf(p.own?.[stat]) || 0]));
    const S = [...rates.values()].reduce((s, v) => s + v, 0);
    if (!(S > 0)) continue;
    for (const p of active) {
      const mine = rates.get(p.key);
      if (!(mine > 0)) continue;
      let lift = 0; const from = [];
      for (const a of outs) {
        if (a.key === p.key) continue;
        const rate = rateOf(a.own?.[stat]);
        if (!(rate > 0)) continue;
        const f = playedShare(p.games, a.played, { season, seasonMin });
        if (!(f > 0)) continue;
        lift += rate * f * share * (mine / S);
        if (!from.includes(a.name)) from.push(a.name);
      }
      if (lift > 0) (out[p.key] ||= {})[stat] = { lift: Math.round(lift * 100) / 100, from };
    }
  }
  return out;
}

/** A without-teammate split speaks from this many games (one, as PropFinder's Injury Splits page does; the weight n / (n + 8) keeps one game a whisper). */
export const WITHOUT_MIN = 1;

/**
 * Per team, the players out tonight with the games they took part in: the report's out rows and
 * the pull's own out flags, each joined to his pulled logs (by id, then team + name); a player
 * whose logs the pull does not carry has an empty `played` and counts for nobody's split.
 * { ABBR: [{ id, name, key, status, detail, played: Set<gameId> }] }
 */
export function absentByTeam(pf) {
  const players = pf?.data?.players || [];
  const out = {};
  const seen = new Set();
  const byId = new Map(); const byKey = new Map();
  for (const p of players) { if (p.id != null && !byId.has(String(p.id))) byId.set(String(p.id), p); if (!byKey.has(`${p.team}|${p.key}`)) byKey.set(`${p.team}|${p.key}`, p); }
  const add = (team, r, p) => {
    if (!team) return;
    const k = `${team}|${r.key}`;
    if (seen.has(k)) return;
    seen.add(k);
    (out[team] ||= []).push({ id: r.id ?? p?.id ?? null, name: r.name, key: r.key, status: r.status, detail: r.detail ?? null, pos: r.pos ?? p?.pos ?? null, played: p ? gamesPlayed(p) : new Set() });
  };
  for (const r of pf?.data?.injuries?.rows || []) {
    if (!isOut(r.status) || r.stale) continue;
    const p = (r.id != null && byId.get(String(r.id))) || byKey.get(`${r.team}|${r.key}`) || null;
    add(r.team || p?.team, r, p);
  }
  for (const p of players) if (isOut(p.injury)) add(p.team, { id: p.id, name: p.name, key: p.key, status: p.injury, detail: p.injuryDetail ?? null, pos: p.pos ?? null }, p);
  return out;
}

/**
 * A player's games without the key teammates of his team out tonight: { absent: [{ id, name, key,
 * status, detail, together, of }], games (newest first), n }, or null when nobody who matters is
 * out, the split is under WITHOUT_MIN games, or every logged game was already without them
 * (a season-long absence: nothing to learn from the split).
 */
export function withoutOf(pfp, absentList, { minGames = WITHOUT_MIN } = {}) {
  if (!pfp?.games?.length || !absentList?.length) return null;
  const others = absentList.filter((a) => a.key !== pfp.key && a.played instanceof Set && a.played.size);
  if (!others.length) return null;
  const absent = keyAbsences(pfp.games, others);
  if (!absent.length) return null;
  const games = withoutGames(pfp.games, absent);
  const logged = pfp.games.filter((g) => g?.gameId != null).length;
  if (games.length < minGames || games.length >= logged) return null;
  return { absent: absent.map(({ played, ...a }) => a), games, n: games.length };
}

/** "Tatum" for Jayson Tatum; "J. Tatum" when the list carries two of the surname. */
export function shortNames(list) {
  const last = (n) => String(n || '').trim().split(/\s+/).slice(-1)[0] || String(n || '');
  const counts = {};
  for (const x of list || []) counts[last(x.name)] = (counts[last(x.name)] || 0) + 1;
  return (list || []).map((x) => (counts[last(x.name)] > 1 ? `${String(x.name).trim().charAt(0)}. ${last(x.name)}` : last(x.name)));
}
