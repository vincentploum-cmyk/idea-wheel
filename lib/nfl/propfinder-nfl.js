// PropFinder's NFL data through the same API client the NHL pull uses (lib/nhl-data/propfinder-api.js:
// the sign-in, the token and the request plumbing): the week's players with their game logs and
// the prop lines PropFinder lists on them, and every team's per-position "what it allows" rows.
//
//   GET /NFL/teams                      32 teams; stats[] rows: type Team | Opponent, position
//                                       All | QB | RB | WR | TE, seasonYear, lastNGames or the season
//   GET /NFL/players?teamIds=…&hydrate=stats&withOddsOnly=true
//                                       the teams' players; stats[] = one row per game; the odds
//                                       PropFinder prices ride on the player when the API hydrates them
//
// The NHL endpoints were checked against its exports; the NFL ones follow the same routes
// (PropFinder serves every sport through /<LEAGUE>/…), but the field names of a football game
// row have not been seen yet. So every field is read through a list of spellings (`FIELDS`) and
// the pull records the keys it actually saw (`fieldsSeen`, shown under Data sources) so a spelling
// this file does not know is visible after the first pull instead of silently reading as zero.
import { pfGetJson, propfinderConfigured } from '../nhl-data/propfinder-api';
import { teamAbbrFromText } from './teams';
import { marketFromText } from './markets';
import { parseOdds, parseNumber } from './odds';
import { normName } from '../nhl-data/names';

export { propfinderConfigured };
export const SOURCE = 'propfinder-api';
export const POSITIONS = ['QB', 'RB', 'WR', 'TE'];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;

// Box-score field → the spellings a PropFinder game row may use.
export const FIELDS = {
  passCmp: ['passingCompletions', 'completions', 'passCompletions', 'cmp'],
  passAtt: ['passingAttempts', 'passAttempts', 'attempts', 'passAtt'],
  passYds: ['passingYards', 'passYards', 'passYds', 'passing_yards'],
  passTd: ['passingTouchdowns', 'passTouchdowns', 'passingTds', 'passTds', 'passTd'],
  passInt: ['interceptions', 'passingInterceptions', 'interceptionsThrown', 'passInt'],
  passLong: ['longestCompletion', 'longestPass', 'passLong'],
  rushAtt: ['rushingAttempts', 'rushAttempts', 'carries', 'rushAtt'],
  rushYds: ['rushingYards', 'rushYards', 'rushYds', 'rushing_yards'],
  rushTd: ['rushingTouchdowns', 'rushTouchdowns', 'rushingTds', 'rushTds', 'rushTd'],
  rushLong: ['longestRush', 'longRush', 'rushLong'],
  rec: ['receptions', 'catches', 'rec'],
  recYds: ['receivingYards', 'recYards', 'recYds', 'receiving_yards'],
  recTd: ['receivingTouchdowns', 'recTouchdowns', 'receivingTds', 'recTds', 'recTd'],
  recLong: ['longestReception', 'longReception', 'recLong'],
  tgt: ['targets', 'receivingTargets', 'tgt'],
  retTd: ['returnTouchdowns', 'kickReturnTouchdowns', 'puntReturnTouchdowns', 'specialTeamsTouchdowns'],
};
export const STAT_KEYS = Object.keys(FIELDS);

const firstOf = (row, names) => { for (const k of names) if (row && row[k] != null && row[k] !== '') return row[k]; return undefined; };

/** One game row in the board's shape: { date, season, type, opp, home, <stat>… }; stats absent in the row read as 0. */
export function gameRow(g) {
  const out = {
    date: String(g.gameDate || g.date || g.gameDay || '').slice(0, 10),
    season: n(g.season ?? g.seasonYear), type: g.seasonType || g.gameType || 'REG',
    home: g.isHomeGame ?? g.isHome ?? g.home ?? null,
    opp: teamAbbrFromText(g.opponent?.code || g.opponentTeam?.code || g.opponent?.abbreviation || g.opponentAbbreviation || g.opponent || g.opp) || null,
    week: n(g.week ?? g.weekNumber) || null,
  };
  for (const [key, names] of Object.entries(FIELDS)) {
    if (key === 'retTd') { out.retTd = names.reduce((s, k) => s + n(g[k]), 0); continue; }
    out[key] = n(firstOf(g, names));
  }
  out.td = out.rushTd + out.recTd + out.retTd;
  out.rushRecYds = out.rushYds + out.recYds;
  out.passRushYds = out.passYds + out.rushYds;
  return out;
}

