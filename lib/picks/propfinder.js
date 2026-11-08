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
//   GET /<LEAGUE>/v2?sportsbooks=…      the games payload the site's game pages load (read from its
//                                       bundle 2026-10-27): { games, players, depthCharts, injuryReport },
//                                       the injury report a JSON string whose data lists
//                                       { team: { id }, player: { id, name, position }, status, type }
//   GET /injuries/<league>/<teamId>     the per-team report the site's WNBA pages use, the fallback
//   GET <PROPFINDER_<LEAGUE>_SAMPLE_PATHS>  PropFinder's Rotations / Lineup Lab page routes, once the env names
//                                       them ({teamIds}, {date}); each answer is stored as a sample only (`fetchSamples`).
//   GET /<LEAGUE>/player/<id>           one player with his logs (and `teammates`): the players out
//                                       tonight the odds-only call leaves out are read this way, so
//                                       their logs say which games they took part in (the "w/o" splits)
//
// The NHL endpoints were checked against its exports; the other leagues follow the same routes
// (PropFinder serves every sport through /<LEAGUE>/…), but the field names of their game rows have
// not been seen yet. So every field is read through a list of spellings (the sport's FIELDS) and
// the pull records the keys it actually saw (`fieldsSeen`, shown under Data sources) so a spelling
// the sport file does not know is visible after the first pull instead of silently reading as zero.
import { pfGetJson, propfinderConfigured } from '../nhl-data/propfinder-api';
import { parseOdds, parseNumber, impliedProb } from '../nfl/odds';
import { normName } from '../nhl-data/names';
import { parseInjuryReport, isOut, markStale, statusOf } from './injuries';

export { propfinderConfigured };
export const SOURCE = 'propfinder-api';
// The books the games payload is asked for (the site sends the user's enabled books; any answer carries the injury report).
export const BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'fanatics'];
// How many players out tonight are read one by one when the odds-only call left them out.
export const MAX_ABSENT_READS = 16;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(v * 100) / 100;
const firstOf = (row, names) => { for (const k of names) if (row && row[k] != null && row[k] !== '') return row[k]; return undefined; };
const chunks = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
// The NBA's: markets the boards do not settle whose names still carry a market's word (see marketOfItem).
const NOT_A_MARKET = /attempt|two.?point|\b2.?pt|field.?goal|fantasy|first (basket|field goal|to score)|fgm|fga/i;
// The last-N windows of the team rows read into the defense tables (the NFL publishes 3, 5 and 10).
const WINDOWS_DEFAULT = [5, 10, 15, 20];
/** How far (implied chance) a line may be priced under a higher line of its market before it is read as another market's. */
export const LADDER_CLASH = 0.15;
const META_KEYS = ['gameDate', 'date', 'gameDay', 'season', 'seasonYear', 'seasonType', 'gameType', 'isHomeGame', 'isHome', 'home', 'opponent', 'opponentTeam', 'opponentAbbreviation', 'opposingTeamCode', 'opposingTeamId', 'opposingTeamName', 'opponentCode', 'opp', 'week', 'weekNumber', 'gameId', 'id', 'teamId', 'playerId', 'playerName', 'fullName', 'teamCode', 'position', 'playerPosition', 'primaryPosition', 'isWin', 'isConferenceGame', 'isDivisional', 'isNationalTv', 'pointDifferential'];

/**
 * One sport's pull: { league ('NFL' | 'NBA'), FIELDS ({ stat: [spellings] }; a list with `optional: true` reads null when absent; a list with `sum: true`
 * adds every spelling present), derive (adds the combined stats to a game row), teamAbbrFromText,
 * markets (makeMarkets), positions (the codes a player may carry), posOf (a player → his code),
 * allowed (the stat keys the defense tables carry), deriveAllowed (adds combined allowed stats) }.
 */
/**
 * `injuryReport`: where the sport's injury report comes from. 'propfinder' (the NBA, the default): PropFinder's own report,
 * read with the pull. 'espn' (the NFL): none from PropFinder — its NFL report sits behind a route only its signed-in pages
 * reach (the site's bundle, read 2026-10-31, builds the NFL games from an `injuryReports` string; `/NFL/v2` and
 * `/injuries/nfl/<teamId>` answer 404 to the API), so the board reads ESPN's league feed (`ensureInjuries` in
 * lib/picks/store.js, applyEspnInjuries) and the pull asks PropFinder nothing. The NFL pull lists every rostered player
 * (3,776 for 28 teams on 2026-10-29), so a player out is in it with his logs and no one-by-one read is needed.
 */
