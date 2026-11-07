// The slate's boards (Vincent, 2026-11-01, with his own lists as the form: "Top TD Board … Best Receiving Ladders: Puka
// Nacua 100+ / 110+ / 125+ … we should for assists, points, rebounds have the best candidates. Also, we should list the
// point ladders. 20+, 25+ etc."): ranked lists of players across the slate, read off the board the page already holds.
// Pure and client-safe; the NBA's specs are here (the NFL's lists are built elsewhere).
//
//   candidateBoard  a yes / no market (anytime TD, double-double): every active player with the play, the likeliest
//                   first, listed with his chance (Vincent, 2026-11-01: "TD candidates we should list with chance%"; the
//                   price and the EV ride on the row for the hover, never on the line); `pos` keeps one position (the
//                   tight ends); a thin or day-to-day player is listed with his caveat ("if he plays", "if role confirmed")
//   ladderBoard     a ladder market (points, receiving yards): every active player with the highest mark he clears at
//                   each tier — strong, lean, thin (`TIERS`, on the board's chance) — ascending ("20+ strong · 25+ lean
//                   · 30+ thin"; a line of 19.5 reads 20+) — ranked by the strong mark, then the lean, then the thin; a
//                   player without a mark at the thin floor is off the board
//   boardsOf        the sport's boards in one call: [{ key, title, note, kind, rows }]
import { fmtEv, MIN_MINUTES } from './value';
import { pAt } from './shuffle';

/**
 * The tiers a mark is called at, on the board's chance (Vincent, 2026-11-01: "I don't care about edge etc… I just want to
 * know what I should bet on: 10+ points (strong), 20+ points (lean), 30+ points (thin)"): strong from 70%, lean from 55%,
 * thin from 40%. A ladder line carries the highest mark he clears at each tier.
 */
export const TIERS = [['strong', 0.7], ['lean', 0.55], ['thin', 0.4]];
export const LADDER_BAR = TIERS[TIERS.length - 1][1];
export const MAX_MARKS = TIERS.length;
export const PER_BOARD = 10;

/** 'strong' | 'lean' | 'thin' | null for a chance. */
export function tierOf(p) {
  if (p == null) return null;
  for (const [name, floor] of TIERS) if (p >= floor) return name;
  return null;
}

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
 * A ladder market's board: [{ …player, proj, marks: [{ line, mark, tier, p, odds, ev }], top, strong, lean, thin }],
 * `marks` the highest rung he clears at each tier, ascending ("20+ strong · 25+ lean · 30+ thin"; a rung that is the
 * same for two tiers is listed once, at the stronger); ranked by the strong mark, then the lean, then the thin, then
 * the chance. A player with no rung at the thin floor is off the board.
 */
export function ladderBoard(board, { market, tiers = TIERS, gameId = null, limit = null, keepAll = false } = {}) {
  const rows = [];
  for (const s of sidesOf(board, gameId)) {
    const rungs = (s.p.ladders?.[market] || []).filter((r) => r.p != null && r.line != null).sort((a, b) => a.line - b.line);
    const range = s.p.ranges?.[market] || null;
    if (!rungs.length && !(keepAll && range?.exp != null)) continue;
    const marks = []; const seen = new Set();
    for (const [tier, floor] of tiers) {
      const cleared = rungs.filter((r) => r.p >= floor);
      const r = cleared[cleared.length - 1];
      if (!r || seen.has(r.line)) continue;
      seen.add(r.line);
      marks.push({ line: r.line, mark: markOf(r.line), tier, p: r.p, raw: r.raw ?? null, odds: r.odds ?? null, ev: r.ev ?? null, fair: r.fair ?? null, main: !!r.main });
    }
    // `keepAll` (the games view: every active player listed with his projection, a mark or not): a player with no mark at 40% stays.
    if (!marks.length && !(keepAll && range?.exp != null)) continue;
    marks.sort((a, b) => a.line - b.line);
    const at = (tier) => marks.find((m) => m.tier === tier) || null;
    const play = (s.p.plays || []).find((x) => x.market === market && x.side === 'over' && !x.steep) || null;
    rows.push({ ...rowBase(s), market, proj: range?.exp ?? null, floor: range?.floor ?? null, ceiling: range?.ceiling ?? null, marks, top: marks[marks.length - 1] || null, strong: at('strong'), lean: at('lean'), thin: at('thin'), line: range?.line ?? null, actual: play?.actual, hit: play?.hit ?? null });
  }
  const key = (r, t) => r[t]?.line ?? -1;
  rows.sort((a, b) => key(b, 'strong') - key(a, 'strong') || key(b, 'lean') - key(a, 'lean') || key(b, 'thin') - key(a, 'thin') || (b.top?.p ?? 0) - (a.top?.p ?? 0) || (b.proj ?? 0) - (a.proj ?? 0) || a.player.localeCompare(b.player));
  return limit ? rows.slice(0, limit) : rows;
}

