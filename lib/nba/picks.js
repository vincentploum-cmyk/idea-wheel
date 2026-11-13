// The NBA board: the shared builder (lib/picks/board.js) bound to the NBA's markets; a season
// read runs over the whole season's games.
import { makeBoard } from '../picks/board';
import { nbaBigGames, nbaOutliers, NBA_OUTLIERS } from './big';
import { makeShuffle } from '../picks/shuffle';
import { markets, SHUFFLE_MARKETS } from './markets';
import { teamName } from './teams';
import { characteristics } from './characteristics';
import { profile } from './profile';
import { modelFeatures, modelRead, modelFactor } from './model';

// Steals and blocks since 2026-10-30: the court's tabs and its shuffle bar read them (Vincent: toggles for
// points / rebounds / assists / threes / steals / blocks above the court).
export const LADDER_MARKETS = ['pts', 'reb', 'ast', 'tpm', 'pra', 'stl', 'blk'];
// The best bets (the ranked list, each side's picks, the game line's count and best play) carry these markets alone
// (Vincent, 2026-10-31: "I don't need turnovers in the best bets. Only rebounds / assists / threes"); every other
// market keeps its rows in the per-game tables.
export const BEST_MARKETS = ['reb', 'ast', 'tpm'];
// A player's season window and a team's season table are this season's from the first game
// (lib/picks/board.js SEASON_MIN, lib/picks/propfinder.js defenseAllowed); last season's stand in
// only until then.
// The minutes in the logs (`field`), the 240 a team plays a night (the priced players' share of the
// game, their own minutes over it), and the most one man plays (`cap`), for the rotation
// (lib/picks/rotations.js through board.js sidesOf).
export const COVERAGE = { field: 'min', perGame: 240, min: 0.5, cap: 38 };
// The volume behind a made count (board.js volumeOf, PropFinder's Volume Trends): threes off his
// three-point attempts, free throws off his attempts at the line; the made count stands in when the
// logs carry no attempts.
export const VOLUME_MARKETS = { tpm: { att: 'tpa' }, ftm: { att: 'fta' } };
// The cocktail (lib/picks/board.js COCKTAIL_DEFAULTS), measured on the box scores: tuned on all of 2025-26
// (20,239 priced player-games, 2024-25 behind it), checked unchanged on 2026-27's first week
// (tools/audit/nba_cocktail.py, docs/audits/2026-10-28-nba-cocktail.md; Vincent, 2026-10-28: "can't you
// just figure out yourself what the best cocktail is"). Against the board as it was, this season:
//   windows      the season with his last ten at 0.65 / 0.35, both this season's regular-season games alone
//   scope        'season' (Vincent, 2026-10-28: "look at the last 10 games for now; I don't want to blend with last
//                season's games because playoffs were at the end"): until 2026-10-28 his last five / ten / twenty were
//                his newest games whatever the season, so a playoff team's player carried last spring's playoff nights
//                into his read until he had ten this season. Last season's regular season stands in only until he has
//                played. The cost, measured (docs/audits/2026-10-28-nba-cocktail.md, "The windows inside this season"):
//                the first two weeks' points projection 5.08 → 5.39 off this season, 5.27 → 5.43 over 2025-26's first
//                two weeks, nothing after that; 'regular' (the playoffs out, last season's regular season kept behind
//                his first games) cost nothing at any stage, 5.11 and 5.29
//   matchupK     40: the opponent's table counts at gp / (gp + 40), a tenth of itself in the first week, two
//                thirds over a season (undamped it cost every projection a tenth of its accuracy this season;
//                over a whole season the matchup is worth about 0.1%, damped or not)
//   hitWeights   last five 0.1, last ten 0.3, season 0.6 (was 0.3 / 0.3 / 0.4): a hot last five read 55% and
//                hit 36%; the plays' chance and a rung's cleared-it half both read it
//   ladderModel  0.7 his distribution, 0.3 how often he cleared it (was 0.5 / 0.5), the cleared-it half moved
//                toward the tail at n / (n + 6) (empK) and his spread a touch wider in his first games (spreadA
//                0.2 at 5 games: × 1.17 after one game, × 1.1 after five, × 1.02 after forty)
//   factorMax    1: the minutes factor cuts a rate whose minutes fell, never lifts one (was 1.3): a last five over
//                the minutes behind his rate read 27.6 minutes this season and he played 21.2, the rows it lifted
//                10–20% ran 2.3 points high and those at the cap 5.0 (over 2025-26 the lift was about even, the ladders
//                a touch better without it); an out teammate's production still reaches him through the vacated lift
//   vacatedShare 0.2 of an out player's production to the priced players (was 0.6): with the minutes capped the lift
//                no longer gives up what the minutes added, and at 0.6 the rows it lifted read worse than without it;
//                0.2, the study's own fit, beat 0.6 and 0.3 on every ladder and projection both seasons
//   pull         his first games this season pulled toward his role, a stat at a time (Vincent, 2026-10-29: "we can't treat
//                them all the same, they depend on different dynamics"): his own read counts at n / (n + K) of the way from
//                the league's rate a minute at his position group × the minutes behind his rate. With one or two games
//                in, the projections ran to the ends (2026-27's first week: each projected point over the middle was
//                worth 0.77 of a point, a projected three 0.62); K fitted per stat on 2025-26's first two weeks, the
//                rate a minute per stat and group measured there (roleRates, the slate's own games this season
//                taking over at 2000 minutes; since 2026-10-29 the cheat sheets' player tables and PropFinder's games
//                first, the reference behind them at 500 minutes, the same misses this season at 2000, 500 or 200:
//                Vincent, "the cheat sheets and the data from PropFinder should be the start of everything").
//                Rebounds pulled hardest (K 2: a big rebounds like a big, the position
//                says much), assists least (0.5: who handles the ball is his own), threes 1.5, points and PRA 1.
//                This season's first week: points miss 5.39 → 5.08, rebounds 2.20 → 2.07, assists 1.58 → 1.53,
//                threes 1.02 → 1.01 (docs/audits/2026-10-29-nba-projections.md)
//   opportunity  his role read off his own opportunity where PropFinder's game rows carry it (Vincent, 2026-10-29: "add
//                usage, rebound chances and potential assists to the projections"): points off his usage (the slate's
//                points per usage-minute × his usage × his minutes), rebounds off his rebound chances, assists off his
//                potential assists (each at the slate's conversion), PRA on the three; the position's rate where the rows
//                lack them. Usage was replayed (ESPN's box scores give it: shots, free throws, turnovers over the
//                team's): a player-specific role earns a stronger pull (`pullOpportunity`), points K 1 → 12 (his own
//                games count at n / (n + 12)), PRA 1 → 5 on its parts — points miss this season 5.09 → 5.00, 2025-26 5.095 → 5.062 over the whole
//                season; PRA 6.80 → 6.70 and 6.68 → 6.65. Rebound chances and potential assists are NBA.com's tracking,
//                not in any public box score here: in on PropFinder's figures at the K fitted on the position's role,
//                graded by the scorecard's "His role" read (docs/audits/2026-10-29-nba-projections.md)
//   reach        the ceiling read (Vincent, 2026-10-31: "look at what a player is capable of and then determine the ceiling …
//                Dosunmu has a great matchup today. His line is over 3.5 rebounds but he is capable of getting more when the
//                matchup is good. Hence, I would expect our projections to be higher for him today"): in a soft matchup the
//                ladder's centre moves from his rate × the matchup toward his ceiling — the top quarter of his nights as a
//                ratio on tonight's figure (board.js ladderOf `up`) — by reach × where, `where` the opponent's rank at his spot
//                placed in the league (1 the softest, 0 the middle; the cheat sheet's tile in full, PropFinder's rank at
//                gp / (gp + reachK)). Measured on 2025-26 (125,045 projections, docs/audits/2026-10-31-nba-ceiling.md): a
//                player with upside clears his ceiling as often in a soft third as in a tough one (26.7% / 27.5% / 27.6%), so
//                the matchup does not say when his big night comes; the read at 0.3 shaves the miss (2.513 → 2.505, mostly the
//                board's low bias) and leaves the rungs as they were (0.1393 → 0.1391; at 0.5 and over the main rung and the
//                60–80% bands read worse), the pull toward his floor in a tough spot (`reachDown`) cost at every weight and
//                is off; this season's 1–8-game tables are noise at the top (K 10: a five-game table counts a third)
// Measured and left out: the book's game total and spread (no gain per player), home, rest, a stronger
// teammates-out read; last season's average behind his season to date (3% better this season, out by
// Vincent's call of 2026-10-27); the last twenty across the seasons (season 0.4, last ten 0.2, last five 0.1,
// last twenty 0.3, the first cut of this cocktail, out with last season's games on 2026-10-28).
/** The cocktail until 2026-11-03 (the windows, the role pull, the without split; the replay's `--cocktail before`). */
export const COCKTAIL_BEFORE_RECIPE = {
  windows: { season: 0.65, l10: 0.35 },
  scope: 'season',
  hitWeights: { l5: 0.1, l10: 0.3, season: 0.6 },
  matchupK: 40,
  ladderModel: 0.7,
  empK: 6,
  spreadA: 0.2,
  spreadB: 5,
  factorMax: 1,
  vacatedShare: 0.2,
  pull: { pts: 1, reb: 2, ast: 0.5, tpm: 1.5, pra: 1 },
  pullOpportunity: { pts: 12, reb: 2, ast: 0.5, pra: 5 },
  roleMinutes: 500,
  opportunity: { pts: 'usg', reb: 'rebCh', ast: 'potAst' },
  // 2025-26's points per usage-minute (26,628 player-games of ESPN's box scores) behind the slate's own, worth 500
  // minutes at a 20% usage; rebound chances and potential assists have no public reference: the slate's alone.
  roleConv: { pts: { conv: 0.02396, perMin: 20 } },
  reach: 0.3,
  reachDown: 0,
  reachK: 10,
  roleRates: {
    pts: { G: 0.4998, F: 0.4954, C: 0.478 },
    reb: { G: 0.1363, F: 0.1943, C: 0.3037 },
    ast: { G: 0.1364, F: 0.0942, C: 0.0881 },
    tpm: { G: 0.0652, F: 0.0559, C: 0.0361 },
    pra: { G: 0.7725, F: 0.7838, C: 0.8697 },
  },
};
/**
 * The per-stat recipe (docs/audits/2026-11-03-nba-stat-drivers.md; Vincent, 2026-11-03: "our rules need to be slightly different
 * for all categories"), fitted on 2024-25's box scores and checked unchanged on 2025-26 and this season (board.js
 * COCKTAIL_DEFAULTS names every field): his rate a minute with a half-life of 15 games for points and assists, 20 for rebounds
 * and threes (threes the noisiest, the longest memory), across the seasons; his minutes from this season's last few games;
 * the opponent in all positions — points on its season, rebounds on its last ten, assists on its season with a little of its
 * last ten at his position and its threes attempted allowed, threes on the threes it lets teams attempt (not the threes made
 * at his position, not its 3P%) — and the teammates out as (1 + their production / the team's)^b. The head to head, the venue
 * split, home and rest predicted nothing and are not in it.
 */
