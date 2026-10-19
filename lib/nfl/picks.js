// The NFL board: the shared builder (lib/picks/board.js) bound to the NFL's markets; a season
// read is capped at 17 games.
import { makeBoard } from '../picks/board';
import { markets } from './markets';
import { teamName } from './teams';

export const { statOf, clears, logRates, logAverages, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildBoard, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = makeBoard({ markets, teamName, seasonCap: 17, h2hGames: 4 });
