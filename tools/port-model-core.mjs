#!/usr/bin/env node
// Port the site's model changes into the local model app (App.jsx, the model's source of truth),
// the same edits made to components/nhl/model-core.js, in thirteen groups, each all-or-nothing:
//   1. 2026-10-13 (a022443): p2s / p3s / p4s / p5s are the Poisson tails of λ shots; the ladder's
//      figures ride along as ladderP3s / P4s / P5s and still set the attack score.
//   2. 2026-10-20 (4ec641f): p1g / p2g / p3g are the Poisson tails of λ goals; the ladder's figures
//      ride along as ladderP1g / P2g / P3g and still set the attack score.
//   3. 2026-10-27 (26b1084): the home / away split's share of a skater's goal base and the
//      historical-profile multipliers on the goal ladder cut to a quarter (VENUE_SPLIT_WEIGHT,
//      H2H_WEIGHT, venueMix).
//   4. 2026-11-07: projectedToiFromLineup refitted on the posted lines (TOI_FIT: the line's constant
//      + 0.345 · last 5 + 0.442 · season, in place of max(last 5, the line's floor)); its call passes
//      skater.toiL5 and skater.toiSeason (docs/audits/2026-11-07-nhl-toi.md).
//   5. 2026-11-12: cheatSheetMajorMultiplier's goals branch is a smooth ISCF/G term
//      (iscfGoalMultiplier, ISCF_GOAL_PER_SD), the Goals/G rank steps out
//      (docs/audits/2026-11-12-nhl-shots-environment.md).
//   6. 2026-11-12: defenseGoalMultiplier (λ goals' and λ points' opponent read) is the ISCF ratio
//      alone, the Goals/G and Shots/G ratios out; no ISCF on the table → 1 (same audit).
//   7. 2026-11-13: the line boost is lineMoveMultiplier: the projected minutes at tonight's posted line over
//      the same at his usual line, to the power 0.8, both ways, defensemen on their own minutes, in place of
//      +6% a line upward only (docs/audits/2026-11-13-nhl-formula-refit.md). Needs group 4 in first.
//   8. 2026-11-27: the iCF gates (shot volume gate, explosion engine, 4+ / 5+ gate, RW shot filter, RW elite
//      volume) read matchupIcf: a forward's season iCF times the opponent's iCF allowed to his position over the
//      league's, to the power 0.73, the shift held to +/-0.5; defensemen and lambda's defMult unchanged
//      (docs/audits/2026-11-27-nhl-icf-thresholds.md). Needs group 7 in first.
//   9. 2026-11-27: the goal gates that test a forward's own iSCF (playerGoalFloorProfile, scorerTierInfo, the
//      finisher / shooter gate, the finisher goal model) read matchupIscf: his iSCF times the opponent's iSCF allowed
//      to his position over the league's, to the power 0.74, the shift held to +/-0.25, his last-5 iSCF by the same
//      ratio; defensemen, the goal-leak overrides and defenseGoalMultiplier unchanged (same audit). Needs group 8 in first.
//  10. 2026-11-27: the points environment reads chances allowed, not assists allowed: cheatSheetMajorMultiplier's
//      points branch is a smooth ISCF/G rank term (iscfPointMultiplier, ISCF_POINT_PER_SD 0.069, defensemen 1) in
//      place of the Assists/G steps, and λ points' pointDefenseMult takes its 0.35 from the iSCF ratio in place of the
//      assists ratio (same audit, "Points").
//  11. 2026-11-27: λ shots' opponent read (defMult) cuts for a tough defense at (1 - raw) x defDamp x DEF_CUT_SHARE (0.25),
//      the skater's shot-tier damping as the lift has, at a quarter of it; the lift unchanged (opponentShotMult;
//      docs/audits/2026-11-27-nhl-team-shots.md). Needs group 9 in first (its anchor is the end of goalGateSkaterOf).
//  12. 2026-11-27: the published λ shots (and p2s … p5s, its Poisson tails) = 1.30 · λ^0.611 (shotSpreadLambda), the
//      ladder, attack score and tiers on the λ before it, kept as lambdaSRaw (docs/audits/2026-11-27-nhl-shot-spread.md).
//      Needs group 11 in first (its anchor is the end of opponentShotMult).
//  13. 2026-11-27: matchupIcf moves defensemen too, at their own exponent (ICF_ENV_EXP_D 0.65), and the defensemen's
//      baseline (defensemanCapabilityProfile) reads the gates' skater; it revises group 8's matchupIcf, which still
//      reads as ported once this is in (same audit, "Defensemen"). Needs group 8 in first.
//
//   node tools/port-model-core.mjs [path to App.jsx] [--check]
//
// Default path: ~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx. Every edit is an exact-text
// replacement that must match once. A group whose new text is already there (or that text as a later group
// revised it) is reported as ported; a group with a missing anchor is skipped and named, the others still go in. A backup
// is written beside the file before it is changed. --check reports and writes nothing.
// Self-test: applied to the model-core of 2026-10-12, groups 1 and 2 reproduce the file of
// 2026-10-20 exactly (`git show 15512c0^1:components/nhl/model-core.js`, `git show 4ec641f:…`).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONSTANTS_BLOCK = `
// ─── WEIGHTS UNDER REVIEW (2026-10-27) ────────────────────────────────────────
// Vincent's call after docs/shots-goals-predictors.md section 16 (this season's data: the home /
// away split moves P(1+ goal) ×1.02 across its range and the head-to-head ×1.00, against ×4.2 for
// his season rate): the split's share of a skater's goal base, which used to replace his season
// rate outright, and the historical-profile (position vs opponent) multipliers on the goal ladder
// are cut to a quarter for now. 1 is the model as it was, 0 the factor off.
const VENUE_SPLIT_WEIGHT = 0.25;
const H2H_WEIGHT = 0.25;
/** A venue-split figure at its weight over the season figure; the season figure alone without a split. */
function venueMix(venueValue, seasonValue) {
  if (venueValue == null || !Number.isFinite(Number(venueValue))) return seasonValue;
  return VENUE_SPLIT_WEIGHT * Number(venueValue) + (1 - VENUE_SPLIT_WEIGHT) * (Number(seasonValue) || 0);
}
`;

const SHOTS_ODDS = [
  {
    name: 'the published shots odds',
    old: '        p3s = clamp(Number.isFinite(Number(p3s)) ? Number(p3s) : 0, 0, 0.999);\n'
      + '        p4s = clamp(Number.isFinite(Number(p4s)) ? Number(p4s) : 0, 0, 0.999);\n'
      + '        p5s = clamp(Number.isFinite(Number(p5s)) ? Number(p5s) : 0, 0, 0.999);\n',
    new: '        const ladderP3s = clamp(Number.isFinite(Number(p3s)) ? Number(p3s) : 0, 0, 0.999);\n'
      + '        const ladderP4s = clamp(Number.isFinite(Number(p4s)) ? Number(p4s) : 0, 0, 0.999);\n'
      + '        const ladderP5s = clamp(Number.isFinite(Number(p5s)) ? Number(p5s) : 0, 0, 0.999);\n'
      + '        // The published shots odds are the Poisson tails of the row\'s λ shots (lineBoostedS).\n'
      + '        // Graded on 2,748 player-games (Oct 1-12, 2026), the ladder\'s figures above ran far\n'
      + '        // past what the box scores returned (at 50%+ they hit 49%; RW1/RW2 under, D1/D2 and\n'
      + '        // depth forwards off), while the Poisson read of the same λ scored better in every\n'
      + '        // bucket a bet is made in (Brier 0.159 vs 0.169). The ladder\'s figures stay on the row\n'
      + '        // as ladderP3s/P4s/P5s and still drive the attack score and the shot tiers.\n'
      + '        p3s = clamp(poissonAtLeast(lineBoostedS, 3), 0, 0.999);\n'
      + '        p4s = clamp(poissonAtLeast(lineBoostedS, 4), 0, 0.999);\n'
      + '        p5s = clamp(poissonAtLeast(lineBoostedS, 5), 0, 0.999);\n'
      + '        const p2s = clamp(poissonAtLeast(lineBoostedS, 2), 0, 0.999);\n',
  },
  {
    name: 'the result row\'s shots fields',
    old: '          p3s: +p3s.toFixed(4),\n          p4s: +p4s.toFixed(4),\n          p5s: +p5s.toFixed(4),\n',
    new: '          p2s: +p2s.toFixed(4),\n          p3s: +p3s.toFixed(4),\n          p4s: +p4s.toFixed(4),\n          p5s: +p5s.toFixed(4),\n'
      + '          ladderP3s: +ladderP3s.toFixed(4),\n          ladderP4s: +ladderP4s.toFixed(4),\n          ladderP5s: +ladderP5s.toFixed(4),\n',
  },
  {
    name: 'the attack score\'s shots terms',
    old: '            0.16 * p3s +\n            0.24 * p4s +\n            0.12 * p5s +\n',
    new: '            0.16 * ladderP3s +\n            0.24 * ladderP4s +\n            0.12 * ladderP5s +\n',
  },
];

const GOAL_ODDS = [
  {
    name: 'the published goal odds',
    old: '        p1g = clamp(Number.isFinite(Number(p1g)) ? Number(p1g) : 0, 0, 0.999);\n'
      + '        p2g = clamp(Number.isFinite(Number(p2g)) ? Number(p2g) : 0, 0, 0.999);\n'
      + '        p3g = clamp(Number.isFinite(Number(p3g)) ? Number(p3g) : 0, 0, 0.999);\n',
    new: '        const ladderP1g = clamp(Number.isFinite(Number(p1g)) ? Number(p1g) : 0, 0, 0.999);\n'
      + '        const ladderP2g = clamp(Number.isFinite(Number(p2g)) ? Number(p2g) : 0, 0, 0.999);\n'
      + '        const ladderP3g = clamp(Number.isFinite(Number(p3g)) ? Number(p3g) : 0, 0, 0.999);\n'
      + '        // The published goal odds are the Poisson tails of the row\'s λ goals (lambdaGDisplay),\n'
      + '        // the same step the shots odds took above. Graded on 1,728 player-games (Oct 13-20,\n'
      + '        // 2026), the goal ladder\'s figures did not follow the λ: at 50%+ they hit 30% (the\n'
      + '        // boards\' anytime-goal plays: stated 0.58, hit 0.29, n = 35), skaters on a λ near 0.25\n'
      + '        // were published at 60-67% and the top λ were capped near 0.37, while the Poisson read\n'
      + '        // of the same λ scored better over all rows (Brier 0.124 vs 0.130) and read 0.41 against\n'
      + '        // a 0.41 hit on the rows over the boards\' floor. The ladder\'s figures stay on the row as\n'
      + '        // ladderP1g/P2g/P3g and still drive the attack score and the goal tier.\n'
      + '        p1g = clamp(poissonAtLeast(lambdaGDisplay, 1), 0, 0.999);\n'
      + '        p2g = clamp(poissonAtLeast(lambdaGDisplay, 2), 0, 0.999);\n'
      + '        p3g = clamp(poissonAtLeast(lambdaGDisplay, 3), 0, 0.999);\n',
  },
  {
    name: 'the result row\'s goal fields',
    old: '          p1g: +p1g.toFixed(4),\n          p2g: +p2g.toFixed(4),\n          p3g: +p3g.toFixed(4),\n',
    new: '          p1g: +p1g.toFixed(4),\n          p2g: +p2g.toFixed(4),\n          p3g: +p3g.toFixed(4),\n'
      + '          ladderP1g: +ladderP1g.toFixed(4),\n          ladderP2g: +ladderP2g.toFixed(4),\n          ladderP3g: +ladderP3g.toFixed(4),\n',
  },
  {
    name: 'the attack score\'s goal terms',
    old: '            0.09 * p1g +\n            0.025 * p2g +\n            0.005 * p3g\n',
    new: '            0.09 * ladderP1g +\n            0.025 * ladderP2g +\n            0.005 * ladderP3g\n',
  },
];

const WEIGHTS = [
  { name: 'the ladder\'s venue-form multiplier', old: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18;\n', new: '  const compressedVenue = 1 + (venueGoalMult - 1) * 0.18 * VENUE_SPLIT_WEIGHT;\n' },
  { name: 'the ladder\'s history multiplier (1+ goal)', old: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22;\n', new: '  const compressedHist1 = 1 + (histGoalMult1 - 1) * 0.22 * H2H_WEIGHT;\n' },
  { name: 'the ladder\'s history multiplier (2+ goals)', old: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18;\n', new: '  const compressedHist2 = 1 + (histGoalMult2 - 1) * 0.18 * H2H_WEIGHT;\n' },
  { name: 'the team goals budget', old: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueGoals : seasonGoals);\n', new: '    return sum + Math.max(0, venueGoals != null && venueGoals > 0 ? venueMix(venueGoals, seasonGoals) : seasonGoals);\n' },
  { name: 'the style read\'s goal base', old: '      goalsBase: p.pHA ? (isHome ? p.pHA.g_home : p.pHA.g_away) : goals,\n', new: '      goalsBase: p.pHA ? venueMix(isHome ? p.pHA.g_home : p.pHA.g_away, goals) : goals,\n' },
  {
    name: 'the capability floors\' goal base',
    old: '  const seasonGoals = skater.goalsSeason || 0;\n  const baseGoals = Math.max(0.001,\n    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? 0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)\n      : 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals)\n  );\n',
    new: '  const seasonGoals = skater.goalsSeason || 0;\n  const seasonGoalsBase = 0.80 * seasonGoals + 0.20 * Math.max(0, skater.goalsL5 || seasonGoals);\n  const baseGoals = Math.max(0.001,\n    venueGoalsBase != null && venueGoalsBase > 0\n'
      + '      ? VENUE_SPLIT_WEIGHT * (0.72 * venueGoalsBase + 0.18 * seasonGoals + 0.10 * Math.max(0, venueGoalsL5 || 0)) + (1 - VENUE_SPLIT_WEIGHT) * seasonGoalsBase\n      : seasonGoalsBase\n  );\n',
  },
  {
    name: 'the skater\'s goal base (season and last five)',
    old: '        const goalsL5 = (venueGoalsL5 !== null ? venueGoalsL5 : skater.goalsL5) ?? 0;\n        const goalsSeason = (venueGoalsSeason !== null ? venueGoalsSeason : skater.goalsSeason) ?? 0;\n',
    new: '        // The venue split at VENUE_SPLIT_WEIGHT over his season figures (it used to replace them).\n        const goalsL5 = venueMix(venueGoalsL5, skater.goalsL5 ?? 0) ?? 0;\n        const goalsSeason = venueMix(venueGoalsSeason, skater.goalsSeason ?? 0) ?? 0;\n',
  },
];

const TOI = [
  {
    name: 'the projected minutes (projectedToiFromLineup)',
    old: 'function projectedToiFromLineup(posKey, todayLine, playerToi) {\n'
      + '  const p = (posKey || \"\").toUpperCase();\n'
      + '  const current = playerToi || 0;\n'
      + '\n'
      + '  if (p === \"D\") {\n'
      + '    if (todayLine === 1) return Math.max(current, 21.0);\n'
      + '    if (todayLine === 2) return Math.max(current, 18.5);\n'
      + '    return Math.max(current, 16.0);\n'
      + '  }\n'
      + '\n'
      + '  if (todayLine === 1) return Math.max(current, 18.5);\n'
      + '  if (todayLine === 2) return Math.max(current, 16.0);\n'
      + '  if (todayLine === 3) return Math.max(current, 13.5);\n'
      + '  return Math.max(current, 11.0);\n'
      + '}\n',
    new: '// ─── PROJECTED MINUTES (2026-11-07) ──────────────────────────────────────────\n'
      + '// Refitted on the posted lines (docs/audits/2026-11-07-nhl-toi.md, tools/audit/nhl_toi.py section F):\n'
      + '// 8,501 skater-games of 2026-27, each with the lines GameDayTweets posted before puck drop.\n'
      + '// toi = the line\'s constant + 0.345 · his last 5 + 0.442 · his season. On the later half of the\n'
      + '// games it misses by 1.82 minutes with a +0.05 bias. The rule it replaces, his last 5 or the\n'
      + '// line\'s floor (F 18.5 / 16 / 13.5 / 11, D 21 / 18.5 / 16), whichever was higher, missed by 2.08\n'
      + '// with a +0.84 bias and never lowered a demoted skater. The matchup\'s power plays measured\n'
      + '// nothing and are left out. With no minutes on record the line\'s mean stands in.\n'
      + 'const TOI_FIT = {\n'
      + '  l5: 0.345,\n'
      + '  season: 0.442,\n'
      + '  line: { F1: 4.05, F2: 3.60, F3: 3.07, F4: 2.16, D1: 5.04, D2: 4.26, D3: 2.98 },\n'
      + '  mean: { F1: 18.36, F2: 16.56, F3: 14.47, F4: 11.32, D1: 22.30, D2: 19.84, D3: 15.54 },\n'
      + '};\n'
      + '\n'
      + 'function projectedToiFromLineup(posKey, todayLine, playerToi, toiL5, toiSeason) {\n'
      + '  const isD = (posKey || \"\").toUpperCase() === \"D\";\n'
      + '  const n = Math.max(1, Math.round(Number(todayLine) || (isD ? 3 : 4)));\n'
      + '  const key = isD ? `D${Math.min(3, n)}` : `F${Math.min(4, n)}`;\n'
      + '  const l5 = Number(toiL5) > 0 ? Number(toiL5) : Number(playerToi) || 0;\n'
      + '  const season = Number(toiSeason) > 0 ? Number(toiSeason) : l5;\n'
      + '  if (!(l5 > 0)) return TOI_FIT.mean[key];\n'
      + '  return +(TOI_FIT.line[key] + TOI_FIT.l5 * l5 + TOI_FIT.season * season).toFixed(2);\n'
      + '}\n',
  },
  {
    name: 'the projected minutes\' call (his last 5 and season passed)',
    old: '        const effectiveToi = projectedToiFromLineup(posKeyForToi, todayLine, playerToi);\n',
    new: '        const effectiveToi = projectedToiFromLineup(posKeyForToi, todayLine, playerToi, skater.toiL5, skater.toiSeason);\n',
  },
];

const GOALS_ENV_OLD = '  } else {\n'
  + '    const openScore = [goalRank, iscfRank, shotRank].filter((v) => soft(v, 16)).length;\n'
  + '    const hardScore = [goalRank, iscfRank, shotRank].filter((v) => hard(v)).length;\n'
  + '    if (open(goalRank, 10)) mult += 0.18;\n'
  + '    else if (soft(goalRank, 16)) mult += 0.09;\n'
  + '    if (open(iscfRank, 10)) mult += 0.12;\n'
  + '    if (openScore >= 2) mult += 0.07;\n'
  + '    if (hardScore >= 2) mult -= 0.18;\n'
  + '    else if (hard(goalRank, 24)) mult -= 0.12;\n'
  + '  }\n'
  + "  if (posKey === 'D' && market === 'goals') mult *= 0.88;\n";

const GOALS_ENV = [
  {
    name: 'the smooth ISCF goals term (iscfGoalMultiplier)',
    old: 'function cheatSheetMajorMultiplier(posStats, market, posKey) {\n',
    new: '// ─── GOALS ENVIRONMENT (2026-11-12) ───────────────────────────────────────────\n'
      + '// The opponent\'s goals read on the cheat sheet is its ISCF/G rank at the position, as a smooth\n'
      + '// term: ×exp(0.04 per SD of rank), about +7% for the rank 1 defense and -6.5% for rank 32.\n'
      + '// Graded on 2025-26 and 2026-27 to Nov 11 (45,393 skater-games, the opponent\'s season table\n'
      + '// ranked each morning, on top of his own goal rate; docs/audits/2026-11-12-nhl-shots-environment.md):\n'
      + '// the Goals/G rank predicted nothing (top 10: +0.8% to +4% where the old steps added +16%; 11-16\n'
      + '// below his rate where they added +8%), ISCF/G carried the read (top 10: +3.6% to +7.1%; fitted,\n'
      + '// 93-98% of the weight), and only a smooth ISCF term beat his rate alone (1+ goal Brier -0.25%;\n'
      + '// the old steps cost +1.2% to +1.4%). Vincent: "replace it with the smooth ISCF term and port it".\n'
      + 'const ISCF_GOAL_PER_SD = 0.04;\n'
      + 'function iscfGoalMultiplier(iscfRank, teams = 32) {\n'
      + '  const r = Number(iscfRank);\n'
      + '  if (iscfRank == null || !Number.isFinite(r) || r <= 0) return 1;\n'
      + '  const n = teams || 32;\n'
      + '  const z = ((n + 1) / 2 - r) / (n / Math.sqrt(12));\n'
      + '  return +Math.exp(ISCF_GOAL_PER_SD * z).toFixed(3);\n'
      + '}\n'
      + '\n'
      + 'function cheatSheetMajorMultiplier(posStats, market, posKey) {\n',
  },
  {
    name: 'the cheat sheet\'s goals multiplier (the ISCF term in place of the Goals/G steps)',
    old: GOALS_ENV_OLD,
    new: '  } else {\n'
      + '    // Goals: the smooth ISCF term (2026-11-12, above iscfGoalMultiplier); the Goals/G rank steps\n'
      + '    // (+18% / +9% / -12%, and the soft / hard counts with Shots) predicted nothing over his rate.\n'
      + '    mult = iscfGoalMultiplier(iscfRank);\n'
      + '  }\n'
      + "  if (posKey === 'D' && market === 'goals') mult *= 0.88;\n",
  },
];

const DEFENSE_GOAL = [
  {
    name: 'the opponent\'s goal read on λ (defenseGoalMultiplier: the ISCF ratio alone)',
    old: 'function defenseGoalMultiplier(teamPos, defenseAvg, posKey) {\n'
      + '  if (!teamPos || !defenseAvg) return 1;\n'
      + '  const goalsRatio = safeRatio(teamPos.goals || 0, Math.max(0.65, defenseAvg.goals || 0.65), 1);\n'
      + '  const iscfRatio = safeRatio(teamPos.iscf || 0, Math.max(3.5, defenseAvg.iscf || 3.5), 1);\n'
      + '  const shotsRatio = safeRatio(teamPos.shots || 0, Math.max(3.5, defenseAvg.shots || 3.5), 1);\n'
      + '\n'
      + '  let composite = 0.5 * goalsRatio + 0.3 * iscfRatio + 0.2 * shotsRatio;\n'
      + '  if (posKey === "D") composite = 0.35 * goalsRatio + 0.35 * iscfRatio + 0.3 * shotsRatio;\n'
      + '  return +clamp(composite, 0.82, 1.22).toFixed(3);\n'
      + '}\n',
    new: '// The opponent\'s goal read on λ (2026-11-12): the scoring chances it allows the position (ISCF/G)\n'
      + '// over the league\'s mean, alone. The Goals/G ratio (half the old composite) predicted nothing over a\n'
      + '// skater\'s goal rate and Shots/G added nothing to ISCF (docs/audits/2026-11-12-nhl-shots-environment.md,\n'
      + '// 45,363 skater-games: replayed through λ points to λ goals at every tier\'s pass-through, the ISCF ratio\n'
      + '// beat his rate alone and the old composite did not). λ goals takes 0.45 x defDamp of it through the\n'
      + '// points step, about 0.2 to 0.45 of the ratio, where the study fitted 0.21 to 0.33. No ISCF on the\n'
      + '// table: neutral. Vincent: "yes, do defenseGoalMultiplier too and port it".\n'
      + 'function defenseGoalMultiplier(teamPos, defenseAvg, posKey) {\n'
      + '  if (!teamPos || !defenseAvg || !(Number(teamPos.iscf) > 0)) return 1;\n'
      + '  const iscfRatio = safeRatio(Number(teamPos.iscf), Math.max(3.5, defenseAvg.iscf || 3.5), 1);\n'
      + '  return +clamp(iscfRatio, 0.82, 1.22).toFixed(3);\n'
      + '}\n',
  },
];

const LINE_MOVE = [
  {
    name: "the line-move multiplier (lineMoveMultiplier, usualLineFromToi, TOI_MOVE_EXP)",
    old: "  if (!(l5 > 0)) return TOI_FIT.mean[key];\n  return +(TOI_FIT.line[key] + TOI_FIT.l5 * l5 + TOI_FIT.season * season).toFixed(2);\n}\n",
    new: "  if (!(l5 > 0)) return TOI_FIT.mean[key];\n  return +(TOI_FIT.line[key] + TOI_FIT.l5 * l5 + TOI_FIT.season * season).toFixed(2);\n}\n\n// ─── SHOTS FOLLOW THE POSTED LINE'S MINUTES (2026-11-13) ─────────────────────\n// docs/audits/2026-11-13-nhl-formula-refit.md (tools/predictors/formula_refit.py): 7,044 skater-games of\n// 2026-27 with the lines posted before puck drop. A skater posted a line above his usual one played 1.03x\n// (one line) and 1.10x (two) his minutes and shot 1.03x / 1.11x his read; posted a line below, 0.97x / 0.94x\n// and 0.97x / 0.96x. The multiplier is the projected minutes at tonight's posted line over the same projection\n// at his usual line (the line whose mean minutes are nearest his own), to the power 0.8 (minutes follow that\n// ratio at 0.81, shots follow minutes at 0.99; fitted directly, 0.70 with 0.16 to 1.24 around it). It replaces\n// the up-only step (+6% a line, read on the forwards' minute cuts for defensemen too, which left a promoted\n// defenseman unread and never lowered a demoted skater). Only with a posted line; 0 turns it off.\nconst TOI_MOVE_EXP = 0.8;\nfunction usualLineFromToi(posKey, playerToi) {\n  const isD = (posKey || \"\").toUpperCase() === \"D\";\n  const toi = Number(playerToi) || 0;\n  let best = null;\n  for (let n = 1; n <= (isD ? 3 : 4); n++) {\n    const gap = Math.abs(TOI_FIT.mean[`${isD ? \"D\" : \"F\"}${n}`] - toi);\n    if (best == null || gap < best.gap) best = { n, gap };\n  }\n  return best.n;\n}\nfunction lineMoveMultiplier(posKey, postedLine, playerToi, toiL5, toiSeason) {\n  if (!TOI_MOVE_EXP || postedLine == null || !(Number(playerToi) > 0)) return 1;\n  const isD = (posKey || \"\").toUpperCase() === \"D\";\n  const today = Math.min(isD ? 3 : 4, Math.max(1, Math.round(Number(postedLine) || 0)));\n  if (!(today >= 1)) return 1;\n  const usual = usualLineFromToi(posKey, playerToi);\n  if (usual === today) return 1;\n  const at = projectedToiFromLineup(posKey, today, playerToi, toiL5, toiSeason);\n  const base = projectedToiFromLineup(posKey, usual, playerToi, toiL5, toiSeason);\n  if (!(at > 0) || !(base > 0)) return 1;\n  return clamp(Math.pow(at / base, TOI_MOVE_EXP), 0.88, 1.14);\n}\n",
  },
  {
    name: "the posted line kept on the prepared skater",
    old: "          todayLine,\n          resolvedPos: posKeyForToi,\n",
    new: "          todayLine,\n          postedLine: luPlayer?.line ?? null,\n          resolvedPos: posKeyForToi,\n",
  },
  {
    name: "the line boost (the minutes multiplier in place of the up-only step)",
    old: "        const lineShift = impliedLine - todayLine;\n        const lineBoost = Math.max(0, Math.min(0.12, lineShift * 0.06));\n",
    new: "        const lineBoost = lineMoveMultiplier(posKey, prep.postedLine, playerToi, skater.toiL5, skater.toiSeason) - 1;\n",
  },
];

