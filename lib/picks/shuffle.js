// The shuffle: a bar per stat. The bar is a height (28 points, 85 receiving yards, 6 catches);
// every player on the slate with logs is read at every height the bar can take, through the
// ladder's math (ladderOf in lib/picks/board.js: half the tail of his own distribution over the
// line, centred on tonight's projection with the matchup inside it, half how often he actually
// cleared it over his last 5 / 10 / the season), and the book's rungs ride beside the bars with
// their prices. The panel keeps the players whose chance at the bar stays over a floor and drops
// the rest as the bar rises; the pure helpers under `shuffleOf` do that reading on the payload,
// so the page needs one request per market and none per slider move.
//
// Pure: the store feeds `shuffleOf` a built board (the sides carry each player's ladder, so his
// environment, and the opponent's allowed table), the slate's PropFinder pull (his logs and lines)
// and the finished games' box scores.
import { impliedProb, fairOdds } from '../nfl/odds';
import { upperTail, envFactor } from './projection';

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * What a chance can be read from: the board's blend (his season blended with his last ten, × the
 * matchup; the default), a plain window of his own results (× the matchup), his head to head (his
 * last four meetings with the opponent, two at least, as PropFinder's logs hold them; the opponent
 * is in it already, so no matchup on top; the blend stands in for a player without two), or the
 * book's main line as the centre of his distribution. The scorecard says which one has predicted best.
 */
export const READ_FROM = [['blend', 'Board’s blend'], ['l5', 'Last 5'], ['l10', 'Last 10'], ['season', 'Season'], ['h2h', 'Head to head'], ['line', 'The line']];
/** The scorecard predictor that is each read's centre (scorecard.js PREDICTORS): the windows × the matchup, the projection, the head to head, the line. */
export const READ_FROM_PREDICTOR = { blend: 'proj', l5: 'own5x', l10: 'own10x', season: 'ownSeasonx', h2h: 'h2h', line: 'line' };
/** Reads scored on their own rows (the scorecard's sparse predictors): shown with their Brier, never ranked against the others. */
export const SPARSE_READS = new Set(['h2h']);
export const BEST_MIN = 100;   // plays the scorecard needs before it ranks the reads

/**
 * Which read the scorecard says has predicted best: each read's over-the-line Brier (its predictor's,
 * on the rows every predictor covers) pooled over the shuffle's markets, weighted by the plays it was
 * scored on, the lowest best once `min` plays are in. `predictors` is the scorecard's per-market
 * list (summarize → predictors). { best (null until then), n, scores: { blend: { brier, n } … },
 * ranked: the reads best first }.
 */
export function bestReadFrom(predictors, markets = null, { min = BEST_MIN } = {}) {
  const sums = {};
  for (const rep of predictors || []) {
    if (markets && !markets.includes(rep.key)) continue;
    for (const [k, pk] of Object.entries(READ_FROM_PREDICTOR)) {
      const p = (rep.common?.predictors || []).find((x) => x.key === pk);
      if (!p || p.brier == null || !p.lined) continue;
      const s = (sums[k] = sums[k] || { brier: 0, n: 0 });
      s.brier += p.brier * p.lined; s.n += p.lined;
    }
  }
  const scores = Object.fromEntries(Object.entries(sums).map(([k, s]) => [k, { brier: Math.round((s.brier / s.n) * 10000) / 10000, n: s.n }]));
  const ranked = Object.entries(scores).filter(([k]) => !SPARSE_READS.has(k)).sort((a, b) => a[1].brier - b[1].brier || a[1].n - b[1].n).map(([k]) => k);
  const n = ranked.length ? Math.min(...ranked.map((k) => scores[k].n)) : 0;
  return { best: n >= min ? ranked[0] : null, n, scores, ranked };
}

/** The heights a bar can take: min to max by step. */
export function heightsOf({ min, max, step }) {
  const out = [];
  for (let h = min; h <= max + 1e-9; h += step) out.push(r1(h));
  return out;
}

/** The line a height clears: "28+" is over 27.5. */
export const lineOf = (h) => r1(h - 0.5);

/**
 * One sport's shuffle: `board` is its makeBoard binding (ladderOf, actualFor, statOf, the markets),
 * `markets` the bars ([{ market, min, max, step, start }]).
 */
