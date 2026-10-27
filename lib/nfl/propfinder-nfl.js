// PropFinder's NFL data: the shared pull (lib/picks/propfinder.js) bound to the NFL's field
// spellings, positions and markets. See that file for the routes and the unread-field report.
import { makePropfinder, propfinderConfigured, SOURCE } from '../picks/propfinder';
import { teamAbbrFromText } from './teams';
import { markets } from './markets';

export { propfinderConfigured, SOURCE };
export const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const r2 = (v) => Math.round(v * 100) / 100;
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Box-score field → the spellings a PropFinder game row uses. Checked against a real pull
// (2026-10-20): passingYards / passingAttempts / passingCompletions / passingTouchdowns /
// passingInterceptions / passingLongest, rushingAttempts / rushingYards / rushingTouchdowns /
// rushingLongest, receivingReceptions / receivingYards / receivingTouchdowns / receivingTargets /
// receivingLongest, the return scores kickReturnsTouchdowns / puntReturnsTouchdowns /
// intReturnsTouchdowns / fumblesEzRecTds; the venue is isHome, the opponent opposingTeamCode, the
// season its start year, seasonType REG / PST. The team rows carry `year` for the season and
// positions All / QB / RB / WR / TE plus the slots WR1 … TE1 / RB1 / RB2.
export const FIELDS = {
  passCmp: ['passingCompletions', 'completions', 'passCompletions', 'cmp'],
  passAtt: ['passingAttempts', 'passAttempts', 'attempts', 'passAtt'],
  passYds: ['passingYards', 'passYards', 'passYds', 'passing_yards'],
  passTd: ['passingTouchdowns', 'passTouchdowns', 'passingTds', 'passTds', 'passTd'],
  passInt: ['passingInterceptions', 'interceptions', 'interceptionsThrown', 'passInt'],
  passLong: ['passingLongest', 'longestCompletion', 'longestPass', 'passLong'],
  rushAtt: ['rushingAttempts', 'rushAttempts', 'carries', 'rushAtt'],
  rushYds: ['rushingYards', 'rushYards', 'rushYds', 'rushing_yards'],
  rushTd: ['rushingTouchdowns', 'rushTouchdowns', 'rushingTds', 'rushTds', 'rushTd'],
  rushLong: ['rushingLongest', 'longestRush', 'longRush', 'rushLong'],
  rec: ['receivingReceptions', 'receptions', 'catches', 'rec'],
  recYds: ['receivingYards', 'recYards', 'recYds', 'receiving_yards'],
  recTd: ['receivingTouchdowns', 'recTouchdowns', 'receivingTds', 'recTds', 'recTd'],
  recLong: ['receivingLongest', 'longestReception', 'longReception', 'recLong'],
  tgt: ['receivingTargets', 'targets', 'tgt'],
  // Every return-touchdown spelling present is added.
  retTd: Object.assign(['kickReturnsTouchdowns', 'puntReturnsTouchdowns', 'intReturnsTouchdowns', 'fumblesEzRecTds', 'returnTouchdowns', 'kickReturnTouchdowns', 'puntReturnTouchdowns', 'specialTeamsTouchdowns'], { sum: true }),
};
export const STAT_KEYS = Object.keys(FIELDS);

const posOf = (p) => { const s = String(p.positionAbbreviation || p.position || p.positionGroup || '').toUpperCase(); return POSITIONS.includes(s) ? s : s === 'HB' || s === 'FB' ? 'RB' : s || null; };

const pf = makePropfinder({
  league: 'NFL', FIELDS, teamAbbrFromText, markets, positions: POSITIONS, posOf,
  derive: (g) => ({ ...g, td: g.rushTd + g.recTd + g.retTd, rushRecYds: g.rushYds + g.recYds, passRushYds: g.passYds + g.rushYds }),
  allowed: ['passYds', 'passTd', 'passCmp', 'passAtt', 'passInt', 'rushAtt', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt'],
  deriveAllowed: (row, r, gp) => ({ ...row, td: r2((n(FIELDS.rushTd.map((k) => r[k]).find((v) => v != null)) + n(FIELDS.recTd.map((k) => r[k]).find((v) => v != null))) / gp) }),
});

export const { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, fetchInjuries, applyInjuries, pullSlate } = pf;
export const pullWeek = pullSlate;
