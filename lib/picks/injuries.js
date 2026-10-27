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
// read at n / (n + WITHOUT_K) (`blendWithout`): a dozen games without the star move the read most
// of the way, three games a little.
import { normName } from '../nhl-data/names';

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
    out.push({
      id: id == null ? null : String(id), name: String(name), key: normName(name), team: abbr,
      pos: pl.position || pl.positionAbbreviation || e.position || null,
      status: statusOf(e.status ?? e.injuryStatus ?? pl.status, detail), detail: detail == null || detail === '' ? null : String(detail),
      date: e.date || e.updated || e.updatedAt || null,
    });
  }
  return out;
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
export function keyAbsences(games, absent, { minShare = 0.4, minTogether = 5 } = {}) {
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

export const WITHOUT_K = 8;
/** The split's weight on the read: n / (n + WITHOUT_K). */
export const withoutWeight = (n, k = WITHOUT_K) => (n > 0 ? Math.round((n / (n + k)) * 1000) / 1000 : 0);
/** `all` moved toward `without` by the split's weight. */
export function blendWithout(all, without, n, k = WITHOUT_K) {
  if (without == null || !(n > 0)) return all ?? null;
  if (all == null) return without;
  const w = n / (n + k);
  return Math.round((w * without + (1 - w) * all) * 1000) / 1000;
}

/** A without-teammate split needs this many games to say anything. */
export const WITHOUT_MIN = 3;

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
    if (!isOut(r.status)) continue;
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
