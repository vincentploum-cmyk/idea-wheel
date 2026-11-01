// The NBA prop markets the board knows, in the groups the page shows (points, rebounds,
// assists, threes, combos, shooting, the first quarter and the first minutes), through the shared factory (lib/picks/markets.js). `step` is the
// rung a synthesized ladder climbs by (`ladderOf`); 1 without one.
import { makeMarkets } from '../picks/markets';

export const GROUPS = [
  ['points', 'Points'],
  ['rebounds', 'Rebounds'],
  ['assists', 'Assists'],
  ['threes', 'Threes'],
  ['combos', 'Combos & defense'],
  ['shooting', 'Shooting'],
  ['periods', '1st quarter & first minutes'],
];

const NBA_MARKETS = {
  pts: { step: 2, group: 'points', label: 'Points', unit: 'pts', fields: ['pts'], floor: 0.55, aliases: ['points', 'pts', 'player_points', 'point', 'p', 'scoring'] },
  reb: { group: 'rebounds', label: 'Rebounds', unit: 'reb', fields: ['reb'], floor: 0.55, aliases: ['rebounds', 'reb', 'rebs', 'boards', 'total rebounds', 'player_rebounds', 'r'] },
  ast: { group: 'assists', label: 'Assists', unit: 'ast', fields: ['ast'], floor: 0.55, aliases: ['assists', 'ast', 'asts', 'dimes', 'player_assists', 'a'] },
  tpm: { group: 'threes', label: '3-pointers', unit: '3PM', fields: ['tpm'], floor: 0.55, aliases: ['3 pointers made', '3pm', 'threes', 'threes made', '3 pointers', 'three pointers', 'three pointers made', 'three points made', 'three point made', '3pt made', '3pt', '3s', 'player_threes', 'three point field goals', '3ptm', '3fgm', 'fg3m', 'made threes', '3 pt'] },
  pra: { step: 3, group: 'combos', defense: 'pra', label: 'Pts + reb + ast', unit: 'pra', fields: ['pts', 'reb', 'ast'], floor: 0.55, aliases: ['points rebounds assists', 'pra', 'p r a', 'pts reb ast', 'player_points_rebounds_assists', 'pts rebs asts'] },
  pr: { step: 2, group: 'combos', defense: 'pr', label: 'Pts + reb', unit: 'pr', fields: ['pts', 'reb'], floor: 0.55, aliases: ['points rebounds', 'pr', 'p r', 'pts reb', 'player_points_rebounds', 'pts rebs'] },
  pa: { step: 2, group: 'combos', defense: 'pa', label: 'Pts + ast', unit: 'pa', fields: ['pts', 'ast'], floor: 0.55, aliases: ['points assists', 'pa', 'p a', 'pts ast', 'player_points_assists', 'pts asts'] },
  ra: { group: 'combos', defense: 'ra', label: 'Reb + ast', unit: 'ra', fields: ['reb', 'ast'], floor: 0.55, aliases: ['rebounds assists', 'ra', 'r a', 'reb ast', 'player_rebounds_assists', 'rebs asts'] },
  stl: { group: 'combos', label: 'Steals', unit: 'stl', fields: ['stl'], floor: 0.55, aliases: ['steals', 'stl', 'stls', 'player_steals'] },
  blk: { group: 'combos', label: 'Blocks', unit: 'blk', fields: ['blk'], floor: 0.55, aliases: ['blocks', 'blk', 'blks', 'player_blocks'] },
  stl_blk: { group: 'combos', defense: 'stlBlk', label: 'Steals + blocks', unit: 'stocks', fields: ['stl', 'blk'], floor: 0.55, aliases: ['steals blocks', 'blocks steals', 'stocks', 's b', 'stl blk', 'player_blocks_steals', 'player_steals_blocks', 'steals and blocks'] },
  tov: { group: 'combos', label: 'Turnovers', unit: 'TO', fields: ['tov'], floor: 0.55, aliases: ['turnovers', 'tov', 'to', 'tos', 'player_turnovers'] },
  ftm: { group: 'combos', label: 'Free throws made', unit: 'FTM', fields: ['ftm'], floor: 0.55, aliases: ['free throws made', 'ftm', 'free throws', 'player_free_throws_made', 'ft made'] },
  dd: { group: 'combos', label: 'Double-double', unit: 'DD', fields: ['dd'], yesNo: true, floor: 0.35, aliases: ['double double', 'double doubles', 'dd', 'player_double_double', 'to record a double double'] },
  td3: { group: 'combos', label: 'Triple-double', unit: 'TD', fields: ['td3'], yesNo: true, floor: 0.15, aliases: ['triple double', 'triple doubles', 'td', 'player_triple_double', 'to record a triple double'] },
  // The shooting lines and the first quarter (2026-11-01, "do the same for the NBA board": PropFinder prices them every
  // night and its game rows carry every figure; until then the shooting lines were skipped by the rule that kept them
  // from being read as points or threes, and every period line by the rule that kept it from the full game's).
  fgm: { step: 1, group: 'shooting', label: 'Field goals made', unit: 'FGM', fields: ['fgm'], floor: 0.55, aliases: ['field goals made', 'fgm', 'fg made', 'made field goals', 'player_field_goals_made'] },
  fga: { step: 1, group: 'shooting', label: 'Field goals attempted', unit: 'FGA', fields: ['fga'], floor: 0.55, aliases: ['field goals attempted', 'fga', 'fg attempted', 'field goal attempts', 'player_field_goals_attempted'] },
  fg2m: { step: 1, group: 'shooting', label: 'Two-pointers made', unit: '2PM', fields: ['fg2m'], floor: 0.55, aliases: ['two pointers made', 'made two pointers', 'two point field goals made', '2pt made', '2pm', 'player_two_pointers_made'] },
  fg2a: { step: 1, group: 'shooting', label: 'Two-pointers attempted', unit: '2PA', fields: ['fg2a'], floor: 0.55, aliases: ['two pointers attempted', 'two point field goals attempted', '2pt attempted', '2pa', 'player_two_pointers_attempted'] },
  tpa: { step: 1, group: 'shooting', label: 'Threes attempted', unit: '3PA', fields: ['tpa'], floor: 0.55, aliases: ['threes attempted', 'three pointers attempted', '3 pointers attempted', 'three point attempts', '3pa', 'player_threes_attempted'] },
  fta: { step: 1, group: 'shooting', label: 'Free throws attempted', unit: 'FTA', fields: ['fta'], floor: 0.55, aliases: ['free throws attempted', 'free throw attempts', 'fta', 'player_free_throws_attempted'] },
  q1_pts: { step: 1, group: 'periods', label: '1st quarter points', unit: 'pts', fields: ['q1Pts'], defense: 'pts', period: 'q1', base: 'pts', floor: 0.55, aliases: ['1st quarter points', 'first quarter points', 'q1 points', '1q points'] },
  q1_reb: { step: 1, group: 'periods', label: '1st quarter rebounds', unit: 'reb', fields: ['q1Reb'], defense: 'reb', period: 'q1', base: 'reb', floor: 0.55, aliases: ['1st quarter rebounds', 'first quarter rebounds', 'q1 rebounds', '1q rebounds'] },
  q1_ast: { step: 1, group: 'periods', label: '1st quarter assists', unit: 'ast', fields: ['q1Ast'], defense: 'ast', period: 'q1', base: 'ast', floor: 0.55, aliases: ['1st quarter assists', 'first quarter assists', 'q1 assists', '1q assists'] },
  m3_pts: { step: 1, group: 'periods', label: 'Points, first 3 minutes', unit: 'pts', fields: ['pts3m'], defense: 'pts', period: 'm3', base: 'pts', floor: 0.55, aliases: ['points in the first 3 minutes', 'first 3 minutes points', '1st 3 minutes points', 'points first 3 minutes'] },
};

export const markets = makeMarkets({ markets: NBA_MARKETS, groups: GROUPS, groupWords: /^(combos?|combo defense|combos defense|defense|props?)$/ });
export const { MARKETS, GROUP_LABEL, MARKET_KEYS, marketFromText, groupOf, labelOf, statFields, statOf, defenseKey } = markets;

// The shuffle's bars (components/picks/Shuffle.jsx): one per market, from the lowest height worth
// asking to the highest, by the step the bar moves in, and where it starts.
export const SHUFFLE_MARKETS = [
  { market: 'pts', min: 8, max: 45, step: 1, start: 25 },
  { market: 'reb', min: 2, max: 20, step: 1, start: 10 },
  { market: 'ast', min: 2, max: 15, step: 1, start: 7 },
  { market: 'tpm', min: 1, max: 8, step: 1, start: 4 },
  { market: 'pra', min: 15, max: 65, step: 1, start: 38 },
  // The court's bar reads these two as well (2026-10-30); a steal or a block a game is the floor worth asking about.
  { market: 'stl', min: 1, max: 5, step: 1, start: 2 },
  { market: 'blk', min: 1, max: 5, step: 1, start: 2 },
];
