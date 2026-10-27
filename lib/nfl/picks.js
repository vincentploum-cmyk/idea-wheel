// The NFL board: the shared builder (lib/picks/board.js) bound to the NFL's markets; a season
// read is capped at 17 games. The yardage and reception markets carry ladders (the book's
// alternate lines, else rungs by the market's step) and so each side's players their ranges.
import { makeBoard } from '../picks/board';
import { makeShuffle } from '../picks/shuffle';
import { markets, SHUFFLE_MARKETS } from './markets';
import { teamName } from './teams';
import { characteristics } from './characteristics';

export const LADDER_MARKETS = ['pass_yds', 'rush_yds', 'rec_yds', 'receptions', 'rush_rec_yds', 'pass_td', 'targets', 'rush_att', 'pass_cmp'];
// Receptions off his targets × his catch rate (board.js volumeOf); the made count stands in without targets in the logs.
export const VOLUME_MARKETS = { rec: { att: 'tgt' } };
const board = makeBoard({ markets, teamName, seasonCap: 17, h2hGames: 4, ladderMarkets: LADDER_MARKETS, characteristics, volumeMarkets: VOLUME_MARKETS });
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
