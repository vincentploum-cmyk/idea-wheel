// The week's boards (Vincent, 2026-11-01: "for NFL, I think we will need to follow the following structure based on the
// cheat sheet and propfinder data": a Top TD board, a first-half TD board, the best receiving / rushing / passing
// ladders and three TE touchdowns across the slate), read off the built board (lib/picks/board.js, every side player's
// plays, ladders and ranges) and ranked as everything on the site is since the restructure of 2026-10-31: by the
// expected value at the book's price (lib/picks/value.js), the chance breaking ties, the floors hiding the capital-dead
// locks. Pure and client-safe: the server attaches the boards at the defaults (lib/nfl/picks.js `boards`), the panel
// (components/nfl/NflBoards.jsx) runs the same function with the user's own floors.
//
// Each board: { key, title, note, rows }, the rows ranked, the ones failing a floor after the ones that pass (`fails`
// names the floor; the panel shows them with "Show marginal"). A row carries the player, the game, the play and its
// value as the Top Plays table does, plus:
//   role        the words next to a name in Vincent's lists — "if active" when he is a game-time decision (DTD), "if
//               role confirmed" when his read leans on a teammate out tonight (a without-teammate split or a vacated
//               lift, lib/picks/injuries.js), with the names
//   rungs       a ladder row: the priced rungs worth playing (passing the floors, three at most, the best value ringed),
//               each "100+" for o99.5, with its chance, price and EV
//   derived     a first-half row: the anytime TD chance it is read from (lib/nfl/markets.js firstHalfOf, 1 − √(1 − p));
//               `synthetic` when the book has no first-half line, in which case the fair price stands alone and the row
//               is not failed for the missing price (nothing to pay for yet)
//   why         the TE board's line: his targets and receiving yards projected, the opponent's rank to tight ends
import { DEFAULTS, failsOf, orderBy, ladderValue, juiceOk } from '../picks/value';
import { MARKETS, labelOf } from './markets';

export const BOARDS = [
  ['td', 'Top TD board', 'Every anytime-touchdown play on the week, one a player, the best value at the book’s price first.'],
  ['firstHalfTd', 'Best first-half TD board', 'The chance of a touchdown before the half, read off each player’s anytime chance (a touchdown count with half its rate in the half: 1 − √(1 − p)); priced where PropFinder carries a first-half line, the fair price alone where it does not.'],
  ['receiving', 'Best receiving ladders', 'Per receiver the rungs of his receiving-yards ladder worth playing at the book’s prices: the alternate lines whose EV clears the floor, the best value ringed.'],
  ['rushing', 'Best rushing ladders', 'Per runner — quarterbacks included — the rungs of his rushing-yards ladder worth playing.'],
  ['passing', 'Best passing ladders', 'Per quarterback the rungs of his passing-yards ladder worth playing.'],
  ['teTd', 'TE touchdowns across the slate', 'The tight ends’ anytime-touchdown plays, the best value first, with the volume and the matchup behind each.'],
];
/** How many rows a board shows before "Show all". */
export const SHOWN = { td: 10, firstHalfTd: 8, receiving: 8, rushing: 6, passing: 4, teTd: 3 };
/** The rungs a ladder row names. */
export const LADDER_RUNGS = 3;
const LADDER_MARKET = { receiving: 'rec_yds', rushing: 'rush_yds', passing: 'pass_yds' };

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const surname = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || String(name || '');

/** "100+" for o99.5 yards, "o100" for a whole line. */
export const markOf = (line) => (line == null ? '—' : Number.isInteger(line) ? `o${line}` : `${Math.ceil(line)}+`);

/** The side player's own windows carry the stat a market settles on under its first field (recYds, rushYds, td …). */
const statOf = (market) => MARKETS[market]?.defense || MARKETS[market]?.fields?.[0] || null;

/**
 * The words beside a name: [{ kind: 'active' | 'role', word, why }]. 'active' when he is a game-time decision; 'role'
 * when his read leans on a teammate out tonight — the play's (or his) without-teammate split, else the production the
 * out players left him for the stat (`own[stat].lift`, `liftFrom`).
 */
