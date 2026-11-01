// PropFinder's NBA data: the shared pull (lib/picks/propfinder.js) bound to the NBA's field
// spellings, positions and markets. See that file for the routes and the unread-field report.
import { makePropfinder, propfinderConfigured, SOURCE } from '../picks/propfinder';
import { teamAbbrFromText } from './teams';
import { markets } from './markets';
import { derived } from './espn';
import { periodOf } from '../picks/periods';

export { propfinderConfigured, SOURCE };
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'];
const r2 = (v) => Math.round(v * 100) / 100;

// Box-score field → the spellings a PropFinder game row uses. Checked against a real pull
// (2026-10-20, LeBron James' 2024-25 log; the tracking figures on Jalen Duren's: usagePct as a
// fraction, 0.1274, read as 12.7; reboundChances; potentialAssists): points, rebounds, assists, steals, blocks, turnovers,
// minutes, fieldGoalsMade / fieldGoalsAtt, threePointsMade / threePointsAtt, freeThrowsMade /
// freeThrowsAtt, offensiveRebounds, defensiveRebounds, personalFouls; the combined
// pointsReboundsAssists, pointsRebounds, pointsAssists, reboundAssists, stealsBlocks and the
// doubleDouble / tripleDouble flags ride along (the derived figures agree with them); the
// opponent is opposingTeamCode, the season its start year, seasonType REG / PST.
export const FIELDS = {
  min: ['minutes', 'minutesPlayed', 'min', 'mins'],
  pts: ['points', 'pts', 'score'],
  reb: ['rebounds', 'totalRebounds', 'reb', 'rebs', 'trb'],
  ast: ['assists', 'ast', 'asts'],
  tpm: ['threePointsMade', 'threePointersMade', 'threePointFieldGoalsMade', 'threesMade', 'threePointMade', 'fg3m', 'tpm', 'threes', 'threePointers'],
  tpa: ['threePointsAtt', 'threePointersAttempted', 'threePointFieldGoalsAttempted', 'fg3a', 'tpa'],
  fgm: ['fieldGoalsMade', 'fgm'],
  fga: ['fieldGoalsAtt', 'fieldGoalsAttempted', 'fga'],
  ftm: ['freeThrowsMade', 'ftm'],
  fta: ['freeThrowsAtt', 'freeThrowsAttempted', 'fta'],
  stl: ['steals', 'stl', 'stls'],
  blk: ['blocks', 'blk', 'blks', 'blockedShots'],
  tov: ['turnovers', 'tov', 'to', 'tos'],
  oreb: ['offensiveRebounds', 'oreb', 'orb'],
  dreb: ['defensiveRebounds', 'dreb', 'drb'],
  pf: ['personalFouls', 'fouls', 'pf'],
  // Tracking figures PropFinder's player summary carries (USG%, REB CHANCES/G, POT AST/G): read per game
  // when the row has them, null otherwise (the pull's unread list shows the spelling if it differs).
  usg: Object.assign(['usagePct', 'usagePercentage', 'usageRate', 'usage', 'usg', 'usgPct', 'usgPercent'], { optional: true }),
  rebCh: Object.assign(['reboundChances', 'rebChances', 'reboundChance', 'totalReboundChances', 'rebound_chances'], { optional: true }),
  potAst: Object.assign(['potentialAssists', 'potAst', 'potentialAssist', 'potential_assists'], { optional: true }),
  // PropFinder's own combined figures and flags, read when present (the derived ones stand in otherwise).
  praApi: ['pointsReboundsAssists'], prApi: ['pointsRebounds'], paApi: ['pointsAssists'], raApi: ['reboundAssists'], stlBlkApi: ['stealsBlocks'],
  ddApi: ['doubleDouble'], td3Api: ['tripleDouble'],
};
// Read since 2026-11-01 ("do the same for the NBA board": load everything PropFinder sends). Sparse: kept only when not
// 0, null when the row does not carry the key (lib/picks/propfinder.js), so a game without the figure is no game in a hit rate.
const sparse = (list) => Object.assign(list, { sparse: true });
Object.assign(FIELDS, {
  // The first quarter and the first three minutes, the lines the books price on them.
  q1Pts: sparse(['q1Points']), q1Reb: sparse(['q1Rebounds']), q1Ast: sparse(['q1Assists']), q1Tpm: sparse(['q1ThreePointsMade']), q1Min: sparse(['q1Minutes']),
  pts3m: sparse(['pointsInFirstThreeMinutes']),
  // Who scored first: his own field goal, point and three, and his team's first field goal (the First Basket tab's subject).
  firstFg: sparse(['hadFirstFG']), firstPt: sparse(['hadFirstPoint']), firstTeamFg: sparse(['hadFirstTeamFG']), firstThree: sparse(['hadFirstThreePt']),
  starter: sparse(['starter']),
  // His opportunity beside usage, rebound chances and potential assists.
  passes: sparse(['passesMade']), contestedReb: sparse(['contestedRebounds']), deferredReb: sparse(['deferredRebounds']),
  techFouls: sparse(['techFouls']), blockedAtt: sparse(['blockedAtt']),
  // Read so they are not stored twice: the two-pointers the board derives from the field goals and the threes (derived in espn.js).
  fg2mApi: sparse(['twoPointsMade']), fg2aApi: sparse(['twoPointsAtt']),
});
export const STAT_KEYS = Object.keys(FIELDS);

