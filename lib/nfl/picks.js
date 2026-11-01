// The NFL board: the shared builder (lib/picks/board.js) bound to the NFL's markets; a season
// read is capped at 17 games. The yardage and reception markets carry ladders (the book's
// alternate lines, else rungs by the market's step) and so each side's players their ranges.
import { makeBoard } from '../picks/board';
import { makeShuffle } from '../picks/shuffle';
import { markets, SHUFFLE_MARKETS } from './markets';
import { teamName } from './teams';
import { characteristics } from './characteristics';
import { profile } from './profile';
import { nflProjections } from './projections';
import { sheetDefense } from './snapshot';

export const LADDER_MARKETS = ['pass_yds', 'rush_yds', 'rec_yds', 'receptions', 'rush_rec_yds', 'pass_td', 'targets', 'rush_att', 'pass_cmp'];
// Receptions off his targets × his catch rate (board.js volumeOf); the made count stands in without targets in the logs.
export const VOLUME_MARKETS = { rec: { att: 'tgt' } };
/**
 * The NFL's cocktail (lib/picks/board.js COCKTAIL_DEFAULTS otherwise): the defense table counted at gp / (gp + 8) of
 * itself (`matchupK`), so a table of three games reads a quarter of the way — measured on 2025's weeks 4–18 (the pooled
 * yards miss −0.9%) and checked on 2026's weeks 1–7 (−2.6%; docs/audits/2026-11-01-nfl-backtest.md).
 */
export const COCKTAIL = { matchupK: 8 };
/** The board with any cocktail, for the audit's A / B (tools/audit/nfl-audit.mjs). */
export const nflBoard = (cocktail = COCKTAIL) => makeBoard({ markets, teamName, seasonCap: 17, h2hGames: 4, ladderMarkets: LADDER_MARKETS, characteristics, profile, volumeMarkets: VOLUME_MARKETS, cocktail });
const board = nflBoard();
export const { statOf, clears, logRates, logAverages, ownWindows, ladderOf, envPosFor, chanceOf, formOf, softSpot, mergeCandidates, actualFor, buildNotes, WEIGHTS, SHRINK_K, TABLE_SIZE, TABLE_MIN, FORM } = board;
/** The board with the week's projections on it (lib/nfl/projections.js: projected yards and touchdown chances, no price). */
// The detailed cheat sheet's defense snapshots (lib/nfl/snapshot.js) go in first: their tiles placed on the positions and
// slots of the offense they face (`meta.oppRanks`, blended with PropFinder's cells in every yards projection), the
// defenses' weak and strong spots on the board as `sheetDefense`.
/** The build on any board (`nflBoard(cocktail)`) with any projection constants (`params`, lib/nfl/projections.js PARAMS). */
export const makeBuild = (b0 = board, { params = null } = {}) => (args) => {
  const { sheets, defense } = sheetDefense(args.sheets || [], args.pf?.data?.defense || null);
  const b = b0.buildBoard({ ...args, sheets });
  b.sheetDefense = defense;
  b.projections = nflProjections(b, { pf: args.pf || null, results: args.results || {}, season: args.season, sheetDefense: defense, params, helpers: { logAverages: b0.logAverages, actualFor: b0.actualFor, statOf: b0.statOf } });
  return b;
};
export const buildBoard = makeBuild(board);
/** The projections again on a built board with other constants (the audit's grid: the board is built once a week). */
export const reproject = (b, args, params, b0 = board) => nflProjections(b, { pf: args.pf || null, results: args.results || {}, season: args.season, sheetDefense: b.sheetDefense || null, params, helpers: { logAverages: b0.logAverages, actualFor: b0.actualFor, statOf: b0.statOf } });

export { SHUFFLE_MARKETS };
export const { shuffleOf, heightsOf } = makeShuffle({ board, markets: SHUFFLE_MARKETS });
