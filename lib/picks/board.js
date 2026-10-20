// The board, pure and shared by the sports: the slate's games, the cheat sheets' rows,
// PropFinder's logs and lines and the finished games' box scores → the best plays per game
// in the sport's tables, each row with the chance of the hit, its break-even price, the
// book's price and the edge, graded once the game is stored.
//
// The chance is a hit-rate read, not a model: how often the player cleared the line in his
// last 5 / last 10 / the season (PropFinder's logs when the slate was pulled, else the sheet's
// own hit columns), the windows blended (L5 0.3, L10 0.3, season 0.4, renormalised over what
// exists) and shrunk toward the book's implied probability at n / (n + 6) (toward a coin flip
// without a price): early-season rates are mostly noise, and the price already carries the
// market's read. Form (flame / snowflake) and the soft spot (the opponent in the softest third
// at the position for the market's stat) are colour only, as on the NHL board.
//
// PropFinder comes first: once the slate has a PropFinder pull, a table is filled from the plays
// PropFinder backs (its logs or its line); a play only a cheat sheet carries fills in behind
// them, marked `sheetOnly`. A sheet is confirmation: a PropFinder play the sheet also lists is
// marked `confirmed` (and wins a tie on the chance).
import { impliedProb, fairOdds } from '../nfl/odds';
import { normName } from '../nhl-data/names';
import { ownRate, envFactor } from './projection';

/** The standard normal's upper tail, P(Z > z) (Abramowitz–Stegun 7.1.26, error under 1.5e-7). */
export function upperTail(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  const upper = 0.5 * (1 - erf);
  return z >= 0 ? upper : 1 - upper;
}

export const WEIGHTS = { l5: 0.3, l10: 0.3, season: 0.4 };
export const SHRINK_K = 6;
export const TABLE_SIZE = 4;
export const TABLE_MIN = 3;
export const FORM = { hot: 0.8, cold: 0.2, minGames: 4 };
// A season's read needs this many games of its own before last season's stop padding it (the
// default; a sport passes its own `seasonMin`: the NBA relies on last season for ten games).
export const SEASON_MIN = 3;
// A ladder's rungs read over the last seasonCap games until this season has this many.
export const LADDER_MIN = 10;

const r3 = (v) => Math.round(v * 1000) / 1000;

/** Whether a stat clears a line for a side (over / yes: more than the line; under / no: less). */
export function clears(value, line, side) {
  if (value == null || line == null) return null;
  if (side === 'under' || side === 'no') return value < line;
  return value > line;
}

/**
 * The chance of the hit from the rates at hand: the windows blended, shrunk toward the book's
 * implied probability (or 0.5) at n / (n + 6) on the games behind the read.
 */
export function chanceOf({ rates, n, implied }) {
  const parts = [];
  for (const [w, weight] of Object.entries(WEIGHTS)) if (rates?.[w] != null) parts.push([rates[w], weight]);
  if (rates?.all != null && !parts.length) parts.push([rates.all, 1]);
  if (!parts.length) return null;
  const total = parts.reduce((s, [, w]) => s + w, 0);
  const est = parts.reduce((s, [r, w]) => s + r * w, 0) / total;
  const prior = implied ?? 0.5;
  const games = Math.max(0, Math.min(Number(n) || 0, 17));
  return r3((games * est + SHRINK_K * prior) / (games + SHRINK_K));
}

/** Flame / snowflake for a market: his last five against the line, against his season rate. */
export function formOf(rates) {
  if (!rates || rates.l5 == null || (rates.l5N || 0) < FORM.minGames) return null;
  if (rates.l5 >= FORM.hot && (rates.season == null || rates.l5 > rates.season)) return 'hot';
  if (rates.l5 <= FORM.cold && (rates.season == null || rates.l5 < rates.season)) return 'cold';
  return null;
}

/** The box-score line of a player in a stored result, by name (and team when both are known). */
export function actualFor(result, c) {
  if (!result?.players) return undefined;
  const key = c.key || normName(c.player);
  const same = result.players.filter((p) => normName(p.name) === key);
  const hit = same.find((p) => !c.team || p.team === c.team) || same[0];
  return hit || null;
}

/**
 * The board for one sport: { markets (makeMarkets), teamName, seasonCap (games a season read
 * is capped at: 17 for the NFL, 82 for the NBA), h2hGames, posLabel (how a position reads in
 * the notes, "QBs") }.
 */
