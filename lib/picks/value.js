// The value layer over the picks boards (the restructure brief of 2026-10-31, "Best matchups, immediately visible"):
// every play's expected value at the book's price, the floors that hide the capital-dead "locks", and the Matchup
// Score that ranks the games. Pure and client-safe (no store, no names.js): the server runs it with the defaults when
// it builds a board (lib/picks/board.js, `value` on the board and `matchup` on every game), and the panels run the
// same functions again with the user's own sliders (components/picks/value-filters.js), so a slider never refetches.
//
// The prediction engine is untouched: `p` is the board's chance as it prints it (calibrated where the fit holds), the
// price the book's; this module only prices the two against each other and ranks what comes out.
//
//   decimal  = american > 0 ? american / 100 + 1 : 100 / |american| + 1
//   pBook    = 1 / decimal                                   (the book's implied chance, vig in)
//   ev       = p × (decimal − 1) − (1 − p)                   (the return per unit staked)
//   edge     = p − pBook                                     (the probability edge, what the boards carried before)
//
// A 99% lock at -5000 is worth about +1% a unit; a 47% touchdown at +145 about +13%. Ranking by the chance inverts
// the P&L, so everything ranks by `ev` and the chance is never the primary sort.

/** The floors a board applies by default; a user's own ride in localStorage (components/picks/value-filters.js). */
export const DEFAULTS = Object.freeze({
  minEv: 0.05,        // a play must return this much a unit at the book's price (5%)
  maxJuice: -200,     // and be priced no worse than this (a price under it, -250, is capital-dead)
  minChance: null,    // optional: the board's chance at least this (off by default)
  sort: 'ev',         // 'ev' | 'matchup' | 'chance' — the top plays' and the games' order
  marginal: false,    // show the rows that fail a floor
});

/** The Matchup Score's weights: top 3 plays' EV summed, half a point a +EV play, 15% a leak tier (the brief's). */
export const MATCHUP = Object.freeze({ top: 3, breadth: 0.5, leak: 0.15 });
/** A big spread benches the starters in the fourth quarter (the NBA): the score × 1 to BLOWOUT.min from `from` to `to` points. */
export const BLOWOUT = Object.freeze({ from: 9, to: 16, min: 0.7 });
/** The NBA's minutes gate: a play on a player projected under this many minutes is thin (demoted, shown as marginal). */
export const MIN_MINUTES = 20;

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** American → decimal odds, null without a price. */
export function decimalOf(american) {
  const o = Number(american);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
}

/**
 * The value of a chance at a price: { decimal, pBook, ev, edge }, or null without a price or a chance. `ev` is the
 * return per unit staked (0.13 = +13%), `edge` the chance over the book's implied one.
 */
export function evOf(p, american) {
  const decimal = decimalOf(american);
  if (decimal == null || p == null || !(p >= 0 && p <= 1)) return null;
  const pBook = 1 / decimal;
  return { decimal: r4(decimal), pBook: r3(pBook), ev: r4(p * (decimal - 1) - (1 - p)), edge: r3(p - pBook) };
}

/** Whether a price is no worse than the juice ceiling (-150 clears -200, -250 does not; a plus price always clears). */
export function juiceOk(american, maxJuice = DEFAULTS.maxJuice) {
  if (american == null) return false;
  if (maxJuice == null) return true;
  return american > 0 || american >= maxJuice;
}

/**
 * Why a play fails the floors, or null when it passes: 'price' (no price: no value to read), 'juice' (priced past the
 * ceiling), 'ev' (under the minimum), 'chance' (under the optional chance floor), 'thin' (the NBA's minutes gate),
 * 'out' (the player is out). The first reason found is the one named.
 */
export function failsOf(row, filters = DEFAULTS) {
  const f = { ...DEFAULTS, ...(filters || {}) };
  if (row.out) return 'out';
  if (row.ev == null || row.odds == null) return 'price';
  if (row.thin) return 'thin';
  if (!juiceOk(row.odds, f.maxJuice)) return 'juice';
  if (row.ev < f.minEv) return 'ev';
  if (f.minChance != null && row.p < f.minChance) return 'chance';
  return null;
}