export function makePropfinder({ league, FIELDS, derive = (g) => g, teamAbbrFromText, markets, positions, posOf, allowed, deriveAllowed = (row) => row, rowsPerGame = false, injuryReport = 'propfinder', depthFromPlayers = false,
  notAMarket = NOT_A_MARKET, periodOf = null, categoryMarkets = null, lineMarket = null, windows = WINDOWS_DEFAULT, keepExtra = false, rosterExtra = false, rosterOnBoard = false, pages = {} }) {
  const { marketFromText } = markets;
  const WINDOWS = windows;

  /** One game row in the board's shape: { date, season, type, opp, home, <stat>… }; stats absent in the row read as 0. */
  function gameRow(g) {
    const gid = g.gameId ?? g.game?.id ?? null;
    const out = {
      date: String(g.gameDate || g.date || g.gameDay || '').slice(0, 10),
      // The game's id, so a teammate's rows say which of this player's games he took part in (the "w/o" splits).
      gameId: gid == null || gid === '' ? null : String(gid),
      season: n(g.season ?? g.seasonYear), type: g.seasonType || g.gameType || 'REG',
      home: g.isHomeGame ?? g.isHome ?? g.home ?? null,
      opp: teamAbbrFromText(g.opponent?.code || g.opponentTeam?.code || g.opponent?.abbreviation || g.opponentAbbreviation || g.opposingTeamCode || g.opponentCode || g.opponent || g.opp) || null,
      week: n(g.week ?? g.weekNumber) || null,
    };
    for (const [key, names] of Object.entries(FIELDS)) {
      if (names.sum) { out[key] = names.reduce((s, k) => s + n(g[k]), 0); continue; }
      const v = firstOf(g, names);
      // A sparse field (`sparse: true`: the periods, the defense, the kicker, the opportunity figures) is kept only when it
      // is not 0 — a game row is read 0 where it is absent (statOf) — and is null when the row does not carry the key at all.
      if (names.sparse) { if (v === undefined) out[key] = null; else { const x = v === true ? 1 : v === false ? 0 : n(v); if (x !== 0) out[key] = x; } continue; }
      // A tracking figure (`optional: true`) the row does not carry reads as null, never 0.
      out[key] = v === undefined && names.optional ? null : v === true ? 1 : v === false ? 0 : n(v);
    }
    return derive(out);
  }

  // A period market ("1st Quarter Player Assists", "Q1assists", "1st Half …") is not a game line.
  const PERIOD = /\b(1st|2nd|3rd|4th|first|second|third|fourth)\s+(quarter|half|period)\b|\bq[1-4]\b|\bh[12]\b|^q[1-4]|^h[12]|quarter|half/i;
  // A window of minutes ("Points in the First 3 Minutes", "first5MinPoints", "points3min") is not a game line either:
  // its o0.5 / o1.5 points, priced near even, are the likeliest source of Coward on o0.5 points and Boozer on o1.5 at
  // the top of the NBA list on 2026-10-30, projected 14.6 and 23.5 (Vincent: "it's even worse now").
  const WINDOW = /\bminutes?\b|\bmins?\b|\dmin(ute)?s?\b/i;
  const words = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  // The item's own market name first ("Points + Rebounds + Assists"), its category only when the
  // name reads as nothing: a category is coarser ("Points" covers the combos too), and read first
  // it filed every points combo and alternate under points (seen 2026-10-20: o49.5 PTS on a PRA line).
  // Markets the boards do not settle, whose names still carry a market's word (seen in the NBA
  // pull of 2026-10-20: "Player Made Two Pointers" and "Player Fantasy Score" read as points,
  // "Player Threes Attempted" as threes, "Player Free Throws Attempted" as free throws made).
  // (NOT_A_MARKET, the NBA's, is the default `notAMarket`; the NFL settles attempts and field goals and passes its own.)
  // A sport that prices the periods (`periodOf(name, category)` → { key: 'h1' | 'q1' | …, name, cat } with the period words
  // taken off, null when the item names no period) files a period item under `<key>_<market>` when the sport has that
  // market, never under the full game's; `categoryMarkets` ({ category, lower case → market | null }) files an item by
  // PropFinder's own category first, where the name's words mislead ("Kicking Points" holds "ints").
  const marketOfItem = (o) => {
    let cat = String(o.categoryMapping || o.category || '');
    let name = String(o.market || o.marketName || o.statType || o.propType || o.name || o.type || o.stat || o.key || o.label || '');
    // A period or a window of minutes ("1st 3 Minutes Player Points") is the sport's period market or nothing.
    const per = periodOf ? periodOf(name, cat) : null;
    if (per) { cat = per.cat; name = per.name; } else if (PERIOD.test(cat) || PERIOD.test(name) || WINDOW.test(words(cat)) || WINDOW.test(words(name))) return null;
    let base;
    const byCat = categoryMarkets && cat ? categoryMarkets[cat.toLowerCase()] : undefined;
    if (byCat !== undefined) base = byCat;
    else {
      if (notAMarket && (notAMarket.test(words(name)) || notAMarket.test(words(cat)))) return null;
      base = marketFromText(words(name)) || marketFromText(name) || marketFromText(words(cat));
    }
    if (!base || !per) return base || null;
    const key = `${per.key}_${base}`;
    return markets.MARKETS?.[key] ? key : null;
  };
  // The market an item's line settles (`lineMarket(market, line)`: the NFL's "Player Touchdowns" ladder is the anytime
  // touchdown at 0.5 and 2+ touchdowns at 1.5); null drops the line.
  const marketAt = (market, line) => (lineMarket ? lineMarket(market, line) : market);
  const sideOfItem = (o) => { const s = String(o.selectionLine ?? o.side ?? o.selection ?? '').toLowerCase(); return /under|^no$|^u$/.test(s) ? 'under' : 'over'; };

  /**
   * PropFinder's prop lines on a player, in the cheat-sheet row shape (market, line, odds, underOdds,
   * book, books). The API lists one item per sportsbook and side (checked 2026-10-20: { market,
   * categoryMapping, sportsbook, selectionLine over | under, price (American), points (the line),
   * isMain }); one line per market is kept as the play's line: of the lines flagged main **the one
   * the book prices nearest a coin flip** (`balance`: the over's implied probability, the vig split
   * when both sides are priced, against 0.5 — a main line is set to be a toss-up, an alternate
   * ladder's rung sits at -10421 / +2500; 2026-10-29 the books priced their whole ladders both ways
   * and "the most books" put Wiggins on o4.5 points at 100%), then the one priced both ways by the
   * most books, then the one nearest the player's own average for the stat (`avgOf(market)`, his
   * last ten regular-season games; a book's one-sided "main" on an alternate ladder put Drummond on
   * o1.5 points, 2026-10-20), without a flag the same over every line, with the best price on each
   * side and the number of books behind it; every line of the market rides along as `lines` (the
   * card's ladder). Objects in the older shape ({ market, line, overOdds, underOdds }) still read.
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
          const mk = marketAt(market, line);
          if (!mk) continue;
          const key = `${mk}|${line}`;
          const g = grouped.get(key) || { market: mk, line, over: [], under: [], main: false };
          const price = parseOdds(o.price ?? o.odds ?? o.americanOdds);
          const book = o.sportsbook || o.book || o.bookmaker || o.provider || null;
          g[sideOfItem(o)].push({ price, book });
          if (o.isMain) g.main = true;
          grouped.set(key, g);
        } else {
          const line = parseNumber(o.line ?? o.value ?? o.threshold ?? o.point ?? o.handicap ?? o.total);
          if (line == null) continue;
          const mk = marketAt(market, line);
          if (!mk) continue;
          legacy.push({
            market: mk, line,
            odds: parseOdds(o.overOdds ?? o.over ?? o.overPrice ?? o.odds ?? o.price ?? o.americanOdds ?? o.yesOdds),
            underOdds: parseOdds(o.underOdds ?? o.under ?? o.underPrice ?? o.noOdds),
            book: o.book || o.sportsbook || o.bookmaker || o.provider || null, books: 1, isMain: true,
          });
        }
      }
    }
    const best = (sides) => sides.filter((x) => x.price != null).sort((a, b) => b.price - a.price)[0] || null;
    // How far from a toss-up the book prices a line: the over's implied probability (the vig split when
    // both sides are priced) against 0.5, rounded to a point so -110 / -105 and -115 / -105 read alike.
    const overProb = (x) => { const o = x.odds != null ? impliedProb(x.odds) : null; const u = x.underOdds != null ? 1 - impliedProb(x.underOdds) : null; return o != null && u != null ? (o + u) / 2 : o ?? u; };
    const balance = (x) => { const p = overProb(x); return p == null ? 1 : Math.round(Math.abs(p - 0.5) * 100) / 100; };
    const priced = (g) => { const over = best(g.over); const under = best(g.under); return !over && !under ? null : { line: g.line, odds: over?.price ?? null, underOdds: under?.price ?? null, book: over?.book || under?.book || null, books: new Set([...g.over, ...g.under].map((x) => x.book).filter(Boolean)).size, main: g.main }; };
    const out = [];
    // One line per market: of the main lines the one the book prices nearest a coin flip (an alternate
    // ladder's rung, flagged main or not, is priced at -2000 / +900), then the one priced both ways by
    // the most books (a lone book's one-sided "main" is a rung), the one nearest his own average on a tie.
    const byMarket = new Map();
    for (const g of grouped.values()) { const row = priced(g); if (!row) continue; const list = byMarket.get(g.market) || []; list.push(row); byMarket.set(g.market, list); }
    for (const [market, all] of byMarket) {
      all.sort((a, b) => a.line - b.line);
      // A ladder's prices fall as the line rises: a line priced well under a higher one of the same market is another
      // market's line filed under it (2026-11-07: a 25-point scorer's o5.5 at -143 between o3.5 at -24900 and o7.5 at
      // -6150, read as the main line with a +68.6% edge). The line in the most such clashes (over 15 points of implied
      // chance) leaves first, until none is left, so one stray line never takes the good ones with it.
      const lines = [...all];
      for (;;) {
        const pr = lines.map(overProb);
        const clash = lines.map(() => 0);
        for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) if (pr[i] != null && pr[j] != null && pr[j] > pr[i] + LADDER_CLASH) { clash[i]++; clash[j]++; }
        const worst = clash.reduce((b, c, i) => (c > clash[b] ? i : b), 0);
        if (!clash[worst]) break;
        // Of two in one clash, the one off the line the most books price (the stray is the lone book's) leaves.
        const tied = clash.map((c, i) => (c === clash[worst] ? i : -1)).filter((i) => i >= 0);
        const out = tied.sort((a, b) => lines[a].books - lines[b].books || a - b)[0];
        lines.splice(out, 1);
      }
      if (!lines.length) continue;
      const avg = avgOf(market);
      // A line under 40% of his own average (4 a game and up) is a rung or another market's line, never the night's:
      // it stays on the ladder, out of the pick while any other line is left.
      const sane = avg != null && avg >= 4 ? lines.filter((x) => x.line >= 0.4 * avg) : lines;
      const fair = sane.length ? sane : lines;
      const mains = fair.filter((x) => x.main);
      const pool = mains.length ? mains : fair;
      const dist = (x) => (avg == null ? 0 : Math.abs(x.line - avg));
      const sides = (x) => (x.odds != null ? 1 : 0) + (x.underOdds != null ? 1 : 0);   // a real main line is priced both ways
      const mid = pool[Math.floor((pool.length - 1) / 2)].line;
      const pick = [...pool].sort((a, b) => balance(a) - balance(b) || sides(b) - sides(a) || b.books - a.books || dist(a) - dist(b) || Math.abs(a.line - mid) - Math.abs(b.line - mid) || a.line - b.line)[0];
      const { main, ...rest } = pick;
      const row = { market, ...rest, isMain: main };
      if (lines.length > 1) row.lines = lines.map(({ line, odds, underOdds, books, main: m }) => ({ line, odds, underOdds, books, main: m }));
      out.push(row);
    }
    return [...out, ...legacy];
  }

  /** The pull's player list in the stored shape: { id, name, key, team, pos, status, games (newest first), props }. */
  /**
   * The book's first-basket price on a player (First Basket, 2026-10-27): the items whose market
   * names a first basket / first field goal (not a team's, not first points), the best price with
   * the books behind it; null without one. Read beside `playerProps`, never filed as a market.
   */
  const FIRST_BASKET = /\bfirst\s+(basket|field\s+goal|fg)\b|\bfirst\s+(basket|field\s+goal)\s+scorer\b/i;
  function firstBasketOdds(p) {
    const lists = [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds].filter(Array.isArray);
    const prices = [];
    for (const list of lists) for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const name = `${o.market || o.marketName || o.statType || o.propType || o.name || o.type || ''} ${o.categoryMapping || o.category || ''}`;
      if (!FIRST_BASKET.test(words(name)) || /\bteam\b|\bpoints?\b|\bq[2-4]\b|2nd|3rd|4th|half/i.test(words(name))) continue;
      if (/under|^no$/i.test(String(o.selectionLine ?? o.side ?? ''))) continue;
      const price = parseOdds(o.price ?? o.odds ?? o.americanOdds ?? o.yesOdds ?? o.overOdds);
      if (price == null) continue;
      prices.push({ price, book: o.sportsbook || o.book || o.bookmaker || o.provider || null });
    }
    if (!prices.length) return null;
    prices.sort((a, b) => b.price - a.price);
    return { odds: prices[0].price, book: prices[0].book, books: new Set(prices.map((x) => x.book).filter(Boolean)).size || prices.length };
  }

  // Everything else PropFinder sends (`keepExtra`, the NFL since 2026-11-01: "we need to load all PropFinder data"), kept
  // beside the board's file as `extra`: per player his own fields, every game row's figures the board's row does not read
  // (the other quarters and halves, the defense's and the kicker's details, the shares …; 0s and nulls left out), and the
  // lines of the markets the board does not settle (the fantasy score, the other quarters); per team every stats row as
  // published (each window, position and slot, PropFinder's ranks in).
  // The keys the board's own row takes (gameRow): everything else on a game row — the win, the margin, the division
  // game, the other quarters … — is kept.
  const ROW_KEYS = ['gameDate', 'date', 'gameDay', 'gameId', 'season', 'seasonYear', 'seasonType', 'gameType', 'isHomeGame', 'isHome', 'home', 'opponent', 'opponentTeam', 'opponentAbbreviation', 'opposingTeamCode', 'opponentCode', 'opp', 'week', 'weekNumber'];
  const READ_KEYS = new Set([...Object.values(FIELDS).flat(), ...ROW_KEYS]);
  const TEXT_KEYS = new Set(['id', 'name', 'jersey', 'position', 'fullPosition', 'srId', 'teamId', 'gameId', 'playerId', 'opposingTeamId', 'opposingTeamName', 'opposingTeamCode', 'teamCode', 'playerName', 'fullName', 'playerPosition', 'primaryPosition']);
  const figuresOf = (row, skip) => { const x = {}; if (!row) return x; for (const k in row) { if (skip.has(k)) continue; const v = row[k]; if (v === true) x[k] = true; else if (typeof v === 'number' && v !== 0 && Number.isFinite(v)) x[k] = v; } return x; };
  const GAME_SKIP = new Set([...READ_KEYS, ...TEXT_KEYS]);
  function gameExtra(g) { const x = figuresOf(g, GAME_SKIP); return Object.keys(x).length ? x : null; }
  /** The lines of the markets the board does not settle: { "<market> [<category>]": [{ line, odds, underOdds, books }] }. */
  function otherProps(p) {
    const lists = [p.odds, p.props, p.markets, p.playerProps, p.lines, p.propOdds].filter(Array.isArray);
    const by = new Map();
    for (const list of lists) for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const line = parseNumber(o.points ?? o.line ?? o.value ?? o.threshold ?? o.handicap);
      const m = marketOfItem(o);
      if (m && (line == null || marketAt(m, line))) continue;
      const name = String(o.market || o.marketName || o.statType || o.propType || o.name || '');
      const cat = String(o.categoryMapping || o.category || '');
      const k = `${name}${cat && cat !== name ? ` [${cat}]` : ''}`;
      const lines = by.get(k) || new Map();
      const g = lines.get(line) || { line, over: [], under: [], books: new Set() };
      const price = parseOdds(o.price ?? o.odds ?? o.americanOdds);
      if (price != null) g[sideOfItem(o)].push(price);
      if (o.sportsbook || o.book) g.books.add(o.sportsbook || o.book);
      lines.set(line, g); by.set(k, lines);
    }
    const out = {};
    for (const [k, lines] of by) out[k] = [...lines.values()].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)).map((g) => ({ line: g.line, odds: g.over.length ? Math.max(...g.over) : null, underOdds: g.under.length ? Math.max(...g.under) : null, books: g.books.size }));
    return Object.keys(out).length ? out : null;
  }
  /** `extra` for the pull: { players: { <id>: { name, team, info, games: { <gameId | date>: figures }, otherProps } }, teams: { ABBR: { id, rows } }, counts }. */
  function extraOf(raw, teams) {
    const players = {}; let games = 0; let other = 0; let offBoard = 0;
    for (const p of raw || []) {
      if (!p?.name) continue;
      const info = {};
      for (const [k, v] of Object.entries(p)) {
        if (['stats', 'odds', 'props', 'markets', 'playerProps', 'lines', 'propOdds', 'team', 'name', 'readFor', 'offBoard'].includes(k) || v == null || v === '') continue;
        if (Array.isArray(v)) { if (v.length) info[k] = v; } else if (typeof v === 'object') { if (Object.keys(v).length) info[k] = v; } else info[k] = v;
      }
      const g = {};
      for (const row of p.stats || []) { const x = gameExtra(row); if (!x) continue; g[String(row.gameId ?? row.id ?? String(row.gameDate || '').slice(0, 10))] = x; games++; }
      const op = otherProps(p);
      if (op) other++;
      // A rostered player the odds-only call left out (`rosterExtra`) carries his whole logs here, read as the board reads a game row.
      const logs = p.offBoard ? (p.stats || []).map(gameRow).filter((x) => x.date && !/^pre/i.test(String(x.type || ''))).sort((a, b) => b.date.localeCompare(a.date)) : null;
      if (p.offBoard) offBoard++;
      players[String(p.id ?? normName(p.name))] = { name: p.name, team: teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) || null, info, ...(p.offBoard ? { offBoard: true, logs } : {}), ...(Object.keys(g).length ? { games: g } : {}), ...(op ? { otherProps: op } : {}) };
    }
    const byTeam = {}; let rows = 0;
    for (const t of teams || []) {
      const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
      if (!abbr) continue;
      const list = (t.stats || []).map((r) => { const keep = {}; for (const k in r) { const v = r[k]; if (v != null && v !== '' && v !== 0 && k !== 'id' && k !== 'teamId') keep[k] = v; } return keep; });
      rows += list.length;
      const { stats, ...rest } = t;
      byTeam[abbr] = { id: t.id ?? null, info: Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null && v !== '' && typeof v !== 'object')), rows: list };
    }
    return { players, teams: byTeam, counts: { players: Object.keys(players).length, games, otherProps: other, teams: Object.keys(byTeam).length, teamRows: rows, ...(offBoard ? { offBoard } : {}) } };
  }

  function mapPlayers(players) {
    const out = [];
    for (const p of players || []) {
      if (!p?.name) continue;
      // Preseason rows (seasonType PRE, short minutes) are left out: they dragged LeBron's last-ten
      // average, and with it his main line, to o14.5 points on 2026-10-20.
      const games = (p.stats || []).map(gameRow).filter((g) => g.date && !/^pre/i.test(String(g.type || ''))).sort((a, b) => b.date.localeCompare(a.date));
      // His average for a market over his last ten games, the main line's anchor.
      const avgOf = (market) => { const v = games.slice(0, 10).map((g) => markets.statOf(g, market)).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      const firstBasket = firstBasketOdds(p);
      out.push({ id: p.id || null, name: p.name, key: normName(p.name), team: teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) || null, pos: posOf(p), status: p.status || null, injury: p.injury?.status || p.injuryStatus || null, games, props: playerProps(p, avgOf), ...(firstBasket ? { firstBasket } : {}), ...(p.readFor ? { readFor: p.readFor } : {}) });
    }
    return out;
  }

  /** The keys the API used, so an unread spelling shows after the first pull; `injuries` adds the report's first item and the games payload's keys. */
  function fieldsSeen(players, teams, injuries = null) {
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
    if (injuries?.sample) sample.injury = clip(injuries.sample, 900);
    if (injuries?.keys?.length) sample.gamesPayload = injuries.keys.join(', ');
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
    // With `keepExtra` the keys the board does not read are stored as sent (the pull's `extra`): listed as `stored`, not as unread.
    return { game: [...game].sort(), player: [...player].sort(), prop: [...prop].sort(), teamRow: [...teamRow].sort(), unread: keepExtra ? [] : unread.sort(), ...(keepExtra ? { stored: unread.sort() } : {}), sample, markets };
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

  /**
   * A team's depth chart from its players' own slots, for a sport whose team objects carry none
   * (`depthFromPlayers`, the NFL: the pull of 2026-10-31 had `depthCharts: 0` for 28 teams while every
   * player object carried `fullPosition` "WR1" / "RB2" / "TE1", and the defense rows are kept per slot,
   * WR1 … TE1, so without it every receiver read the WR table): { WR: [{ name, key, depth: 1, … }] } in
   * the depthChart shape (slot letters + depth, the chip reads "WR1"), the sport's positions only; null
   * when no player of the team carries one. The game rows' own fullPosition is empty, never read.
   */
  function depthFromRoster(players, abbr) {
    const out = {};
    for (const p of players || []) {
      const team = teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName);
      const m = String(p.fullPosition || '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
      if (team !== abbr || !m || !(positions || []).includes(m[1]) || !p.name) continue;
      (out[m[1]] = out[m[1]] || []).push({ name: p.name, key: normName(p.name), depth: Number(m[2]), status: p.status || null, starter: null, injury: null, id: p.id ?? null });
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.depth - b.depth);
    return Object.keys(out).length ? out : null;
  }

  /** A team's stats row for a season, position and window (null = the full season). */
  function pickRow(stats, { season, position, lastN = null, type = 'Opponent' }) {
    // The NBA rows carry seasonYear, the NFL rows year; a full-season row has lastNGames 0 or none.
    const rows = (stats || []).filter((r) => n(r.seasonYear ?? r.season ?? r.year) === season && (r.type || 'Team') === type && String(r.position || 'All').toUpperCase() === position.toUpperCase()
      && (!r.seasonType || /^reg/i.test(String(r.seasonType))) && (lastN ? n(r.lastNGames) === lastN : !r.lastNGames) && n(r.gamesPlayed ?? r.games ?? r.gp) > 0);
    rows.sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')));
    return rows[0] || null;
  }

  /**
   * What every team allows per position per game ({ ABBR: { <pos>: { gp, <stat>… } } }) with ranks
   * (1 = the most allowed, ties shared), for the positions the rows carry. The table is this
   * season's as PropFinder publishes it (Vincent, 2026-10-27: the Season table reads this season
   * for every sport, never last season's and never a blend of the two; the ten-game hold and the
   * games / (games + 15) blend that stood here are gone). Last season's full row stands in only
   * for a team without a game this season yet (`held: true`, `season` last season's, `prior` its
   * games), and the UI says so. `gp` is this season's count.
   * Last season's full table rides along as `prior: { season, teams, ranks, league, count }`, the tab the
   * court and the card compare this season's against; `totals[ABBR]` also carries `l10` (both All rows
   * at lastN 10 this season, the characteristics card's trend line) and `prior` (both last season in full).
   * The last-N windows PropFinder publishes (lastNGames 5 / 10 / 15 / 20, this season's rows as they
   * are, no blend) ride along as `windows: { l5: { teams, ranks, count }, … }`, each ranked on its
   * own, and `league` carries the league's average per position and stat for the season table and
   * every window (the environment a player's projection is read against). `totals[ABBR]` = { for:
   * the team's own per-game row (type Team, All), against: what it gives up in all, l10: both over its
   * last ten this season, prior: both last season in full } by the same rule, `leagueFor` the league's
   * average of the `for` rows: the team's expected total tonight.
   */
  function defenseAllowed(teams, { season }) {
    const per = {};
    const totals = {};
    const seen = new Set();
    /** This season's row as published; last season's stands in (`held`) only until the team's first game. */
    const seasonRow = (cur, last) => {
      if (cur) return perGame(cur);
      if (!last) return null;
      const prior = perGame(last);
      return { ...prior, gp: 0, prior: prior.gp, priorSeason: prior.season, season: prior.season, held: true };
    };
    // The allowed stats some team row of this pull carries: PropFinder leaves a stat off a row when
    // the figure is zero (2026-10-30: WSH, LAL and HOU had allowed no blocks to point guards and their
    // PG rows had no `blocks` key, so the board had no cell there and the matchup read as no table),
    // so a key other rows carry is read as 0 where a row lacks it. A key no row carries stays unread
    // (`fieldsSeen.unread` names it), never a guessed 0.
    const known = new Set();
    for (const t of teams || []) for (const r of t.stats || []) for (const key of allowed) if (firstOf(r, FIELDS[key] || []) != null) known.add(key);
    // A team row's figures: per game already (`rowsPerGame`, the NBA: points 117.8 on an 82-game
    // row, seen 2026-10-20) or season totals divided by the games.
    const perGame = (r) => {
      const gp = n(r.gamesPlayed ?? r.games ?? r.gp);
      const row = { gp, season: n(r.seasonYear ?? r.season ?? r.year) };
      const missing = [];
      for (const key of allowed) { const v = firstOf(r, FIELDS[key] || []); if (v != null) row[key] = r2(rowsPerGame ? n(v) : n(v) / gp); else if (known.has(key)) missing.push(key); }
      // A row with figures reads 0 for the known stats it leaves out; a row with none stays empty.
      if (missing.length && allowed.some((key) => row[key] != null)) for (const key of missing) row[key] = 0;
      return deriveAllowed(row, r, gp);
    };
    const priorPer = {};
    for (const t of teams || []) {
      const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
      if (!abbr) continue;
      const rows = {}; const lastRows = {};
      const posHere = [...new Set((t.stats || []).filter((r) => (r.type || '') === 'Opponent').map((r) => String(r.position || 'All').toUpperCase()).filter((p) => p !== 'ALL'))];
      for (const pos of posHere) {
        const last = pickRow(t.stats, { season: season - 1, position: pos });
        const row = seasonRow(pickRow(t.stats, { season, position: pos }), last);
        if (!row) continue;
        rows[pos] = row;
        if (last) lastRows[pos] = perGame(last);
        seen.add(pos);
      }
      if (Object.keys(rows).length) per[abbr] = rows;
      if (Object.keys(lastRows).length) priorPer[abbr] = lastRows;
      // The team's own totals (type Team, All) and what it gives up in all (type Opponent, All), the
      // same rule: the side's projections are scaled to add up to the team's expected total tonight.
      // Its last ten this season and last season in full ride along for the characteristics card.
      const lastFor = pickRow(t.stats, { season: season - 1, position: 'All', type: 'Team' });
      const lastAgainst = pickRow(t.stats, { season: season - 1, position: 'All' });
      const forRow = seasonRow(pickRow(t.stats, { season, position: 'All', type: 'Team' }), lastFor);
      const againstRow = seasonRow(pickRow(t.stats, { season, position: 'All' }), lastAgainst);
      if (forRow || againstRow) {
        const l10For = pickRow(t.stats, { season, position: 'All', type: 'Team', lastN: 10 });
        const l10Against = pickRow(t.stats, { season, position: 'All', lastN: 10 });
        totals[abbr] = {
          for: forRow, against: againstRow,
          l10: l10For || l10Against ? { for: l10For ? perGame(l10For) : null, against: l10Against ? perGame(l10Against) : null } : null,
          prior: lastFor || lastAgainst ? { for: lastFor ? perGame(lastFor) : null, against: lastAgainst ? perGame(lastAgainst) : null } : null,
        };
      }
    }
    const prior = Object.keys(priorPer).length ? { season: season - 1, teams: priorPer, ...rankTable(priorPer, seen), count: Object.keys(priorPer).length } : null;
    const leagueFor = {};
    for (const key of new Set(Object.values(totals).flatMap((t) => Object.keys(t.for || {})))) {
      if (META.includes(key)) continue;
      const have = Object.values(totals).map((t) => t.for?.[key]).filter((v) => v != null);
      if (have.length) leagueFor[key] = r2(have.reduce((a, b) => a + b, 0) / have.length);
    }
    const windows = {};
    for (const lastN of WINDOWS) {
      // A window PropFinder publishes, this season or last (a team short of it reads its season row below); none, no tab.
      if (!(teams || []).some((t) => (t.stats || []).some((r) => n(r.lastNGames) === lastN && [season, season - 1].includes(n(r.seasonYear ?? r.season ?? r.year))))) continue;
      const w = {};
      for (const t of teams || []) {
        const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
        if (!abbr) continue;
        const rows = {};
        for (const pos of seen) {
          // A team short of N games this season has no last-N row yet (2026-11-02: ATL on 8 games read its L10 tab off
          // last season's last ten, "10 GP"): its games this season are its last N, so the season's row stands in
          // (`short`); last season's last N only for a team without a game this season.
          let r = pickRow(t.stats, { season, position: pos, lastN });
          let short = false;
          if (!r) {
            const full = pickRow(t.stats, { season, position: pos });
            if (full && n(full.gamesPlayed ?? full.games ?? full.gp) < lastN) { r = full; short = true; }
            else r = pickRow(t.stats, { season: season - 1, position: pos, lastN });
          }
          if (r) rows[pos] = { ...perGame(r), lastN, ...(short ? { short: true } : {}) };
        }
        if (Object.keys(rows).length) w[abbr] = rows;
      }
      if (Object.keys(w).length) windows[`l${lastN}`] = { teams: w, ...rankTable(w, seen), count: Object.keys(w).length, lastN, season: Math.max(...Object.values(w).flatMap((rows) => Object.values(rows).map((r) => r.season || 0))) || null };
    }
    return { teams: per, ...rankTable(per, seen), count: Object.keys(per).length, positions: [...seen], windows, prior, totals, leagueFor };
  }

  const META = ['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held', 'short'];

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
   * The injury report from the live API: the games payload's `injuryReport` first (every team), else
   * the per-team route for the slate's teams. { rows, source: 'v2' | 'teams' | null, error, keys, sample }:
   * never a throw, the pull goes on without it and the report says why.
   */
  async function fetchInjuries({ teams, byAbbr, slateAbbrs, get = pfGetJson }) {
    if (injuryReport === 'espn') return { rows: [], source: 'espn', keys: [], sample: null, errors: [] };
    const byId = new Map((teams || []).map((t) => [String(t.id), t]));
    const teamOf = (id, code) => { const t = id != null ? byId.get(String(id)) : null; return (t && teamAbbrFromText(t.code || t.abbreviation || t.fullName)) || (code ? teamAbbrFromText(code) : null) || null; };
    const errors = [];
    try {
      const v2 = await get(`/${league}/v2?${BOOKS.map((b) => `sportsbooks=${b}`).join('&')}`);
      const raw = v2?.injuryReport ?? v2?.injuryReports ?? v2?.injuries ?? null;
      const keys = v2 && typeof v2 === 'object' ? Object.keys(v2) : [];
      const rows = parseInjuryReport(raw, { teamOf });
      let parsed = raw; if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = null; } }
      const first = Array.isArray(parsed) ? parsed[0] : Array.isArray(parsed?.data) ? parsed.data[0] : null;
      if (rows.length) return { rows, source: 'v2', keys, sample: first || null, errors };
      errors.push(`the games payload carried no injury report (keys: ${keys.join(', ') || 'none'})`);
    } catch (err) { errors.push(`games payload: ${err?.message || err}`); }
    // Per team, the route the site's WNBA pages use; one refusal is the route's answer.
    const rows = []; let answered = 0; let sample = null;
    for (const a of slateAbbrs || []) {
      const t = byAbbr?.[a];
      if (t?.id == null) continue;
      try {
        const got = await get(`/injuries/${league.toLowerCase()}/${encodeURIComponent(t.id)}`);
        const list = Array.isArray(got) ? got : Array.isArray(got?.data) ? got.data : null;
        if (!list) { errors.push(`injuries/${a}: not a list`); break; }
        answered++; sample = sample || list[0] || null;
        rows.push(...parseInjuryReport(list, { team: a }));
      } catch (err) { errors.push(`injuries/${a}: ${err?.message || err}`); break; }
    }
    if (answered) return { rows, source: 'teams', keys: [], sample, errors };
    return { rows: [], source: null, keys: [], sample: null, errors, error: errors.join('; ') };
  }

  /** Each player's injury status: the report's row (by id, then by team + name), else the depth chart's flag, else his own field. */
  function applyInjuries(players, rows, depth = {}) {
    // A row the logs have overtaken (he played after it was written) is left aside, named on the player.
    markStale(rows, players);
    const byId = new Map(); const byKey = new Map();
    for (const r of rows || []) { if (r.id != null) byId.set(String(r.id), r); byKey.set(`${r.team || ''}|${r.key}`, r); if (!byKey.has(`|${r.key}`)) byKey.set(`|${r.key}`, r); }
    const fromDepth = new Map();
    for (const [team, slots] of Object.entries(depth || {})) for (const list of Object.values(slots || {})) for (const x of list || []) if (x.injury) fromDepth.set(`${team}|${x.key}`, x.injury);
    for (const p of players || []) {
      const r = (p.id != null && byId.get(String(p.id))) || byKey.get(`${p.team || ''}|${p.key}`) || byKey.get(`|${p.key}`) || null;
      if (r && r.stale) { p.injury = null; p.injuryDetail = null; p.injuryFrom = 'report-stale'; p.injuryStale = { status: r.status, raw: r.raw ?? null, detail: r.detail ?? null, date: r.date ?? null, playedOn: r.stale.playedOn }; continue; }
      if (r) { p.injury = r.status; p.injuryDetail = r.detail; p.injuryFrom = 'report'; p.injuryRaw = r.raw ?? null; p.injuryDate = r.date ?? null; continue; }
      const d = fromDepth.get(`${p.team}|${p.key}`);
      if (d) { p.injury = statusOf(d); p.injuryFrom = 'depth'; p.injuryRaw = String(d); }
    }
    return players;
  }

  /**
   * One read each of the PropFinder page routes the env names, never a throw: PropFinder's Rotations
   * and Lineup Lab pages sit behind the login and their routes are not known, so
   * PROPFINDER_<LEAGUE>_SAMPLE_PATHS ("rotations=/NBA/…;lineups=/NBA/…", `{teamIds}` the slate's team
   * ids, `{date}` the ET date, `{season}` / `{week}` the slate's; PROPFINDER_<LEAGUE>_ROTATIONS_PATH names the rotations one alone)
   * is read once a pull and each answer's keys and first 2000 characters ride on the pull as
   * `samples[name]`, shown under Data sources, so a reader can be written from what the page sends.
   * { name: { path, keys, count, sample, error } } or null when nothing is named.
   */
  async function fetchSamples({ slateAbbrs, byAbbr, at, season = null, week = null, get = pfGetJson, env = process.env, keep = pages }) {
    const named = Object.entries(keep || {});
    if (env[`PROPFINDER_${league}_ROTATIONS_PATH`]) named.push(['rotations', env[`PROPFINDER_${league}_ROTATIONS_PATH`]]);
    for (const part of String(env[`PROPFINDER_${league}_SAMPLE_PATHS`] || '').split(/[;,]/)) { const m = part.trim().match(/^([\w-]+)\s*=\s*(\S+)$/); if (m && !named.some(([n]) => n === m[1])) named.push([m[1], m[2]]); }
    if (!named.length) return null;
    const ids = (slateAbbrs || []).map((a) => byAbbr[a]?.id).filter((x) => x != null);
    const clip = (o, n = 2000) => { try { const t = JSON.stringify(o); return t.length > n ? `${t.slice(0, n)}…` : t; } catch { return null; } };
    const out = {};
    for (const [name, tpl] of named) {
      const path = tpl.replace('{teamIds}', ids.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')).replace('{date}', String(at).slice(0, 10)).replaceAll('{season}', String(season ?? '')).replaceAll('{week}', String(week ?? ''));
      // A route that needs the week reads nothing without one (a slate with no week number).
      if (/[?&]week=(&|$)/.test(path)) { out[name] = { path, keys: [], count: null, sample: null, error: 'no week' }; continue; }
      try {
        const got = await get(path);
        const first = Array.isArray(got) ? got[0] : got && typeof got === 'object' ? got : null;
        out[name] = { path, keys: first && typeof first === 'object' ? Object.keys(first) : [], count: Array.isArray(got) ? got.length : null, sample: clip(got), error: null };
        // A page the league keeps (`pages`: its cheat sheets) rides whole on the pull's data, for the readers and the backtests.
        if (keep?.[name]) out[name].data = got;
      } catch (err) { out[name] = { path, keys: [], count: null, sample: null, error: err?.message || String(err) }; }
    }
    return out;
  }

  /**
   * Pull the slate: the teams playing, their players with logs and prop lines, every team's
   * defense rows, and the injury report. Returns the file the store writes for the slate.
   */
  async function pullSlate({ season, games, at = new Date().toISOString(), week = null }) {
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
    // `rosterExtra` (the NBA, 2026-11-01): every rostered player, the ones the books have not priced kept with the extra
    // (their logs and figures, `offBoard`), never on the board, whose minutes and team scale read the priced players.
    let rosterOnly = [];
    if (keepExtra && rosterExtra && hydrate && raw.length) {
      // Two teams a call, each answer cut to the players the priced call did not list before the next is read: the
      // logs reach back two seasons, so a whole roster's answer beside the priced one would double the pull's heap.
      const priced = new Set(raw.map((p) => String(p.id)));
      for (const ch of chunks(ids, 2)) {
        try {
          const got = await pfGetJson(`/${league}/players?${ch.map((id) => `teamIds=${encodeURIComponent(id)}`).join('&')}&hydrate=stats`);
          if (Array.isArray(got)) for (const p of got) if (p?.name && !priced.has(String(p.id))) rosterOnly.push(p);
        } catch (err) { console.error(`[${league}] the roster call for the extra was refused:`, err?.message || err); break; }
      }
    }
    // The injury report, live. The players it lists out for the slate's teams whom the odds-only
    // call left out (the books pull a sidelined player's lines) are read one by one: their logs say
    // which games they took part in, the key to the without-teammate splits.
    const injuries = await fetchInjuries({ teams, byAbbr, slateAbbrs });
    // `rosterOnBoard` (the NBA, 2026-11-02; Vincent, of IND with ten players out: "why the hell do I only have 2 players
    // listed for Indiana???"): the unpriced rostered players join the board too, with their logs and no lines, so the
    // players taking the minutes of a team's absentees have a projection before the books price them; the minutes, the
    // team scale and the vacated lifts then read the whole roster, as the audits' replays (every player of ESPN's logs) do.
    const board = rosterOnBoard ? [...raw, ...rosterOnly] : raw;
    const have = new Set(board.map((p) => String(p.id))); const haveKey = new Set(board.map((p) => normName(p.name)));
    const want = injuries.rows.filter((r) => slateAbbrs.includes(r.team) && isOut(r.status) && r.id != null && !have.has(String(r.id)) && !haveKey.has(r.key)).slice(0, MAX_ABSENT_READS);
    const fetched = []; const missing = [];
    for (const r of want) {
      try {
        const path = `/${league}/player/${encodeURIComponent(r.id)}`;
        const got = await pfGetJson(path);
        let p = got?.player && typeof got.player === 'object' ? got.player : got;
        // The site's player pages read the logs off the plain call; an answer without them is asked again with the players route's hydrate.
        if (p && typeof p === 'object' && !Array.isArray(p.stats)) { const again = await pfGetJson(`${path}?hydrate=stats`).catch(() => null); const q = again?.player && typeof again.player === 'object' ? again.player : again; if (Array.isArray(q?.stats)) p = q; }
        if (p && typeof p === 'object' && (p.name || p.fullName)) { const read = { ...p, name: p.name || p.fullName, team: p.team || { code: r.team }, readFor: 'injury' }; raw.push(read); if (board !== raw) board.push(read); fetched.push(r.name); }
        else missing.push(`${r.name} (no player in the answer)`);
      } catch (err) { missing.push(`${r.name} (${err?.message || err})`); }
    }
    const players = mapPlayers(board);
    const defense = defenseAllowed(teams, { season });
    const pace = paceTable(teams, { season });
    const depth = {};
    let depthFrom = null;
    for (const a of slateAbbrs) {
      let d = depthChart(byAbbr[a]);
      if (d) depthFrom = depthFrom || 'teams';
      else if (depthFromPlayers && (d = depthFromRoster(board, a))) depthFrom = depthFrom === 'teams' ? 'both' : 'players';
      if (d) depth[a] = d;
    }
    applyInjuries(players, injuries.rows, depth);
    // PropFinder's Rotations page (Vincent, 2026-10-27): its route is not known yet, and the minutes the
    // board reads come from the logs (lib/picks/rotations.js). When PROPFINDER_<LEAGUE>_ROTATIONS_PATH
    // names the route on Render ({teamIds} and {date} filled in), the answer rides along as a sample
    // with its keys under Data sources, so the read can be written from what the page really sends.
    const sampled = await fetchSamples({ slateAbbrs, byAbbr, at, season, week });
    // The kept pages (the league's `pages`, PropFinder's cheat sheets) whole on `data.pages`, their keys and a sample on `samples`.
    const pagesData = {}; let samples = null;
    if (sampled) { samples = {}; for (const [k, v] of Object.entries(sampled)) { const { data: d, ...meta } = v; samples[k] = meta; if (d !== undefined) pagesData[k] = d; } }
    // The extra is built and stored a team at a time by the store (one file a team: the whole of it outgrew the bucket's
    // 15 MB file limit and 400 MB of heap on a pull of 3,777 players): `of(abbr)` → that team's players and rows.
    const extra = keepExtra ? {
      abbrs: [...new Set(teams.map((t) => teamAbbrFromText(t.code || t.abbreviation || t.fullName)).filter(Boolean))],
      of: (abbr) => extraOf([...raw, ...rosterOnly.map((p) => ({ ...p, offBoard: true }))].filter((p) => teamAbbrFromText(p.team?.code || p.team?.abbreviation || p.teamCode || p.team?.fullName) === abbr), teams.filter((t) => teamAbbrFromText(t.code || t.abbreviation || t.fullName) === abbr)),
    } : null;
    const slateRows = injuries.rows.filter((r) => slateAbbrs.includes(r.team));
    const injuryMeta = { source: injuries.source, count: injuries.rows.length, slate: slateRows.length, out: slateRows.filter((r) => isOut(r.status) && !r.stale).length, stale: slateRows.filter((r) => r.stale).map((r) => `${r.name} (${r.status} on ${String(r.date).slice(0, 10)}, played ${r.stale.playedOn})`), fetched, missing, error: injuries.error || null, errors: injuries.errors || [] };
    return {
      ok: true, at, season, source: SOURCE, hydrate, teams: slateAbbrs.length, missingTeams, players: players.length,
      withProps: players.filter((p) => p.props.length).length, withGames: players.filter((p) => p.games.length).length,
      defenseTeams: defense.count, depthCharts: Object.keys(depth).length, ...(depthFrom ? { depthFrom } : {}), injuries: injuryMeta, samples, fieldsSeen: fieldsSeen(raw, teams, injuries),
      ...(pace ? { paceTeams: pace.count } : {}),
      data: { players, defense, depth, injuries: { at, source: injuries.source, rows: injuries.rows }, ...(pace ? { pace } : {}), ...(extra ? { extra } : {}), ...(Object.keys(pagesData).length ? { pages: pagesData } : {}) },
    };
  }

  /**
   * Every team's pace from PropFinder's team objects (`paceStats`, one row a season: possessions a game with its rank,
   * offensive and defensive efficiency, assist and turnover rates): this season's row, last season's standing in for a
   * team without one (`held`). { teams: { ABBR: { season, pace, rank, offEff, offRank, defEff, defRank, held } },
   * league (the teams' mean pace), count } or null when no team carries it (the NHL and NFL objects).
   */
  function paceTable(teams, { season }) {
    const out = {};
    for (const t of teams || []) {
      const abbr = teamAbbrFromText(t.code || t.abbreviation || t.fullName);
      const rows = Array.isArray(t.paceStats) ? t.paceStats.filter((r) => Number.isFinite(Number(r?.pace))) : [];
      if (!abbr || !rows.length) continue;
      const mine = rows.find((r) => Number(r.season) === season) || null;
      const row = mine || [...rows].sort((a, b) => Number(b.season) - Number(a.season))[0];
      out[abbr] = { season: Number(row.season), pace: Number(row.pace), rank: row.paceRanking ?? null, offEff: row.offEff ?? null, offRank: row.offEffRanking ?? null, defEff: row.defEff ?? null, defRank: row.defEffRanking ?? null, ...(mine ? {} : { held: true }) };
    }
    const vals = Object.values(out).map((r) => r.pace);
    if (!vals.length) return null;
    return { teams: out, league: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length };
  }

  return { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, depthChart, depthFromRoster, extraOf, otherProps, marketOfItem, fetchInjuries, fetchSamples, applyInjuries, pullSlate, paceTable, positions };
}
