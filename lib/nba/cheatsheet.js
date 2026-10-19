// The NBA cheat sheets: the shared parser (lib/picks/cheatsheet.js) bound to the NBA's markets,
// positions and team spellings.
import { makeCheatSheetParser } from '../picks/cheatsheet';
import { markets } from './markets';
import { teamAbbrFromText, parseMatchup } from './teams';

export const POS = new Set(['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'GF', 'FC']);

export const { parseCheatSheet, classifyHeader, parsePlayerCell, parseSide, tablesOf, findHeader, countByGroup } = makeCheatSheetParser({
  markets, positions: POS, teamAbbrFromText, parseMatchup,
  nameNoise: /cheat ?sheet|sheet|props?|slate|tonight|20\d{2}[-_]?\d{2}[-_]?\d{2}/gi,
});
