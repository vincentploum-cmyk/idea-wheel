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
// The share of the game a side's priced players account for, for the team scale (board.js sidesOf):
// their own minutes over the 240 a team plays; under half of it the scale stays off.
export const COVERAGE = { field: 'min', perGame: 240, min: 0.5 };
const board = makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, coverage: COVERAGE, characteristics });
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
