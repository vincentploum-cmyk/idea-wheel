// The NBA board: the shared builder (lib/picks/board.js) bound to the NBA's markets; a season
// read runs over the whole season's games.
import { makeBoard } from '../picks/board';
import { markets } from './markets';
import { teamName } from './teams';

export const { statOf, clears, logRates, logAverages, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = makeBoard({ markets, teamName, seasonCap: 82, h2hGames: 4 });
