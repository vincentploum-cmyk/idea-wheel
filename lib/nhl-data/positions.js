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
    // A player of the slot's own group on the roster (a forward never carries a stored pair slot; a last lineup read before the roster rule could hold one).
    const cand = Object.entries(last.players).find(([k, v]) => v.pos === pos && v.line === line && roster[k] && (!roster[k].pos || groupOf(roster[k].pos) === groupOf(pos)) && !(out[k] && inLineup(out[k])) && !out[k]?.carried);
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

// A beat writers' tweet from this long before puck drop (or after it) is the final word on the lines.
export { GDT_FINAL_WORD_MIN } from './lineup-read';
import { GDT_FINAL_WORD_MIN } from './lineup-read';

/** A position's group: forwards, defense, goalies. */
const groupOf = (pos) => (pos === 'D' ? 'D' : pos === 'G' ? 'G' : 'F');

// A first name as transliterations agree on it: a leading Y before a vowel dropped (Yegor / Egor, Yevgeni / Evgeni).
const firstOf = (first) => first.replace(/^y(?=[aeiou])/, '');
const nameParts = (n) => { const parts = normName(n).split(' '); return { first: firstOf(parts[0] || ''), last: parts.slice(1).join(' ') }; };
/** Whether two spellings name the same player: the same last name and a first name that starts alike (names.js's rule). */
export function sameName(a, b) {
  const ka = normName(a); const kb = normName(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const A = nameParts(a); const B = nameParts(b);
  return !!A.last && A.last === B.last && (A.first.slice(0, 3) === B.first.slice(0, 3) || A.first[0] === B.first[0]);
}
/**
 * The roster key a lineup name belongs to ({ normName → { name, id, pos } }): the exact key, else the one rostered
 * player it names by last name and a first name that starts alike (a preview's "Egor" against the roster's "Yegor";
 * 2026-10-31 a lineup spelling the roster did not hold put a skater on the snapshot twice — the lineup's entry without
 * an id and the roster's without a line — and the player card read the roster's). Null when none or several match.
 */
export function rosterKeyOf(roster, name) {
  const key = normName(name);
  if (!key) return null;
  if (roster?.[key]) return key;
  const hits = Object.keys(roster || {}).filter((k) => sameName(roster[k].name || k, name));
  return hits.length === 1 ? hits[0] : null;
}

const SINGLE_NAME = /^[A-Za-zÀ-ÿ'’.-]+( [A-Za-zÀ-ÿ'’.-]+){1,3}$/;

/**
 * The NHL.com preview's rows → { [abbrev]: { normName → { name, pos, line } } }. NHL.com lists a team's forward lines
 * first, then its defense pairs, then single names (an extra skater, then the goalies, the starter first). An
 * 11-forward, 7-defenseman night puts a two-name forward line among them (TBL at NSH, 2026-10-31: "Steven Stamkos --
 * Ryan O'Reilly" on top of Nashville's lines and "Jeffrey Viel -- Conor Geekie" under Tampa Bay's third; read as pairs
 * they pushed every real pair down a slot and made Nicolas Hague a goalie — Vincent: "Stamkos is never a defender").
 * `rosters` ({ ABBR: { normName → { pos } } }, the slate teams' rosters) decides a row's group as the tweet parser's
 * roster does: a pair holds a defenseman, two roster forwards side by side are a short forward line, a lone roster
 * defenseman takes the next pair and a lone roster forward the next line. Without a roster the order decides: a
 * two-name row is a pair only when it is one of the team's last three two-name rows, an earlier one a short forward
 * line; of the single names the last two are the goalies, any before them a seventh defenseman on the next pair.
 */
