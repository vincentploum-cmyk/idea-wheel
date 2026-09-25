// NHL team reference data (abbrev → names). Nicknames match what the model's
// normTeam() already understands.
/** The NHL's static per-team logo (the standings feed's teamLogo can go stale). */
export function teamLogo(abbr) {
  return /^[A-Z]{3}$/.test(abbr || '') ? `https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg` : '';
}

export const TEAMS = {
  ANA: { name: 'Ducks', full: 'Anaheim Ducks' },
  BOS: { name: 'Bruins', full: 'Boston Bruins' },
  BUF: { name: 'Sabres', full: 'Buffalo Sabres' },
  CAR: { name: 'Hurricanes', full: 'Carolina Hurricanes' },
  CBJ: { name: 'Blue Jackets', full: 'Columbus Blue Jackets' },
  CGY: { name: 'Flames', full: 'Calgary Flames' },
  CHI: { name: 'Blackhawks', full: 'Chicago Blackhawks' },
  COL: { name: 'Avalanche', full: 'Colorado Avalanche' },
  DAL: { name: 'Stars', full: 'Dallas Stars' },
  DET: { name: 'Red Wings', full: 'Detroit Red Wings' },
  EDM: { name: 'Oilers', full: 'Edmonton Oilers' },
  FLA: { name: 'Panthers', full: 'Florida Panthers' },
  LAK: { name: 'Kings', full: 'Los Angeles Kings' },
  MIN: { name: 'Wild', full: 'Minnesota Wild' },
  MTL: { name: 'Canadiens', full: 'Montreal Canadiens' },
  NJD: { name: 'Devils', full: 'New Jersey Devils' },
  NSH: { name: 'Predators', full: 'Nashville Predators' },
  NYI: { name: 'Islanders', full: 'New York Islanders' },
  NYR: { name: 'Rangers', full: 'New York Rangers' },
  OTT: { name: 'Senators', full: 'Ottawa Senators' },
  PHI: { name: 'Flyers', full: 'Philadelphia Flyers' },
  PIT: { name: 'Penguins', full: 'Pittsburgh Penguins' },
  SEA: { name: 'Kraken', full: 'Seattle Kraken' },
  SJS: { name: 'Sharks', full: 'San Jose Sharks' },
  STL: { name: 'Blues', full: 'St. Louis Blues' },
  TBL: { name: 'Lightning', full: 'Tampa Bay Lightning' },
  TOR: { name: 'Maple Leafs', full: 'Toronto Maple Leafs' },
  UTA: { name: 'Mammoth', full: 'Utah Mammoth' },
  VAN: { name: 'Canucks', full: 'Vancouver Canucks' },
  VGK: { name: 'Golden Knights', full: 'Vegas Golden Knights' },
  WPG: { name: 'Jets', full: 'Winnipeg Jets' },
  WSH: { name: 'Capitals', full: 'Washington Capitals' },
};

export function teamName(abbr) {
  return TEAMS[abbr]?.name || abbr;
}

export function teamFull(abbr) {
  return TEAMS[abbr]?.full || abbr;
}

const BY_NAME = Object.fromEntries(
  Object.entries(TEAMS).flatMap(([abbr, t]) => [
    [t.name.toLowerCase(), abbr],
    [t.full.toLowerCase(), abbr],
    [abbr.toLowerCase(), abbr],
  ]),
);
Object.assign(BY_NAME, {
  la: 'LAK', lak: 'LAK', nj: 'NJD', sj: 'SJS', tb: 'TBL', vgk: 'VGK', vegas: 'VGK',
  'golden knights': 'VGK', leafs: 'TOR', utah: 'UTA', 'utah hockey club': 'UTA',
  'montréal canadiens': 'MTL', 'st louis blues': 'STL', 'colombus blue jackets': 'CBJ',
});

/** Best-effort team → abbrev ("Maple Leafs Defense (Last 10 Games)" → TOR). */
export function teamAbbrFromText(text) {
  const s = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (BY_NAME[s]) return BY_NAME[s];
  const keys = Object.keys(BY_NAME).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 3 && new RegExp(`(^|[^a-z])${k.replace(/[.]/g, '\\.')}([^a-z]|$)`).test(s)) return BY_NAME[k];
  }
  return null;
}