const ICF_ENV = [
  {
    name: "the matchup-adjusted iCF (matchupIcf, ICF_ENV_EXP, ICF_ENV_MAX_SHIFT)",
    old: "  return clamp(Math.pow(at / base, TOI_MOVE_EXP), 0.88, 1.14);\n}\n",
    new: "  return clamp(Math.pow(at / base, TOI_MOVE_EXP), 0.88, 1.14);\n}\n\n// \u2500\u2500\u2500 THE MATCHUP MOVES THE iCF THE GATES READ (2026-11-27) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// 45,455 skater-games of 2025-26 and 2026-27, read leak-free: a forward's shots follow his attempts a game to\n// the power 0.89 and the opponent's attempts allowed to forwards (over the league's) to the power 0.65, so the\n// matchup is worth his iCF times that ratio to the power 0.73 (0.65 / 0.89). From the toughest defenses (x0.88)\n// to the softest (x1.12) that is about one attempt a game: an even-money 3+ needed 6.1 against the first and\n// 5.1 against the second. The gates that read his season iCF (5.0 / 5.4 / 5.5 / 5.8 / 6.0 / 6.5) read this\n// instead, the shift held to +/-0.5. Forwards only: a defenseman's 3+ barely moved with the defense in the same\n// rows. lambda's own defense read (defMult) is unchanged. Vincent: \"Add the +/-0.5 iCF environment adjustment\n// to the model\". 0 turns it off.\nconst ICF_ENV_EXP = 0.73;\nconst ICF_ENV_MAX_SHIFT = 0.5;\nfunction matchupIcf(posKey, icfSeason, teamPos, defenseAvg) {\n  const icf = Number(icfSeason) || 0;\n  if (!ICF_ENV_EXP || !(icf > 0) || (posKey || \"\").toUpperCase() === \"D\") return icf;\n  const allowed = Number(teamPos?.icf);\n  const league = Number(defenseAvg?.icf);\n  if (!(allowed > 0) || !(league > 0)) return icf;\n  const shift = clamp(icf * (Math.pow(allowed / league, ICF_ENV_EXP) - 1), -ICF_ENV_MAX_SHIFT, ICF_ENV_MAX_SHIFT);\n  return +(icf + shift).toFixed(3);\n}\n",
  },
  {
    name: "the matchup iCF and the gates' skater, read once a skater",
    old: "        const rawTeamPosStats = oppDef?.posStats?.[posKey] || null;\n",
    new: "        const rawTeamPosStats = oppDef?.posStats?.[posKey] || null;\n        const icfMatchup = matchupIcf(posKey, skater.icfSeason, teamPos, defenseAvg);\n        const gateSkater = icfMatchup === (skater.icfSeason || 0) ? skater : { ...skater, icfSeason: icfMatchup };\n",
  },
  {
    name: "the shot volume gate reads it",
    old: "          icfSeason: skater.icfSeason || 0,\n          iscfSeason: skater.iscfSeason || 0,\n          effectiveToi,\n          todayLine,\n          dynamicLineShare,\n",
    new: "          icfSeason: icfMatchup,\n          iscfSeason: skater.iscfSeason || 0,\n          effectiveToi,\n          todayLine,\n          dynamicLineShare,\n",
  },
  {
    name: "the shot explosion engine reads it",
    old: "          icfSeason: skater.icfSeason || 0,\n          iscfSeason: skater.iscfSeason || 0,\n          effectiveToi,\n          todayLine,\n          blockPaceMult,\n          teamPos,\n",
    new: "          icfSeason: icfMatchup,\n          iscfSeason: skater.iscfSeason || 0,\n          effectiveToi,\n          todayLine,\n          blockPaceMult,\n          teamPos,\n",
  },
  {
    name: "the RW elite-volume cap reads it",
    old: "          (skater.icfSeason || 0) >= 6.0 &&\n",
    new: "          icfMatchup >= 6.0 &&\n",
  },
  {
    name: "the 4+ / 5+ gate reads it",
    old: "const fourPlusGate = fourPlusShotGateContext({ skater, effectiveToi,",
    new: "const fourPlusGate = fourPlusShotGateContext({ skater: gateSkater, effectiveToi,",
  },
  {
    name: "the RW shot filter reads it",
    old: "          ? rwShotFilterContext({\n              skater,\n",
    new: "          ? rwShotFilterContext({\n              skater: gateSkater,\n",
  },
];

