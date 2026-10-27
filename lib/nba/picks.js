// The NBA board: the shared builder (lib/picks/board.js) bound to the NBA's markets; a season
// read runs over the whole season's games.
import { makeBoard } from '../picks/board';
import { makeShuffle } from '../picks/shuffle';
import { markets, SHUFFLE_MARKETS } from './markets';
import { teamName } from './teams';

export const LADDER_MARKETS = ['pts', 'reb', 'ast', 'tpm', 'pra'];
// The first ten games of a season read off last season for a player's own window (his last 82,
// this season's few on top) until this one has ten games. A team's season table is this season's
// from its first game (lib/picks/propfinder.js, defenseAllowed).
export const SEASON_MIN = 10;
// The share of the game a side's priced players account for, for the team scale (board.js sidesOf):
// their own minutes over the 240 a team plays; under half of it the scale stays off.
export const COVERAGE = { field: 'min', perGame: 240, min: 0.5 };
const board = makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, seasonMin: SEASON_MIN, coverage: COVERAGE });
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