/**
 * The same board on round marks (Vincent's form: "10+ points (strong), 20+ points (lean), 30+ points (thin)"), read off
 * the shuffle's payload for the market (`GET /api/<sport>/shuffle`: every player at every height of the bar, the chance
 * the court and the Shuffle tab print, `pAt`): the marks are the heights on `step` (points by 5: 10+, 15+, 20+ …), and
 * a player's line carries the highest round mark he clears at each tier. Rows in `ladderBoard`'s shape.
 */
export function tierBoard(shuffle, { step = 1, tiers = TIERS, gameId = null, limit = null, keepAll = false } = {}) {
  const heights = shuffle?.heights || [];
  const marksAt = heights.map((h, i) => [h, i]).filter(([h]) => h % step === 0);
  const rows = [];
  for (const pl of shuffle?.players || []) {
    if (gameId && String(pl.game) !== String(gameId)) continue;
    if (pl.health === 'Out') continue;
    const read = marksAt.map(([h, i]) => ({ h, i, p: pAt(pl, heights, i) })).filter((x) => x.p != null);
    const marks = []; const seen = new Set();
    for (const [tier, floor] of tiers) {
      const cleared = read.filter((x) => x.p >= floor);
      const x = cleared[cleared.length - 1];
      if (!x || seen.has(x.h)) continue;
      seen.add(x.h);
      const book = (pl.book || []).find((b) => b.line === x.h - 0.5) || null;
      marks.push({ line: x.h - 0.5, mark: `${x.h}+`, tier, p: x.p, raw: pl.at[x.i]?.raw ?? null, odds: book?.odds ?? null, ev: null, fair: null, main: !!book?.main });
    }
    // `keepAll` (the games view: every active player listed with his projection, a mark or not): a player with no mark at 40% stays.
    if (!marks.length && !(keepAll && pl.exp != null)) continue;
    marks.sort((a, b) => a.line - b.line);
    const at = (tier) => marks.find((m) => m.tier === tier) || null;
    const minutes = pl.minutes?.tonight ?? null;
    const thin = minutes != null && minutes < MIN_MINUTES;
    rows.push({
      key: pl.key, player: pl.player, espnId: pl.espnId || null, team: pl.team, opp: pl.opp, venue: pl.venue, pos: pl.pos || null, slot: pl.slot || null, depth: pl.depth || null,
      game: pl.game, start: pl.start || null, final: !!pl.final, health: pl.health || null, thin, b2b: false, caveat: pl.health === 'DTD' ? 'if he plays' : thin ? 'if role confirmed' : null,
      market: shuffle.market, proj: pl.exp ?? null, floor: pl.floor ?? null, ceiling: pl.ceiling ?? null, marks, top: marks[marks.length - 1] || null, strong: at('strong'), lean: at('lean'), thin: at('thin'),
      actual: pl.actual, hit: null,
    });
  }
  const key = (r, t) => r[t]?.line ?? -1;
  rows.sort((a, b) => key(b, 'strong') - key(a, 'strong') || key(b, 'lean') - key(a, 'lean') || key(b, 'thin') - key(a, 'thin') || (b.top?.p ?? 0) - (a.top?.p ?? 0) || (b.proj ?? 0) - (a.proj ?? 0) || a.player.localeCompare(b.player));
  return limit ? rows.slice(0, limit) : rows;
}