const ISCF_ENV = [
  {
    name: "the matchup-adjusted iSCF (matchupIscf, goalGateSkaterOf, ISCF_ENV_EXP, ISCF_ENV_MAX_SHIFT)",
    old: "  return +(icf + shift).toFixed(3);\n}\n",
    new: "  return +(icf + shift).toFixed(3);\n}\n\n// \u2500\u2500\u2500 THE MATCHUP MOVES THE iSCF THE GOAL GATES READ (2026-11-27) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// The same study for goals (45,450 skater-games of 2025-26 and 2026-27, leak-free): a forward's goals follow his\n// scoring chances a game (iSCF) to the power 1.06 and the opponent's chances allowed to forwards (over the league's)\n// to the power 0.78, so the matchup is worth his iSCF times that ratio to the power 0.74; the opponent's goals\n// allowed read only 0.32. The goal gates that test his own iSCF (the goal floor's level, caps and premium 1+, the\n// scorer tier, the finisher goal model, the finisher / shooter routing) read this instead, the shift held to\n// +/-0.25 (about +/-9% at the gates' 1.7 to 2.8). Forwards only (defensemen: 0.37, and their rows by the\n// opponent's rank do not line up). Not the goal-leak overrides, which already fire on the opponent's goals and\n// chances allowed; lambda's defenseGoalMultiplier is unchanged. Vincent: \"now do the same for goals with iSCF\n// thresholds\". 0 turns it off.\nconst ISCF_ENV_EXP = 0.74;\nconst ISCF_ENV_MAX_SHIFT = 0.25;\nfunction matchupIscf(posKey, iscfSeason, teamPos, defenseAvg) {\n  const iscf = Number(iscfSeason) || 0;\n  if (!ISCF_ENV_EXP || !(iscf > 0) || (posKey || \"\").toUpperCase() === \"D\") return iscf;\n  const allowed = Number(teamPos?.iscf);\n  const league = Number(defenseAvg?.iscf);\n  if (!(allowed > 0) || !(league > 0)) return iscf;\n  const shift = clamp(iscf * (Math.pow(allowed / league, ISCF_ENV_EXP) - 1), -ISCF_ENV_MAX_SHIFT, ISCF_ENV_MAX_SHIFT);\n  return +(iscf + shift).toFixed(3);\n}\n/** The skater the goal gates read: his season iSCF moved by the matchup and his last-5 iSCF by the same ratio. */\nfunction goalGateSkaterOf(skater, iscfMatchup) {\n  const season = Number(skater?.iscfSeason) || 0;\n  if (!(season > 0) || iscfMatchup === season) return skater;\n  const l5 = skater.iscfL5 == null ? skater.iscfL5 : +(Number(skater.iscfL5) * iscfMatchup / season).toFixed(3);\n  return { ...skater, iscfSeason: iscfMatchup, iscfL5: l5 };\n}\n",
  },
  {
    name: "the matchup iSCF and the goal gates' skater, read once a skater",
    old: "        const gateSkater = icfMatchup === (skater.icfSeason || 0) ? skater : { ...skater, icfSeason: icfMatchup };\n",
    new: "        const gateSkater = icfMatchup === (skater.icfSeason || 0) ? skater : { ...skater, icfSeason: icfMatchup };\n        const iscfMatchup = matchupIscf(posKey, skater.iscfSeason, teamPos, defenseAvg);\n        const goalGateSkater = goalGateSkaterOf(skater, iscfMatchup);\n",
  },
  {
    name: "the goal floor profile reads it",
    old: "        const goalFloor = playerGoalFloorProfile(skater, posKey, todayLine, effectiveToi);\n",
    new: "        const goalFloor = playerGoalFloorProfile(goalGateSkater, posKey, todayLine, effectiveToi);\n",
  },
  {
    name: "the scorer tier reads it",
    old: "        const scorerTier = scorerTierInfo({\n          ...skater,\n          goalsL5,\n",
    new: "        const scorerTier = scorerTierInfo({\n          ...goalGateSkater,\n          goalsL5,\n",
  },
  {
    name: "the finisher / shooter gate reads it",
    old: "          goalsSeason,\n          iscfSeason: skater.iscfSeason || 0,\n          assistsSeason: skater.astSeason || 0,\n",
    new: "          goalsSeason,\n          iscfSeason: goalGateSkater.iscfSeason || 0,\n          assistsSeason: skater.astSeason || 0,\n",
  },
  {
    name: "the finisher goal model reads it",
    old: "          shotsSeason: skater.shotsSeason || 0,\n          iscfSeason: skater.iscfSeason || 0,\n          dangerRate,\n",
    new: "          shotsSeason: skater.shotsSeason || 0,\n          iscfSeason: goalGateSkater.iscfSeason || 0,\n          dangerRate,\n",
  },
];