export function makeShuffle({ board, markets }) {
  const { ladderOf, ownWindows, actualFor, statOf, MARKETS, defenseKey, labelOf } = board;
  const configOf = (market) => markets.find((m) => m.market === market) || null;
  const packRung = (r) => ({ p: r.p, model: r.model, emp: r.emp, l10: r.rates.l10, season: r.rates.season });

  /**
   * Every player on the slate read at every height of the market's bar:
   *   { market, label, unit, heights, step, start, players: [{ key, player, team, opp, venue, pos, slot,
   *     depth, injury, exp, sd, env, matchup, teamFactor, floor, ceiling, spot, confirmed, main,
   *     at: [rung per height | null], book: [the book's priced rungs], actual, final }] }
   * `env` is the multiplier on his rate in the ladder's centre: `matchup` (what the opponent gives
   * up at his spot over the league, damped) × `teamFactor` (his side's scale, board.js sidesOf),
   * either null when the pull has no table for it. `spot` is the opponent's cell at his spot on the
   * season table (this season blended into last season's; `held` while it is last season's alone),
   * the table the board's projection reads: the court's and the card's window tabs compare against
   * it and move no figure.
   */
  function shuffleOf({ market, board: built, pf, season, results = {} }) {
    const cfg = configOf(market);
    const m = MARKETS[market];
    if (!cfg || !m || m.yesNo) return null;
    const heights = heightsOf(cfg);
    const lines = heights.map(lineOf);
    const stat = defenseKey(market);
    const pfByKey = new Map();
    for (const p of pf?.data?.players || []) if (!pfByKey.has(p.key)) pfByKey.set(p.key, p);
    const players = [];
    for (const g of built?.games || []) {
      for (const side of Object.values(g.sides || {})) {
        for (const p of side.players || []) {
          const pfp = pfByKey.get(p.key);
          if (!pfp?.games?.length) continue;
          const env = p.ladders?.[market]?.[0]?.env ?? null;
          const prop = (pfp.props || []).find((x) => x.market === market) || null;
          const rungs = ladderOf(pfp.games, { market, season, prop, opp: side.opp, env, lines });
          if (!rungs.length) continue;
          const byLine = new Map(rungs.map((r) => [r.line, r]));
          const at = lines.map((line) => { const r = byLine.get(line); return r ? packRung(r) : null; });
          const book = rungs.filter((r) => r.odds != null).map((r) => ({ line: r.line, p: r.p, odds: r.odds, underOdds: r.underOdds ?? null, books: r.books || 0, main: !!r.main }));
          const row = side.allowed?.rows?.[p.envPos] || null;
          const cell = (stat && row?.[stat]) || null;
          const league = (stat && side.allowed?.league?.[p.envPos]?.[stat]) ?? null;
          const matchup = cell ? envFactor(cell.value, league) : null;
          const teamFactor = (stat && p.scale?.[stat]) ?? null;
          const play = (p.plays || []).find((x) => x.market === market && (x.side === 'over' || x.side === 'yes')) || null;
          let actual;   // undefined before the game, null when he did not play
          if (g.final) {
            const line = actualFor(results?.[g.id], p);
            actual = line === undefined ? (play?.actual ?? undefined) : line && line.played !== false ? statOf(line, market) : null;
          }
          const own = ownWindows(pfp.games, { market, season, opp: side.opp || null });
          players.push({
            key: p.key, player: p.player, team: side.team, opp: side.opp, venue: side.venue, pos: p.pos || null, slot: p.slot || null, depth: p.depth || null,
            injury: p.injury || null, espnId: p.espnId || null, game: g.id, start: g.date || null, final: !!g.final,
            exp: rungs[0].proj, sd: rungs[0].sd, env, matchup, teamFactor, n: rungs[0].rates.n, l10N: rungs[0].rates.l10N,
            own: { l3: own.l3, l5: own.l5, l10: own.l10, season: own.season, seasonN: own.seasonN, h2h: own.h2h, h2hN: own.h2hN, blend: env ? r1(rungs[0].proj / env) : rungs[0].proj },
            floor: p.ranges?.[market]?.floor ?? null, ceiling: p.ranges?.[market]?.ceiling ?? null,
            spot: cell ? { pos: p.envPos, rank: cell.rank ?? null, value: cell.value ?? null, league, count: side.allowed?.count || null, held: !!row.held, gp: row.gp ?? null } : null,
            confirmed: !!play?.confirmed, sheet: play?.sheetFiles || [], main: play ? { line: play.line, p: play.p, odds: play.odds ?? null } : null,
            at, book, actual,
          });
        }
      }
    }
    const games = built?.games || [];
    return { market, label: labelOf(market), unit: m.unit, stat, heights, step: cfg.step, start: cfg.start ?? heights[Math.floor(heights.length / 2)], games: games.length, finals: games.filter((g) => g.final).length, players };
  }

  return { shuffleOf, heightsOf: (market) => { const cfg = configOf(market); return cfg ? heightsOf(cfg) : []; }, markets };
}

const dec = (odds) => (odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds);