/** The stat a market's matchup is read on (PropFinder's table keys: the combos on their own key). */
const STAT_KEY = { pts: 'pts', reb: 'reb', ast: 'ast', tpm: 'tpm', pra: 'pra', stl: 'stl', blk: 'blk' };

/**
 * Where a line's projection comes from (Vincent, 2026-11-01: "I also need to know the matchup from propfinder / cheat
 * sheet so I know where the projection is coming from"): the position his matchup is read at, PropFinder's rank there
 * this season (the table the projection reads) and over the last ten, the cheat sheet's tile, whether the sheet sits in
 * the same third, and the factor the matchup puts on his rate. { pos, count, pf, pfValue, l10, l10Value, league, sheet,
 * agree, factor, from } or null without a table. Off the side's `allowed` table on the board (lib/picks/board.js sidesOf).
 */
export function matchupOf(board, row) {
  const g = (board?.games || []).find((x) => String(x.id) === String(row.game));
  const side = g?.sides?.[row.team];
  if (!side) return null;
  const sp = (side.players || []).find((p) => p.key === row.key) || null;
  const pos = sp?.envPos || row.envPos || null;
  const stat = STAT_KEY[row.market] || row.market;
  const a = side.allowed || null;
  const cell = pos ? a?.rows?.[pos]?.[stat] || null : null;
  const l10 = pos ? a?.windows?.l10?.rows?.[pos]?.[stat] || null : null;
  const range = sp?.ranges?.[row.market] || null;
  if (!pos || (!cell && !l10)) return range?.matchup != null ? { pos, factor: range.matchup, from: range.matchupFrom?.from || null } : null;
  const count = a?.count || 30;
  const third = (r) => (r == null ? null : r <= Math.ceil(count / 3) ? 'soft' : r > count - Math.ceil(count / 3) ? 'tough' : 'mid');
  const pf = cell?.rank ?? null;
  const sheet = cell?.sheet ?? null;
  return {
    pos, count, stat,
    pf, pfValue: cell?.value ?? null, pfTone: third(pf),
    l10: l10?.rank ?? null, l10Value: l10?.value ?? null, l10Tone: third(l10?.rank ?? null),
    league: a?.league?.[pos]?.[stat] ?? null,
    sheet, sheetTone: sheet == null ? null : third(sheet), agree: sheet != null && pf != null ? third(sheet) === third(pf) : null,
    factor: range?.matchup ?? null, from: range?.matchupFrom?.from || (sheet != null && pf != null ? 'blend' : pf != null ? 'propfinder' : sheet != null ? 'sheet' : null),
  };
}

/** The matchup in words for a hover: "PG: PropFinder #3 of 30 (24.1 a game, the league 21.0) · L10 #5 · cheat sheet #4, the same third · × 1.06 on his rate". */
export function matchupText(m, opp = '') {
  if (!m) return 'No matchup table: the projection is his own rate';
  const parts = [];
  if (m.pf != null) parts.push(`PropFinder #${m.pf} of ${m.count}${m.pfValue != null ? ` (${m.pfValue} a game${m.league != null ? `, the league ${m.league}` : ''})` : ''}`);
  if (m.l10 != null) parts.push(`last 10 #${m.l10}`);
  if (m.sheet != null) parts.push(`cheat sheet #${m.sheet}${m.agree == null ? '' : m.agree ? ', the same third: confirmed' : ', a different third: not confirmed'}`);
  if (m.factor != null) parts.push(`× ${Number(m.factor).toFixed(2)} on his rate (${m.from === 'team' ? 'what the opponent gives up to all positions' : m.from === 'blend' ? 'the sheet and PropFinder blended' : m.from === 'sheet' ? 'the cheat sheet alone' : 'PropFinder alone'})`);
  return `${opp ? `${opp} to ${m.pos}s` : m.pos}: ${parts.join(' · ')}`;
}

