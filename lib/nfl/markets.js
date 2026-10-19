// The NFL prop markets the board knows, in the four groups the page shows (touchdowns, passing,
// rushing, receiving), through the shared factory (lib/picks/markets.js).
import { makeMarkets } from '../picks/markets';

export const GROUPS = [
  ['touchdowns', 'Touchdowns'],
  ['passing', 'Passing'],
  ['rushing', 'Rushing'],
  ['receiving', 'Receiving'],
];

// key → { group, label, unit, fields (the box-score fields the market settles on, summed), yesNo
// (a scorer market: the pick is "yes"), floor (the chance the board wants before a play makes the
// table), defense (the allowed-table key), aliases }.
const NFL_MARKETS = {
  anytime_td: { group: 'touchdowns', label: 'Anytime TD', unit: 'TD', fields: ['rushTd', 'recTd', 'retTd'], defense: 'td', yesNo: true, floor: 0.35, aliases: ['anytime td', 'anytime touchdown', 'anytime touchdown scorer', 'atd', 'any time td', 'td scorer', 'touchdown scorer', 'to score a td', 'player_anytime_td', 'anytime', 'td', 'tds', 'touchdown', 'touchdowns'] },
  first_td: { group: 'touchdowns', label: 'First TD', unit: 'TD', fields: ['firstTd'], defense: 'td', yesNo: true, floor: 0.12, aliases: ['first td', '1st td', 'first touchdown', 'first touchdown scorer', '1st touchdown scorer', 'first td scorer', '1st td scorer', 'first scorer', '1st scorer', 'player_1st_td', 'ftd'] },
  two_td: { group: 'touchdowns', label: '2+ TD', unit: 'TD', fields: ['rushTd', 'recTd', 'retTd'], defense: 'td', yesNo: true, floor: 0.15, defaultLine: 1.5, aliases: ['2+ td', '2+ touchdowns', 'two or more touchdowns', 'multi td', 'player_2_td', '2 td'] },
  rush_td: { group: 'touchdowns', label: 'Rushing TD', unit: 'TD', fields: ['rushTd'], yesNo: true, floor: 0.3, aliases: ['rushing td', 'rush td', 'rushing touchdown', 'rushing touchdowns', 'player_rush_td', 'rush tds'] },
  rec_td: { group: 'touchdowns', label: 'Receiving TD', unit: 'TD', fields: ['recTd'], yesNo: true, floor: 0.3, aliases: ['receiving td', 'rec td', 'receiving touchdown', 'receiving touchdowns', 'player_reception_td', 'rec tds'] },
  pass_yds: { group: 'passing', label: 'Pass yards', unit: 'yds', fields: ['passYds'], floor: 0.55, aliases: ['passing yards', 'pass yards', 'pass yds', 'passing yds', 'player_pass_yds', 'pass yd', 'py'] },
  pass_td: { group: 'passing', label: 'Pass TDs', unit: 'TD', fields: ['passTd'], floor: 0.55, aliases: ['passing touchdowns', 'passing tds', 'pass tds', 'pass td', 'player_pass_tds', 'passing td'] },
  pass_cmp: { group: 'passing', label: 'Completions', unit: 'cmp', fields: ['passCmp'], floor: 0.55, aliases: ['completions', 'pass completions', 'passing completions', 'player_pass_completions', 'cmp'] },
  pass_att: { group: 'passing', label: 'Pass attempts', unit: 'att', fields: ['passAtt'], floor: 0.55, aliases: ['pass attempts', 'passing attempts', 'player_pass_attempts', 'attempts'] },
  pass_int: { group: 'passing', label: 'Interceptions', unit: 'INT', fields: ['passInt'], floor: 0.55, aliases: ['interceptions', 'interceptions thrown', 'ints', 'player_pass_interceptions', 'int'] },
  pass_long: { group: 'passing', label: 'Longest completion', unit: 'yds', fields: ['passLong'], floor: 0.55, aliases: ['longest completion', 'longest pass', 'player_pass_longest_completion', 'long completion'] },
  rush_yds: { group: 'rushing', label: 'Rush yards', unit: 'yds', fields: ['rushYds'], floor: 0.55, aliases: ['rushing yards', 'rush yards', 'rush yds', 'rushing yds', 'player_rush_yds', 'rush yd', 'ry'] },
  rush_att: { group: 'rushing', label: 'Rush attempts', unit: 'att', fields: ['rushAtt'], floor: 0.55, aliases: ['rushing attempts', 'rush attempts', 'carries', 'rush att', 'player_rush_attempts', 'ra'] },
  rush_long: { group: 'rushing', label: 'Longest rush', unit: 'yds', fields: ['rushLong'], floor: 0.55, aliases: ['longest rush', 'longest run', 'player_rush_longest', 'long rush'] },
  rec_yds: { group: 'receiving', label: 'Rec yards', unit: 'yds', fields: ['recYds'], floor: 0.55, aliases: ['receiving yards', 'rec yards', 'rec yds', 'receiving yds', 'player_reception_yds', 'rec yd', 'recv yds', 'rey'] },
  receptions: { group: 'receiving', label: 'Receptions', unit: 'rec', fields: ['rec'], floor: 0.55, aliases: ['receptions', 'rec', 'catches', 'player_receptions', 'recs'] },
  rec_long: { group: 'receiving', label: 'Longest reception', unit: 'yds', fields: ['recLong'], floor: 0.55, aliases: ['longest reception', 'longest catch', 'player_reception_longest', 'long reception', 'long rec'] },
  targets: { group: 'receiving', label: 'Targets', unit: 'tgt', fields: ['tgt'], floor: 0.55, aliases: ['targets', 'tgts', 'player_targets'] },
  rush_rec_yds: { group: 'rushing', label: 'Rush + rec yards', unit: 'yds', fields: ['rushYds', 'recYds'], floor: 0.55, aliases: ['rush + rec yards', 'rushing + receiving yards', 'rush+rec yds', 'rush and rec yards', 'scrimmage yards', 'player_rush_reception_yds', 'rush rec yds', 'total yards'] },
  pass_rush_yds: { group: 'passing', label: 'Pass + rush yards', unit: 'yds', fields: ['passYds', 'rushYds'], floor: 0.55, aliases: ['pass + rush yards', 'passing + rushing yards', 'pass+rush yds', 'player_pass_rush_yds', 'pass rush yds'] },
};

export const markets = makeMarkets({ markets: NFL_MARKETS, groups: GROUPS, groupWords: /^(touchdowns?|passing|rushing|receiving|scoring)$/ });
export const { MARKETS, GROUP_LABEL, MARKET_KEYS, marketFromText, groupOf, labelOf, statFields, statOf, defenseKey } = markets;