export const RECIPE = {
  rate: { pts: 15, reb: 20, ast: 15, tpm: 20, default: 15 },
  minutes: 3,
  matchupK: 10,
  matchup: { pts: { season: 0.94 }, reb: { l10: 0.65 }, ast: { season: 0.62, posL10: 0.18, tpa: 0.51 }, tpm: { tpa: 1.12 } },
  out: { pts: 0.7, reb: 0.53, ast: 0.77, tpm: 0.64, pra: 0.68, default: 0.6 },
};
/** The recipe on the site's cocktail (the audit's `--cocktail recipe`): the without split off, its teammates-out read covering it. */
export const RECIPE_COCKTAIL = { recipe: RECIPE, withoutSplit: false };
/**
 * The site's cocktail since 2026-11-03: the recipe, the role pull off (its long memory reads a player's first games better
 * than the pull toward his role did), the team ceiling kept. Replayed with tools/audit/nba-audit.mjs on the same player-games
 * (docs/audits/2026-11-03-nba-stat-drivers.md, "Built and replayed"): over 2025-26 the average miss points 4.96 → 4.92,
 * rebounds 1.99 → 1.97, assists 1.46 → 1.45, threes 1.012 → 1.005, PRA 6.52 → 6.42, every market's rung Brier lower; this
 * season points 4.89 → 4.83, rebounds 1.98 → 1.91, assists 1.48 → 1.40, threes level, PRA 6.40 → 6.33.
 */