export function roleOf(sp, stat = null, play = null) {
  const out = [];
  if (sp?.health === 'DTD') out.push({ kind: 'active', word: 'if active', why: `${sp.injury || 'Listed'}${sp.injuryDetail ? `: ${sp.injuryDetail}` : ''} — a game-time decision` });
  const wo = play?.without || sp?.without || null;
  const lift = stat ? sp?.own?.[stat]?.lift : null;
  const from = stat && lift ? (sp.own[stat].liftFrom || []).map((n) => (typeof n === 'string' ? surname(n) : surname(n?.name))) : [];
  const names = wo?.names?.length ? wo.names : from;
  if (names.length) {
    const who = names.join(', ');
    out.push({ kind: 'role', word: 'if role confirmed', why: wo ? `${who} out: his read leans on his ${wo.n} game${wo.n === 1 ? '' : 's'} without ${names.length > 1 ? 'them' : 'him'} (${Math.round((wo.weight || 0) * 100)}% of the way)` : `${who} out: the production left behind lifts his rate (+${r1(lift)} a game)` });
  }
  return out;
}

/** The opponent's cell at his spot for the stat, in the Top Plays table's shape; the play's own soft spot without one. */
function spotOf(side, sp, stat, play = null) {
  const cell = sp?.envPos && stat ? side?.allowed?.rows?.[sp.envPos]?.[stat] || null : null;
  if (cell) return { pos: sp.envPos, rank: cell.rankBlend ?? cell.rank ?? null, value: cell.value ?? null, count: side.allowed?.count || null };
  if (play?.spot) return { pos: sp?.pos || null, rank: play.spot.rank, value: play.spot.value ?? null, count: play.spot.teams ?? null };
  return null;
}

/** Why a row fails the floors, or null; a synthetic row (no book line yet) is not failed for the price it lacks. */
export function boardFails(row, filters = DEFAULTS) {
  const f = { ...DEFAULTS, ...(filters || {}) };
  const fails = failsOf(row, f);
  if (fails === 'price' && row.synthetic) return f.minChance != null && row.p < f.minChance ? 'chance' : null;
  return fails;
}

const players = (board) => {
  const out = [];
  for (const g of board?.games || []) for (const side of Object.values(g.sides || {})) for (const sp of side.players || []) out.push({ g, side, sp });
  return out;
};

const rank = (rows, filters) => {
  const f = { ...DEFAULTS, ...(filters || {}) };
  const order = orderBy(f.sort === 'chance' ? 'chance' : 'ev');
  return rows.map((r) => ({ ...r, fails: boardFails(r, f) })).sort((a, b) => (a.fails ? 1 : 0) - (b.fails ? 1 : 0) || order(a, b));
};

/** One player's row for a yes/no market (the touchdown boards): his likeliest-value play on it. */
function playRow({ g, side, sp }, market, filters) {
  if (sp.out) return null;
  const f = { ...DEFAULTS, ...(filters || {}) };
  const mine = (sp.plays || []).filter((x) => x.market === market && x.side === 'yes' && !x.steep);
  if (!mine.length) return null;
  const order = orderBy(f.sort === 'chance' ? 'chance' : 'ev');
  const play = [...mine].sort(order)[0];
  const stat = statOf(market);
  const m = MARKETS[market];
  return {
    id: play.id, player: sp.player, key: sp.key, espnId: sp.espnId || play.espnId || null, team: side.team, opp: side.opp, venue: side.venue, pos: sp.pos || null, slot: sp.slot || null, depth: sp.depth || null,
    game: g.id, start: g.date || null, final: !!g.final, market, label: labelOf(market), group: m.group, unit: m.unit, line: play.line, side: 'yes',
    p: play.p, raw: play.raw ?? null, fair: play.fair, odds: play.odds ?? null, implied: play.implied ?? null, edge: play.edge ?? null, ev: play.ev ?? null, book: play.book || null,
    confirmed: !!play.confirmed, sheetOnly: !play.pfBacked && !!play.onSheet, form: play.form || null, rates: { l5: play.rates?.l5 ?? null, l5N: play.rates?.l5N ?? 0, season: play.rates?.season ?? null },
    health: sp.health || null, injury: sp.injury || null, out: !!sp.out, thin: !!sp.thin, actual: play.actual, hit: play.hit,
    spot: spotOf(side, sp, stat, play), role: roleOf(sp, stat, play), derived: play.derived || null, synthetic: !!play.synthetic,
    volume: { targets: sp.ranges?.targets?.exp ?? null, recYds: sp.ranges?.rec_yds?.exp ?? null, rushAtt: sp.ranges?.rush_att?.exp ?? null, rushYds: sp.ranges?.rush_yds?.exp ?? null },
  };
}

