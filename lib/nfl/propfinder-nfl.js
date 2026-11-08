// PropFinder's NFL data: the shared pull (lib/picks/propfinder.js) bound to the NFL's field
// spellings, positions and markets. See that file for the routes and the unread-field report.
import { makePropfinder, propfinderConfigured, SOURCE } from '../picks/propfinder';
import { teamAbbrFromText } from './teams';
import { markets, PERIODS, periodField } from './markets';
import { periodOf } from '../picks/periods';

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
  // The First TD market settles on it (lib/nfl/markets.js first_td); unread until 2026-11-01, so every
  // First TD hit rate off PropFinder's logs read 0 (the pull of 2026-10-31 listed it among the unread keys).
  firstTd: ['firstTouchdownScorer', 'firstTd', 'isFirstTouchdownScorer'],
  // Every return-touchdown spelling present is added.
  retTd: Object.assign(['kickReturnsTouchdowns', 'puntReturnsTouchdowns', 'intReturnsTouchdowns', 'fumblesEzRecTds', 'returnTouchdowns', 'kickReturnTouchdowns', 'puntReturnTouchdowns', 'specialTeamsTouchdowns'], { sum: true }),
};
// Read since 2026-11-01 ("we need to load all PropFinder data"): the defense, the kicker, the opportunity figures and the
// periods the books price. Sparse: kept only when not 0, null when the row does not carry the key (lib/picks/propfinder.js).
const sparse = (list) => Object.assign(list, { sparse: true });
Object.assign(FIELDS, {
  // Tackles are solo tackles: PropFinder lists "Player Tackles", "Player Assists" and "Player Tackles + Assists".
  defTkl: sparse(['defenseTackles']),
  defAst: sparse(['defenseAssists']),
  defSacks: sparse(['defenseSacks']),
  defInt: sparse(['defenseInterceptions']),
  fgMade: sparse(['fieldGoalsMade']),
  fgAtt: sparse(['fieldGoalsAttempts']),
  xpMade: sparse(['extraPointsKicksMade']),
  // His opportunity: the share of the team's targets / carries, the red-zone looks, air yards and yards after the catch.
  tgtShare: sparse(['receivingShare']),
  rushShare: sparse(['rushingShare']),
  rzTgt: sparse(['receivingRedzoneTargets']),
  rzAtt: sparse(['rushingRedzoneAttempts']),
  passRzAtt: sparse(['passingRedzoneAttempts']),
  airYds: sparse(['receivingAirYards']),
  passAirYds: sparse(['passingAirYards']),
  yac: sparse(['receivingYardsAfterCatch']),
  sacked: sparse(['passingSacks']),
  fumLost: sparse(['fumblesLostFumbles']),
});
// The periods' fields: "h1RecYds" ← h1ReceivingYards, every field a period market settles on (lib/nfl/markets.js PERIODS).
const PF_PERIOD = { PassYds: 'PassingYards', PassTd: 'PassingTouchdowns', RushYds: 'RushingYards', RushAtt: 'RushingAttempts', RushTd: 'RushingTouchdowns', Rec: 'ReceivingReceptions', RecYds: 'ReceivingYards', RecTd: 'ReceivingTouchdowns' };
for (const per of PERIODS) {
  for (const base of per.markets) for (const f of base === 'anytime_td' ? ['rushTd', 'recTd'] : markets.MARKETS[base].fields) {
    const key = periodField(per.field, f);
    const suffix = key && key.slice(per.field.length);
    if (key && PF_PERIOD[suffix] && !FIELDS[key]) FIELDS[key] = sparse([`${per.field}${PF_PERIOD[suffix]}`]);
  }
}
export const STAT_KEYS = Object.keys(FIELDS);

