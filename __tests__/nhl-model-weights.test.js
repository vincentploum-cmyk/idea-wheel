import { describe, expect, test } from '@jest/globals';
import { VENUE_SPLIT_WEIGHT, H2H_WEIGHT, venueMix, buildGoalProbabilityFromPipeline } from '../components/nhl/model-core';

describe('the venue split and the head-to-head at a quarter of their weight (Vincent’s call, 2026-10-27)', () => {
  test('the weights', () => {
    expect(VENUE_SPLIT_WEIGHT).toBe(0.25);
    expect(H2H_WEIGHT).toBe(0.25);
  });
  test('a skater’s goal base: a quarter the split, three quarters his season rate; his season rate alone without a split', () => {
    expect(venueMix(0.8, 0.4)).toBeCloseTo(0.25 * 0.8 + 0.75 * 0.4, 6);
    expect(venueMix(0, 0.4)).toBeCloseTo(0.3, 6);
    expect(venueMix(null, 0.4)).toBe(0.4);
    expect(venueMix(undefined, 0.4)).toBe(0.4);
  });
  test('the goal ladder: the history and venue multipliers move it a quarter as far as before', () => {
    const base = { posKey: 'C', todayLine: 1, scorerTier: { score: 1, tier: 'good' }, p1p: 0.6, p2p: 0.2, baseLambdaG: 0.4, expectedGoalsBudget: 0.3, playerGoalShare: 0.2,
      goalShareOfPoints: 0.5, dangerRate: 0.4, convBlend: 0.65, effectiveToi: 19, goalsSeason: 0.4, goalsL5: 0.4, shotsSeason: 3, roleGoalAdj: 1, venueGoalMult: 1, teamRoleGoalAdj: 1,
      defenseGoalMult: 1, roleGoalMult: 1, histGoalMult1: 1, histGoalMult2: 1, broadGoalEnv: false, distributedGoalEnv: false, goalRankTeam: 1, goalRankPos: 1 };
    const flat = buildGoalProbabilityFromPipeline(base);
    const hist = buildGoalProbabilityFromPipeline({ ...base, histGoalMult1: 1.25, histGoalMult2: 1.25 });
    const venue = buildGoalProbabilityFromPipeline({ ...base, venueGoalMult: 1.05 });
    expect(hist.opportunityLambda / flat.opportunityLambda).toBeCloseTo(1 + 0.25 * 0.22 * H2H_WEIGHT, 3);      // was 1 + 0.25 × 0.22
    expect(venue.opportunityLambda / flat.opportunityLambda).toBeCloseTo(1 + 0.05 * 0.18 * VENUE_SPLIT_WEIGHT, 3);   // was 1 + 0.05 × 0.18
  });
});
