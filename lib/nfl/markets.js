// The NFL prop markets the board knows, in the four groups the page shows (touchdowns, passing,
// rushing, receiving), through the shared factory (lib/picks/markets.js).
import { makeMarkets } from '../picks/markets';

export const GROUPS = [
  ['touchdowns', 'Touchdowns'],
  ['passing', 'Passing'],
  ['rushing', 'Rushing'],
  ['receiving', 'Receiving'],
  ['defense', 'Defense'],
  ['kicking', 'Kicking'],
  ['periods', 'Halves & quarters'],
];

// key → { step (the rung a synthesized ladder climbs by, and the shuffle's bar), group, label, unit, fields (the
// box-score fields the market settles on, summed), yesNo (a scorer market: the pick is "yes"), floor (the
// chance the board wants before a play makes the table), defense (the allowed-table key), aliases }.
const NFL_MARKETS = {
  anytime_td: { group: 'touchdowns', label: 'Anytime TD', unit: 'TD', fields: ['rushTd', 'recTd', 'retTd'], defense: 'td', yesNo: true, floor: 0.35, aliases: ['anytime td', 'anytime touchdown', 'anytime touchdown scorer', 'atd', 'any time td', 'td scorer', 'touchdown scorer', 'to score a td', 'player_anytime_td', 'anytime', 'td', 'tds', 'touchdown', 'touchdowns'] },
  first_td: { group: 'touchdowns', label: 'First TD', unit: 'TD', fields: ['firstTd'], defense: 'td', yesNo: true, floor: 0.12, aliases: ['first td', '1st td', 'first touchdown', 'first touchdown scorer', '1st touchdown scorer', 'first td scorer', '1st td scorer', 'first scorer', '1st scorer', 'player_1st_td', 'ftd'] },
  two_td: { group: 'touchdowns', label: '2+ TD', unit: 'TD', fields: ['rushTd', 'recTd', 'retTd'], defense: 'td', yesNo: true, floor: 0.15, defaultLine: 1.5, aliases: ['2+ td', '2+ touchdowns', 'two or more touchdowns', 'multi td', 'player_2_td', '2 td'] },
  rush_td: { group: 'touchdowns', label: 'Rushing TD', unit: 'TD', fields: ['rushTd'], yesNo: true, floor: 0.3, aliases: ['rushing td', 'rush td', 'rushing touchdown', 'rushing touchdowns', 'player_rush_td', 'rush tds'] },
  rec_td: { group: 'touchdowns', label: 'Receiving TD', unit: 'TD', fields: ['recTd'], yesNo: true, floor: 0.3, aliases: ['receiving td', 'rec td', 'receiving touchdown', 'receiving touchdowns', 'player_reception_td', 'rec tds'] },
  pass_yds: { step: 25, group: 'passing', label: 'Pass yards', unit: 'yds', fields: ['passYds'], floor: 0.55, aliases: ['passing yards', 'pass yards', 'pass yds', 'passing yds', 'player_pass_yds', 'pass yd', 'py'] },
  pass_td: { step: 1, group: 'passing', label: 'Pass TDs', unit: 'TD', fields: ['passTd'], floor: 0.55, aliases: ['passing touchdowns', 'passing tds', 'pass tds', 'pass td', 'player_pass_tds', 'passing td'] },
  pass_cmp: { step: 2, group: 'passing', label: 'Completions', unit: 'cmp', fields: ['passCmp'], floor: 0.55, aliases: ['completions', 'pass completions', 'passing completions', 'player_pass_completions', 'cmp'] },
  pass_att: { step: 3, group: 'passing', label: 'Pass attempts', unit: 'att', fields: ['passAtt'], floor: 0.55, aliases: ['pass attempts', 'passing attempts', 'player_pass_attempts', 'attempts'] },
  pass_int: { step: 1, group: 'passing', label: 'Interceptions', unit: 'INT', fields: ['passInt'], floor: 0.55, aliases: ['interceptions', 'interceptions thrown', 'passing interceptions', 'player_pass_interceptions', 'int'] },
  pass_long: { step: 5, group: 'passing', label: 'Longest completion', unit: 'yds', fields: ['passLong'], floor: 0.55, aliases: ['longest completion', 'longest passing completion', 'longest pass', 'player_pass_longest_completion', 'long completion'] },
  rush_yds: { step: 10, group: 'rushing', label: 'Rush yards', unit: 'yds', fields: ['rushYds'], floor: 0.55, aliases: ['rushing yards', 'rush yards', 'rush yds', 'rushing yds', 'player_rush_yds', 'rush yd', 'ry'] },
  rush_att: { step: 3, group: 'rushing', label: 'Rush attempts', unit: 'att', fields: ['rushAtt'], floor: 0.55, aliases: ['rushing attempts', 'rush attempts', 'carries', 'rush att', 'player_rush_attempts', 'ra'] },
  rush_long: { step: 5, group: 'rushing', label: 'Longest rush', unit: 'yds', fields: ['rushLong'], floor: 0.55, aliases: ['longest rush', 'longest run', 'player_rush_longest', 'long rush'] },
  rec_yds: { step: 10, group: 'receiving', label: 'Rec yards', unit: 'yds', fields: ['recYds'], floor: 0.55, aliases: ['receiving yards', 'rec yards', 'rec yds', 'receiving yds', 'player_reception_yds', 'rec yd', 'recv yds', 'rey'] },
  receptions: { step: 1, group: 'receiving', label: 'Receptions', unit: 'rec', fields: ['rec'], floor: 0.55, aliases: ['receptions', 'rec', 'catches', 'player_receptions', 'recs'] },
  rec_long: { step: 5, group: 'receiving', label: 'Longest reception', unit: 'yds', fields: ['recLong'], floor: 0.55, aliases: ['longest reception', 'longest catch', 'player_reception_longest', 'long reception', 'long rec'] },
  targets: { step: 1, group: 'receiving', label: 'Targets', unit: 'tgt', fields: ['tgt'], floor: 0.55, aliases: ['targets', 'tgts', 'player_targets'] },
  rush_rec_yds: { step: 15, group: 'rushing', label: 'Rush + rec yards', unit: 'yds', fields: ['rushYds', 'recYds'], floor: 0.55, aliases: ['rush + rec yards', 'rushing + receiving yards', 'rush+rec yds', 'rush and rec yards', 'scrimmage yards', 'player_rush_reception_yds', 'rush rec yds', 'total yards'] },
  pass_rush_yds: { step: 25, group: 'passing', label: 'Pass + rush yards', unit: 'yds', fields: ['passYds', 'rushYds'], floor: 0.55, aliases: ['pass + rush yards', 'passing + rushing yards', 'pass+rush yds', 'player_pass_rush_yds', 'pass rush yds'] },
  // The defense and the kicker (2026-11-01: PropFinder lists these lines on every pull; until then the kicking points,
  // the extra points and the defensive interceptions were read as a quarterback's interceptions — "points" holds "ints" —
  // and the tackles, assists, sacks and field goals were skipped). Tackles are solo tackles, as PropFinder's
  // "Player Tackles" beside "Player Assists" and "Player Tackles + Assists", and ESPN's SOLO beside its TOT.
  def_tkl: { step: 1, group: 'defense', label: 'Tackles', unit: 'tkl', fields: ['defTkl'], floor: 0.55, aliases: ['tackles', 'solo tackles', 'player_tackles', 'tkl'] },
  def_ast: { step: 1, group: 'defense', label: 'Tackle assists', unit: 'ast', fields: ['defAst'], floor: 0.55, aliases: ['assists', 'tackle assists', 'defensive assists', 'player_assists'] },
  def_tkl_ast: { step: 1, group: 'defense', label: 'Tackles + assists', unit: 'tkl', fields: ['defTkl', 'defAst'], floor: 0.55, aliases: ['tackles + assists', 'tackles and assists', 'total tackles', 'combined tackles', 'player_tackles_assists', 'tackles assists'] },
  def_sacks: { step: 1, group: 'defense', label: 'Sacks', unit: 'sk', fields: ['defSacks'], floor: 0.55, aliases: ['sacks', 'player_sacks', 'defensive sacks'] },
  def_int: { step: 1, group: 'defense', label: 'Defensive INTs', unit: 'INT', fields: ['defInt'], floor: 0.55, aliases: ['defensive interceptions', 'def interceptions', 'player_defensive_interceptions', 'interceptions caught'] },
  kick_pts: { step: 1, group: 'kicking', label: 'Kicking points', unit: 'pts', fields: ['kickPts'], floor: 0.55, aliases: ['kicking points', 'kick points', 'kicker points', 'kickpts', 'player_kicking_points'] },
  fg_made: { step: 1, group: 'kicking', label: 'Field goals made', unit: 'FG', fields: ['fgMade'], floor: 0.55, aliases: ['field goals made', 'field goals', 'fg made', 'fgm', 'player_field_goals'] },
  xp_made: { step: 1, group: 'kicking', label: 'Extra points made', unit: 'XP', fields: ['xpMade'], floor: 0.55, aliases: ['extra points made', 'extra points', 'xp made', 'pat made', 'player_pats'] },
};

