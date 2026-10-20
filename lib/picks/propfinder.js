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
 * One sport's pull: { league ('NFL' | 'NBA'), FIELDS ({ stat: [spellings] }; a list with `optional: true` reads null when absent; a list with `sum: true`
 * adds every spelling present), derive (adds the combined stats to a game row), teamAbbrFromText,
 * markets (makeMarkets), positions (the codes a player may carry), posOf (a player → his code),
 * allowed (the stat keys the defense tables carry), deriveAllowed (adds combined allowed stats) }.
 */
const DEFENSE_PRIOR = 15;   // last season's weight in games behind a team's per-position row

export function makePropfinder({ league, FIELDS, derive = (g) => g, teamAbbrFromText, markets, positions, posOf, allowed, deriveAllowed = (row) => row, defenseMin = 1 }) {
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
      // A tracking figure (`optional: true`) the row does not carry reads as null, never 0.
      out[key] = v === undefined && names.optional ? null : v === true ? 1 : v === false ? 0 : n(v);
    }
    return derive(out);
  }

  // A period market ("1st Quarter Player Assists", "Q1assists", "1st Half …") is not a game line.
  const PERIOD = /\b(1st|2nd|3rd|4th|first|second|third|fourth)\s+(quarter|half|period)\b|\bq[1-4]\b|\bh[12]\b|^q[1-4]|^h[12]|quarter|half/i;
  const words = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  // The item's own market name first ("Points + Rebounds + Assists"), its category only when the
  // name reads as nothing: a category is coarser ("Points" covers the combos too), and read first
  // it filed every points combo and alternate under points (seen 2026-10-20: o49.5 PTS on a PRA line).
  // Markets the boards do not settle, whose names still carry a market's word (seen in the NBA
  // pull of 2026-10-20: "Player Made Two Pointers" and "Player Fantasy Score" read as points,
  // "Player Threes Attempted" as threes, "Player Free Throws Attempted" as free throws made).
  const NOT_A_MARKET = /attempt|two.?point|\b2.?pt|field.?goal|fantasy|first (basket|field goal|to score)|fgm|fga/i;
  const marketOfItem = (o) => {
    const cat = String(o.categoryMapping || o.category || '');
    const name = String(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label || '');
    if (PERIOD.test(cat) || PERIOD.test(name)) return null;
    if (NOT_A_MARKET.test(words(name)) || NOT_A_MARKET.test(words(cat))) return null;
    return marketFromText(words(name)) || marketFromText(name) || marketFromText(words(cat));
  };
  const sideOfItem = (o) => { const s = String(o.selectionLine ?? o.side ?? o.selection ?? '').toLowerCase(); return /under|^no$|^u$/.test(s) ? 'under' : 'over'; };

  /**
   * PropFinder's prop lines on a player, in the cheat-sheet row shape (market, line, odds, underOdds,
   * book, books). The API lists one item per sportsbook and side (checked 2026-10-20: { market,
   * categoryMapping, sportsbook, selectionLine over | under, price (American), points (the line),
   * isMain }); one line per market is kept as the play's line: of the lines flagged main the one
   * priced both ways by the most books, then the one nearest the player's own average for the stat
   * (`avgOf(market)`, his last ten regular-season games; a book's one-sided "main" on an alternate
   * ladder put Drummond on o1.5 points, 2026-10-20), without a flag the line with the most books,
   * with the best price on each side and the number of books behind it;
   * every line of the market rides along as `lines` (the card's ladder). Objects in the older
   * shape ({ market, line, overOdds, underOdds }) still read.
   */
  function playerProps(p, avgOf = () => null) {
    const lists = [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds].filter(Array.isArray);
    const grouped = new Map(); // market|line → { market, line, over: [{ price, book }], under: […], main }
    const legacy = [];
    for (const list of lists) {
      for (const o of list) {
        if (!o || typeof o !== 'object') continue;
        const market = marketOfItem(o);
        if (!market) continue;
        if (o.points != null || o.selectionLine != null || o.sportsbook != null) {
          const line = parseNumber(o.points ?? o.line ?? o.value ?? o.threshold ?? o.handicap);
          if (line == null) continue;
          const key = `${market}|${line}`;
          const g = grouped.get(key) || { market, line, over: [], under: [], main: false };
          const price = parseOdds(o.price ?? o.odds ?? o.americanOdds);
          const book = o.sportsbook || o.book || o.bookmaker || o.provider || null;
          g[sideOfItem(o)].push({ price, book });
          if (o.isMain) g.main = true;
          grouped.set(key, g);
        } else {
          const line = parseNumber(o.line ?? o.value ?? o.threshold ?? o.point ?? o.handicap ?? o.total);
          if (line == null) continue;
          legacy.push({
            market, line,
            odds: parseOdds(o.overOdds ?? o.over ?? o.overPrice ?? o.odds ?? o.price ?? o.americanOdds ?? o.yesOdds),
            underOdds: parseOdds(o.underOdds ?? o.under ?? o.underPrice ?? o.noOdds),
            book: o.book || o.sportsbook || o.bookmaker || o.provider || null, books: 1, isMain: true,
          });
        }
      }
    }
    const best = (sides) => sides.filter((x) => x.price != null).sort((a, b) => b.price - a.price)[0] || null;
    const priced = (g) => { const over = best(g.over); const under = best(g.under); return !over && !under ? null : { line: g.line, odds: over?.price ?? null, underOdds: under?.price ?? null, book: over?.book || under?.book || null, books: new Set([...g.over, ...g.under].map((x) => x.book).filter(Boolean)).size, main: g.main }; };
    const out = [];
    // One line per market: of the main lines the one priced both ways by the most books (a lone
    // book's one-sided "main" is an alternate ladder's rung), the one nearest his own average on a tie.
    const byMarket = new Map();
    for (const g of grouped.values()) { const row = priced(g); if (!row) continue; const list = byMarket.get(g.market) || []; list.push(row); byMarket.set(g.market, list); }
    for (const [market, lines] of byMarket) {
      lines.sort((a, b) => a.line - b.line);
      const avg = avgOf(market);
      const mains = lines.filter((x) => x.main);
      const pool = mains.length ? mains : lines;
      const dist = (x) => (avg == null ? 0 : Math.abs(x.line - avg));
      const sides = (x) => (x.odds != null ? 1 : 0) + (x.underOdds != null ? 1 : 0);   // a real main line is priced both ways
      const mid = pool[Math.floor((pool.length - 1) / 2)].line;
      const pick = [...pool].sort((a, b) => sides(b) - sides(a) || b.books - a.books || dist(a) - dist(b) || Math.abs(a.line - mid) - Math.abs(b.line - mid) || a.line - b.line)[0];
      const { main, ...rest } = pick;
      const row = { market, ...rest, isMain: main };
      if (lines.length > 1) row.lines = lines.map(({ line, odds, underOdds, books, main: m }) => ({ line, odds, underOdds, books, main: m }));
      out.push(row);
    }
    return [...out, ...legacy];
  }

  /** The pull's player list in the stored shape: { id, name, key, team, pos, status, games (newest first), props }. */
  function mapPlayers(players) {
    const out = [];
    for (const p of players || []) {
      if (!p?.name) continue;
      // Preseason rows (seasonType PRE, short minutes) are left out: they dragged LeBron's last-ten
      // average, and with it his main line, to o14.5 points on 2026-10-20.
      const games = (p.stats || []).map(gameRow).filter((g) => g.date && !/^pre/i.test(String(g.type || ''))).sort((a, b) => b.date.localeCompare(a.date));
      // His average for a market over his last ten games, the main line's anchor.
      const avgOf = (market) => { const v = games.slice(0, 10).map((g) => markets.statOf(g, market)).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      out.push({ id: p.id || null, name: p.name, key: normName(p.name), team: teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) || null, pos: posOf(p), status: p.status || null, injury: p.injury?.status || p.injuryStatus || null, games, props: playerProps(p, avgOf) });
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
    const td = (teams || []).find((t) => t.depthChart);
    if (td) sample.depthChart = clip(td.depthChart, 1500);
    // Every odds market name and category the pull carried, with the market it was filed under
    // (null = skipped), so a mapping can be checked under Data sources without the raw pull.
    const markets = {};
    for (const p of players || []) {
      for (const list of [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds]) {
        if (!Array.isArray(list)) continue;
        for (const o of list) {
          if (!o || typeof o !== 'object') continue;
          const name = String(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label || '');
          const cat = String(o.categoryMapping || o.category || '');
          const k = `${name}${cat && cat !== name ? ` [${cat}]` : ''}`.slice(0, 80);
          const m = markets[k] || { market: marketOfItem(o), n: 0 };
          m.n++; markets[k] = m;
        }
      }
    }
    if (t0) sample.teamRows = clip((t0.stats || []).slice(0, 40).map((r) => [r.type, r.position, r.seasonYear ?? r.season, r.lastNGames ?? null, r.gamesPlayed ?? r.games ?? r.gp ?? null]));
    return { game: [...game].sort(), player: [...player].sort(), prop: [...prop].sort(), teamRow: [...teamRow].sort(), unread: unread.sort(), sample, markets };
  }

  /**
   * A team's depth chart as PropFinder's team object carries it: the NHL shape
   * (depthChart.positions[SLOT].players[{ full_name, depth, status, reference }]) or the NBA's
   * (checked 2026-10-20: depthChart = { id, teamId, data: "<JSON>" }, the JSON's positions[SLOT]
   * .players[{ full_name, depth, nba_com_starter, espn_injury_status, id }]): { SLOT: [{ name, key,
   * depth, status, starter, injury, id }] } by depth, slots the sport's positions; null without one.
   */
  function depthChart(team) {
    let dc = team?.depthChart;
    if (dc && typeof dc.data === 'string') { try { dc = JSON.parse(dc.data); } catch { return null; } }
    else if (dc && dc.data && typeof dc.data === 'object') dc = dc.data;
    const pos = dc?.positions;
    if (!pos || typeof pos !== 'object') return null;
    const out = {};
    for (const [slot, v] of Object.entries(pos)) {
      const list = (v?.players || v || []);
      if (!Array.isArray(list)) continue;
      const rows = list.filter((p) => p && (p.full_name || p.name)).map((p) => ({ name: p.full_name || p.name, key: normName(p.full_name || p.name), depth: n(p.depth) || null, status: p.status || null, starter: p.nba_com_starter ?? null, injury: p.espn_injury_status || null, id: p.reference ?? p.id ?? null })).sort((a, b) => (a.depth || 99) - (b.depth || 99));
      if (rows.length) out[String(slot).toUpperCase()] = rows;
    }
    return Object.keys(out).length ? out : null;
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
   * What every team allows per position per game ({ ABBR: { <pos>: { gp, <stat>… } } }) with ranks
   * (1 = the most allowed, ties shared), for the positions the rows carry. Early in a season the
   * table is last season's: this season's per-game figures are blended into last season's full
   * row at gp / (gp + DEFENSE_PRIOR) (the NHL defense tables' rule), last season's alone until the
   * team has `defenseMin` games (`held: true` on the row; the NBA holds for ten); `gp` is this
   * season's count, `prior` last season's games behind the blend.
   * The last-N windows PropFinder publishes (lastNGames 5 / 10 / 15 / 20, this season's rows as they
   * are, no blend) ride along as `windows: { l5: { teams, ranks, count }, … }`, each ranked on its
   * own, and `league` carries the league's average per position and stat for the season table and
   * every window (the environment a player's projection is read against).
   */
  function defenseAllowed(teams, { season }) {
    const per = {};
    const seen = new Set();
    const perGame = (r) => {
      const gp = n(r.gamesPlayed ?? r.games ?? r.gp);
      const row = { gp, season: n(r.seasonYear ?? r.season ?? r.year) };
      for (const key of allowed) { const v = firstOf(r, FIELDS[key] || []); if (v != null) row[key] = r2(n(v) / gp); }
      return deriveAllowed(row, r, gp);
    };
    for (const t of teams || []) {
      const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
      if (!abbr) continue;
      const rows = {};
      const posHere = [...new Set((t.stats || []).filter((r) => (r.type || '') === 'Opponent').map((r) => String(r.position || 'All').toUpperCase()).filter((p) => p !== 'ALL'))];
      for (const pos of posHere) {
        const cur = pickRow(t.stats, { season, position: pos });
        const last = pickRow(t.stats, { season: season - 1, position: pos });
        if (!cur && !last) continue;
        const now = cur ? perGame(cur) : null;
        const prior = last ? perGame(last) : null;
        let row;
        if (now && prior && now.gp < defenseMin) row = { ...prior, gp: now.gp, prior: prior.gp, priorSeason: prior.season, season: prior.season, held: true };
        else if (now && prior) {
          const w = now.gp / (now.gp + DEFENSE_PRIOR);
          row = { gp: now.gp, season: now.season, prior: prior.gp, priorSeason: prior.season };
          for (const key of new Set([...Object.keys(now), ...Object.keys(prior)])) {
            if (['gp', 'season', 'prior', 'priorSeason'].includes(key)) continue;
            const a = now[key]; const b = prior[key];
            row[key] = a != null && b != null ? r2(w * a + (1 - w) * b) : a ?? b ?? null;
          }
        } else row = now || { ...prior, gp: 0, prior: prior.gp, priorSeason: prior.season, season: prior.season };
        rows[pos] = row;
        seen.add(pos);
      }
      if (Object.keys(rows).length) per[abbr] = rows;
    }
    const windows = {};
    for (const lastN of WINDOWS) {
      const w = {};
      for (const t of teams || []) {
        const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
        if (!abbr) continue;
        const rows = {};
        for (const pos of seen) { const r = pickRow(t.stats, { season, position: pos, lastN }) || pickRow(t.stats, { season: season - 1, position: pos, lastN }); if (r) rows[pos] = { ...perGame(r), lastN }; }
        if (Object.keys(rows).length) w[abbr] = rows;
      }
      if (Object.keys(w).length) windows[`l${lastN}`] = { teams: w, ...rankTable(w, seen), count: Object.keys(w).length, lastN, season: Math.max(...Object.values(w).flatMap((rows) => Object.values(rows).map((r) => r.season || 0))) || null };
    }
    return { teams: per, ...rankTable(per, seen), count: Object.keys(per).length, positions: [...seen], windows };
  }

  const WINDOWS = [5, 10, 15, 20];
  const META = ['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held'];

  /** Ranks (1 = the most allowed, ties shared) and the league's average per position and stat over a { ABBR: { pos: row } } table. */
  function rankTable(per, positions) {
    const ranks = {}; const league = {};
    const keys = [...new Set(Object.values(per).flatMap((rows) => Object.values(rows).flatMap((row) => Object.keys(row))))].filter((k) => !META.includes(k));
    for (const pos of positions) {
      const abbrs = Object.keys(per).filter((a) => per[a][pos]);
      for (const key of keys) {
        const have = abbrs.filter((a) => per[a][pos][key] != null);
        if (!have.length) continue;
        league[pos] = league[pos] || {};
        league[pos][key] = r2(have.reduce((s, a) => s + per[a][pos][key], 0) / have.length);
        const sorted = [...have].sort((x, y) => per[y][pos][key] - per[x][pos][key]);
        sorted.forEach((a, i) => {
          ranks[a] = ranks[a] || {}; ranks[a][pos] = ranks[a][pos] || {};
          ranks[a][pos][key] = sorted.findIndex((b) => per[b][pos][key] === per[a][pos][key]) + 1 || i + 1;
        });
      }
    }
    return { ranks, league };
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
    const defense = defenseAllowed(teams, { season });
    const depth = {};
    for (const a of slateAbbrs) { const d = depthChart(byAbbr[a]); if (d) depth[a] = d; }
    return {
      ok: true, at, season, source: SOURCE, hydrate, teams: slateAbbrs.length, missingTeams, players: players.length,
      withProps: players.filter((p) => p.props.length).length, withGames: players.filter((p) => p.games.length).length,
      defenseTeams: defense.count, depthCharts: Object.keys(depth).length, fieldsSeen: fieldsSeen(raw, teams),
      data: { players, defense, depth },
    };
  }

  return { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, depthChart, pullSlate, positions };
}