/** "20+ strong · 25+ lean · 30+ thin" for a row's marks. */
export const marksText = (row) => (row?.marks || []).map((m) => `${m.mark} ${m.tier}`).join(' · ');

/** A mark's hover: the chance, the price and the EV where priced. */
export const markText = (m, unit = '') => `${m.mark}${unit ? ` ${unit}` : ''} — ${m.tier} (${Math.round(m.p * 100)}% on the board)${m.odds != null ? ` · ${m.odds > 0 ? '+' : ''}${m.odds} at the book · EV ${fmtEv(m.ev)} a unit` : ` · no price on this rung, break-even ${m.fair || '—'}`}${m.main ? ' · the book’s main line' : ''}`;

/**
 * A sport's boards: `specs` = [{ key, title, note, kind: 'candidates' | 'ladder', market, pos?, min?, limit? }] →
 * [{ …spec, rows }], the rows built as above; `gameId` cuts every board to one game.
 */
export function boardsOf(board, specs, { gameId = null, shuffles = null } = {}) {
  const withMatchup = (b) => ({ ...b, rows: b.rows.map((r) => ({ ...r, matchup: matchupOf(board, r) })) });
  return specs.map((spec) => withMatchup(buildOne(board, spec, { gameId, shuffles })));
}

function buildOne(board, spec, { gameId, shuffles }) {
  {
    if (spec.kind === 'candidates') return { ...spec, rows: candidateBoard(board, { market: spec.market, pos: spec.pos || null, min: spec.min || 0, gameId, limit: spec.limit ?? null }) };
    // Round marks off the shuffle when it is loaded (`round: true`), the book's ladder rungs until then.
    const sh = shuffles?.[spec.market];
    if (sh?.players) return { ...spec, round: true, rows: tierBoard(sh, { step: spec.step || 1, tiers: spec.tiers || TIERS, gameId, limit: spec.limit ?? null }) };
    return { ...spec, round: false, rows: ladderBoard(board, { market: spec.market, tiers: spec.tiers || TIERS, gameId, limit: spec.limit ?? null }) };
  }
}

/**
 * The NBA's boards (Vincent, 2026-11-01: "I just want to know what I should bet on: 10+ points (strong), 20+ points
 * (lean), 30+ points (thin)"): the points, rebounds, assists and threes ladders, PRA behind them, each line the marks he
 * clears at the three tiers.
 */
export const NBA_BOARDS = [
  { key: 'pts', title: 'Points', note: 'by 5: the highest mark he clears strong (70%+), lean (55%+) and thin (40%+)', kind: 'ladder', market: 'pts', step: 5 },
  { key: 'reb', title: 'Rebounds', note: 'by 2 · strong · lean · thin', kind: 'ladder', market: 'reb', step: 2 },
  { key: 'ast', title: 'Assists', note: 'by 2 · strong · lean · thin', kind: 'ladder', market: 'ast', step: 2 },
  { key: 'tpm', title: 'Threes', note: 'strong · lean · thin', kind: 'ladder', market: 'tpm', step: 1 },
  { key: 'pra', title: 'Points + rebounds + assists', note: 'by 5 · strong · lean · thin', kind: 'ladder', market: 'pra', step: 5 },
  // The NBA's touchdown list (Vincent, 2026-11-01: "TD candidates we should list with chance%"): who records a double-double, by his chance.
  { key: 'dd', title: 'Double-double candidates', note: 'the likeliest first, with his chance', kind: 'candidates', market: 'dd', min: 0.2 },
];