const posOf = (p) => { const s = String(p.positionAbbreviation || p.position || p.positionGroup || '').toUpperCase(); return POSITIONS.includes(s) ? s : s === 'HB' || s === 'FB' ? 'RB' : s || null; };

/** PropFinder's prop lines on a player, in the cheat-sheet row shape (market, line, side, odds, underOdds, book). */
export function playerProps(p) {
  const lists = [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds].filter(Array.isArray);
  const out = [];
  for (const list of lists) {
    for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const market = marketFromText(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label);
      const line = parseNumber(o.line ?? o.value ?? o.threshold ?? o.point ?? o.handicap ?? o.total);
      if (!market || line == null) continue;
      out.push({
        market, line,
        odds: parseOdds(o.overOdds ?? o.over ?? o.overPrice ?? o.odds ?? o.price ?? o.americanOdds ?? o.yesOdds),
        underOdds: parseOdds(o.underOdds ?? o.under ?? o.underPrice ?? o.noOdds),
        book: o.book || o.sportsbook || o.bookmaker || o.provider || null,
      });
    }
  }
  return out;
}

/** The pull's player list in the stored shape: { id, name, key, team, pos, status, games (newest first), props }. */
export function mapPlayers(players) {
  const out = [];
  for (const p of players || []) {
    if (!p?.name) continue;
    const games = (p.stats || []).map(gameRow).filter((g) => g.date).sort((a, b) => b.date.localeCompare(a.date));
    out.push({ id: p.id || null, name: p.name, key: normName(p.name), team: teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) || null, pos: posOf(p), status: p.status || null, injury: p.injury?.status || p.injuryStatus || null, games, props: playerProps(p) });
  }
  return out;
}

/** The keys the API used, so an unread spelling shows after the first pull. */
export function fieldsSeen(players, teams) {
  const game = new Set(); const player = new Set(); const prop = new Set(); const teamRow = new Set();
  for (const p of (players || []).slice(0, 200)) {
    for (const k of Object.keys(p)) player.add(k);
    for (const g of (p.stats || []).slice(0, 5)) for (const k of Object.keys(g)) game.add(k);
    for (const list of [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds]) if (Array.isArray(list)) for (const o of list.slice(0, 5)) for (const k of Object.keys(o || {})) prop.add(k);
  }
  for (const t of (teams || []).slice(0, 4)) for (const r of (t.stats || []).slice(0, 10)) for (const k of Object.keys(r)) teamRow.add(k);
  const unread = [...game].filter((k) => !Object.values(FIELDS).some((names) => names.includes(k)) && !['gameDate', 'date', 'season', 'seasonType', 'isHomeGame', 'opponent', 'week', 'gameId', 'id', 'teamId', 'playerId'].includes(k));
  return { game: [...game].sort(), player: [...player].sort(), prop: [...prop].sort(), teamRow: [...teamRow].sort(), unread: unread.sort() };
}

// What a defense allows per position, per game: the stat keys the picks read, with the row spellings.
const ALLOWED = {
  passYds: FIELDS.passYds, passTd: FIELDS.passTd, passCmp: FIELDS.passCmp, passAtt: FIELDS.passAtt, passInt: FIELDS.passInt,
  rushAtt: FIELDS.rushAtt, rushYds: FIELDS.rushYds, rushTd: FIELDS.rushTd,
  rec: FIELDS.rec, recYds: FIELDS.recYds, recTd: FIELDS.recTd, tgt: FIELDS.tgt,
};

/** A team's Opponent row for a season, position and window (null = the full season). */
export function pickRow(stats, { season, position, lastN = null, type = 'Opponent' }) {
  const rows = (stats || []).filter((r) => n(r.seasonYear ?? r.season) === season && (r.type || 'Team') === type && String(r.position || 'All').toUpperCase() === position.toUpperCase()
    && (lastN ? n(r.lastNGames) === lastN : !r.lastNGames) && n(r.gamesPlayed ?? r.games ?? r.gp) > 0);
  rows.sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')));
  return rows[0] || null;
}

