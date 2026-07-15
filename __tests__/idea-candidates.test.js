import { describe, test, expect } from '@jest/globals';
import { canonicalComboKey, eligibilityFor } from '../lib/idea-candidates.js';

describe('canonicalComboKey — action folded into copy', () => {
  test('same workflow+industry collapses regardless of action', () => {
    const a = canonicalComboKey('b2b', 'client onboarding', 'Dental practices');
    const b = canonicalComboKey('B2B', 'Client Onboarding', 'dental practices');
    expect(a).toBe(b);
  });

  test('different industry is a different candidate', () => {
    expect(canonicalComboKey('b2b', 'client onboarding', 'Dental practices'))
      .not.toBe(canonicalComboKey('b2b', 'client onboarding', 'Law firms'));
  });

  test('mode is part of the key', () => {
    expect(canonicalComboKey('consumer', 'sleep', 'new parents'))
      .not.toBe(canonicalComboKey('b2b', 'sleep', 'new parents'));
    expect(canonicalComboKey('consumer', 'sleep', 'new parents').startsWith('consumer:')).toBe(true);
  });
});

describe('eligibilityFor — score + safety', () => {
  test('60 is eligible, 59 is rejected', () => {
    expect(eligibilityFor(60, 'standard')).toBe('eligible');
    expect(eligibilityFor(59, 'standard')).toBe('rejected');
  });

  test('75+ is catalog tier', () => {
    expect(eligibilityFor(75, 'standard')).toBe('catalog');
    expect(eligibilityFor(88, 'financial')).toBe('catalog');
  });

  test('clinical high risk never auto-qualifies, even at 90', () => {
    expect(eligibilityFor(90, 'clinical_high_risk')).toBe('manual_review');
    expect(eligibilityFor(65, 'clinical_high_risk')).toBe('manual_review');
  });

  test('null / NaN score is rejected', () => {
    expect(eligibilityFor(null, 'standard')).toBe('rejected');
    expect(eligibilityFor(NaN, 'standard')).toBe('rejected');
  });
});
