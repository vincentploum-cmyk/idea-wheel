// The slate's boards (Vincent, 2026-11-01, with his own lists as the form: "Top TD Board … Best Receiving Ladders: Puka
// Nacua 100+ / 110+ / 125+ … we should for assists, points, rebounds have the best candidates. Also, we should list the
// point ladders. 20+, 25+ etc."): ranked lists of players across the slate, read off the board the page already holds.
// Pure and client-safe; the NBA's specs are here (the NFL's lists are built elsewhere).
//
//   candidateBoard  a yes / no market (anytime TD): every active player with the play, the likeliest first, the book's
//                   price and the EV beside him; `pos` keeps one position (the tight ends); a thin or day-to-day player
//                   is listed with his caveat ("if he plays"), as the lists say "if role confirmed"
//   ladderBoard     a ladder market (receiving yards, points): every active player with the marks he clears at the bar
//                   (`LADDER_BAR` = 55% on the board's chance, the rung's EV beside it when the book prices it) — up to
//                   `MAX_MARKS` of them, the highest he clears, ascending ("100+ / 110+ / 125+"; a line of 99.5 reads
//                   100+) — ranked by the highest mark, then the chance there; a player without a mark at the bar is
//                   listed off the board
//   boardsOf        the sport's boards in one call: [{ key, title, note, kind, rows }]
import { fmtEv } from './value';

export const LADDER_BAR = 0.55;
export const MAX_MARKS = 3;
export const PER_BOARD = 10;

const r3 = (v) => Math.round(v * 1000) / 1000;
export const markOf = (line) => `${Math.floor(Number(line)) + 1}+`;

/** The caveat a listed player carries: out players are off the boards; thin minutes and a game-time decision are named. */
export function caveatOf(p) {
  if (p.health === 'DTD') return 'if he plays';
  if (p.thin) return 'if role confirmed';
  return null;
}

function sidesOf(board, gameId = null) {
  const out = [];
  for (const g of board?.games || []) {
    if (gameId && String(g.id) !== String(gameId)) continue;
    for (const team of [g.away, g.home]) {
      const side = g.sides?.[team];
      if (!side) continue;
      for (const p of side.players || []) if (!p.out) out.push({ p, side, g });
    }
  }
  return out;
}

const rowBase = ({ p, side, g }) => ({
  key: p.key, player: p.player, espnId: p.espnId || null, team: side.team, opp: side.opp, venue: side.venue, pos: p.pos || null, slot: p.slot || null, depth: p.depth || null,
  game: g.id, start: g.date || null, final: !!g.final, health: p.health || null, thin: !!p.thin, b2b: !!p.b2b, caveat: caveatOf(p),
});

/**
 * A yes / no market's candidates (the anytime TD board): [{ …player, line, p, odds, ev, fair, actual, hit }], the
 * likeliest first; `pos` (a string or a list) keeps those positions alone; `min` the chance floor (the market's).
 */
export function candidateBoard(board, { market, pos = null, min = 0, gameId = null, limit = null } = {}) {
  const keep = pos ? new Set([].concat(pos).map((x) => String(x).toUpperCase())) : null;
  const rows = [];
  for (const s of sidesOf(board, gameId)) {
    if (keep && !keep.has(String(s.p.pos || '').toUpperCase())) continue;
    // The over at the book's main line: the ladder's main rung (the chance the NBA board prints there), the play beside it
    // for the grade and the sheet's check; a yes market (a touchdown) reads its play.
    const main = (s.p.ladders?.[market] || []).find((r) => r.main && r.p != null) || null;
    const play = (s.p.plays || []).filter((x) => x.market === market && (x.side === 'yes' || x.side === 'over') && !x.steep && (!main || x.line === main.line)).sort((a, b) => b.p - a.p)[0] || null;
    const p = main?.p ?? play?.p ?? null;
    if (p == null || p < min || (play?.steep)) continue;
    const odds = main?.odds ?? play?.odds ?? null;
    rows.push({ ...rowBase(s), id: play?.id || `${s.p.key}|${market}|${main?.line}|over`, market, label: play?.label || market, line: main?.line ?? play?.line ?? null, side: play?.side || 'over', p, raw: main?.raw ?? play?.raw ?? null, odds, ev: main ? main.ev ?? null : play?.ev ?? null, fair: main?.fair ?? play?.fair ?? null, confirmed: !!play?.confirmed, actual: play?.actual, hit: play?.hit ?? null, proj: s.p.ranges?.[market]?.exp ?? null });
  }
  rows.sort((a, b) => b.p - a.p || (b.ev ?? -9) - (a.ev ?? -9) || a.player.localeCompare(b.player));
  return limit ? rows.slice(0, limit) : rows;
}