// The team ceiling never cuts a side by more than a fifth (2026-11-05: at the default 0.5 a roster's worth of bench minutes halved
// every Nugget's projection; the ceiling now sums the expected rotation, board.js sumOwn, and the floor is the guard behind it).
export const COCKTAIL_BEFORE_OUTLIERS = { ...COCKTAIL_BEFORE_RECIPE, ...RECIPE_COCKTAIL, pull: null, ceilingFloor: 0.8 };
/**
 * The outlier nights (Vincent, 2026-11-07: "a few players were projected by us to get 4 or 5 rebounds but they actually got
 * 10+ … that is where the money is for nba"; docs/audits/2026-11-07-nba-outliers.md, tools/audit/nba_spikes.py and the board
 * replayed on 2025-26 and this season): the counts' rungs read a count's tail (the negative binomial with the ladder's centre
 * and spread: the normal had 2025-26's threes at his centre + 3 at 2.4% where 3.5% landed, rebounds + 6 at 2.0% for 2.5%,
 * steals and blocks' tails at a fifth of what landed; points and PRA keep the normal, a count's skew cost them near the
 * line), and tonight's starting five moves the projection: a player who started under half of his last ten and starts
 * tonight × 1.1, a starter out of the five × 0.9 (2025-26: 1.21–1.30× and 0.89–0.92× landed; this season's 18 nights 1.0–1.12×
 * and 0.79–0.86×).
 */
