// NBA team reference data: ESPN's abbreviations (the schedule and box scores use them), names,
// and every other spelling a cheat sheet or PropFinder may carry.
export const TEAMS = {
  ATL: { name: 'Hawks', full: 'Atlanta Hawks' },
  BOS: { name: 'Celtics', full: 'Boston Celtics' },
  BKN: { name: 'Nets', full: 'Brooklyn Nets' },
  CHA: { name: 'Hornets', full: 'Charlotte Hornets' },
  CHI: { name: 'Bulls', full: 'Chicago Bulls' },
  CLE: { name: 'Cavaliers', full: 'Cleveland Cavaliers' },
  DAL: { name: 'Mavericks', full: 'Dallas Mavericks' },
  DEN: { name: 'Nuggets', full: 'Denver Nuggets' },
  DET: { name: 'Pistons', full: 'Detroit Pistons' },
  GS: { name: 'Warriors', full: 'Golden State Warriors' },
  HOU: { name: 'Rockets', full: 'Houston Rockets' },
  IND: { name: 'Pacers', full: 'Indiana Pacers' },
  LAC: { name: 'Clippers', full: 'LA Clippers' },
  LAL: { name: 'Lakers', full: 'Los Angeles Lakers' },
  MEM: { name: 'Grizzlies', full: 'Memphis Grizzlies' },
  MIA: { name: 'Heat', full: 'Miami Heat' },
  MIL: { name: 'Bucks', full: 'Milwaukee Bucks' },
  MIN: { name: 'Timberwolves', full: 'Minnesota Timberwolves' },
  NO: { name: 'Pelicans', full: 'New Orleans Pelicans' },
  NY: { name: 'Knicks', full: 'New York Knicks' },
  OKC: { name: 'Thunder', full: 'Oklahoma City Thunder' },
  ORL: { name: 'Magic', full: 'Orlando Magic' },
  PHI: { name: '76ers', full: 'Philadelphia 76ers' },
  PHX: { name: 'Suns', full: 'Phoenix Suns' },
  POR: { name: 'Trail Blazers', full: 'Portland Trail Blazers' },
  SAC: { name: 'Kings', full: 'Sacramento Kings' },
  SA: { name: 'Spurs', full: 'San Antonio Spurs' },
  TOR: { name: 'Raptors', full: 'Toronto Raptors' },
  UTAH: { name: 'Jazz', full: 'Utah Jazz' },
  WSH: { name: 'Wizards', full: 'Washington Wizards' },
};

export const TEAM_ABBRS = Object.keys(TEAMS);
export const teamName = (abbr) => TEAMS[abbr]?.name || abbr || '';
export const teamFull = (abbr) => TEAMS[abbr]?.full || abbr || '';

/** ESPN's team logo (a private tool can read the CDN directly). */
export function teamLogo(abbr) {
  return TEAMS[abbr] ? `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png` : '';
}

const ALIASES = {
  gsw: 'GS', gs: 'GS', 'golden state': 'GS', warriors: 'GS',
  nyk: 'NY', ny: 'NY', knicks: 'NY', 'new york': 'NY',
  sas: 'SA', sa: 'SA', spurs: 'SA', 'san antonio': 'SA',
  nop: 'NO', no: 'NO', pelicans: 'NO', 'new orleans': 'NO', pels: 'NO',
  uta: 'UTAH', utah: 'UTAH', jazz: 'UTAH',
  was: 'WSH', wsh: 'WSH', wizards: 'WSH', washington: 'WSH',
  pho: 'PHX', phx: 'PHX', suns: 'PHX', phoenix: 'PHX',
  brk: 'BKN', bkn: 'BKN', nets: 'BKN', brooklyn: 'BKN',
  cho: 'CHA', cha: 'CHA', hornets: 'CHA', charlotte: 'CHA',
  okc: 'OKC', thunder: 'OKC', 'oklahoma city': 'OKC',
  lac: 'LAC', clippers: 'LAC', 'la clippers': 'LAC', 'los angeles clippers': 'LAC',
  lal: 'LAL', lakers: 'LAL', 'la lakers': 'LAL',
  por: 'POR', blazers: 'POR', 'trail blazers': 'POR', portland: 'POR',
  phi: 'PHI', sixers: 'PHI', '76ers': 'PHI', philadelphia: 'PHI',
  wolves: 'MIN', timberwolves: 'MIN', minnesota: 'MIN', cavs: 'CLE', mavs: 'DAL',
};

const BY_NAME = {};
for (const [abbr, t] of Object.entries(TEAMS)) {
  BY_NAME[abbr.toLowerCase()] = abbr;
  BY_NAME[t.name.toLowerCase()] = abbr;
  BY_NAME[t.full.toLowerCase()] = abbr;
}
Object.assign(BY_NAME, ALIASES);

/** The site's abbreviation for any spelling ("GSW", "Golden State Warriors", "@ NYK"), or null. */
export function teamAbbrFromText(text) {
  const s = String(text || '').trim().replace(/^(?:@\s*|(?:vs|v|at)\.?\s+)/i, '').replace(/\s+/g, ' ').toLowerCase();
  if (!s) return null;
  if (BY_NAME[s]) return BY_NAME[s];
  const compact = s.replace(/[^a-z0-9 ]/g, '').trim();
  if (BY_NAME[compact]) return BY_NAME[compact];
  const code = compact.match(/\b([a-z]{2,4})\b$/);
  if (code && BY_NAME[code[1]]) return BY_NAME[code[1]];
  for (const [key, abbr] of Object.entries(BY_NAME)) if (key.length > 3 && compact.includes(key)) return abbr;
  return null;
}

/** "BOS @ NY", "NY vs BOS", "BOS at NY" → { away, home }; "@ NY" / "vs BOS" alone → with the team given. */
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
