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
//   windows      season 0.4, last ten 0.2, last five 0.1, last twenty 0.3 (the board read 0.65 / 0.35): the
//                last twenty reaches into last season's games until he has twenty, as the last ten always did;
//                that is where its gain is (kept inside this season, the same weights read worse)
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
// Measured and left out: the book's game total and spread (no gain per player), home, rest, a stronger
// teammates-out read; last season's average behind his season to date (3% better this season, but out by
// Vincent's call of 2026-10-27 — the last twenty carries the part of it that windows always carried).
export const COCKTAIL = {
  windows: { season: 0.4, l10: 0.2, l5: 0.1, l20: 0.3 },
  hitWeights: { l5: 0.1, l10: 0.3, season: 0.6 },
  matchupK: 40,
  ladderModel: 0.7,
  empK: 6,
  spreadA: 0.2,
  spreadB: 5,
  factorMax: 1,
  vacatedShare: 0.2,
};
/** The board with a given cocktail (the audit's A / B); the site's is `COCKTAIL`. */
export const nbaBoard = (cocktail = COCKTAIL) => makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, coverage: COVERAGE, characteristics, volumeMarkets: VOLUME_MARKETS, cocktail });
const board = nbaBoard();
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
