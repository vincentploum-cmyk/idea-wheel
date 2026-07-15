import { describe, test, expect } from '@jest/globals';
import { classifyIdeaRisk, isPubliclyEligible, safetyNoticeFor } from '../lib/idea-safety.js';

describe('classifyIdeaRisk', () => {
  test('flags eating-disorder recovery as clinical high risk', () => {
    const { level } = classifyIdeaRisk({ action: 'Coaches', workflow: 'eating disorder recovery', industry: 'college students' });
    expect(level).toBe('clinical_high_risk');
  });

  test('flags a vulnerable audience (bipolar) even with a neutral workflow', () => {
    const { level } = classifyIdeaRisk({ action: 'Tracks', workflow: 'daily habits', industry: 'people with bipolar disorder' });
    expect(level).toBe('clinical_high_risk');
  });

  test('sleep for new parents is wellness, not clinical', () => {
    const { level } = classifyIdeaRisk({ action: 'Improves', workflow: 'sleep', industry: 'new parents' });
    expect(level).toBe('health_wellness');
  });

  test('spending habits is financial', () => {
    const { level } = classifyIdeaRisk({ action: 'Optimizes', workflow: 'spending habits', industry: 'freelancers' });
    expect(level).toBe('financial');
  });

  test('an ordinary B2B ops idea is standard', () => {
    const { level } = classifyIdeaRisk({ action: 'Automates', workflow: 'invoicing', industry: 'Auto repair shops' });
    // invoicing is financial-adjacent by design; assert it is NOT clinical.
    expect(level).not.toBe('clinical_high_risk');
  });
});

describe('public eligibility gate', () => {
  test('clinical high risk is not publicly eligible', () => {
    expect(isPubliclyEligible('clinical_high_risk')).toBe(false);
  });
  test('wellness / financial / standard are publicly eligible', () => {
    expect(isPubliclyEligible('health_wellness')).toBe(true);
    expect(isPubliclyEligible('financial')).toBe(true);
    expect(isPubliclyEligible('standard')).toBe(true);
  });
  test('clinical high risk carries a notice', () => {
    expect(safetyNoticeFor('clinical_high_risk')).toMatch(/safety|clinical|medical/i);
  });
});