const POINTS_ENV = [
  {
    name: "the smooth ISCF points term (iscfPointMultiplier, ISCF_POINT_PER_SD)",
    old: "// \u2500\u2500\u2500 GOALS ENVIRONMENT (2026-11-12)",
    new: "// \u2500\u2500\u2500 POINTS ENVIRONMENT (2026-11-27) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// The opponent's points read on the cheat sheet is its ISCF/G rank at the position as a smooth term, like goals:\n// \u00d7exp(0.069 per SD of rank), about +12% for the rank 1 defense and -11% for rank 32; defensemen none. 45,455\n// skater-games of 2025-26 and 2026-27, read leak-free on top of his own points rate and scored on held-out dates\n// (docs/audits/2026-11-27-nhl-icf-thresholds.md, \"Points\"): the assists-allowed rank steps it replaces\n// (+16% / +8% / -12%) made points worse than no opponent read at all (forwards -38.7 deviance, defensemen -23.7),\n// a smooth assists term barely helped (+5.6), the iSCF term did (+42.3); for defensemen it was flat (0.007 per SD).\n// Vincent: \"now do the same for points with assists thresholds\", then option 1: \"go with option 1\".\nconst ISCF_POINT_PER_SD = 0.069;\nfunction iscfPointMultiplier(iscfRank, posKey, teams = 32) {\n  const r = Number(iscfRank);\n  if ((posKey || \"\").toUpperCase() === \"D\" || iscfRank == null || !Number.isFinite(r) || r <= 0) return 1;\n  const n = teams || 32;\n  const z = ((n + 1) / 2 - r) / (n / Math.sqrt(12));\n  return +Math.exp(ISCF_POINT_PER_SD * z).toFixed(3);\n}\n\n// \u2500\u2500\u2500 GOALS ENVIRONMENT (2026-11-12)",
  },
  {
    name: "the cheat sheet's points multiplier (the ISCF term in place of the Assists/G steps)",
    old: "  } else if (market === 'points') {\n    const openScore = [assistRank, shotRank, icfRank, iffRank, iscfRank].filter((v) => soft(v, 16)).length;\n    const hardScore = [assistRank, shotRank, icfRank, iffRank, iscfRank].filter((v) => hard(v)).length;\n    if (open(assistRank, 10)) mult += 0.16;\n    else if (soft(assistRank, 16)) mult += 0.08;\n    if (open(shotRank, 12)) mult += 0.08;\n    if (openScore >= 3) mult += 0.08;\n    if (hardScore >= 3) mult -= 0.18;\n    else if (hard(assistRank, 24)) mult -= 0.12;\n",
    new: "  } else if (market === 'points') {\n    // Points: the smooth ISCF term (2026-11-27, above iscfPointMultiplier); the Assists/G rank steps (+16% / +8% /\n    // -12%, and the soft / hard counts with Shots) made points worse than no opponent read.\n    mult = iscfPointMultiplier(iscfRank, posKey);\n",
  },
  {
    name: "\u03bb points' opponent read (the iSCF ratio in place of the assists ratio)",
    old: "        const assistRatio = teamPos && defenseAvg\n          ? safeRatio(teamPos.assists || 0, Math.max(0.75, defenseAvg.assists || 0.75), 1)\n          : 1;\n        const pointDefenseMult = clamp(\n          0.45 * defenseGoalMult + 0.35 * assistRatio + 0.20 * safeRatio(teamPos?.shots || 0, Math.max(3.5, defenseAvg?.shots || 3.5), 1),\n",
    new: "        // The 0.35 that read the opponent's assists allowed reads its scoring chances allowed (2026-11-27): on top of\n        // his points rate the iSCF ratio carried 68.5 of held-out deviance against 30.3 for assists, and with both in\n        // assists kept 0.14 to iSCF's 0.73 (docs/audits/2026-11-27-nhl-icf-thresholds.md, \"Points\"). No iSCF: neutral.\n        const pointIscfRatio = teamPos && defenseAvg && Number(teamPos.iscf) > 0\n          ? safeRatio(Number(teamPos.iscf), Math.max(3.5, defenseAvg.iscf || 3.5), 1)\n          : 1;\n        const pointDefenseMult = clamp(\n          0.45 * defenseGoalMult + 0.35 * pointIscfRatio + 0.20 * safeRatio(teamPos?.shots || 0, Math.max(3.5, defenseAvg?.shots || 3.5), 1),\n",
  },
];

