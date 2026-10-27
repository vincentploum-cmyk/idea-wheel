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
const board = makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4, ladderMarkets: LADDER_MARKETS, coverage: COVERAGE, characteristics, volumeMarkets: VOLUME_MARKETS });
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