export const passes = (row, filters = DEFAULTS) => failsOf(row, filters) == null;

/** The rows' order by the sort picked: EV first (the default), the chance, or as given (for 'matchup', the games carry the order). */
export function orderBy(sort = 'ev') {
  if (sort === 'chance') return (a, b) => (b.p ?? 0) - (a.p ?? 0) || (b.ev ?? -9) - (a.ev ?? -9) || String(a.player || '').localeCompare(String(b.player || ''));
  return (a, b) => (b.ev ?? -9) - (a.ev ?? -9) || (b.p ?? 0) - (a.p ?? 0) || String(a.player || '').localeCompare(String(b.player || ''));
}

/** The number in a spread as the schedule carries it ("DET -2.5" → 2.5, "-3" → 3), null without one. */
export function spreadOf(spread) {
  if (spread == null) return null;
  const n = typeof spread === 'number' ? spread : Number(String(spread).replace(/[−–]/g, '-').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

/** The blowout dampener on a spread: 1 up to BLOWOUT.from points, down to BLOWOUT.min at BLOWOUT.to, flat past it. */
export function blowoutFactor(spread) {
  const s = spreadOf(spread);
  if (s == null || s <= BLOWOUT.from) return 1;
  if (s >= BLOWOUT.to) return BLOWOUT.min;
  return r3(1 - (1 - BLOWOUT.min) * ((s - BLOWOUT.from) / (BLOWOUT.to - BLOWOUT.from)));
}

const LEVEL_TIER = { poor: 2, weak: 1 };
const TIER_WORD = ['Average', 'Leaky', 'Very leaky'];

/**
 * A team's leak tier from the profile the board already draws (lib/nba/profile.js, lib/nfl/profile.js): 0 average, 1
 * leaky, 2 very leaky — the Allows cell's level (points / yards allowed, the head's "Leaky defense" pill) and the Soft
 * spots cell's (how many positions it leaks to), the higher of the two. { tier, word, from: { allows, spots } }.
 */
export function teamLeak(profile, team) {
  if (!profile?.rows) return { tier: 0, word: TIER_WORD[0], from: null };
  const cell = (key) => profile.rows.find((r) => r.key === key)?.cells?.[team] || null;
  const allows = cell('allows'); const spots = cell('spots');
  const a = LEVEL_TIER[allows?.level] || 0; const s = LEVEL_TIER[spots?.level] || 0;
  const tier = Math.max(a, s);
  return { tier, word: TIER_WORD[tier], from: { allows: allows?.word || null, spots: spots?.word || null } };
}

/**
 * The game's leak: the softer of the two defenses (a play attacks the opponent's defense, so the game's ceiling is
 * its leakiest side), each team's beside it. The NBA's pace and total fold in (the brief: "a volume amplifier"): the
 * game script's tier (lib/nba/profile.js gameScript: both the pace and the total up = 'high', +1 tier; both down =
 * 'low', −1), never under 0 on the whole.
 */
export function gameLeak(g) {
  const profile = g.profile || null;
  const teams = {};
  for (const t of [g.away, g.home]) if (t) teams[t] = teamLeak(profile, t);
  const defense = Math.max(0, ...Object.values(teams).map((x) => x.tier));
  const script = profile?.script || null;
  const pace = script?.tier === 'high' ? 1 : script?.tier === 'low' ? -1 : 0;
  const tier = Math.max(0, defense + pace);
  return { tier, defense, pace, word: TIER_WORD[Math.min(2, defense)], teams, script: script?.word || null };
}

/**
 * The Matchup Score of a game from the plays it holds (each with `ev`): the top three's EV summed in percentage points
 * (the concentration of value: three +10% plays = 30), half a point a +EV play (the breadth), × 1 + 0.15 a leak tier,
 * × the blowout dampener on the spread.
 *   top        the plays passing the floors, the best EV first, MATCHUP.top of them
 *   base       their EV summed (a fraction: 0.3 = 30 points)
 *   breadth    how many plays pass the floors
 *   leakMult   1 + MATCHUP.leak × leak.tier
 *   blowout    the spread's factor (1 without a spread, or a small one)
 *   score      (100 × base + MATCHUP.breadth × breadth) × leakMult × blowout
 * { score, base, breadth, leakMult, blowout, spread, leak, top: [ids] }.
 */
export function matchupScore(plays, { leak = null, spread = null, filters = DEFAULTS } = {}) {
  const live = (plays || []).filter((x) => passes(x, filters)).sort(orderBy('ev'));
  const top = live.slice(0, MATCHUP.top);
  const base = top.reduce((s, x) => s + (x.ev || 0), 0);
  const breadth = live.length;
  const tier = leak?.tier || 0;
  const leakMult = r3(1 + MATCHUP.leak * tier);
  const blowout = blowoutFactor(spread);
  const score = Math.round((100 * base + MATCHUP.breadth * breadth) * leakMult * blowout * 10) / 10;
  return { score, base: r4(base), breadth, leakMult, blowout, spread: spreadOf(spread), leak: leak || null, top: top.map((x) => x.id), topPlay: top[0] || null };
}

/**
 * The games re-ranked with a user's filters: [{ game, matchup }] the highest score first, each `matchup` as
 * `matchupScore` reads it over the board's +EV plays for the game (`board.best`; the server's own `g.matchup` is the
 * same read at the defaults). A game without a +EV play scores 0 and sorts by the tip.
 */
export function rankGames(board, filters = DEFAULTS) {
  const best = board?.best || [];
  const out = (board?.games || []).map((g) => {
    const mine = best.filter((x) => x.game === g.id);
    // The blowout dampener is the NBA's (`board.value.blowout`: starters sit late in a blowout; an NFL favourite runs the ball instead).
    const matchup = matchupScore(mine, { leak: g.matchup?.leak || gameLeak(g), spread: board?.value?.blowout === false ? null : g.odds?.spread ?? null, filters });
    return { game: g, matchup };
  });
  return out.sort((a, b) => b.matchup.score - a.matchup.score || String(a.game.date || '').localeCompare(String(b.game.date || '')));
}

/** The slate's plays passing a user's filters, ordered by the sort picked (`matchup`: by the game's score, then EV). */
export function topPlays(board, filters = DEFAULTS) {
  const f = { ...DEFAULTS, ...(filters || {}) };
  const best = (board?.best || []).filter((x) => passes(x, f));
  if (f.sort === 'matchup') {
    const rank = new Map(rankGames(board, f).map((r, i) => [r.game.id, i]));
    return best.sort((a, b) => (rank.get(a.game) ?? 99) - (rank.get(b.game) ?? 99) || orderBy('ev')(a, b));
  }
  return best.sort(orderBy(f.sort));
}

/** A play's ladder with the value of every rung at its price for the side, the best-EV rung marked (`best: true`). */
export function ladderValue(rungs, side = 'over') {
  const under = side === 'under' || side === 'no';
  const out = (rungs || []).map((r) => {
    const p = under ? (r.p == null ? null : r3(1 - r.p)) : r.p;
    const odds = under ? r.underOdds ?? null : r.odds ?? null;
    const v = evOf(p, odds);
    return { line: r.line, main: !!r.main, p, odds, ev: v?.ev ?? null, edge: v?.edge ?? null, pBook: v?.pBook ?? null, fair: r.fair ?? null, best: false };
  });
  let best = null;
  for (const r of out) if (r.ev != null && (best == null || r.ev > best.ev)) best = r;
  if (best) best.best = true;
  return out;
}

/** "+13.2%" / "−4.0%" / "—" for an EV. */
export const fmtEv = (ev) => (ev == null ? '—' : `${ev >= 0 ? '+' : '−'}${(Math.abs(ev) * 100).toFixed(1)}%`);
