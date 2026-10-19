// The NFL prop markets the board knows, in the four groups the page shows (touchdowns, passing,
// rushing, receiving), and the tolerant reading of a market's name from a cheat sheet column,
// a PropFinder odds row or a sheet name ("Rec Yds", "player_reception_yds", "Anytime TD Scorer").
export const GROUPS = [
  ['touchdowns', 'Touchdowns'],
  ['passing', 'Passing'],
  ['rushing', 'Rushing'],
  ['receiving', 'Receiving'],
];
export const GROUP_LABEL = Object.fromEntries(GROUPS);

// key → { group, label, unit, stat (the box-score field the market settles on), yesNo (a scorer
// market: the line is a count and the pick is "yes"), floor (the chance the board wants before
// a play makes the table; below it rows are fill-ins), aliases }.
export const MARKETS = {
  anytime_td: { group: 'touchdowns', label: 'Anytime TD', unit: 'TD', stat: 'td', yesNo: true, floor: 0.35, aliases: ['anytime td', 'anytime touchdown', 'anytime touchdown scorer', 'atd', 'any time td', 'td scorer', 'touchdown scorer', 'to score a td', 'player_anytime_td', 'anytime'] },
  first_td: { group: 'touchdowns', label: 'First TD', unit: 'TD', stat: 'firstTd', yesNo: true, floor: 0.12, aliases: ['first td', '1st td', 'first touchdown', 'first touchdown scorer', '1st touchdown scorer', 'first td scorer', '1st td scorer', 'first scorer', '1st scorer', 'player_1st_td', 'ftd'] },
  two_td: { group: 'touchdowns', label: '2+ TD', unit: 'TD', stat: 'td', yesNo: true, floor: 0.15, aliases: ['2+ td', '2+ touchdowns', 'two or more touchdowns', 'multi td', 'player_2_td', '2 td'] },
  rush_td: { group: 'touchdowns', label: 'Rushing TD', unit: 'TD', stat: 'rushTd', yesNo: true, floor: 0.3, aliases: ['rushing td', 'rush td', 'rushing touchdown', 'rushing touchdowns', 'player_rush_td', 'rush tds'] },
  rec_td: { group: 'touchdowns', label: 'Receiving TD', unit: 'TD', stat: 'recTd', yesNo: true, floor: 0.3, aliases: ['receiving td', 'rec td', 'receiving touchdown', 'receiving touchdowns', 'player_reception_td', 'rec tds'] },
  pass_yds: { group: 'passing', label: 'Pass yards', unit: 'yds', stat: 'passYds', floor: 0.55, aliases: ['passing yards', 'pass yards', 'pass yds', 'passing yds', 'player_pass_yds', 'pass yd', 'py'] },
  pass_td: { group: 'passing', label: 'Pass TDs', unit: 'TD', stat: 'passTd', floor: 0.55, aliases: ['passing touchdowns', 'passing tds', 'pass tds', 'pass td', 'player_pass_tds', 'passing td'] },
  pass_cmp: { group: 'passing', label: 'Completions', unit: 'cmp', stat: 'passCmp', floor: 0.55, aliases: ['completions', 'pass completions', 'passing completions', 'player_pass_completions', 'cmp'] },
  pass_att: { group: 'passing', label: 'Pass attempts', unit: 'att', stat: 'passAtt', floor: 0.55, aliases: ['pass attempts', 'passing attempts', 'player_pass_attempts', 'attempts'] },
  pass_int: { group: 'passing', label: 'Interceptions', unit: 'INT', stat: 'passInt', floor: 0.55, aliases: ['interceptions', 'interceptions thrown', 'ints', 'player_pass_interceptions', 'int'] },
  pass_long: { group: 'passing', label: 'Longest completion', unit: 'yds', stat: 'passLong', floor: 0.55, aliases: ['longest completion', 'longest pass', 'player_pass_longest_completion', 'long completion'] },
  rush_yds: { group: 'rushing', label: 'Rush yards', unit: 'yds', stat: 'rushYds', floor: 0.55, aliases: ['rushing yards', 'rush yards', 'rush yds', 'rushing yds', 'player_rush_yds', 'rush yd', 'ry'] },
  rush_att: { group: 'rushing', label: 'Rush attempts', unit: 'att', stat: 'rushAtt', floor: 0.55, aliases: ['rushing attempts', 'rush attempts', 'carries', 'rush att', 'player_rush_attempts', 'ra'] },
  rush_long: { group: 'rushing', label: 'Longest rush', unit: 'yds', stat: 'rushLong', floor: 0.55, aliases: ['longest rush', 'longest run', 'player_rush_longest', 'long rush'] },
  rec_yds: { group: 'receiving', label: 'Rec yards', unit: 'yds', stat: 'recYds', floor: 0.55, aliases: ['receiving yards', 'rec yards', 'rec yds', 'receiving yds', 'player_reception_yds', 'rec yd', 'recv yds', 'rey'] },
  receptions: { group: 'receiving', label: 'Receptions', unit: 'rec', stat: 'rec', floor: 0.55, aliases: ['receptions', 'rec', 'catches', 'player_receptions', 'recs'] },
  rec_long: { group: 'receiving', label: 'Longest reception', unit: 'yds', stat: 'recLong', floor: 0.55, aliases: ['longest reception', 'longest catch', 'player_reception_longest', 'long reception', 'long rec'] },
  targets: { group: 'receiving', label: 'Targets', unit: 'tgt', stat: 'tgt', floor: 0.55, aliases: ['targets', 'tgts', 'player_targets'] },
  rush_rec_yds: { group: 'rushing', label: 'Rush + rec yards', unit: 'yds', stat: 'rushRecYds', floor: 0.55, aliases: ['rush + rec yards', 'rushing + receiving yards', 'rush+rec yds', 'rush and rec yards', 'scrimmage yards', 'player_rush_reception_yds', 'rush rec yds', 'total yards'] },
  pass_rush_yds: { group: 'passing', label: 'Pass + rush yards', unit: 'yds', stat: 'passRushYds', floor: 0.55, aliases: ['pass + rush yards', 'passing + rushing yards', 'pass+rush yds', 'player_pass_rush_yds', 'pass rush yds'] },
};