export const OUTLIERS = { countTail: ['reb', 'ast', 'tpm', 'stl', 'blk'], lineup: { up: 0.1, down: 0.1, games: 10, min: 5 } };
/**
 * His minutes with the starting five (Vincent, 2026-11-07: "can we predict player's minutes based on lineups?" — "yes build it
 * into the board"): a promoted or demoted player's projection moves by his own minutes with the five over his minutes without
 * it, in place of the flat × 1.1 / × 0.9. Least squares on 2025-26's rotation player-games (ESPN's box scores, the starters as
 * the five), checked unchanged on this season: the minutes' average miss 4.87 → 4.65 over 2025-26, 4.94 → 4.66 this season
 * (the board's own read 4.75 / 4.91); a promoted player 23.3 → 27.5 minutes (27.5 played), this season 21.6 → 26.1 (25.3); a
 * demoted one 22.8 → 19.7 (19.7), this season 20.4 → 18.2 (18.1). `docs/audits/2026-11-07-nba-outliers.md`, "His minutes".
 */
export const LINEUP_MINUTES = {
  ...OUTLIERS.lineup,
  history: 40, hl: 3, splitK: 3, clip: [0.6, 1.6],
  model: { a: 1.3259, dec: 0.62, split: 0.2333, start: 2.268, promoted: 2.6584, demoted: -1.3018, vac: 0.0425 },
  base: { a: 0.4915, dec: 0.9304, vac: 0.0558 },
};
// The Outliers list's mark on every ladder of its four stats, so his card shows the line the list reads (Vincent, 2026-11-07: "Ok").
export const OUTLIER_RUNGS = Object.fromEntries(Object.entries(NBA_OUTLIERS).map(([m, v]) => [m, v.add]));
/**
 * The rebounds' high lines (Vincent, 2026-11-07: "fix the rebounds and assists chances too"): over 2025-26 the rungs at double his
 * centre and up said more than landed (13.6% said, 12.2% landed in the 10–15% band; the Outliers list's top ten 10.8% for 7.9%);
 * σ(−0.3598 + 0.9543 · logit) there, in by the line's height from 1.5 × the centre. The assists' high lines landed on what they
 * said (12.3% → 13.2%; the fit came out at a −0.08, b 0.97): no fit, the top of their list runs high from the ranking alone.
 */