export function makeBoard({ markets, teamName, seasonCap = 17, h2hGames = 4, ladderMarkets = [], seasonMin = SEASON_MIN }) {
  const { MARKETS, GROUPS, statOf, defenseKey, labelOf } = markets;
  const LADDER_MARKETS = ladderMarkets.filter((k) => MARKETS[k]);

  /** Hit rates over a player's logs (newest first) against a line: { l5, l10, season, h2h, n, …N }. */
  function logRates(games, { market, line, side, season, opp = null }) {
    const vals = (list) => list.map((g) => clears(statOf(g, market), line, side)).filter((v) => v != null);
    const rate = (list) => { const v = vals(list); return v.length ? { rate: v.filter(Boolean).length / v.length, n: v.length } : null; };
    const reg = games.filter((g) => g.type === 'REG' || !g.type);
    let seasonGames = reg.filter((g) => g.season === season);
    // Early in a season the read is last season's (with this season's few on top) until this one has seasonMin games.
    if (seasonGames.length < seasonMin) seasonGames = [...seasonGames, ...reg.filter((g) => g.season === season - 1)].slice(0, seasonCap);
    const l5 = rate(games.slice(0, 5)); const l10 = rate(games.slice(0, 10)); const szn = rate(seasonGames);
    const h2h = opp ? rate(games.filter((g) => g.opp === opp).slice(0, h2hGames)) : null;
    return {
      l5: l5?.rate ?? null, l5N: l5?.n ?? 0, l10: l10?.rate ?? null, l10N: l10?.n ?? 0,
      season: szn?.rate ?? null, seasonN: szn?.n ?? 0, h2h: h2h?.rate ?? null, h2hN: h2h?.n ?? 0,
      n: szn?.n ?? 0,
    };
  }

  /** The player's average for the market's stat over his last 5 / 10 / the season. */
  function logAverages(games, { market, season }) {
    const avg = (list) => { const v = list.map((g) => statOf(g, market)).filter((x) => x != null); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; };
    const szn = games.filter((g) => g.season === season && (g.type === 'REG' || !g.type));
    return { l5: avg(games.slice(0, 5)), l10: avg(games.slice(0, 10)), season: avg(szn.length >= seasonMin ? szn : games.slice(0, seasonCap)) };
  }

  /**
   * A player's ladder for a market: every rung with his realistic chance of clearing it tonight,
   * from all the data at hand — his own distribution (his stat over his last `seasonCap` games,
   * the season window's rules) centred on tonight's projection (`ownRate` × the opponent's
   * environment at his position, `env`), P(X > rung) off a normal with his own spread (floored at a
   * quarter of the projection, so a steady player still has a tail), blended half and half with how
   * often he actually cleared the rung (last 5 / last 10 / season, the board's weights). No price in
   * the number: the book's price rides beside it. The rungs are the book's lines when the prop
   * carries a ladder, else rungs by the market's step around the main line (two under, four over:
   * the ceilings are where the money is). Each rung: { line, p, model, emp, proj, sd, rates, odds… }.
   */
  function ladderOf(games, { market, season, prop = null, opp = null, env = null }) {
    const m = MARKETS[market];
    if (!m || m.yesNo || !games?.length) return [];
    const side = 'over';
    const step = m.step || 1;
    let rungs = (prop?.lines || []).map((x) => ({ line: x.line, odds: x.odds ?? null, underOdds: x.underOdds ?? null, books: x.books || 0, main: !!x.main }));
    const main = prop?.line ?? null;
    if (rungs.length < 3) {
      const base = main ?? (() => { const a = logAverages(games, { market, season }); const v = a.season ?? a.l10; return v == null ? null : Math.floor(v) + 0.5; })();
      if (base == null) return [];
      const have = new Set(rungs.map((x) => x.line));
      for (let k = -2; k <= 4; k++) { const line = base + k * step; if (line > 0 && !have.has(line)) rungs.push({ line, odds: null, underOdds: null, books: 0, main: false }); }
      if (main != null && prop) { const r = rungs.find((x) => x.line === main); if (r) { r.odds = r.odds ?? prop.odds ?? null; r.underOdds = r.underOdds ?? prop.underOdds ?? null; r.books = r.books || prop.books || 0; r.main = true; } }
    }
    rungs.sort((a, b) => a.line - b.line);
    // His distribution: the stat over his last `seasonCap` regular-season games (this season's
    // window once it has LADDER_MIN games), centred on tonight's projection.
    const long = games.filter((g) => g.type === 'REG' || !g.type).slice(0, seasonCap);
    const vals = long.map((g) => statOf(g, market)).filter((v) => v != null);
    if (!vals.length) return [];
    const own = logAverages(games, { market, season });
    const rate = ownRate(own) ?? vals.reduce((a, b) => a + b, 0) / vals.length;
    const proj = Math.round(rate * (env ?? 1) * 10) / 10;
    const meanV = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sdRaw = vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - meanV) ** 2, 0) / (vals.length - 1)) : 0;
    const sd = Math.round(Math.max(sdRaw, 0.25 * proj, step / 2) * 100) / 100;
    return rungs.map((r) => {
      const rates = logRates(games, { market, line: r.line, side, season, opp });
      if (rates.n < LADDER_MIN && long.length > rates.n) {
        const v = long.map((g) => clears(statOf(g, market), r.line, side)).filter((x) => x != null);
        if (v.length) { rates.season = v.filter(Boolean).length / v.length; rates.n = v.length; rates.seasonN = v.length; }
      }
      const model = r3(upperTail((r.line - proj) / sd));
      const parts = [];
      for (const [w, weight] of Object.entries(WEIGHTS)) if (rates[w] != null) parts.push([rates[w], weight]);
      const emp = parts.length ? r3(parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0)) : null;
      const p = emp == null ? model : r3(0.5 * model + 0.5 * emp);
      return { ...r, p, model, emp, proj, sd, env: env ?? null, rates: { l5: rates.l5, l10: rates.l10, season: rates.season, n: rates.n }, fair: fairOdds(p) };
    });
  }

  /** The opponent's rank at the player's position for the market's stat: soft third → 'soft', stingy third → 'tough'. */
  function softSpot(defense, { opp, pos, market }) {
    const key = defenseKey(market);
    if (!defense?.ranks || !opp || !pos || !key) return null;
    const rank = defense.ranks[opp]?.[pos]?.[key];
    const value = defense.teams?.[opp]?.[pos]?.[key];
    if (!rank) return null;
    const teams = defense.count || Object.keys(defense.teams || {}).length || 32;
    const third = Math.ceil(teams / 3);
    return { rank, value, teams, key, soft: rank <= third, tough: rank > teams - third };
  }

  /** Plays merged from the sheets' rows and PropFinder's lines: one per player + market + line + side. */
  function mergeCandidates(sheetRows, pfPlayers) {
    const byKey = new Map();
    const keyOf = (c) => `${c.key}|${c.market}|${c.line}|${c.side}`;
    for (const r of sheetRows || []) {
      if (!r.market || r.line == null) continue;   // a mention (a line-less sheet row) confirms, it is not a play of its own
      const c = { ...r, key: normName(r.player), hit: { ...(r.hit || {}) }, sources: [r.file || 'sheet'] };
      const k = keyOf(c);
      const prev = byKey.get(k);
      if (prev) { prev.odds = prev.odds ?? c.odds; prev.underOdds = prev.underOdds ?? c.underOdds; for (const [w, v] of Object.entries(c.hit)) if (v != null && prev.hit[w] == null) prev.hit[w] = v; prev.proj = prev.proj ?? c.proj; prev.edge = prev.edge ?? c.edge; prev.rating = prev.rating || c.rating; prev.sources.push(...c.sources); prev.team = prev.team || c.team; prev.opp = prev.opp || c.opp; prev.pos = prev.pos || c.pos; }
      else byKey.set(k, c);
    }
    for (const p of pfPlayers || []) {
      for (const o of p.props || []) {
        if (!MARKETS[o.market]) continue;
        const side = MARKETS[o.market].yesNo ? 'yes' : 'over';
        const c = { player: p.name, key: p.key, team: p.team, pos: p.pos, market: o.market, group: MARKETS[o.market].group, line: o.line, side, odds: o.odds, underOdds: o.underOdds, book: o.book, main: o.isMain !== false, hit: {}, avg: {}, sources: ['propfinder'] };
        const k = keyOf(c);
        const prev = byKey.get(k);
        if (prev) { prev.odds = prev.odds ?? c.odds; prev.underOdds = prev.underOdds ?? c.underOdds; prev.team = prev.team || c.team; prev.pos = prev.pos || c.pos; prev.sources.push('propfinder'); }
        else byKey.set(k, c);
      }
    }
    return [...byKey.values()];
  }

  /** The line-less sheet rows by player: the files naming him, his position, team and season averages. */
  function mentionsOf(sheetRows) {
    const out = new Map();
    for (const r of sheetRows || []) {
      if (r.market && r.line != null) continue;
      const key = normName(r.player);
      const m = out.get(key) || { files: [], pos: null, team: null, avg: {} };
      if (r.file && !m.files.includes(r.file)) m.files.push(r.file);
      m.pos = m.pos || r.pos || null; m.team = m.team || r.team || null;
      for (const [k, v] of Object.entries(r.avg || {})) if (v != null && m.avg[k] == null) m.avg[k] = v;
      out.set(key, m);
    }
    return out;
  }

  /** PropFinder's defense table from the sheets' rank tiles (what each team's opponent gives up, rank 1 = most). */
  function defenseFromSheets(sheets, games) {
    const ranks = {};
    for (const s of sheets || []) {
      for (const [team, byPos] of Object.entries(s.meta?.oppRanks || {})) {
        const g = games.find((x) => x.away === team || x.home === team);
        const opp = g ? (g.away === team ? g.home : g.away) : null;
        if (!opp) continue;
        for (const [pos, byKey] of Object.entries(byPos)) for (const [key, rank] of Object.entries(byKey)) { ranks[opp] = ranks[opp] || {}; ranks[opp][pos] = ranks[opp][pos] || {}; ranks[opp][pos][key] = ranks[opp][pos][key] ?? rank; }
      }
    }
    return Object.keys(ranks).length ? { ranks, teams: {}, count: 30, from: 'sheet' } : null;
  }

  /**
   * The matchup view's two sides of a game: per team its players (every player with a play, plus
   * the PropFinder players of the team without one) with their plays, and what the opponent gives
   * up per position and stat with the league rank (1 = the most).
   */
  function sidesOf(g, plays, pfPlayers, defense, season, depth = null, sheetDefense = null) {
    const out = {};
    const pfByKey = new Map();
    for (const p of pfPlayers) if (!pfByKey.has(p.key)) pfByKey.set(p.key, p);
    // A player's own windows per stat ({ l5, l10, season }) from his logs, for the projection.
    const ownOf = (pfp) => {
      const own = {};
      if (!pfp?.games?.length) return own;
      for (const key of Object.keys(MARKETS)) { const stat = defenseKey(key); if (!stat || own[stat] || MARKETS[key].yesNo) continue; const a = logAverages(pfp.games, { market: key, season }); if (a.season != null || a.l10 != null) own[stat] = a; }
      return own;
    };
    // An allowed table ({ ABBR: { pos: row } } + ranks + league) for the opponent as the UI reads it: value + rank per cell.
    // The cheat sheet's rank tiles for the opponent ride on every cell as `sheet` (its rank, 1 = the
    // most), so the court can show where the sheet confirms PropFinder's environment and where not.
    const tableOf = (vals, ranks, league, count, from, extra = {}, sheetRanks = null) => {
      const rows = {};
      for (const pos of new Set([...Object.keys(vals || {}), ...Object.keys(ranks || {})])) {
        rows[pos] = {};
        for (const key of new Set([...Object.keys(vals?.[pos] || {}), ...Object.keys(ranks?.[pos] || {})])) { if (['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held'].includes(key)) continue; rows[pos][key] = { value: vals?.[pos]?.[key] ?? null, rank: ranks?.[pos]?.[key] ?? null, ...(sheetRanks?.[pos]?.[key] != null ? { sheet: sheetRanks[pos][key] } : {}) }; }
        if (vals?.[pos]?.gp != null) rows[pos].gp = vals[pos].gp;
        if (vals?.[pos]?.prior != null) rows[pos].prior = vals[pos].prior;
        if (vals?.[pos]?.held) rows[pos].held = true;
      }
      return Object.keys(rows).length ? { rows, count: count || null, from, league: league || null, ...extra } : null;
    };
    for (const team of [g.away, g.home]) {
      const opp = team === g.away ? g.home : g.away;
      // PropFinder's depth chart for the team: the slot and depth per player (1 = the starter there).
      const slots = new Map();
      for (const [slot, list] of Object.entries(depth?.[team] || {})) for (const x of list) { const prev = slots.get(x.key); if (!prev || (x.depth || 99) < (prev.depth || 99)) slots.set(x.key, { slot, depth: x.depth, status: x.status }); }
      const byKey = new Map();
      for (const x of plays) {
        if (x.team !== team) continue;
        const p = byKey.get(x.key) || { player: x.player, key: x.key, pos: x.pos, status: x.status, injury: x.injury, espnId: x.espnId, avg: {}, plays: [] };
        p.pos = p.pos || x.pos; p.espnId = p.espnId || x.espnId;
        const stat = defenseKey(x.market);
        if (stat && x.avg?.season != null && p.avg[stat] == null) p.avg[stat] = x.avg.season;
        p.plays.push({ id: x.id, market: x.market, label: x.label, group: x.group, unit: x.unit, line: x.line, side: x.side, p: x.p, fair: x.fair, odds: x.odds, edge: x.edge, floor: x.floor, main: x.main, book: x.book, confirmed: x.confirmed, pfBacked: x.pfBacked, onSheet: x.onSheet, sheetFiles: x.sheetFiles || [], form: x.form, spot: x.spot ? { rank: x.spot.rank, soft: x.spot.soft, tough: x.spot.tough } : null, rates: { l5: x.rates.l5, l10: x.rates.l10, season: x.rates.season, n: x.rates.n }, actual: x.actual, hit: x.hit });
        byKey.set(x.key, p);
      }
      for (const pfp of pfPlayers) {
        if (pfp.team !== team || byKey.has(pfp.key)) continue;
        byKey.set(pfp.key, { player: pfp.name, key: pfp.key, pos: pfp.pos, status: pfp.status, injury: pfp.injury, espnId: null, avg: {}, plays: [] });
      }
      // The side's projections add up to the team's expected total tonight: its own per-game figure
      // (`totals.for`) through the opponent's environment in all (`totals.against` over the league's
      // average, damped as the position factor), over the sum of the players' own rates (the injured
      // out left aside), one factor per stat (`scale`), the combos on their parts.
      const scale = {}; const teamProj = {};
      const tot = defense?.totals || null;
      if (tot?.[team]?.for) {
        const active = [...byKey.values()].filter((p) => !/out|susp/i.test(String(p.injury || '')));
        const base = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'ftm'];
        const sumOwn = (stat) => active.reduce((a, p) => a + (ownRate(ownOf(pfByKey.get(p.key))[stat]) || 0), 0);
        const expected = (stat) => { const f = tot[team].for[stat]; if (f == null) return null; return Math.round(f * (envFactor(tot[opp]?.against?.[stat], defense.leagueFor?.[stat]) ?? 1) * 10) / 10; };
        for (const stat of base) { const T = expected(stat); const S = sumOwn(stat); if (T != null && S > 0) { teamProj[stat] = T; scale[stat] = Math.round(Math.min(1.5, Math.max(0.5, T / S)) * 1000) / 1000; } }
        for (const [combo, parts] of [['pra', ['pts', 'reb', 'ast']], ['pr', ['pts', 'reb']], ['pa', ['pts', 'ast']], ['ra', ['reb', 'ast']], ['stlBlk', ['stl', 'blk']]]) {
          if (!parts.every((k) => teamProj[k] != null)) continue;
          const T = parts.reduce((a, k) => a + teamProj[k], 0); const S = parts.reduce((a, k) => a + sumOwn(k), 0);
          if (S > 0) { teamProj[combo] = Math.round(T * 10) / 10; scale[combo] = Math.round(Math.min(1.5, Math.max(0.5, T / S)) * 1000) / 1000; }
        }
      }
      const players = [...byKey.values()].map((p) => {
        const d = slots.get(p.key);
        const pfp = pfByKey.get(p.key);
        const own = ownOf(pfp);
        const ladders = {};
        // The environment for the ladder: what the opponent gives up at his spot (the depth-chart slot, else his position; G → SG, F → SF) over the league, the season table.
        const envPos = d?.slot || ({ G: 'SG', F: 'SF' }[p.pos] || p.pos);
        const envOf = (market) => { const stat = defenseKey(market); const a = defense?.teams?.[opp]?.[envPos]?.[stat]; const lg = defense?.league?.[envPos]?.[stat]; return envFactor(a, lg); };
        // His range tonight per market: the expected figure (the ladder's centre), the floor and the
        // ceiling (the quartiles of his distribution: he lands between them half the nights), and the
        // book's main rung with his chance of clearing it.
        const ranges = {};
        if (pfp?.games?.length) for (const market of LADDER_MARKETS) {
          const stat = defenseKey(market); const pos = envOf(market); const team = scale[stat]; const env = pos == null && team == null ? null : Math.round((pos ?? 1) * (team ?? 1) * 1000) / 1000;
          const l = ladderOf(pfp.games, { market, season, prop: (pfp.props || []).find((x) => x.market === market) || null, opp, env });
          if (!l.length) continue;
          ladders[market] = l;
          const main = l.find((r) => r.main) || null;
          ranges[market] = { exp: l[0].proj, floor: Math.max(0, Math.round(l[0].proj - 0.6745 * l[0].sd)), ceiling: Math.round(l[0].proj + 0.6745 * l[0].sd), line: main?.line ?? null, p: main?.p ?? null, odds: main?.odds ?? null };
        }
        const avg = { ...p.avg };
        for (const [stat, a] of Object.entries(own)) if (avg[stat] == null && a.season != null) avg[stat] = a.season;
        return { ...p, avg, own, ladders, ranges, scale, slot: d?.slot || null, depth: d?.depth || null, plays: p.plays.sort((a, b) => b.p - a.p) };
      })
        .sort((a, b) => (a.depth || 99) - (b.depth || 99) || (b.plays.length ? 1 : 0) - (a.plays.length ? 1 : 0) || (b.plays[0]?.p ?? 0) - (a.plays[0]?.p ?? 0) || a.player.localeCompare(b.player));
      // The opponent's table for the season (blended) and each last-N window PropFinder published.
      const windows = {};
      const sheetRanks = sheetDefense?.ranks?.[opp] || null;
      for (const [k, w] of Object.entries(defense?.windows || {})) { const t = tableOf(w.teams?.[opp], w.ranks?.[opp], w.league, w.count, 'propfinder', { lastN: w.lastN, season: w.season || null }, sheetRanks); if (t) windows[k] = t; }
      const allowed = tableOf(defense?.teams?.[opp], defense?.ranks?.[opp], defense?.league, defense?.count, defense?.from || 'propfinder', { ...(Object.keys(windows).length ? { windows } : {}), ...(sheetRanks ? { sheet: sheetDefense.from === 'sheet' && defense === sheetDefense ? 'same' : 'beside' } : {}) }, sheetRanks);
      out[team] = { team, opp, venue: g.home === team ? 'H' : 'A', players, lineup: slots.size ? 'propfinder' : null, allowed, scale, teamProj, teamFor: tot?.[team]?.for ? Object.fromEntries(Object.entries(tot[team].for).filter(([k]) => !['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held'].includes(k))) : null };
    }
    return out;
  }

  function gameOf(games, c) {
    if (c.team) { const g = games.find((x) => x.away === c.team || x.home === c.team); if (g) return g; }
    if (c.opp) { const g = games.find((x) => x.away === c.opp || x.home === c.opp); if (g) return g; }
    return null;
  }

  /** The notes under the board, written from the plays: the richest game, the softest spots, thin games, the sources. */
  function buildNotes({ games, plays, sheets, pf, defense }) {
    const notes = [];
    const over = plays.filter((x) => x.p >= x.floor);
    const byGame = games.map((g) => ({ g, n: over.filter((x) => x.game === g.id).length })).sort((a, b) => b.n - a.n);
    if (byGame[0]?.n) notes.push(`Richest game: ${byGame[0].g.away} @ ${byGame[0].g.home} with ${byGame[0].n} play${byGame[0].n === 1 ? '' : 's'} over the floor.`);
    const best = [...over].sort((a, b) => (b.edge ?? -9) - (a.edge ?? -9)).filter((x) => x.edge != null).slice(0, 3);
    if (best.length) notes.push(`Best prices: ${best.map((x) => `${x.player} ${x.side === 'under' ? 'under' : x.side === 'yes' ? '' : 'over'} ${x.side === 'yes' ? '' : `${x.line} `}${x.label} (${Math.round(x.p * 100)}% at ${x.odds > 0 ? `+${x.odds}` : x.odds}, +${Math.round(x.edge * 100)} pts)`).join('; ')}.`);
    const soft = {};
    for (const x of over) if (x.spot?.soft) soft[`${x.opp} to ${x.pos}s`] = (soft[`${x.opp} to ${x.pos}s`] || 0) + 1;
    const softest = Object.entries(soft).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (softest.length) notes.push(`Softest spots: ${softest.map(([k, n]) => `${k} (${n})`).join(', ')}, from what each defense allows per position this season (PropFinder).`);
    if (pf && sheets.length) {
      const backed = over.filter((x) => x.pfBacked);
      const confirmed = backed.filter((x) => x.confirmed);
      const sheetOnly = over.filter((x) => !x.pfBacked);
      notes.push(`PropFinder first: ${backed.length} play${backed.length === 1 ? '' : 's'} over the floor from its logs and lines, ${confirmed.length} of them also on a cheat sheet (✓)${sheetOnly.length ? `; ${sheetOnly.length} sheet-only play${sheetOnly.length === 1 ? '' : 's'} listed behind them` : ''}.`);
    }
    const hot = over.filter((x) => x.form === 'hot').slice(0, 4);
    if (hot.length) notes.push(`Running hot: ${hot.map((x) => `${x.player} (${x.label}, ${Math.round(x.rates.l5 * 100)}% of his last ${x.rates.l5N})`).join(', ')}. Colour only: the chance already carries the rate.`);
    const thin = games.filter((g) => !g.plays).map((g) => `${g.away} @ ${g.home}`);
    if (thin.length) notes.push(`No plays yet in ${thin.length > 5 ? `${thin.length} games (${thin.slice(0, 4).join(', ')} and ${thin.length - 4} more)` : thin.join(', ')}: no cheat-sheet row or PropFinder line for either team.`);
    const src = [];
    if (sheets.length) src.push(`${sheets.length} cheat sheet${sheets.length === 1 ? '' : 's'} (${sheets.map((s) => s.fileName).join(', ')})`);
    if (pf?.at) src.push(`PropFinder pulled ${new Date(pf.at).toUTCString().replace(' GMT', ' UTC')} (${(pf.data?.players || []).length} players, ${defense?.count || 0} defenses)`);
    if (!src.length) notes.push('No data yet for this slate: drop the cheat sheets under Data sources or pull PropFinder.');
    else notes.push(`Sources: ${src.join('; ')}. The chance is a hit-rate read (last 5 / last 10 / season, shrunk toward the book’s price), the price under it the break-even.`);
    return notes;
  }

  /**
   * The board for a slate.
   *   games: the schedule ([{ id, date, away, home, final, awayScore, homeScore, detail }])
   *   sheets: the parsed cheat sheets ([{ id, fileName, at, rows }])
   *   pf: the slate's PropFinder file ({ at, data: { players, defense } }) or null
   *   results: { [gameId]: parsed summary } for the finished games
   *   season: the season the logs' season read belongs to (its start year)
   */
  function buildBoard({ season, games = [], sheets = [], pf = null, results = {}, ...rest }) {
    const pfPlayers = pf?.data?.players || [];
    const byKey = new Map();
    for (const p of pfPlayers) { const list = byKey.get(p.key) || []; list.push(p); byKey.set(p.key, list); }
    const rows = sheets.flatMap((s) => (s.rows || []).map((r) => ({ ...r, file: s.fileName || r.file })));
    const sheetDefense = defenseFromSheets(sheets, games);
    const defense = pf?.data?.defense || sheetDefense;
    const candidates = mergeCandidates(rows, pfPlayers);
    const mentions = mentionsOf(rows);
    const plays = [];
    for (const c of candidates) {
      const m = MARKETS[c.market];
      if (!m) continue;
      const pfs = byKey.get(c.key) || [];
      const pfp = pfs.find((p) => !c.team || p.team === c.team) || pfs[0] || null;
      if (pfp) { c.team = c.team || pfp.team; c.pos = c.pos || pfp.pos; c.pfId = pfp.id; c.status = pfp.status; c.injury = pfp.injury; }
      const mention = mentions.get(c.key);
      if (mention) {
        c.sources.push(...mention.files.filter((f) => !c.sources.includes(f)));
        c.team = c.team || mention.team; c.pos = c.pos || mention.pos;
        const stat = defenseKey(c.market);
        if (stat && mention.avg[stat] != null && c.avg?.season == null) c.avg = { ...(c.avg || {}), season: mention.avg[stat] };
      }
      const g = gameOf(games, c);
      if (!g) continue;
      c.game = g.id;
      if (!c.team && c.opp) c.team = g.away === c.opp ? g.home : g.away;
      c.opp = c.opp || (g.away === c.team ? g.home : g.away);
      c.venue = g.home === c.team ? 'H' : 'A';
      const logs = pfp?.games || [];
      const sheetRates = c.hit || {};
      const read = logs.length ? logRates(logs, { market: c.market, line: c.line, side: c.side, season, opp: c.opp }) : null;
      const rates = read && read.n ? read : { l5: sheetRates.l5 ?? null, l10: sheetRates.l10 ?? null, season: sheetRates.season ?? sheetRates.l20 ?? sheetRates.l15 ?? null, h2h: sheetRates.h2h ?? null, all: sheetRates.all ?? null, l5N: sheetRates.l5N ?? (sheetRates.l5 != null ? 5 : 0), n: sheetRates.seasonN ?? (sheetRates.season != null ? 10 : sheetRates.l10 != null ? 10 : sheetRates.l5 != null ? 5 : sheetRates.all != null ? 8 : 0) };
      const implied = impliedProb(c.side === 'under' || c.side === 'no' ? c.underOdds ?? c.odds : c.odds);
      const p = chanceOf({ rates, n: rates.n, implied });
      if (p == null) continue;
      const price = c.side === 'under' || c.side === 'no' ? (c.underOdds ?? c.odds ?? null) : (c.odds ?? null);
      const avg = logs.length ? logAverages(logs, { market: c.market, season }) : (c.avg || {});
      const spot = softSpot(defense, { opp: c.opp, pos: c.pos, market: c.market });
      const result = results?.[g.id];
      const line = result ? actualFor(result, c) : undefined;
      const actual = line === undefined ? undefined : line && line.played !== false ? statOf(line, c.market) : null;
      const pfBacked = !!(read && read.n) || c.sources.includes('propfinder');
      const sheetFiles = [...new Set(c.sources.filter((x) => x !== 'propfinder'))];
      plays.push({
        id: `${c.key}|${c.market}|${c.line}|${c.side}`, player: c.player, key: c.key, team: c.team, opp: c.opp, venue: c.venue, pos: c.pos, game: g.id,
        pfBacked, onSheet: sheetFiles.length > 0, confirmed: pfBacked && sheetFiles.length > 0, sheetFiles,
        market: c.market, label: labelOf(c.market), group: m.group, unit: m.unit, line: c.line, side: c.side,
        p, fair: fairOdds(p), odds: price, implied: implied == null ? null : r3(implied), edge: implied == null ? null : r3(p - implied), book: c.book || null,
        rates: { l5: rates.l5, l10: rates.l10, season: rates.season, h2h: rates.h2h, n: rates.n, l5N: rates.l5N || 0, from: read && read.n ? 'logs' : 'sheet' },
        avg, form: formOf(rates), spot, proj: c.proj ?? null, rating: c.rating || null, status: c.status || null, injury: c.injury || null, main: c.main !== false,
        sources: [...new Set(c.sources)], floor: m.floor,
        actual, hit: actual == null ? null : clears(actual, c.line, c.side), espnId: line?.espnId || null,
      });
    }
    // Per game, per group: the best plays over the floor (3 to 4 a table), fill-ins under it, the rest on a "next" line.
    // With a PropFinder pull in, PropFinder's plays come first and a sheet-only play fills in behind them.
    const pfFirst = !!pf;
    const order = (a, b) => b.p - a.p || (b.confirmed ? 1 : 0) - (a.confirmed ? 1 : 0) || (b.edge ?? -1) - (a.edge ?? -1) || a.player.localeCompare(b.player);
    const boardGames = games.map((g) => {
      const mine = plays.filter((x) => x.game === g.id);
      const tables = {};
      for (const [group] of GROUPS) {
        const list = mine.filter((x) => x.group === group).sort(order);
        const seen = new Set(); const uniq = [];
        for (const x of list) { const k = `${x.key}|${x.market}|${x.side}`; if (seen.has(k)) continue; seen.add(k); uniq.push(x); }
        const over = uniq.filter((x) => x.p >= x.floor);
        // The table's candidates in order of preference: PropFinder's over the floor, a sheet's over the
        // floor (marked), PropFinder's under the floor, a sheet's under the floor (both fill-ins).
        const tier = (x) => (pfFirst && !x.pfBacked ? 1 : 0) + (x.p >= x.floor ? 0 : 2);
        const ranked = [...uniq].sort((a, b) => tier(a) - tier(b) || order(a, b));
        const shown = ranked.filter((x) => tier(x) === 0).slice(0, TABLE_SIZE);
        const fill = shown.length < TABLE_MIN ? ranked.filter((x) => tier(x) > 0).slice(0, TABLE_MIN - shown.length).map((x) => ({ ...x, under: x.p < x.floor, sheetOnly: pfFirst && !x.pfBacked })) : [];
        const rowsOut = [...shown, ...fill];
        const next = ranked.filter((x) => !rowsOut.some((r) => r.id === x.id)).slice(0, 4).map((x) => ({ ...x, sheetOnly: pfFirst && !x.pfBacked }));
        tables[group] = { rows: rowsOut, next, total: uniq.length, fallback: over.length === 0 && uniq.length > 0, pfFirst };
      }
      const graded = mine.filter((x) => x.hit != null && x.p >= x.floor);
      return {
        ...g, awayName: teamName(g.away), homeName: teamName(g.home), tables, plays: mine.length,
        tally: g.final ? { hit: graded.filter((x) => x.hit).length, of: graded.length } : null,
        sides: sidesOf(g, mine, pfPlayers, defense, season, pf?.data?.depth || null, sheetDefense),
      };
    });
    const notes = buildNotes({ games: boardGames, plays, sheets, pf, defense });
    return {
      season, ...rest, games: boardGames, plays: plays.length,
      sources: { sheets: sheets.map((s) => ({ id: s.id, fileName: s.fileName, at: s.at, rows: (s.rows || []).length })), propfinder: pf ? { at: pf.at, players: pfPlayers.length, withProps: pfPlayers.filter((p) => p.props?.length).length, withGames: pfPlayers.filter((p) => p.games?.length).length } : null, results: Object.keys(results || {}).length },
      notes,
    };
  }

  return { statOf, clears, logRates, logAverages, ladderOf, chanceOf, formOf, softSpot, mergeCandidates, mentionsOf, defenseFromSheets, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM };
}