// The halves and the first quarter (2026-11-01): PropFinder's game rows carry every quarter's and half's passing, rushing
// and receiving lines (q1… / h1… / h2…), and the books price the 1st half, the 1st quarter and the 2nd half's touchdowns.
// Each period market is its full-game market's twin: `<period>_<market>`, the period's fields, the full game's matchup
// table (`defense`; a table per period is not published). The touchdowns are rushing + receiving (no return touchdown
// per period in the rows).
export const PERIODS = [
  { key: 'h1', label: '1st half', words: ['1st half', 'first half', '1h', 'h1'], field: 'h1', markets: ['pass_yds', 'pass_td', 'rush_yds', 'rush_att', 'rec_yds', 'receptions', 'rush_rec_yds', 'anytime_td'] },
  { key: 'q1', label: '1st quarter', words: ['1st quarter', 'first quarter', '1q', 'q1'], field: 'q1', markets: ['pass_yds', 'pass_td', 'rush_yds', 'rush_att', 'rec_yds', 'receptions', 'rush_rec_yds', 'anytime_td'] },
  { key: 'h2', label: '2nd half', words: ['2nd half', 'second half', '2h', 'h2'], field: 'h2', markets: ['anytime_td'] },
];
// A full-game field → its period twin's field name ("recYds" → "h1RecYds").
const PERIOD_FIELD = { passYds: 'PassYds', passTd: 'PassTd', rushYds: 'RushYds', rushAtt: 'RushAtt', recYds: 'RecYds', rec: 'Rec', rushTd: 'RushTd', recTd: 'RecTd' };
export const periodField = (period, field) => (PERIOD_FIELD[field] ? `${period}${PERIOD_FIELD[field]}` : null);
const PERIOD_FLOOR = { h1: { anytime_td: 0.25 }, q1: { anytime_td: 0.12 }, h2: { anytime_td: 0.25 } };
for (const per of PERIODS) {
  for (const base of per.markets) {
    const m = NFL_MARKETS[base];
    const fields = (base === 'anytime_td' ? ['rushTd', 'recTd'] : m.fields).map((f) => periodField(per.field, f));
    const baseWords = [m.label, ...m.aliases].map((a) => a.toLowerCase()).filter((a) => a.length >= 3 && !/^player_/.test(a));
    NFL_MARKETS[`${per.key}_${base}`] = {
      ...(m.step ? { step: m.step } : {}), group: 'periods', label: `${per.label} ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}`, unit: m.unit, fields,
      defense: m.defense || (m.fields.length === 1 ? m.fields[0] : null), period: per.key, base,
      ...(m.yesNo ? { yesNo: true } : {}), floor: PERIOD_FLOOR[per.key]?.[base] ?? m.floor,
      aliases: per.words.flatMap((w) => baseWords.map((b) => `${w} ${b}`)),
    };
  }
}

export const markets = makeMarkets({ markets: NFL_MARKETS, groups: GROUPS, groupWords: /^(touchdowns?|passing|rushing|receiving|scoring|defense|kicking)$/ });
export const { MARKETS, GROUP_LABEL, MARKET_KEYS, marketFromText, groupOf, labelOf, statFields, statOf, defenseKey } = markets;

// The shuffle's bars (components/picks/Shuffle.jsx): one per market, from the lowest height worth
// asking to the highest, by the step the bar moves in, and where it starts.
export const SHUFFLE_MARKETS = [
  { market: 'pass_yds', min: 150, max: 400, step: 10, start: 270 },
  { market: 'rush_yds', min: 20, max: 160, step: 5, start: 85 },
  { market: 'rec_yds', min: 20, max: 160, step: 5, start: 85 },
  { market: 'receptions', min: 1, max: 12, step: 1, start: 6 },
  { market: 'rush_rec_yds', min: 30, max: 200, step: 5, start: 110 },
  { market: 'pass_td', min: 1, max: 5, step: 1, start: 3 },
];