const DEF_CUT = [
  {
    name: "the softer cut (opponentShotMult, DEF_CUT_SHARE)",
    old: "  return { ...skater, iscfSeason: iscfMatchup, iscfL5: l5 };\n}\n",
    new: "  return { ...skater, iscfSeason: iscfMatchup, iscfL5: l5 };\n}\n\n// ─── A TOUGH OPPONENT CUTS λ SHOTS A QUARTER AS HARD AS A SOFT ONE LIFTS THEM (2026-11-27) ─\n// λ shots' opponent read (defMult): a soft defense's lift has always been scaled by the skater's shot tier (defDamp:\n// elite 1.0, good 0.82, average 0.64, weak 0.48), while a tough defense's cut went in at 0.94 to 1.03 of its size, so a\n// depth skater lost the whole cut and gained half the lift. Replayed on the season's 5,843 graded skater-games\n// (docs/audits/2026-11-27-nhl-team-shots.md): the teams the run read lowest got 24.3 shots on 18.7 projected, and with\n// each tier's level fitted the cut scored best near nothing (the cut at the lift's damping x1: +4.6 log-likelihood per\n// 1,000 skater-games; x0.25: about twice that, and the same order fitted before 11-13 and scored after). The cut is\n// (1 - raw) x defDamp x DEF_CUT_SHARE; the lift is unchanged. Vincent: \"yes soften the cut and port it to the local app\".\n// The cut as it was: 1 - (1 - raw) x max(0.9, 1.12 - 0.18 x defDamp).\nconst DEF_CUT_SHARE = 0.25;\nfunction opponentShotMult(rawDefMult, defDamp) {\n  return rawDefMult >= 1\n    ? 1 + (rawDefMult - 1) * defDamp\n    : 1 - (1 - rawDefMult) * defDamp * DEF_CUT_SHARE;\n}\n",
  },
  {
    name: "λ shots' opponent read uses it",
    old: "          defMult = rawDefMult >= 1\n            ? 1 + (rawDefMult - 1) * dampStrength\n            : 1 - (1 - rawDefMult) * Math.max(0.9, 1.12 - 0.18 * dampStrength);\n",
    new: "          defMult = opponentShotMult(rawDefMult, dampStrength);\n",
  },
];

