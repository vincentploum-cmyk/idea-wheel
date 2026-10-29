// The NBA board: the shared builder (lib/picks/board.js) bound to the NBA's markets; a season
// read runs over the whole season's games.
import { makeBoard } from '../picks/board';
import { makeShuffle } from '../picks/shuffle';
import { markets, SHUFFLE_MARKETS } from './markets';
import { teamName } from './teams';
import { characteristics } from './characteristics';

export const LADDER_MARKETS = ['pts', 'reb', 'ast', 'tpm', 'pra'];
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
// Measured and left out: the book's game total and spread (no gain per player), home, rest, a stronger
// teammates-out read; last season's average behind his season to date (3% better this season, out by
// Vincent's call of 2026-10-27); the last twenty across the seasons (season 0.4, last ten 0.2, last five 0.1,
// last twenty 0.3, the first cut of this cocktail, out with last season's games on 2026-10-28).
export const COCKTAIL = {
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
  roleRates: {
    pts: { G: 0.4998, F: 0.4954, C: 0.478 },
    reb: { G: 0.1363, F: 0.1943, C: 0.3037 },
    ast: { G: 0.1364, F: 0.0942, C: 0.0881 },
    tpm: { G: 0.0652, F: 0.0559, C: 0.0361 },
    pra: { G: 0.7725, F: 0.7838, C: 0.8697 },
  },
};
/** The board with a given cocktail (the audit's A / B); the site's is `COCKTAIL`. */
export const nbaBoard = (cocktail = COCKTAIL) => makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, coverage: COVERAGE, characteristics, volumeMarkets: VOLUME_MARKETS, cocktail });
const board = nbaBoard();
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