/**
 * What every team allows per position per game this season ({ ABBR: { QB: { gp, passYds, … }, RB, WR, TE } })
 * with ranks (1 = the most allowed, ties shared) so a pick can read whether its opponent is in the
 * soft third at the player's position for the market's stat.
 */
export function defenseAllowed(teams, { season }) {
  const per = {};
  for (const t of teams || []) {
    const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
    if (!abbr) continue;
    const rows = {};
    for (const pos of POSITIONS) {
      const r = pickRow(t.stats, { season, position: pos }) || pickRow(t.stats, { season: season - 1, position: pos });
      if (!r) continue;
      const gp = n(r.gamesPlayed ?? r.games ?? r.gp);
      const row = { gp, season: n(r.seasonYear ?? r.season) };
      for (const [key, names] of Object.entries(ALLOWED)) { const v = firstOf(r, names); if (v != null) row[key] = r2(n(v) / gp); }
      row.td = r2((n(firstOf(r, FIELDS.rushTd)) + n(firstOf(r, FIELDS.recTd))) / gp);
      rows[pos] = row;
    }
    if (Object.keys(rows).length) per[abbr] = rows;
  }
  const ranks = {};
  const keys = [...Object.keys(ALLOWED), 'td'];
  for (const pos of POSITIONS) {
    const abbrs = Object.keys(per).filter((a) => per[a][pos]);
    for (const key of keys) {
      const have = abbrs.filter((a) => per[a][pos][key] != null);
      const sorted = [...have].sort((x, y) => per[y][pos][key] - per[x][pos][key]);
      sorted.forEach((a, i) => {
        ranks[a] = ranks[a] || {}; ranks[a][pos] = ranks[a][pos] || {};
        ranks[a][pos][key] = sorted.findIndex((b) => per[b][pos][key] === per[a][pos][key]) + 1 || i + 1;
      });
    }
  }
  return { teams: per, ranks, count: Object.keys(per).length };
}

const chunks = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

/**
 * Pull the week: the teams playing (from the stored schedule), their players with logs and
 * prop lines, and every team's defense rows. Returns the file the store writes for the week.
 */
export async function pullWeek({ season, games, at = new Date().toISOString() }) {
  if (!propfinderConfigured()) return { ok: false, at, skipped: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD)' };
  const slateAbbrs = [...new Set((games || []).flatMap((g) => [g.away, g.home]))].filter(Boolean);
  if (!slateAbbrs.length) return { ok: false, at, skipped: 'no games in the week' };
  const teams = await pfGetJson('/NFL/teams');
  if (!Array.isArray(teams) || !teams.length) throw new Error('PropFinder returned no NFL teams');
  const byAbbr = {};
  for (const t of teams) { const a = teamAbbrFromText(t.code || t.abbreviation || t.fullName); if (a) byAbbr[a] = t; }
  const missingTeams = slateAbbrs.filter((a) => !byAbbr[a]);
  const ids = slateAbbrs.map((a) => byAbbr[a]?.id).filter(Boolean);
  const raw = [];
  for (const ch of chunks(ids, 8)) {
    const got = await pfGetJson(`/NFL/players?${ch.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')}&hydrate=stats&withOddsOnly=true`);
    if (Array.isArray(got)) raw.push(...got);
  }
  // Without odds-only players (a week PropFinder has not priced yet) take everyone on the roster.
  if (!raw.length) {
    for (const ch of chunks(ids, 8)) {
      const got = await pfGetJson(`/NFL/players?${ch.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')}&hydrate=stats`);
      if (Array.isArray(got)) raw.push(...got);
    }
  }
  const players = mapPlayers(raw);
  const playedSeason = players.some((p) => p.games.some((g) => g.season === season && g.type === 'REG')) ? season : season - 1;
  const defense = defenseAllowed(teams, { season: playedSeason });
  return {
    ok: true, at, season, source: SOURCE, teams: slateAbbrs.length, missingTeams, players: players.length,
    withProps: players.filter((p) => p.props.length).length, withGames: players.filter((p) => p.games.length).length,
    defenseTeams: defense.count, fieldsSeen: fieldsSeen(raw, teams),
    data: { players, defense },
  };
}