const SHOT_SPREAD = [
  {
    name: "the published λ shots' spread (shotSpreadLambda, SHOT_SPREAD_A, SHOT_SPREAD_B)",
    old: "    : 1 - (1 - rawDefMult) * defDamp * DEF_CUT_SHARE;\n}\n",
    new: "    : 1 - (1 - rawDefMult) * defDamp * DEF_CUT_SHARE;\n}\n\n// ─── THE PUBLISHED λ SHOTS PULLED TOWARD THE MIDDLE (2026-11-27) ─────────────\n// The run's λ shots spread too wide: on the season's 5,843 graded skater-games (the softer cut above replayed in), a\n// skater read under 0.5 took 0.78 shots and one read over 3.5 took 3.23 on 4.20; by shot tier elite landed 0.85 of its λ\n// and weak 1.41, and inside every tier the low reads ran low and the high reads high, so the tier only follows the size\n// of λ. Fitted on the games before 11-13 and scored on those after, landed = A · λ^B beat the λ as it was (log-likelihood\n// +52 per 1,000 skater-games, Brier 3+ 0.1573 → 0.1514, 4+ 0.0824 → 0.0791) and one factor per tier (+32); on the season\n// A = 1.30, B = 0.611: a read of 1.96 stays, 0.36 becomes 0.70, 4.2 becomes 3.12 (docs/audits/2026-11-27-nhl-shot-spread.md).\n// Applied to the published λ shots and the odds read from it (p2s … p5s); the shot ladder, the attack score and the\n// tiers read the λ before it (`lambdaSRaw` on the row). Vincent: \"fix the tier bias first\". B = 1 and A = 1 turn it off.\nconst SHOT_SPREAD_A = 1.3;\nconst SHOT_SPREAD_B = 0.611;\nfunction shotSpreadLambda(lam) {\n  const v = Number(lam);\n  if (!(v > 0)) return v;\n  return SHOT_SPREAD_A * Math.pow(v, SHOT_SPREAD_B);\n}\n",
  },
  {
    name: "λ shots after the line move can be pulled in",
    old: "        const lineBoostedS = cappedLambdaS * (1 + lineBoost);\n",
    new: "        let lineBoostedS = cappedLambdaS * (1 + lineBoost);\n",
  },
  {
    name: "the published λ shots and its odds read it (the ladder before it)",
    old: "        // Final hard clamp after all overlays so rendered probabilities can never exceed 100%\n",
    new: "        // The published λ shots (and the odds below, its Poisson tails) pulled toward the middle (shotSpreadLambda, 2026-11-27);\n        // the ladder above read the λ before it, kept on the row as lambdaSRaw.\n        const lambdaSRaw = lineBoostedS;\n        lineBoostedS = shotSpreadLambda(lineBoostedS);\n        // Final hard clamp after all overlays so rendered probabilities can never exceed 100%\n",
  },
  {
    name: "the row keeps the λ before it (lambdaSRaw)",
    old: "          lambdaS: +lineBoostedS.toFixed(2),\n",
    new: "          lambdaS: +lineBoostedS.toFixed(2),\n          lambdaSRaw: +lambdaSRaw.toFixed(2),\n",
  },
];