// PropFinder's own category per item (seen on the pull of 2026-11-01), read before the item's name.
export const CATEGORY_MARKETS = {
  points: 'pts', rebounds: 'reb', assists: 'ast', threepointsmade: 'tpm', pointsreboundsassists: 'pra', pointsrebounds: 'pr',
  pointsassists: 'pa', reboundassists: 'ra', steals: 'stl', blocks: 'blk', stealsblocks: 'stl_blk', turnovers: 'tov',
  freethrowsmade: 'ftm', freethrowsatt: 'fta', fieldgoalsmade: 'fgm', fieldgoalsatt: 'fga', twopointsmade: 'fg2m', twopointsatt: 'fg2a',
  threepointsatt: 'tpa', doubledouble: 'dd', tripledouble: 'td3',
  // The fantasy score: no figure on the game rows and no scoring stated, so nothing to settle it on (kept in the pull's extra).
  fantasypoints: null,
};

/** PG / SG / SF / PF / C, else the first letter group of "G-F"; nothing → null. */
export const posOf = (p) => {
  const s = String(p.positionAbbreviation || p.position || p.positionGroup || '').toUpperCase().replace(/\s+/g, '');
  if (POSITIONS.includes(s)) return s;
  const first = s.split(/[-/]/)[0];
  return POSITIONS.includes(first) ? first : first || null;
};

const pf = makePropfinder({
  league: 'NBA', FIELDS, teamAbbrFromText, markets, positions: POSITIONS, posOf,
  // The shooting lines are markets now; the first basket (read beside the markets, firstBasketOdds) and the fantasy score are not.
  notAMarket: /fantasy|first (basket|field goal|to score)/i, periodOf, categoryMarkets: CATEGORY_MARKETS,
  keepExtra: true,
  // The players the books have not priced, every rostered one with his logs, kept with the extra (not on the board).
  rosterExtra: true,
  derive: (g) => {
    const d = derived(g);
    delete d.fg2mApi; delete d.fg2aApi;
    // Usage comes as a fraction of the team's possessions; the card reads a percentage.
    if (d.usg != null && d.usg > 0 && d.usg <= 1) d.usg = Math.round(d.usg * 1000) / 10;
    // The API's own combined figures and flags win where it sends them.
    for (const [api, key] of [['praApi', 'pra'], ['prApi', 'pr'], ['paApi', 'pa'], ['raApi', 'ra'], ['stlBlkApi', 'stlBlk'], ['ddApi', 'dd'], ['td3Api', 'td3']]) {
      if (g[api] != null && g[api] !== 0) d[key] = Number(g[api]) || (g[api] === true ? 1 : 0);
      delete d[api];
    }
    return d;
  },
  allowed: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'ftm'],
  // A team's season table is this season's as PropFinder publishes it (lib/picks/propfinder.js); last
  // season's full table rides along as `prior`, the tab the court and the card compare it against.
  rowsPerGame: true, // PropFinder's NBA team rows are per-game figures already (points 117.8 on an 82-game row)
  deriveAllowed: (row) => ({ ...row, ...(row.pts != null && row.reb != null && row.ast != null ? { pra: r2(row.pts + row.reb + row.ast), pr: r2(row.pts + row.reb), pa: r2(row.pts + row.ast), ra: r2(row.reb + row.ast) } : {}), ...(row.stl != null && row.blk != null ? { stlBlk: r2(row.stl + row.blk) } : {}) }),
});

export const { gameRow, playerProps, mapPlayers, fieldsSeen, pickRow, defenseAllowed, depthChart, extraOf, otherProps, marketOfItem, fetchInjuries, applyInjuries, pullSlate, paceTable } = pf;
export { periodOf };
