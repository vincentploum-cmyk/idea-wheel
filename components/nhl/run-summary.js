// Tiny helpers shared by the run-history UI (kept out of the heavy model bundle).
const SLOT_LABELS = {
  season: 'Season',
  l5: 'L5',
  hist: 'History',
  playerStats: 'Home/Away',
  lineups: 'Lineups',
  pace: 'Pace',
  rankings: 'Def. ranks',
  boxScores: 'Box scores',
};

export function slotLabel(slot) {
  return SLOT_LABELS[slot] || slot;
}

export function teamLogo(abbr) {
  return /^[A-Z]{3}$/.test(abbr || '') ? `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg` : '';
}