// PropFinder's own category per item (seen on the pull of 2026-11-01), read before the item's name.
export const CATEGORY_MARKETS = {
  receivingyards: 'rec_yds', receivingreceptions: 'receptions', receivingtargets: 'targets', receivinglongest: 'rec_long',
  touchdowns: 'anytime_td', anytimetouchdownscorer: 'anytime_td', firsttouchdownscorer: 'first_td',
  rushingyards: 'rush_yds', rushingattempts: 'rush_att', rushinglongest: 'rush_long', rushingandreceivingyards: 'rush_rec_yds',
  passingyards: 'pass_yds', passingtouchdowns: 'pass_td', passingcompletions: 'pass_cmp', passingattempts: 'pass_att',
  passinginterceptions: 'pass_int', passinglongest: 'pass_long', passingandrushingyards: 'pass_rush_yds',
  defensetackles: 'def_tkl', assists: 'def_ast', defensecombined: 'def_tkl_ast', defensesacks: 'def_sacks', defenseinterceptions: 'def_int',
  kickpts: 'kick_pts', fieldgoalsmade: 'fg_made', extrapointskicksmade: 'xp_made',
  // The fantasy score: no figure on the game rows and no scoring stated, so nothing to settle it on (kept in the pull's extra).
  fantasypoints: null,
};
// The period an item names: the shared reader (lib/picks/periods.js), re-exported for the tests.
export { periodOf };
/** The touchdown ladders: 0.5 is the anytime touchdown, 1.5 on the full game 2+ touchdowns, any other rung no market. */
export function lineMarket(market, line) {
  if (!/anytime_td$/.test(market)) return market;
  if (line <= 0.5) return market;
  return market === 'anytime_td' && line === 1.5 ? 'two_td' : null;
}

const posOf = (p) => { const s = String(p.positionAbbreviation || p.position || p.positionGroup || '').toUpperCase(); return POSITIONS.includes(s) ? s : s === 'HB' || s === 'FB' ? 'RB' : s || null; };

const pf = makePropfinder({
  league: 'NFL', FIELDS, teamAbbrFromText, markets, positions: POSITIONS, posOf,
  // PropFinder's NFL injury report is behind a route only its signed-in pages reach: the board reads ESPN's feed.
  injuryReport: 'espn',
  // The team objects carry no depth chart; each player's fullPosition ("WR1", "RB2") is his slot, and the defense rows are per slot.
  depthFromPlayers: true,
  // Attempts and field goals are NFL markets (the NBA's rule skipped "Player Rushing Attempts"); the fantasy score is not.
  notAMarket: /fantasy/i, periodOf, categoryMarkets: CATEGORY_MARKETS, lineMarket,
  // The NFL's team rows carry last 3, 5 and 10.
  windows: [3, 5, 10, 15, 20],
  keepExtra: true,
  // PropFinder's NFL cheat-sheet pages, kept whole on the pull (`data.pages`) for their readers and the backtests (Vincent,
  // 2026-11-08: "we need to use all these cheat sheets to determine matchups"). Routes as the page's request names them
  // (DevTools → Network); a page joins the list once its route is read off the site, never guessed.
  pages: {
    roleMatchups: '/NFL/role-matchups?season={season}',
    coverageReceiverSplits: '/NFL/coverage/receiver-splits?season={season}',
    tdMatchups: '/NFL/td-matchups?teamWindow=Season{season}&playerYear={season}',
    tdMatchupsAllSplits: '/NFL/td-matchups?teamWindow=Season{season}&playerYear={season}&allSplitTypes=true&skipSplits=true',
  },
  derive: (g) => {
    const out = { ...g, td: g.rushTd + g.recTd + g.retTd, rushRecYds: g.rushYds + g.recYds, passRushYds: g.passYds + g.rushYds };
    // Kicking points: 3 a field goal, 1 an extra point (null when the row carries neither key).
    if (g.fgMade === null && g.xpMade === null) out.kickPts = null;
    else { const k = 3 * (g.fgMade || 0) + (g.xpMade || 0); if (k) out.kickPts = k; }
    return out;
  },
  allowed: ['passYds', 'passTd', 'passCmp', 'passAtt', 'passInt', 'rushAtt', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd', 'tgt'],
  deriveAllowed: (row, r, gp) => ({ ...row, td: r2((n(FIELDS.rushTd.map((k) => r[k]).find((v) => v != null)) + n(FIELDS.recTd.map((k) => r[k]).find((v) => v != null))) / gp) }),
});

export const { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, depthFromRoster, extraOf, otherProps, marketOfItem, fetchInjuries, fetchSamples, applyInjuries, pullSlate } = pf;
export const pullWeek = pullSlate;
