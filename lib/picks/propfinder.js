// PropFinder's data for a sport through the same API client the NHL pull uses
// (lib/nhl-data/propfinder-api.js: the sign-in, the token and the request plumbing): the slate's
// players with their game logs and the prop lines PropFinder lists on them, and every team's
// per-position "what it allows" rows.
//
//   GET /<LEAGUE>/teams                 the teams; stats[] rows: type Team | Opponent, position
//                                       All | <pos>, seasonYear, lastNGames or the season
//   GET /<LEAGUE>/players?teamIds=…&hydrate=stats&withOddsOnly=true
//                                       the teams' players; stats[] = one row per game; the odds
//                                       PropFinder prices ride on the player when the API hydrates them
//
// The NHL endpoints were checked against its exports; the other leagues follow the same routes
// (PropFinder serves every sport through /<LEAGUE>/…), but the field names of their game rows have
// not been seen yet. So every field is read through a list of spellings (the sport's FIELDS) and
// the pull records the keys it actually saw (`fieldsSeen`, shown under Data sources) so a spelling
// the sport file does not know is visible after the first pull instead of silently reading as zero.
import { pfGetJson, propfinderConfigured } from '../nhl-data/propfinder-api';
import { parseOdds, parseNumber } from '../nfl/odds';
import { normName } from '../nhl-data/names';

export { propfinderConfigured };
export const SOURCE = 'propfinder-api';

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const firstOf = (row, names) => { for (const k of names) if (row && row[k] != null && row[k] !== '') return row[k]; return undefined; };
const chunks = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
const META_KEYS = ['gameDate', 'date', 'gameDay', 'season', 'seasonYear', 'seasonType', 'gameType', 'isHomeGame', 'isHome', 'home', 'opponent', 'opponentTeam', 'opponentAbbreviation', 'opposingTeamCode', 'opposingTeamId', 'opposingTeamName', 'opponentCode', 'opp', 'week', 'weekNumber', 'gameId', 'id', 'teamId', 'playerId', 'playerName', 'fullName', 'teamCode', 'position', 'playerPosition', 'primaryPosition', 'isWin', 'isConferenceGame', 'isDivisional', 'isNationalTv', 'pointDifferential'];

/**
 * One sport's pull: { league ('NFL' | 'NBA'), FIELDS ({ stat: [spellings] }; a list with `sum: true`
 * adds every spelling present), derive (adds the combined stats to a game row), teamAbbrFromText,
 * markets (makeMarkets), positions (the codes a player may carry), posOf (a player → his code),
 * allowed (the stat keys the defense tables carry), deriveAllowed (adds combined allowed stats) }.
 */