export const HIGH_LINES = { reb: { a: -0.3598, b: 0.9543, from: 1.5, full: 2 } };
/** The cocktail until 2026-11-09 (the replay's `--cocktail beforeStarOut`). */
export const COCKTAIL_BEFORE_STAR_OUT = { ...COCKTAIL_BEFORE_OUTLIERS, ...OUTLIERS, lineup: LINEUP_MINUTES, outlierRungs: OUTLIER_RUNGS, highLines: HIGH_LINES };
/**
 * The star out (Vincent, 2026-11-09: "yesterday Reaves had 40+ points … Doncic was out … our model was still way too
 * conservative … based on the injury report, adjust the game script, including our projection for assists, points,
 * rebounds"; docs/audits/2026-11-09-nba-star-out.md). The board had Reaves at 19.4: Doncic was not on ESPN's report, so
 * nobody was lifted and the team ceiling, still counting his 40 a game, cut the Lakers by 12%. Three changes:
 *  - `lineupOuts`: RotoWire's lineups name who sits that the report missed (lib/picks/injuries.js applyLineupOuts).
 *  - `outRule: 'overlap'`: every out player of this season at 20+ minutes counts, his production × the share of each
 *    teammate's decayed memory he took part in (an absence of 3+ games no longer lifts nobody), player by player.
 *  - `ceilingOut`: the team ceiling sums the lifted rates, so a star out no longer lifts the cut and the lift both.
 * The exponents for rebounds, assists and threes come down (a promoted starter's minutes already move with the lineup's
 * minutes model). Replayed: 2025-26 points 4.88 → 4.84 (bias −0.64 → −0.12; the out nights' −0.73), PRA 6.30 → 6.22,
 * assists 1.436 → 1.435, rebounds and threes level, every main market's rung Brier lower; this season points 4.82 → 4.79,
 * PRA 6.27 → 6.20, rebounds, assists and threes a hair better. Reaves on 2026-11-08: 19.4 → 26.0 (43).
 */
export const STAR_OUT = { pts: 0.7, reb: 0.3, ast: 0.55, tpm: 0.4, pra: 0.62, default: 0.45 };
/**
 * The book's line as a projection (Vincent, 2026-11-13: "check whether the odds from propfinder can help us";
 * docs/audits/2026-11-13-nba-odds.md): on the site's 23 graded nights the main line a book priced near even missed a player's
 * points by 4.84 where the board missed by 5.00, his PRA by 6.16 against 6.40; half and half 4.86 and 6.19 (2.7% and 3.2%
 * better than the board, both halves of the nights). For rebounds, assists, threes, steals and blocks a half-point line is too
 * coarse and the board reads as well or better: not blended.
 */
export const LINE_BLEND = { pts: 0.5, pra: 0.5, band: [-160, 130] };
/** The cocktail until 2026-11-13 (no line blend). */
export const COCKTAIL_BEFORE_LINE = { ...COCKTAIL_BEFORE_STAR_OUT, recipe: { ...RECIPE, outRule: 'overlap', outHl: 15, outMin: 20, outGames: 3, out: STAR_OUT }, lineupOuts: true, ceilingOut: true, idleGate: true };
export const COCKTAIL = { ...COCKTAIL_BEFORE_LINE, lineBlend: LINE_BLEND };
/**
 * The board with a given cocktail (the audit's A / B); the site's is `COCKTAIL`. `bestMarkets: null` lists every market's
 * best bets; `bestBy` ranks them: 'edge' (the site's since 2026-10-31: the board's chance at the book's main line against
 * its price, board.js `edgeRows`) or 'chance' (the hit-rate plays over the floor, the likeliest first, as before).
 */
export const nbaBoard = (cocktail = COCKTAIL, { bestMarkets = BEST_MARKETS, bestBy = 'edge' } = {}) => makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, coverage: COVERAGE, characteristics, profile, volumeMarkets: VOLUME_MARKETS, cocktail, bestMarkets, bestBy, learned: { features: modelFeatures, read: modelRead, factor: modelFactor } });
const board = nbaBoard();
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;
/** The site's board, with the night's big games and outliers on it (lib/nba/big.js: the Big games tab). */
export function buildBoard(args) {
  const b = board.buildBoard(args);
  const ctx = { pf: args.pf || null, results: args.results || {}, statOf: board.statOf, actualFor: board.actualFor, season: args.season ?? null };
  // The big games, and beside them the outliers (double his projection: the Big games tab's Outliers view).
  b.big = { ...nbaBigGames(b, ctx), outliers: nbaOutliers(b, ctx) };
  return b;
}

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
