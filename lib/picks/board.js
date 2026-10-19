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
import { impliedProb, fairOdds } from '../nfl/odds';
import { normName } from '../nhl-data/names';

export const WEIGHTS = { l5: 0.3, l10: 0.3, season: 0.4 };
export const SHRINK_K = 6;
export const TABLE_SIZE = 4;
export const TABLE_MIN = 3;
export const FORM = { hot: 0.8, cold: 0.2, minGames: 4 };
// A season's read needs this many games of its own before last season's stop padding it.
export const SEASON_MIN = 3;

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
export function makeBoard({ markets, teamName, seasonCap = 17, h2hGames = 4 }) {
  const { MARKETS, GROUPS, statOf, defenseKey, labelOf } = markets;

  /** Hit rates over a player's logs (newest first) against a line: { l5, l10, season, h2h, n, …N }. */
  function logRates(games, { market, line, side, season, opp = null }) {
    const vals = (list) => list.map((g) => clears(statOf(g, market), line, side)).filter((v) => v != null);
    const rate = (list) => { const v = vals(list); return v.length ? { rate: v.filter(Boolean).length / v.length, n: v.length } : null; };
    const reg = games.filter((g) => g.type === 'REG' || !g.type);
    let seasonGames = reg.filter((g) => g.season === season);
    // Early in a season the read is last season's until this one has three games.
    if (seasonGames.length < SEASON_MIN) seasonGames = [...seasonGames, ...reg.filter((g) => g.season === season - 1)].slice(0, seasonCap);
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
    return { l5: avg(games.slice(0, 5)), l10: avg(games.slice(0, 10)), season: avg(szn.length >= SEASON_MIN ? szn : games.slice(0, seasonCap)) };
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
        const c = { player: p.name, key: p.key, team: p.team, pos: p.pos, market: o.market, group: MARKETS[o.market].group, line: o.line, side, odds: o.odds, underOdds: o.underOdds, book: o.book, hit: {}, avg: {}, sources: ['propfinder'] };
        const k = keyOf(c);
        const prev = byKey.get(k);
        if (prev) { prev.odds = prev.odds ?? c.odds; prev.underOdds = prev.underOdds ?? c.underOdds; prev.team = prev.team || c.team; prev.pos = prev.pos || c.pos; prev.sources.push('propfinder'); }
        else byKey.set(k, c);
      }
    }
    return [...byKey.values()];
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
    const defense = pf?.data?.defense || null;
    const byKey = new Map();
    for (const p of pfPlayers) { const list = byKey.get(p.key) || []; list.push(p); byKey.set(p.key, list); }
    const rows = sheets.flatMap((s) => (s.rows || []).map((r) => ({ ...r, file: s.fileName || r.file })));
    const candidates = mergeCandidates(rows, pfPlayers);
    const plays = [];
    for (const c of candidates) {
      const m = MARKETS[c.market];
      if (!m) continue;
      const pfs = byKey.get(c.key) || [];
      const pfp = pfs.find((p) => !c.team || p.team === c.team) || pfs[0] || null;
      if (pfp) { c.team = c.team || pfp.team; c.pos = c.pos || pfp.pos; c.pfId = pfp.id; c.status = pfp.status; c.injury = pfp.injury; }
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
      plays.push({
        id: `${c.key}|${c.market}|${c.line}|${c.side}`, player: c.player, key: c.key, team: c.team, opp: c.opp, venue: c.venue, pos: c.pos, game: g.id,
        market: c.market, label: labelOf(c.market), group: m.group, unit: m.unit, line: c.line, side: c.side,
        p, fair: fairOdds(p), odds: price, implied: implied == null ? null : r3(implied), edge: implied == null ? null : r3(p - implied), book: c.book || null,
        rates: { l5: rates.l5, l10: rates.l10, season: rates.season, h2h: rates.h2h, n: rates.n, l5N: rates.l5N || 0, from: read && read.n ? 'logs' : 'sheet' },
        avg, form: formOf(rates), spot, proj: c.proj ?? null, rating: c.rating || null, status: c.status || null, injury: c.injury || null,
        sources: [...new Set(c.sources)], floor: m.floor,
        actual, hit: actual == null ? null : clears(actual, c.line, c.side), espnId: line?.espnId || null,
      });
    }
    // Per game, per group: the best plays over the floor (3 to 4 a table), fill-ins under it, the rest on a "next" line.
    const order = (a, b) => b.p - a.p || (b.edge ?? -1) - (a.edge ?? -1) || a.player.localeCompare(b.player);
    const boardGames = games.map((g) => {
      const mine = plays.filter((x) => x.game === g.id);
      const tables = {};
      for (const [group] of GROUPS) {
        const list = mine.filter((x) => x.group === group).sort(order);
        const seen = new Set(); const uniq = [];
        for (const x of list) { const k = `${x.key}|${x.market}|${x.side}`; if (seen.has(k)) continue; seen.add(k); uniq.push(x); }
        const over = uniq.filter((x) => x.p >= x.floor);
        const shown = over.slice(0, TABLE_SIZE);
        const fill = shown.length < TABLE_MIN ? uniq.filter((x) => !shown.includes(x)).slice(0, TABLE_MIN - shown.length).map((x) => ({ ...x, under: true })) : [];
        const rowsOut = [...shown, ...fill];
        const next = uniq.filter((x) => !rowsOut.some((r) => r.id === x.id)).slice(0, 4);
        tables[group] = { rows: rowsOut, next, total: uniq.length, fallback: over.length === 0 && uniq.length > 0 };
      }
      const graded = mine.filter((x) => x.hit != null && x.p >= x.floor);
      return {
        ...g, awayName: teamName(g.away), homeName: teamName(g.home), tables, plays: mine.length,
        tally: g.final ? { hit: graded.filter((x) => x.hit).length, of: graded.length } : null,
      };
    });
    const notes = buildNotes({ games: boardGames, plays, sheets, pf, defense });
    return {
      season, ...rest, games: boardGames, plays: plays.length,
      sources: { sheets: sheets.map((s) => ({ id: s.id, fileName: s.fileName, at: s.at, rows: (s.rows || []).length })), propfinder: pf ? { at: pf.at, players: pfPlayers.length, withProps: pfPlayers.filter((p) => p.props?.length).length, withGames: pfPlayers.filter((p) => p.games?.length).length } : null, results: Object.keys(results || {}).length },
      notes,
    };
  }

  return { statOf, clears, logRates, logAverages, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM };
}