/**
 * The centre a chance is read around for a window: his average over it × the environment, his
 * head to head as it is (the opponent is in it already), the main line itself for 'line'; null for
 * the board's blend or when the window is empty (the blend then stands in).
 */
export function centreOf(player, from = 'blend') {
  if (!from || from === 'blend') return null;
  if (from === 'line') return player.main?.line ?? null;
  const v = player.own?.[from];
  if (v == null) return null;
  return from === 'h2h' ? r1(v) : r1(v * (player.env ?? 1));
}

/** The chance at the i-th height: the ladder's read, or the model half recentred on the window picked (the hit-rate half stays). */
export function pAt(player, heights, i, from = 'blend') {
  const r = player.at[i];
  if (!r) return null;
  const centre = centreOf(player, from);
  if (centre == null) return r.p;
  const model = r3(upperTail((lineOf(heights[i]) - centre) / Math.max(player.sd || 0, 0.01)));
  return r.emp == null ? model : r3(0.5 * model + 0.5 * r.emp);
}

/**
 * A player's read at a height: his chance there (read from the window picked), how often he
 * cleared it, and the book's price at that line, else at the nearest priced rung above it (the
 * rung's own chance and edge beside it).
 */
export function readAt(player, heights, height, from = 'blend') {
  const i = heights.indexOf(height);
  const r = i < 0 ? null : player.at[i];
  if (!r) return null;
  const line = lineOf(height);
  const centre = centreOf(player, from);
  const p = pAt(player, heights, i, from);
  const model = centre == null ? r.model : r3(upperTail((line - centre) / Math.max(player.sd || 0, 0.01)));
  const exact = player.book.find((b) => b.line === line) || null;
  const nearest = exact || player.book.find((b) => b.line > line) || null;
  const implied = nearest?.odds != null ? impliedProb(nearest.odds) : null;
  // The rung's own chance follows the window too: its line read the same way.
  const rungP = nearest ? (centre == null ? nearest.p : (() => { const m = r3(upperTail((nearest.line - centre) / Math.max(player.sd || 0, 0.01))); const j = heights.indexOf(nearest.line + 0.5); const e = j >= 0 ? player.at[j]?.emp ?? null : null; return e == null ? m : r3(0.5 * m + 0.5 * e); })()) : null;
  return {
    height, line, p, model, emp: r.emp, n: player.n, l10: r.l10, l10N: player.l10N, season: r.season, fair: fairOdds(p), from, centre: centre ?? player.exp,
    book: nearest ? { ...nearest, p: rungP } : null, exact: !!exact, implied: implied == null ? null : r3(implied), edge: nearest && implied != null ? r3(rungP - implied) : null,
    cleared: r.l10 != null && player.l10N ? { of: player.l10N, n: Math.round(r.l10 * player.l10N) } : null,
    got: player.final ? player.actual : undefined, hit: player.final && player.actual != null ? player.actual > line : null,
  };
}

/** The highest height the player still clears at the floor, or null. */
export function thinsAt(player, heights, floor, from = 'blend') {
  for (let i = heights.length - 1; i >= 0; i--) if ((pAt(player, heights, i, from) ?? 0) >= floor) return heights[i];
  return null;
}

/** The players whose chance at the height is at least the floor, the best edge first, then the chance. */
export function survivorsAt(players, heights, height, floor, from = 'blend') {
  return players
    .map((p) => ({ player: p, read: readAt(p, heights, height, from) }))
    .filter((x) => x.read && x.read.p >= floor)
    .map((x) => ({ ...x, thins: thinsAt(x.player, heights, floor, from) }))
    .sort((a, b) => (b.read.edge ?? -9) - (a.read.edge ?? -9) || b.read.p - a.read.p || a.player.player.localeCompare(b.player.player));
}

/** The players under the floor at the height, the nearest miss first, each with the highest height he still clears. */
export function fallenAt(players, heights, height, floor, from = 'blend') {
  return players
    .map((p) => ({ player: p, read: readAt(p, heights, height, from) }))
    .filter((x) => x.read && x.read.p < floor)
    .map((x) => ({ ...x, thins: thinsAt(x.player, heights, floor, from) }))
    .sort((a, b) => b.read.p - a.read.p);
}

/** How many players clear each height at the floor. */
export function curveOf(players, heights, floor, from = 'blend') {
  return heights.map((height, i) => ({ height, n: players.filter((p) => (pAt(p, heights, i, from) ?? 0) >= floor).length }));
}

/** Flat-stake return per unit of a read's book rung, from a hit or a miss (for the graded view). */
export function returnOf(read) {
  if (!read?.book || read.hit == null || read.book.odds == null) return null;
  return read.hit ? r3(dec(read.book.odds) - 1) : -1;
}