export function makePropfinder({ league, FIELDS, derive = (g) => g, teamAbbrFromText, markets, positions, posOf, allowed, deriveAllowed = (row) => row }) {
  const { marketFromText } = markets;

  /** One game row in the board's shape: { date, season, type, opp, home, <stat>… }; stats absent in the row read as 0. */
  function gameRow(g) {
    const out = {
      date: String(g.gameDate || g.date || g.gameDay || '').slice(0, 10),
      season: n(g.season ?? g.seasonYear), type: g.seasonType || g.gameType || 'REG',
      home: g.isHomeGame ?? g.isHome ?? g.home ?? null,
      opp: teamAbbrFromText(g.opponent?.code || g.opponentTeam?.code || g.opponent?.abbreviation || g.opponentAbbreviation || g.opposingTeamCode || g.opponentCode || g.opponent || g.opp) || null,
      week: n(g.week ?? g.weekNumber) || null,
    };
    for (const [key, names] of Object.entries(FIELDS)) {
      if (names.sum) { out[key] = names.reduce((s, k) => s + n(g[k]), 0); continue; }
      const v = firstOf(g, names);
      out[key] = v === true ? 1 : v === false ? 0 : n(v);
    }
    return derive(out);
  }

  /** PropFinder's prop lines on a player, in the cheat-sheet row shape (market, line, odds, underOdds, book). */
  function playerProps(p) {
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
  function mapPlayers(players) {
    const out = [];
    for (const p of players || []) {
      if (!p?.name) continue;
      const games = (p.stats || []).map(gameRow).filter((g) => g.date).sort((a, b) => b.date.localeCompare(a.date));
      out.push({ id: p.id || null, name: p.name, key: normName(p.name), team: teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) || null, pos: posOf(p), status: p.status || null, injury: p.injury?.status || p.injuryStatus || null, games, props: playerProps(p) });
    }
    return out;
  }

  /** The keys the API used, so an unread spelling shows after the first pull. */
  function fieldsSeen(players, teams) {
    const game = new Set(); const player = new Set(); const prop = new Set(); const teamRow = new Set();
    for (const p of (players || []).slice(0, 200)) {
      for (const k of Object.keys(p)) player.add(k);
      for (const g of (p.stats || []).slice(0, 5)) for (const k of Object.keys(g)) game.add(k);
      for (const list of [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds]) if (Array.isArray(list)) for (const o of list.slice(0, 5)) for (const k of Object.keys(o || {})) prop.add(k);
    }
    for (const t of (teams || []).slice(0, 4)) for (const r of (t.stats || []).slice(0, 10)) for (const k of Object.keys(r)) teamRow.add(k);
    const unread = [...game].filter((k) => !Object.values(FIELDS).some((names) => names.includes(k)) && !META_KEYS.includes(k));
    // One of each object as the API sent it (strings clipped), so a structure this file does not
    // read yet can be seen in the pull's report: a player's non-log fields, the first item of
    // every array a player carries besides his logs, one game row, one team stats row.
    const clip = (o, n = 1200) => { try { const t = JSON.stringify(o); return t.length > n ? `${t.slice(0, n)}…` : t; } catch { return null; } };
    const sample = {};
    const p0 = (players || []).find((p) => Object.values(p).some((v) => Array.isArray(v) && v.length && v !== p.stats)) || (players || [])[0];
    if (p0) {
      const { stats, ...rest } = p0;
      sample.player = clip(Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Array.isArray(v) ? `[${v.length} items]` : v])));
      sample.arrays = Object.fromEntries(Object.entries(rest).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => [k, clip(v[0], 900)]));
      if (stats?.length) sample.game = clip(stats[0]);
    }
    const t0 = (teams || []).find((t) => t.stats?.length);
    if (t0) sample.teamRow = clip(t0.stats[0]);
    if (t0) sample.teamRows = clip((t0.stats || []).slice(0, 40).map((r) => [r.type, r.position, r.seasonYear ?? r.season, r.lastNGames ?? null, r.gamesPlayed ?? r.games ?? r.gp ?? null]));
    return { game: [...game].sort(), player: [...player].sort(), prop: [...prop].sort(), teamRow: [...teamRow].sort(), unread: unread.sort(), sample };
  }

  /** A team's stats row for a season, position and window (null = the full season). */
  function pickRow(stats, { season, position, lastN = null, type = 'Opponent' }) {
    // The NBA rows carry seasonYear, the NFL rows year; a full-season row has lastNGames 0 or none.
    const rows = (stats || []).filter((r) => n(r.seasonYear ?? r.season ?? r.year) === season && (r.type || 'Team') === type && String(r.position || 'All').toUpperCase() === position.toUpperCase()
      && (lastN ? n(r.lastNGames) === lastN : !r.lastNGames) && n(r.gamesPlayed ?? r.games ?? r.gp) > 0);
    rows.sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')));
    return rows[0] || null;
  }

  /**
   * What every team allows per position per game this season ({ ABBR: { <pos>: { gp, <stat>… } } })
   * with ranks (1 = the most allowed, ties shared), for the positions the rows carry.
   */
  function defenseAllowed(teams, { season }) {
    const per = {};
    const seen = new Set();
    for (const t of teams || []) {
      const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
      if (!abbr) continue;
      const rows = {};
      const posHere = [...new Set((t.stats || []).filter((r) => (r.type || '') === 'Opponent').map((r) => String(r.position || 'All').toUpperCase()).filter((p) => p !== 'ALL'))];
      for (const pos of posHere) {
        const r = pickRow(t.stats, { season, position: pos }) || pickRow(t.stats, { season: season - 1, position: pos });
        if (!r) continue;
        const gp = n(r.gamesPlayed ?? r.games ?? r.gp);
        const row = { gp, season: n(r.seasonYear ?? r.season ?? r.year) };
        for (const key of allowed) { const v = firstOf(r, FIELDS[key] || []); if (v != null) row[key] = r2(n(v) / gp); }
        rows[pos] = deriveAllowed(row, r, gp);
        seen.add(pos);
      }
      if (Object.keys(rows).length) per[abbr] = rows;
    }
    const ranks = {};
    const keys = [...new Set(Object.values(per).flatMap((rows) => Object.values(rows).flatMap((row) => Object.keys(row))))].filter((k) => k !== 'gp' && k !== 'season');
    for (const pos of seen) {
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
    return { teams: per, ranks, count: Object.keys(per).length, positions: [...seen] };
  }

  /**
   * Pull the slate: the teams playing, their players with logs and prop lines, and every team's
   * defense rows. Returns the file the store writes for the slate.
   */
  async function pullSlate({ season, games, at = new Date().toISOString() }) {
    if (!propfinderConfigured()) return { ok: false, at, skipped: 'PropFinder credentials are not configured (PROPFINDER_EMAIL / PROPFINDER_PASSWORD)' };
    const slateAbbrs = [...new Set((games || []).flatMap((g) => [g.away, g.home]))].filter(Boolean);
    if (!slateAbbrs.length) return { ok: false, at, skipped: 'no games in the slate' };
    const teams = await pfGetJson(`/${league}/teams`);
    if (!Array.isArray(teams) || !teams.length) throw new Error(`PropFinder returned no ${league} teams`);
    const byAbbr = {};
    for (const t of teams) { const a = teamAbbrFromText(t.code || t.abbreviation || t.fullName); if (a) byAbbr[a] = t; }
    const missingTeams = slateAbbrs.filter((a) => !byAbbr[a]);
    const ids = slateAbbrs.map((a) => byAbbr[a]?.id).filter(Boolean);
    // The players' odds arrays came back empty with hydrate=stats alone (2026-10-20, a priced NBA
    // slate), so the lines are asked for by name; an API that refuses the extra hydrate gets the
    // plain call. `hydrate` on the result says which call answered.
    const hydrates = ['stats,odds,lastLines', 'stats'];
    const fetchPlayers = async (hydrate, oddsOnly) => {
      const out = [];
      for (const ch of chunks(ids, 8)) {
        const got = await pfGetJson(`/${league}/players?${ch.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')}&hydrate=${hydrate}${oddsOnly ? '&withOddsOnly=true' : ''}`);
        if (Array.isArray(got)) out.push(...got);
      }
      return out;
    };
    let raw = [];
    let hydrate = null;
    for (const h of hydrates) {
      try { raw = await fetchPlayers(h, true); hydrate = h; break; }
      catch (err) { console.error(`[${league}] players?hydrate=${h} refused:`, err?.message || err); }
    }
    // Without odds-only players (a slate PropFinder has not priced yet) take everyone on the roster.
    if (!raw.length) {
      for (const h of hydrates) {
        try { raw = await fetchPlayers(h, false); hydrate = h; break; }
        catch (err) { console.error(`[${league}] players?hydrate=${h} refused:`, err?.message || err); }
      }
    }
    const players = mapPlayers(raw);
    const playedSeason = players.some((p) => p.games.some((g) => g.season === season && g.type === 'REG')) ? season : season - 1;
    const defense = defenseAllowed(teams, { season: playedSeason });
    return {
      ok: true, at, season, source: SOURCE, hydrate, teams: slateAbbrs.length, missingTeams, players: players.length,
      withProps: players.filter((p) => p.props.length).length, withGames: players.filter((p) => p.games.length).length,
      defenseTeams: defense.count, fieldsSeen: fieldsSeen(raw, teams),
      data: { players, defense },
    };
  }

  return { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, pullSlate, positions };
}
