// A sport's prop markets: the keys the boards know, in the groups the page shows, and the
// tolerant reading of a market's name from a cheat-sheet column, a PropFinder odds row or a
// sheet name. Each sport declares its markets and gets back the same set of helpers.
//
//   markets: { key: { group, label, unit, fields (the box-score fields the market settles on, summed),
//                     yesNo (a scorer / double-double market: the pick is "yes"), floor (the chance the
//                     board wants before a play makes the table), defense (the allowed-table key when it
//                     is not the single field), aliases } }
//   groups: [[key, label]]
//   groupWords: a regex of group names that are tables, not markets ("Receiving", "Points")
const norm = (s) => String(s || '').toLowerCase().replace(/[_\-./+&]+/g, ' ').replace(/\s+/g, ' ').replace(/\bover\b|\bunder\b|\bo\/u\b|\bline\b|\bprop\b|\bplayer\b/g, ' ').replace(/\s+/g, ' ').trim();

export function makeMarkets({ markets, groups, groupWords }) {
  const GROUP_LABEL = Object.fromEntries(groups);
  const index = [];
  for (const [key, m] of Object.entries(markets)) {
    index.push([norm(m.label), key]);
    for (const a of m.aliases) index.push([norm(a), key]);
  }
  // Longest alias first, so "receiving touchdowns" wins over "receiving".
  index.sort((a, b) => b[0].length - a[0].length);
  const singular = (s) => s.replace(/s\b/g, '');

  function marketFromText(text) {
    const s = norm(text);
    if (!s) return null;
    if (groupWords && groupWords.test(s)) return null;
    for (const [alias, key] of index) if (alias === s) return key;
    const sg = singular(s);
    for (const [alias, key] of index) if (singular(alias) === sg) return key;
    for (const [alias, key] of index) {
      if (alias.length >= 4) { if (s.includes(alias) || sg.includes(singular(alias))) return key; continue; }
      // A short alias ("pts", "reb", "3pm") counts as a whole word: "PTS Odds", "REB L10 %".
      if (alias.length >= 3 && new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(s)) return key;
    }
    return null;
  }

  const statFields = (key) => markets[key]?.fields || [];
  /** The market's figure on a game log or box-score line: its fields summed (null without a line). */
  const statOf = (line, key) => { const f = statFields(key); if (!f.length || !line) return null; return f.reduce((s, x) => s + (Number(line[x]) || 0), 0); };
  const defenseKey = (key) => { const m = markets[key]; if (!m) return null; return m.defense || (m.fields.length === 1 ? m.fields[0] : null); };
  return {
    MARKETS: markets, GROUPS: groups, GROUP_LABEL, MARKET_KEYS: Object.keys(markets),
    marketFromText, groupOf: (key) => markets[key]?.group || null, labelOf: (key) => markets[key]?.label || key,
    statFields, statOf, defenseKey,
    /** The line a scorer / yes-no market takes when the sheet prints none. */
    defaultLine: (key) => markets[key]?.defaultLine ?? 0.5,
  };
}