const ICF_ENV_D = [
  {
    name: "matchupIcf for defensemen at their own exponent (ICF_ENV_EXP_D)",
    old: "// instead, the shift held to +/-0.5. Forwards only: a defenseman's 3+ barely moved with the defense in the same\n// rows. lambda's own defense read (defMult) is unchanged. Vincent: \"Add the +/-0.5 iCF environment adjustment\n// to the model\". 0 turns it off.\nconst ICF_ENV_EXP = 0.73;\nconst ICF_ENV_MAX_SHIFT = 0.5;\nfunction matchupIcf(posKey, icfSeason, teamPos, defenseAvg) {\n  const icf = Number(icfSeason) || 0;\n  if (!ICF_ENV_EXP || !(icf > 0) || (posKey || \"\").toUpperCase() === \"D\") return icf;\n  const allowed = Number(teamPos?.icf);\n  const league = Number(defenseAvg?.icf);\n  if (!(allowed > 0) || !(league > 0)) return icf;\n  const shift = clamp(icf * (Math.pow(allowed / league, ICF_ENV_EXP) - 1), -ICF_ENV_MAX_SHIFT, ICF_ENV_MAX_SHIFT);\n",
    new: "// instead, the shift held to +/-0.5. lambda's own defense read (defMult) is unchanged. Vincent: \"Add the +/-0.5\n// iCF environment adjustment to the model\". 0 turns it off.\n// Defensemen too since later the same day (Vincent: \"now do the same for defensemen\"), at their own fit: their shots\n// follow their attempts to the power 0.96 and the attempts allowed to defensemen to the power 0.63, so 0.65; held out\n// by date the read saved 59.6 deviance over their own rate (forwards 102.5). Their 3+ grid had looked flat only\n// because few defensemen reach 3+; by rank they shot x1.066 against the five loosest defenses, x0.905 the tightest.\n// Their goals and points did not move with the defense (iSCF allowed -1.2 and +5.7): no goal or points shift.\nconst ICF_ENV_EXP = 0.73;\nconst ICF_ENV_EXP_D = 0.65;\nconst ICF_ENV_MAX_SHIFT = 0.5;\nfunction matchupIcf(posKey, icfSeason, teamPos, defenseAvg) {\n  const icf = Number(icfSeason) || 0;\n  const exp = (posKey || \"\").toUpperCase() === \"D\" ? ICF_ENV_EXP_D : ICF_ENV_EXP;\n  if (!exp || !(icf > 0)) return icf;\n  const allowed = Number(teamPos?.icf);\n  const league = Number(defenseAvg?.icf);\n  if (!(allowed > 0) || !(league > 0)) return icf;\n  const shift = clamp(icf * (Math.pow(allowed / league, exp) - 1), -ICF_ENV_MAX_SHIFT, ICF_ENV_MAX_SHIFT);\n",
  },
  {
    name: "the defensemen's baseline (their capability profile) reads the gates' skater",
    old: "            todayLine,\n            skater,\n            environmentScore,\n          });\n",
    new: "            todayLine,\n            skater: gateSkater,\n            environmentScore,\n          });\n",
  },
];

