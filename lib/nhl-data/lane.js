// The model's lane rule as the one environment read everywhere the site colours a matchup: the
// rink's ice, the soft-spot flag on Best bets and the plays strip, the shuffle's Matchup cell.
// Until 2026-10-27 those read shots allowed alone (goals allowed on the Goals switch) while the
// model (`classifyDefenseLaneState` in components/nhl/model-core.js) reads the opponent's shots,
// iCF, iFF and iSCF ranks together — and the study found attempts (iFF / iCF) the better volume
// signal for shots than shots themselves (docs/shots-goals-predictors.md, section 1). The rule
// itself stays in model-core.js (the model's math is untouched); the server stamps each PropFinder
// defense row with it (`lane` in `propfinderDefenseTabs`, lib/nhl-data/propfinder.js), so this
// module is pure and safe in the browser: words and tones only.

/** The columns each market's rule reads, in the order the band label shows them. */
export const LANE_COLS = { sog: ['sog', 'icf', 'iff', 'iscf'], g: ['g', 'iscf', 'sog'] };
export const COL_LABEL = { sog: 'SOG', g: 'G', a: 'A', icf: 'iCF', iff: 'iFF', iscf: 'iSCF' };
/** A lane state → the rink's tone (the same classes the rank thirds use). */
export const LANE_TONE = { open: 'soft', neutral: 'mid', suppressed: 'tough' };
export const LANE_WORD = { open: 'open', neutral: 'neutral', suppressed: 'suppressed' };

export const laneTone = (lane) => LANE_TONE[lane] || 'none';

/** The rule in words, for a hover: what opens a lane and what suppresses it. */
export function laneRuleText(metric = 'sog') {
  return metric === 'g'
    ? 'open when two of goals / iSCF / SOG allowed are in the top 16, or goals alone, or iSCF in the top 12; suppressed when two of the three are 23rd or worse, or goals and iSCF both'
    : 'open when two of SOG / iCF / iFF / iSCF allowed are in the top 12, or SOG or iSCF alone; suppressed when three of the four are 23rd or worse, or SOG and iSCF both';
}

/** "#8 SOG, #15 iCF, #13 iFF, #13 iSCF" — the rule's columns with their ranks (a missing rank reads "–"). */
export function laneRanksText(ranks, metric = 'sog') {
  return LANE_COLS[metric].map((k) => `#${ranks?.[k] ?? '–'} ${COL_LABEL[k]}`).join(', ');
}

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none': the rank-thirds read, the fallback for a table without a lane. */
export function thirdTone(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'soft';
  if (rank > teams - third) return 'tough';
  return 'mid';
}

/**
 * The tone of a defense band ({ rank: { sog, g, … }, lane: { sog, g }, teamCount }) for a market:
 * the model's lane when the band carries one (a PropFinder table), else the rank third.
 */
export function bandTone(band, metric = 'sog', teams = null) {
  if (!band) return 'none';
  const lane = band.lane?.[metric];
  if (lane) return laneTone(lane);
  return thirdTone(band.rank?.[metric], band.teamCount || teams);
}