export function parseLineupRows(rows, rosters = null) {
  const teams = {};
  let cur = null;   // { abbr, roster, rows: [{ names }] }
  const flush = () => { if (cur) teams[cur.abbr] = { ...(teams[cur.abbr] || {}), ...lineupOfRows(cur.rows, cur.roster) }; cur = null; };
  for (const raw of rows || []) {
    const cell = String(raw || '').replace(/ /g, ' ').replace(/ +/g, ' ').trim();
    if (!cell) continue;
    if (/projected lineup/i.test(cell)) {
      flush();
      const abbr = teamAbbrFromText(cell.replace(/projected lineup/i, ''));
      cur = abbr ? { abbr, roster: rosters?.[abbr] || null, rows: [] } : null;
      continue;
    }
    if (!cur || SKIP.test(cell)) continue;
    const line = cell.replace(/\s+[–—-]{1,2}\s+/g, ' -- ').replace(/\s*--\s*/g, ' -- ');
    if (line.includes(' -- ')) {
      const names = line.split(' -- ').map((s) => s.trim()).filter(Boolean);
      if (names.length === 2 || names.length === 3) cur.rows.push({ names });
    } else if (cur.rows.length && SINGLE_NAME.test(line) && !/ at /i.test(line)) {
      // Single names after the lines: the extra skaters and the goalies.
      cur.rows.push({ names: [line] });
    }
  }
  flush();
  return teams;
}

/** One team's rows in order → its players by slot (the rule in parseLineupRows' comment; `roster` null = by order). */
function lineupOfRows(rows, roster) {
  const out = {};
  const posOf = (name) => { const k = roster ? rosterKeyOf(roster, name) : null; return (k && roster[k]?.pos) || null; };
  const multi = rows.filter((r) => r.names.length >= 2);
  const twos = multi.filter((r) => r.names.length === 2);
  const lastThree = new Set(twos.slice(-3));
  // A two-name row is a pair when the roster says so (a defenseman among the two, or no forward known), else by its place.
  const isPair = (r) => {
    if (!roster) return lastThree.has(r);
    const known = r.names.map(posOf);
    return known.some((p) => p === 'D') || !known.some((p) => p && groupOf(p) === 'F');
  };
  let fwdLine = 0; let dPair = 0;
  for (const r of multi) {
    if (r.names.length === 3 || !isPair(r)) {
      if (fwdLine >= 4) continue;
      fwdLine += 1;
      r.names.forEach((name, i) => { out[normName(name)] = { name, pos: FWD[i], line: fwdLine }; });
    } else {
      if (dPair >= 4) continue;
      dPair += 1;
      r.names.forEach((name) => { out[normName(name)] = { name, pos: 'D', line: dPair }; });
    }
  }
  // The single names: a roster defenseman (or, without a roster, any but the last two) is the seventh defenseman on the
  // next pair, a roster forward a thirteenth forward on the next line, a goalie or an unknown name a goalie, the starter first.
  const singles = rows.filter((r) => r.names.length === 1).map((r) => r.names[0]);
  let goalies = 0;
  singles.forEach((name, i) => {
    const rPos = posOf(name);
    const extraD = roster ? rPos === 'D' : i < singles.length - 2;
    const extraF = roster ? !!rPos && groupOf(rPos) === 'F' : false;
    if (extraD) { if (dPair < 4) { dPair += 1; out[normName(name)] = { name, pos: 'D', line: dPair }; } }
    else if (extraF) { if (fwdLine < 4) { fwdLine += 1; out[normName(name)] = { name, pos: 'LW', line: fwdLine }; } }
    else if (!rPos || rPos === 'G') { goalies += 1; out[normName(name)] = { name, pos: 'G', line: goalies === 1 ? 1 : 2 }; }
  });
  return out;
}

