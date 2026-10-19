// The NFL cheat sheets: the shared parser (lib/picks/cheatsheet.js) bound to the NFL's markets,
// positions and team spellings.
import { makeCheatSheetParser } from '../picks/cheatsheet';
import { markets } from './markets';
import { teamAbbrFromText, parseMatchup } from './teams';

export const POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'FB', 'D', 'DST', 'DEF']);

export const { parseCheatSheet, classifyHeader, parsePlayerCell, parseSide, tablesOf, findHeader, countByGroup } = makeCheatSheetParser({ markets, positions: POS, teamAbbrFromText, parseMatchup });