export const GROUPS = [
  { key: 'shotsOdds20261013', label: 'shots odds (2026-10-13): p2s / p3s / p4s / p5s the Poisson tails of λ shots, the ladder as ladderP3s / P4s / P5s', edits: SHOTS_ODDS },
  { key: 'goalOdds20261020', label: 'goal odds (2026-10-20): p1g / p2g / p3g the Poisson tails of λ goals, the ladder as ladderP1g / P2g / P3g', edits: GOAL_ODDS },
  { key: 'weights20261027', label: 'venue split and head-to-head at a quarter (2026-10-27)', edits: WEIGHTS, constants: true },
  { key: 'toi20261107', label: 'projected minutes (2026-11-07): the line\'s constant + 0.345 · last 5 + 0.442 · season, refitted on the posted lines', edits: TOI },
  { key: 'goalsEnv20261112', label: 'goals environment (2026-11-12): the cheat sheet\'s goals multiplier is a smooth ISCF/G term, the Goals/G steps out', edits: GOALS_ENV },
  { key: 'defenseGoal20261112', label: 'λ goals\' opponent read (2026-11-12): defenseGoalMultiplier is the ISCF ratio alone, Goals/G and Shots/G out', edits: DEFENSE_GOAL },
  { key: 'lineMove20261113', label: 'shots follow the posted line\'s minutes (2026-11-13): lineMoveMultiplier in place of the up-only +6% a line', edits: LINE_MOVE },
  { key: 'icfEnv20261127', label: 'the matchup moves the iCF the gates read (2026-11-27): matchupIcf, forwards, +/-0.5 at most', edits: ICF_ENV },
  { key: 'iscfEnv20261127', label: 'the matchup moves the iSCF the goal gates read (2026-11-27): matchupIscf, forwards, +/-0.25 at most', edits: ISCF_ENV },
  { key: 'pointsEnv20261127', label: 'points environment (2026-11-27): the cheat sheet\'s points multiplier a smooth ISCF/G term, λ points\' 0.35 on the iSCF ratio, assists allowed out', edits: POINTS_ENV },
  { key: 'defCut20261127', label: 'a tough opponent cuts λ shots a quarter as hard as a soft one lifts them (2026-11-27): opponentShotMult, DEF_CUT_SHARE 0.25', edits: DEF_CUT },
  { key: 'shotSpread20261127', label: 'the published λ shots pulled toward the middle (2026-11-27): 1.30 · λ^0.611, the ladder on the λ before it (lambdaSRaw)', edits: SHOT_SPREAD },
  { key: 'icfEnvD20261127', label: 'the matchup iCF for defensemen too (2026-11-27): matchupIcf at 0.65 for D, their capability profile reads it', edits: ICF_ENV_D },
];

/** The end index of the `function poissonAtLeast(` body (after its closing brace), or -1. */
function afterPoissonAtLeast(src) {
  const start = src.indexOf('function poissonAtLeast(');
  if (start < 0) return -1;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.indexOf('\n', i) + 1; }
  }
  return -1;
}

/** One group on a source text, all or nothing: { text, status: 'ported' | 'applied' | 'missing', missing: [names] }. */
/** An edit's text as the later groups rewrote it: their edits applied in order where their anchor sits inside it, the pure
 *  insertions left out (an edit that keeps its anchor and adds before or after it leaves the earlier text whole, and
 *  chaining them would ask for every later group's text to be there too). */
function revisedText(group, edit) {
  const at = GROUPS.findIndex((g) => g.key === group.key);
  if (at < 0) return edit.new;
  const rewrites = GROUPS.slice(at + 1).flatMap((g) => g.edits).filter((l) => !l.new.startsWith(l.old) && !l.new.endsWith(l.old));
  return rewrites.reduce((t, l) => (t.includes(l.old) ? t.replace(l.old, l.new) : t), edit.new);
}

export function applyGroup(src, group) {
  const hasConstants = !group.constants || src.includes('const VENUE_SPLIT_WEIGHT = ');
  // An edit a later group revised (group 13 rewrote part of group 8's matchupIcf) still counts as ported.
  const present = group.edits.filter((e) => src.includes(e.new) || src.includes(revisedText(group, e)));
  if (hasConstants && present.length === group.edits.length) return { text: src, status: 'ported', missing: [] };
  const missing = [];
  if (present.length) missing.push(`already partly there (${present.map((e) => e.name).join(', ')}): port the rest by hand from components/nhl/model-core.js`);
  let out = src;
  if (group.constants && !src.includes('const VENUE_SPLIT_WEIGHT = ')) {
    const at = afterPoissonAtLeast(out);
    if (at < 0) missing.push('the weights and venueMix: no `function poissonAtLeast(` to put them after');
    else out = out.slice(0, at) + CONSTANTS_BLOCK + out.slice(at);
  }
  for (const e of group.edits) {
    const n = out.split(e.old).length - 1;
    if (n !== 1) { missing.push(`${e.name}: the anchor was found ${n} times, expected once:\n${e.old}`); continue; }
    out = out.replace(e.old, e.new);
  }
  return missing.length ? { text: src, status: 'missing', missing } : { text: out, status: 'applied', missing: [] };
}

/** Every group in order: { text, results: [{ key, label, status, missing }] }; a missing group leaves the text as it was. */
export function portText(src, groups = GROUPS) {
  let text = src; const results = [];
  for (const g of groups) {
    const r = applyGroup(text, g);
    text = r.text; results.push({ key: g.key, label: g.label, status: r.status, missing: r.missing });
  }
  return { text, results };
}

// Compare real paths: on macOS /tmp is a link to /private/tmp, and a plain comparison read the script as
// imported and did nothing, silently (2026-11-12).
const realOf = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const isMain = !!process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--')) || path.join(os.homedir(), 'Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx');
  if (!fs.existsSync(file)) { console.error(`No file at ${file}`); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  const { text, results } = portText(src);
  for (const r of results) {
    console.log(`${r.status === 'ported' ? 'already ported' : r.status === 'applied' ? (check ? 'would apply   ' : 'applied       ') : 'MISSING       '}  ${r.label}`);
    for (const m of r.missing) console.log(`                  ${m.split('\n').join('\n                  ')}`);
  }
  const applied = results.filter((r) => r.status === 'applied').length;
  const missing = results.filter((r) => r.status === 'missing').length;
  if (!applied) { console.log(missing ? '\nNothing written: the groups above are missing an anchor. Send the file and the lines above.' : '\nNothing to do.'); process.exit(missing ? 1 : 0); }
  if (check) { console.log('\n--check: nothing written.'); process.exit(0); }
  const bak = `${file}.bak-${new Date().toISOString().slice(0, 10)}`;
  fs.copyFileSync(file, bak);
  fs.writeFileSync(file, text);
  console.log(`\nWritten. Backup at ${bak}${missing ? '\nA group is missing an anchor (above): send the file and the lines.' : ''}`);
  process.exit(missing ? 1 : 0);
}