/** Every rostered player per team: { ABBR: { normName → { name, id, pos, line: null } } }. */
export function rosterMap(ref) {
  const byTeam = {};
  for (const p of Object.values(ref?.players || {})) {
    if (!p.onRoster || p.excluded || !p.team) continue;
    (byTeam[p.team] = byTeam[p.team] || {})[normName(p.name)] = { name: p.name, id: p.id, pos: p.pos, line: null };
  }
  return byTeam;
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
  const byTeam = rosterMap(ref);
  const lineupOf = Object.fromEntries((lineups?.games || []).map((g) => [g.gameId, g]));
  // Each slate team's last known lineup, to fill whatever today's capture leaves empty.
  const abbrs = [...new Set(schedule.flatMap((g) => [g.away, g.home]))];
  const lastOf = Object.fromEntries(await Promise.all(abbrs.map(async (abbr) => [abbr, await readJson(lastLineupPath(abbr)).catch(() => null)])));

  for (const g of schedule) {
    const parsed = parseLineupRows(lineupOf[g.id]?.rows || [], byTeam);
    const teams = {};
    for (const abbr of [g.away, g.home]) {
      const roster = byTeam[abbr] || {};
      // Newest word wins, by timestamp: the beat writers' tweet (its id carries the
      // posting time) against NHL.com's preview "updated" time, except that a tweet from
      // the warm-up window (GDT_FINAL_WORD_MIN before puck drop, or after it) is the
      // writers' final word and beats the preview whatever its time: NHL.com's page keeps
      // its "updated" stamp moving on every refresh while its lineup stands still. Without
      // a tweet time, a game-day tweet still beats the preview. Then an older tweet, then
      // PropFinder's depth chart from the last pull, then the roster.
      const gdt = lineups?.gdt?.[abbr]?.players ? lineups.gdt[abbr] : null;
      const nhl = parsed[abbr] ? lineupOf[g.id] : null;
      // PropFinder's depth chart is the chart of the day it was pulled: never for a game before that day.
      const pf = depth?.teams?.[abbr]?.players && !(depth.date && depth.date > date) ? depth.teams[abbr] : null;
      const nhlAt = nhl?.updated || null;
      const gdtAt = gdt?.meta?.at || null;
      const start = Date.parse(g.startTimeUTC || '');
      const gdtMs = Date.parse(gdtAt || '');
      const finalWord = Number.isFinite(start) && Number.isFinite(gdtMs) && gdtMs >= start - GDT_FINAL_WORD_MIN * 60000 && gdtMs <= start + 4 * 3600000;
      const gdtWins = gdt && (!nhl || finalWord || (gdtAt && nhlAt ? gdtAt > nhlAt : gdtAt ? true : gdt.meta?.date === date));
      const fromLineup = gdtWins ? gdt.players : nhl ? parsed[abbr] : gdt?.players || pf?.players || {};
      const source = gdtWins ? 'gamedaytweets' : nhl ? 'lineup' : gdt ? 'gamedaytweets' : pf ? 'propfinder' : 'roster';
      let players = mergeLineup(fromLineup, roster, abbr);
      // Empty slots (no lineup yet, or a partial one) take the team's last known lineup, when
      // it is dated and no newer than the game (a past date settled after today's capture, or
      // a file from before the date was recorded, must not lend it lines).
      const last = lastOf[abbr]?.date && lastOf[abbr].date <= date ? lastOf[abbr] : null;
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
          // A "same lineup" tweet standing for the lines before it, or a line-change tweet applied onto them (the rink's pill says so).
          gdtConfirmed: !!gdt?.meta?.confirmed, gdtChanged: gdt?.meta?.changed || 0,
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

/**
 * A team's lineup entries over its roster, one entry a player: a lineup name the roster spells otherwise lands under
 * the roster's key with the roster's id and spelling (the box score, the last-lineup fill and the card all look him up
 * by that key), and a roster player the lineup does not place keeps his roster position with no line (`inLineup: false`).
 * `fromLineup` and `roster` are { normName → { name, id?, pos, line } }.
 */
export function mergeLineup(fromLineup, roster, abbr) {
  const players = {};
  for (const [key, v] of Object.entries(fromLineup || {})) {
    const rk = (v.id != null && Object.keys(roster || {}).find((k) => roster[k].id === v.id)) || rosterKeyOf(roster, v.name || key) || key;
    const r = roster?.[rk] || null;
    players[rk] = { ...v, name: r?.name || v.name, id: v.id ?? r?.id ?? null, team: abbr };
  }
  // Roster players missing from the lineup keep their roster position (no line).
  for (const [key, v] of Object.entries(roster || {})) if (!players[key]) players[key] = { ...v, team: abbr, inLineup: false };
  return players;
}

/** Position and line slot the snapshot holds for a skater in a game ({ pos, line }), or null. */
export function snapshotSlot(snapshot, gameId, team, name) {
  const p = snapshot?.games?.[gameId]?.teams?.[team]?.players?.[normName(name)];
  if (!p || p.inLineup === false || !['LW', 'C', 'RW', 'D'].includes(p.pos)) return null;
  const line = Number(p.line);
  // Four forward lines, three pairs: a slot beyond that is no slot.
  return { pos: p.pos, line: Number.isInteger(line) && line >= 1 && line <= (p.pos === 'D' ? 3 : 4) ? line : null };
}

/** Position the snapshot holds for a skater in a game, or null. */
export function snapshotPos(snapshot, gameId, team, name) {
  return snapshotSlot(snapshot, gameId, team, name)?.pos || null;
}

/** The slot label a box-score row is logged under: LW1 … RW4 by forward line, D1 … D3 by pair; null without a line. */
/**
 * A skater's lineup slot on a date's position snapshot, by id first, then by name:
 * { date, team, opp, venue, pos, line, source, inLineup } or null when he is not on the slate.
 */
export function slotOnSnapshot(file, { id = null, name = '', team = null } = {}) {
  const key = normName(name);
  for (const g of Object.values(file?.games || {})) {
    for (const abbr of [g.away, g.home]) {
      if (team && abbr !== team) continue;
      const t = g.teams?.[abbr];
      if (!t?.players) continue;
      // Every entry that is him (a snapshot written before mergeLineup could hold him twice: the lineup's entry
      // under its own spelling without an id, the roster's with the id and no line); the one placed in the lineup
      // — the chip the rink draws — wins, by id first, then by key, then by the name itself.
      const mine = Object.entries(t.players).filter(([k, p]) => (id != null && p.id === id) || (key && k === key) || (key && sameName(p.name || k, name)));
      if (!mine.length) continue;
      const rank = ([k, p]) => (inLineup(p) ? 0 : 4) + (id != null && p.id === id ? 0 : k === key ? 1 : 2);
      const [, hit] = mine.sort((a, b) => rank(a) - rank(b))[0];
      return { date: file.date || null, team: abbr, opp: abbr === g.away ? g.home : g.away, venue: abbr === g.away ? 'A' : 'H', pos: hit.pos || null, line: hit.line ?? null, source: t.source || null, inLineup: hit.inLineup !== false, carried: !!hit.carried };
    }
  }
  return null;
}

export function slotLabel(pos, line) {
  return pos && line ? `${pos}${line}` : null;
}

const posGroup = (pos) => (pos === 'D' ? 'D' : pos === 'G' ? 'G' : 'F');

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
      s.boxPos = s.boxPos ?? s.pos;
      // The box score decides whether he dressed as a forward or a defenseman: a lineup slot
      // in the other group is a misread line (a two-forward line taken for a pair), not a move.
      const read = snapshotSlot(snapshot, g.id, s.team, s.name);
      const slot = read && posGroup(read.pos) === posGroup(s.boxPos) ? read : null;
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
  const [preview, ref] = await Promise.all([fetchPreview(game.id).catch(() => null), loadPlayers().catch(() => null)]);
  if (!preview) return null;
  const parsed = parseLineupRows(lineupRows(preview.markdown), ref ? rosterMap(ref) : null);
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
// The third name of a two-forward line in the rows the model reads: the model's parser takes a three-name row as a
// forward line and a two-name row as a defense pair (never change the model's parsers; change the builders), so an
// 11-forward night's short line goes out with a placeholder no skater matches, and its two forwards stay confirmed in
// the lineup at their slots (until 2026-10-31 the short line was left out and Stamkos and O'Reilly, TBL at NSH, read as
// not in the lineup).
export const SHORT_LINE_FILL = '—';
export function lineupRowsFromSnapshot(abbr, team, display = {}) {
  const players = Object.values(team?.players || {}).filter((p) => p.inLineup !== false && p.line);
  if (!players.length) return [];
  const nm = (p) => (p.id != null && display[p.id]) || p.name;
  const rows = [`${teamName(abbr)} projected lineup`];
  const order = { LW: 0, C: 1, RW: 2 };
  for (let line = 1; line <= 4; line++) {
    const f = players.filter((p) => p.line === line && order[p.pos] != null).sort((a, b) => order[a.pos] - order[b.pos]);
    if (f.length === 3) rows.push(f.map(nm).join(' -- '));
    else if (f.length === 2) rows.push([...f.map(nm), SHORT_LINE_FILL].join(' -- '));
  }
  for (let pair = 1; pair <= 4; pair++) {
    const d = players.filter((p) => p.line === pair && p.pos === 'D');
    if (d.length === 2) rows.push(d.map(nm).join(' -- '));
  }
  return rows.length > 1 ? rows : [];
}