export const MARKET_KEYS = Object.keys(MARKETS);

const norm = (s) => String(s || '').toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').replace(/\bover\b|\bunder\b|\bo\/u\b|\bline\b|\bprop\b|\bplayer\b/g, ' ').replace(/\s+/g, ' ').trim();

const ALIAS_INDEX = (() => {
  const idx = [];
  for (const [key, m] of Object.entries(MARKETS)) {
    idx.push([norm(m.label), key]);
    for (const a of m.aliases) idx.push([norm(a), key]);
  }
  // Longest alias first, so "receiving touchdowns" wins over "receiving".
  return idx.sort((a, b) => b[0].length - a[0].length);
})();

/**
 * The market key a text names, or null. Exact alias first, then an alias contained in the text
 * ("Receiving Yards O/U", "rec_yds_line"); plurals and the words over / under / line are ignored.
 */
export function marketFromText(text) {
  const s = norm(text);
  if (!s) return null;
  // A group's name ("Receiving") is a table, not a market.
  if (/^(touchdowns?|passing|rushing|receiving|scoring)$/.test(s)) return null;
  for (const [alias, key] of ALIAS_INDEX) if (alias === s) return key;
  const singular = s.replace(/s\b/g, '');
  for (const [alias, key] of ALIAS_INDEX) if (alias.replace(/s\b/g, '') === singular) return key;
  for (const [alias, key] of ALIAS_INDEX) {
    if (alias.length < 4) continue;
    if (s.includes(alias) || singular.includes(alias.replace(/s\b/g, ''))) return key;
  }
  // "TD" alone, with no qualifier, is the anytime scorer market a cheat sheet usually means.
  if (/^(td|tds|touchdown|touchdowns)$/.test(s)) return 'anytime_td';
  return null;
}

export const groupOf = (key) => MARKETS[key]?.group || null;
export const labelOf = (key) => MARKETS[key]?.label || key;

/** The box-score fields a market is settled on, summed (rush + rec yards is two fields). */
export function statFields(key) {
  const m = MARKETS[key];
  if (!m) return [];
  if (m.stat === 'rushRecYds') return ['rushYds', 'recYds'];
  if (m.stat === 'passRushYds') return ['passYds', 'rushYds'];
  if (m.stat === 'td') return ['rushTd', 'recTd', 'retTd'];
  return [m.stat];
}