/** One player's ladder row for a yardage market: the priced rungs that pass the floors (the best alone when none does). */
function ladderRow({ g, side, sp }, market, filters) {
  if (sp.out) return null;
  const f = { ...DEFAULTS, ...(filters || {}) };
  const rungs = sp.ladders?.[market];
  if (!rungs?.length) return null;
  const priced = ladderValue(rungs, 'over').filter((r) => r.odds != null);
  if (!priced.length) return null;
  const ok = (r) => juiceOk(r.odds, f.maxJuice) && r.ev != null && r.ev >= f.minEv && (f.minChance == null || r.p >= f.minChance);
  const pass = priced.filter(ok);
  const byEv = (a, b) => (b.ev ?? -9) - (a.ev ?? -9) || a.line - b.line;
  const best = [...(pass.length ? pass : priced)].sort(byEv)[0];
  const named = (pass.length ? pass : [best]).sort(byEv).slice(0, LADDER_RUNGS).sort((a, b) => a.line - b.line);
  const stat = statOf(market);
  const m = MARKETS[market];
  const range = sp.ranges?.[market] || null;
  const play = (sp.plays || []).find((x) => x.market === market && x.actual !== undefined) || null;
  const actual = play ? play.actual : undefined;
  const confirmed = (sp.plays || []).some((x) => x.market === market && x.confirmed);
  return {
    id: `${sp.key}|${market}|ladder`, player: sp.player, key: sp.key, espnId: sp.espnId || play?.espnId || null, team: side.team, opp: side.opp, venue: side.venue, pos: sp.pos || null, slot: sp.slot || null, depth: sp.depth || null,
    game: g.id, start: g.date || null, final: !!g.final, market, label: labelOf(market), group: m.group, unit: m.unit, line: best.line, side: 'over',
    p: best.p, fair: best.fair, odds: best.odds, implied: best.pBook ?? null, edge: best.edge ?? null, ev: best.ev ?? null,
    rungs: named.map((r) => ({ line: r.line, mark: markOf(r.line), p: r.p, odds: r.odds, ev: r.ev, edge: r.edge, main: r.main, best: r.line === best.line, hit: actual == null ? null : actual > r.line })),
    mainLine: rungs.find((r) => r.main)?.line ?? null, rungsPriced: priced.length, rungsPassing: pass.length,
    proj: range ? { exp: range.exp, floor: range.floor, ceiling: range.ceiling } : null, gap: range?.exp != null ? r1(range.exp - best.line) : null,
    confirmed, health: sp.health || null, injury: sp.injury || null, out: !!sp.out, thin: !!sp.thin, actual, hit: actual == null ? null : actual > best.line,
    spot: spotOf(side, sp, stat), role: roleOf(sp, stat),
  };
}

/** The TE board's line under a row: his projected targets and receiving yards, the opponent's rank to tight ends for touchdowns. */
function whyOf(r) {
  const parts = [];
  if (r.volume?.targets != null) parts.push(`${r.volume.targets} targets projected`);
  if (r.volume?.recYds != null) parts.push(`${r.volume.recYds} rec yds`);
  if (r.spot?.rank) parts.push(`${r.opp} #${r.spot.rank} of ${r.spot.count || '—'} to ${r.spot.pos || r.pos}s for TDs`);
  for (const x of r.role || []) parts.push(x.why);
  return parts.join(' · ');
}

/**
 * The six boards for a week off its built board, at the floors given (the defaults when the server attaches them):
 * { td, firstHalfTd, receiving, rushing, passing, teTd }, each { key, title, note, rows, shown }.
 */
export function weekBoards(board, filters = DEFAULTS) {
  const all = players(board);
  const td = rank(all.map((x) => playRow(x, 'anytime_td', filters)).filter(Boolean), filters);
  const firstHalfTd = rank(all.map((x) => playRow(x, 'first_half_td', filters)).filter(Boolean), filters);
  const ladders = Object.fromEntries(Object.entries(LADDER_MARKET).map(([key, market]) => [key, rank(all.map((x) => ladderRow(x, market, filters)).filter(Boolean), filters)]));
  const teTd = td.filter((r) => r.pos === 'TE').map((r) => ({ ...r, why: whyOf(r) }));
  const rows = { td, firstHalfTd, ...ladders, teTd };
  const out = {};
  for (const [key, title, note] of BOARDS) out[key] = { key, title, note, market: LADDER_MARKET[key] || (key === 'firstHalfTd' ? 'first_half_td' : 'anytime_td'), rows: rows[key], shown: SHOWN[key], passing: rows[key].filter((r) => !r.fails).length };
  return out;
}
