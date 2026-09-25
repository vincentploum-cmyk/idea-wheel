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

export { teamLogo } from '@/lib/nhl-data/teams';
