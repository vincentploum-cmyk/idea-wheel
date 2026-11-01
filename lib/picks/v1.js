// The read API over the picks boards (the brief of 2026-10-31, section 6: "serve pre-ranked JSON; all compute
// server-side"): the slate overview and one game's tables shaped as the front end reads them, every row with its
// expected value. Pure: the routes hand in the built board (lib/picks/store.js boardFor).
import { rankGames, topPlays, failsOf, DEFAULTS } from './value';

/** One play as the API serves it: the player, the market, the chances, the prices, the value, the status, the result. */
export function rowOf(r) {
  return {
    id: r.id, player: r.player, key: r.key, team: r.team, opp: r.opp, venue: r.venue, pos: r.pos || null, game: r.game ?? null,
    market: r.market, label: r.label, group: r.group, line: r.line, side: r.side, play: r.side === 'yes' ? r.label : r.side === 'no' ? `No ${r.label}` : `${r.side === 'under' ? 'u' : 'o'}${r.line} ${r.label}`,
    model_chance: r.p, stated_chance: r.raw ?? null, fair_price: r.fair ?? null, book_price: r.odds ?? null, book: r.book || null, implied: r.implied ?? null,
    EV_pct: r.ev ?? null, edge: r.edge ?? null, fails: failsOf(r), marginal: failsOf(r) != null,
    projection: r.proj ? { exp: r.proj.exp, floor: r.proj.floor, ceiling: r.proj.ceiling } : null, gap: r.gap ?? null,
    matchup: r.spot ? { pos: r.spot.pos, rank: r.spot.rank, of: r.spot.count ?? r.spot.teams ?? null } : null,
    status: { health: r.health || null, injury: r.injury || null, out: !!r.out, thin: !!r.thin, b2b: !!r.b2b, minutes: r.minutes ?? null, confirmed: !!r.confirmed, sheetOnly: !!r.sheetOnly },
    result: r.actual === undefined ? null : { actual: r.actual, hit: r.hit },
  };
}

/** A game's line for the slate payload. */
export function gameOf(g, matchup, best) {
  const mine = best.filter((x) => x.game === g.id);
  return {
    id: g.id, matchup: `${g.away} @ ${g.home}`, away: g.away, home: g.home, kickoff: g.date || null, final: !!g.final, state: g.state || null,
    score: g.final || g.state === 'in' ? { away: g.awayScore ?? null, home: g.homeScore ?? null } : null,
    line: g.odds ? { spread: g.odds.spread ?? null, total: g.odds.total ?? null } : null,
    leak_tier: matchup.leak?.tier ?? 0, leak: matchup.leak || null, script: g.profile?.script?.word || null,
    matchup_score: matchup.score, matchup_parts: { base: matchup.base, breadth: matchup.breadth, leakMult: matchup.leakMult, blowout: matchup.blowout },
    plays_with_edge: mine.length, plays_passing: matchup.breadth,
    top_plays: matchup.top.map((id) => rowOf(mine.find((x) => x.id === id))).filter(Boolean),
  };
}

/** GET /api/v1/slate/{sport}: the games by Matchup Score and every play passing the floors, the best value first. */
export function slatePayload(board, { filters = DEFAULTS, marginal = false } = {}) {
  const best = board?.best || [];
  const ranked = rankGames(board, filters);
  const plays = marginal ? best : topPlays(board, filters);
  return {
    sport: board?.sport || null, date: board?.date || null, season: board?.season ?? null, week: board?.week ?? null, label: board?.label || null,
    filters: { minEv: filters.minEv, maxJuice: filters.maxJuice, minChance: filters.minChance ?? null, minMinutes: board?.value?.minMinutes ?? null },
    games: ranked.map(({ game, matchup }) => gameOf(game, matchup, best)),
    top_plays: plays.map(rowOf),
    sources: board?.sources || null, calibration: board?.calibration ? { applied: board.calibration.applied ?? null } : null, generatedAt: new Date().toISOString(),
  };
}

/** GET /api/v1/picks/{sport}/{gameId}: one game's tables with every row's value, the marginal rows beside them. */
export function gamePayload(board, gameId, { filters = DEFAULTS } = {}) {
  const g = (board?.games || []).find((x) => String(x.id) === String(gameId));
  if (!g) return null;
  const best = (board.best || []).filter((x) => x.game === g.id);
  const matchup = rankGames({ ...board, games: [g] }, filters)[0]?.matchup || g.matchup;
  return {
    ...gameOf(g, matchup, board.best || []),
    tables: Object.fromEntries(Object.entries(g.tables || {}).map(([group, t]) => [group, { rows: t.rows.map(rowOf), marginal: (t.marginal || []).map(rowOf), total: t.total }])),
    best: best.map(rowOf),
    sides: Object.fromEntries(Object.entries(g.sides || {}).map(([team, s]) => [team, { team, opp: s.opp, venue: s.venue, out: s.out || [], picks: (s.picks || []).map(rowOf), players: (s.players || []).map((p) => ({ key: p.key, player: p.player, pos: p.pos, slot: p.slot, depth: p.depth, health: p.health, out: !!p.out, thin: !!p.thin, b2b: !!p.b2b, minutes: p.minutes?.tonight ?? null, ranges: p.ranges || {}, ladders: p.ladders || {} })) }])),
    profile: g.profile || null, notes: board.notes || [], generatedAt: new Date().toISOString(),
  };
}

/** The user's floors from a query string (?minEv=0.05&maxJuice=-200&minChance=0.5), the defaults otherwise. */
export function filtersOf(params) {
  const f = { ...DEFAULTS };
  const num = (k) => { const v = params.get(k); if (v == null || v === '') return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; };
  const minEv = num('minEv'); if (minEv !== undefined) f.minEv = minEv;
  const maxJuice = num('maxJuice'); if (maxJuice !== undefined) f.maxJuice = maxJuice;
  const minChance = num('minChance'); if (minChance !== undefined) f.minChance = minChance > 0 ? minChance : null;
  const sort = params.get('sort'); if (sort === 'ev' || sort === 'matchup' || sort === 'chance') f.sort = sort;
  return f;
}
