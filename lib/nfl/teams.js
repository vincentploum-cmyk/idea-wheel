// NFL team reference data: the site's abbreviation (ESPN's spelling, which the schedule and box
// scores use), names, and every other spelling a cheat sheet or PropFinder may carry.
export const TEAMS = {
  ARI: { name: 'Cardinals', full: 'Arizona Cardinals' },
  ATL: { name: 'Falcons', full: 'Atlanta Falcons' },
  BAL: { name: 'Ravens', full: 'Baltimore Ravens' },
  BUF: { name: 'Bills', full: 'Buffalo Bills' },
  CAR: { name: 'Panthers', full: 'Carolina Panthers' },
  CHI: { name: 'Bears', full: 'Chicago Bears' },
  CIN: { name: 'Bengals', full: 'Cincinnati Bengals' },
  CLE: { name: 'Browns', full: 'Cleveland Browns' },
  DAL: { name: 'Cowboys', full: 'Dallas Cowboys' },
  DEN: { name: 'Broncos', full: 'Denver Broncos' },
  DET: { name: 'Lions', full: 'Detroit Lions' },
  GB: { name: 'Packers', full: 'Green Bay Packers' },
  HOU: { name: 'Texans', full: 'Houston Texans' },
  IND: { name: 'Colts', full: 'Indianapolis Colts' },
  JAX: { name: 'Jaguars', full: 'Jacksonville Jaguars' },
  KC: { name: 'Chiefs', full: 'Kansas City Chiefs' },
  LAC: { name: 'Chargers', full: 'Los Angeles Chargers' },
  LAR: { name: 'Rams', full: 'Los Angeles Rams' },
  LV: { name: 'Raiders', full: 'Las Vegas Raiders' },
  MIA: { name: 'Dolphins', full: 'Miami Dolphins' },
  MIN: { name: 'Vikings', full: 'Minnesota Vikings' },
  NE: { name: 'Patriots', full: 'New England Patriots' },
  NO: { name: 'Saints', full: 'New Orleans Saints' },
  NYG: { name: 'Giants', full: 'New York Giants' },
  NYJ: { name: 'Jets', full: 'New York Jets' },
  PHI: { name: 'Eagles', full: 'Philadelphia Eagles' },
  PIT: { name: 'Steelers', full: 'Pittsburgh Steelers' },
  SEA: { name: 'Seahawks', full: 'Seattle Seahawks' },
  SF: { name: '49ers', full: 'San Francisco 49ers' },
  TB: { name: 'Buccaneers', full: 'Tampa Bay Buccaneers' },
  TEN: { name: 'Titans', full: 'Tennessee Titans' },
  WSH: { name: 'Commanders', full: 'Washington Commanders' },
};

export const TEAM_ABBRS = Object.keys(TEAMS);

export const teamName = (abbr) => TEAMS[abbr]?.name || abbr || '';
export const teamFull = (abbr) => TEAMS[abbr]?.full || abbr || '';

/** ESPN's team logo (the site has no NFL media store; a private tool can read the CDN directly). */
export function teamLogo(abbr) {
  return TEAMS[abbr] ? `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png` : '';
}

const ALIASES = {
  was: 'WSH', wsh: 'WSH', washington: 'WSH', commanders: 'WSH',
  jac: 'JAX', jax: 'JAX', jacksonville: 'JAX',
  la: 'LAR', lar: 'LAR', rams: 'LAR', 'la rams': 'LAR',
  lac: 'LAC', chargers: 'LAC', 'la chargers': 'LAC', sd: 'LAC',
  lv: 'LV', lvr: 'LV', oak: 'LV', raiders: 'LV', 'las vegas': 'LV',
  gb: 'GB', gnb: 'GB', 'green bay': 'GB',
  kc: 'KC', kan: 'KC', 'kansas city': 'KC',
  ne: 'NE', nwe: 'NE', 'new england': 'NE',
  no: 'NO', nor: 'NO', 'new orleans': 'NO',
  sf: 'SF', sfo: 'SF', 'san francisco': 'SF', niners: 'SF',
  tb: 'TB', tam: 'TB', 'tampa bay': 'TB', bucs: 'TB',
  ari: 'ARI', arz: 'ARI', hou: 'HOU', htx: 'HOU', clv: 'CLE', blt: 'BAL',
  'ny giants': 'NYG', 'ny jets': 'NYJ', giants: 'NYG', jets: 'NYJ',
};

const BY_NAME = {};
for (const [abbr, t] of Object.entries(TEAMS)) {
  BY_NAME[abbr.toLowerCase()] = abbr;
  BY_NAME[t.name.toLowerCase()] = abbr;
  BY_NAME[t.full.toLowerCase()] = abbr;
  BY_NAME[t.full.toLowerCase().replace(/^(new york|los angeles|san francisco|new england|new orleans|green bay|kansas city|tampa bay|las vegas) /, '')] = abbr;
}
Object.assign(BY_NAME, ALIASES);

/** The site's abbreviation for any spelling ("WAS", "Washington Commanders", "la rams", "@ KC"), or null. */
export function teamAbbrFromText(text) {
  const s = String(text || '').trim().replace(/^(?:@\s*|(?:vs|v|at)\.?\s+)/i, '').replace(/\s+/g, ' ').toLowerCase();
  if (!s) return null;
  if (BY_NAME[s]) return BY_NAME[s];
  const compact = s.replace(/[^a-z0-9 ]/g, '').trim();
  if (BY_NAME[compact]) return BY_NAME[compact];
  // "Kansas City Chiefs (KC)" or a cell that ends with the code.
  const code = compact.match(/\b([a-z]{2,3})\b$/);
  if (code && BY_NAME[code[1]]) return BY_NAME[code[1]];
  for (const [key, abbr] of Object.entries(BY_NAME)) if (key.length > 3 && compact.includes(key)) return abbr;
  return null;
}

/** "DAL @ PHI", "PHI vs DAL", "DAL at PHI" → { away, home }; "@ PHI" / "vs DAL" alone → the opponent and the venue. */
export function parseMatchup(text, team = null) {
  const s = String(text || '').trim();
  const m = s.match(/^(.+?)\s*(@|at|vs\.?|v\.?)\s*(.+)$/i);
  if (m) {
    const a = teamAbbrFromText(m[1]); const b = teamAbbrFromText(m[3]);
    if (a && b) return /^(@|at)$/i.test(m[2]) ? { away: a, home: b } : { away: b, home: a };
  }
  const lone = s.match(/^(@|at|vs\.?|v\.?)\s*(.+)$/i);
  if (lone && team) {
    const opp = teamAbbrFromText(lone[2]);
    if (opp) return /^(@|at)$/i.test(lone[1]) ? { away: team, home: opp } : { away: opp, home: team };
  }
  return null;
}