/**
 * A ladder market's board: [{ …player, proj, marks: [{ line, mark, p, odds, ev }], top: the highest mark }], ranked by
 * the highest mark cleared at `bar`, then the chance there; `marks` ascending, the highest MAX_MARKS of them.
 */
export function ladderBoard(board, { market, bar = LADDER_BAR, maxMarks = MAX_MARKS, gameId = null, limit = null } = {}) {
  const rows = [];
  for (const s of sidesOf(board, gameId)) {
    const rungs = (s.p.ladders?.[market] || []).filter((r) => r.p != null && r.line != null);
    if (!rungs.length) continue;
    const cleared = rungs.filter((r) => r.p >= bar).sort((a, b) => a.line - b.line);
    if (!cleared.length) continue;
    const marks = cleared.slice(-maxMarks).map((r) => ({ line: r.line, mark: markOf(r.line), p: r.p, raw: r.raw ?? null, odds: r.odds ?? null, ev: r.ev ?? null, fair: r.fair ?? null, main: !!r.main }));
    const top = marks[marks.length - 1];
    const range = s.p.ranges?.[market] || null;
    const play = (s.p.plays || []).find((x) => x.market === market && x.side === 'over' && !x.steep) || null;
    rows.push({ ...rowBase(s), market, proj: range?.exp ?? null, floor: range?.floor ?? null, ceiling: range?.ceiling ?? null, marks, top, line: range?.line ?? null, actual: play?.actual, hit: play?.hit ?? null });
  }
  rows.sort((a, b) => b.top.line - a.top.line || b.top.p - a.top.p || (b.proj ?? 0) - (a.proj ?? 0) || a.player.localeCompare(b.player));
  return limit ? rows.slice(0, limit) : rows;
}

/** "100+ / 110+ / 125+" for a row's marks. */
export const marksText = (row) => (row?.marks || []).map((m) => m.mark).join(' / ');

/** A mark's hover: the chance, the price and the EV where priced. */
export const markText = (m, unit = '') => `${m.mark}${unit ? ` ${unit}` : ''}: ${Math.round(m.p * 100)}% on the board${m.odds != null ? ` · ${m.odds > 0 ? '+' : ''}${m.odds} at the book · EV ${fmtEv(m.ev)} a unit` : ` · no price on this rung, break-even ${m.fair || '—'}`}${m.main ? ' · the book’s main line' : ''}`;

/**
 * A sport's boards: `specs` = [{ key, title, note, kind: 'candidates' | 'ladder', market, pos?, min?, limit? }] →
 * [{ …spec, rows }], the rows built as above; `gameId` cuts every board to one game.
 */
export function boardsOf(board, specs, { gameId = null } = {}) {
  return specs.map((spec) => ({
    ...spec,
    rows: spec.kind === 'candidates'
      ? candidateBoard(board, { market: spec.market, pos: spec.pos || null, min: spec.min || 0, gameId, limit: spec.limit ?? null })
      : ladderBoard(board, { market: spec.market, bar: spec.bar ?? LADDER_BAR, maxMarks: spec.maxMarks ?? MAX_MARKS, gameId, limit: spec.limit ?? null }),
  }));
}

/**
 * The NBA's boards: per stat the best candidates (the book's main line, the likeliest over first, with the price and the
 * EV) and the ladders (the marks he clears at the bar: 20+ / 25+ for points, 10+ / 12+ rebounds, 6+ / 8+ assists, 3+ / 4+
 * threes), PRA behind them.
 */
export const NBA_BOARDS = [
  { key: 'pts-best', title: 'Best points candidates', note: 'over the book’s main line, the likeliest first, the price and the EV beside him', kind: 'candidates', market: 'pts', min: 0.5 },
  { key: 'pts', title: 'Points ladders', note: 'the marks he clears at 55% or better, the highest first', kind: 'ladder', market: 'pts' },
  { key: 'reb-best', title: 'Best rebounds candidates', note: 'over the book’s main line', kind: 'candidates', market: 'reb', min: 0.5 },
  { key: 'reb', title: 'Rebounds ladders', note: '10+ / 12+ at 55% or better', kind: 'ladder', market: 'reb' },
  { key: 'ast-best', title: 'Best assists candidates', note: 'over the book’s main line', kind: 'candidates', market: 'ast', min: 0.5 },
  { key: 'ast', title: 'Assists ladders', note: '6+ / 8+ at 55% or better', kind: 'ladder', market: 'ast' },
  { key: 'tpm-best', title: 'Best threes candidates', note: 'over the book’s main line', kind: 'candidates', market: 'tpm', min: 0.5 },
  { key: 'tpm', title: 'Threes ladders', note: '3+ / 4+ at 55% or better', kind: 'ladder', market: 'tpm' },
  { key: 'pra', title: 'PRA ladders', note: 'points + rebounds + assists', kind: 'ladder', market: 'pra' },
];
