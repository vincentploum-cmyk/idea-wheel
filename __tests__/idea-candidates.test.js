import { describe, test, expect } from '@jest/globals';
import { canonicalComboKey, eligibilityFor, getCandidateEligibility } from '../lib/idea-candidates.js';

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

// Auditor #2/#3: getCandidateEligibility must never treat found:true alone as
// qualification — it must enforce score, current version, eligibility_status,
// safety level, canonical combo_key, mode collision. Signature must accept the
// object shape the build route now uses.
describe('getCandidateEligibility — object args + full policy (auditor #2)', () => {
  test('accepts the object-arg shape without throwing', async () => {
    const r = await getCandidateEligibility({ mode: 'b2b', workflow: 'x', industry: 'y' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('candidate_lookup_unavailable');
  });

  test('accepts the legacy positional shape (backwards compat)', async () => {
    const r = await getCandidateEligibility('b2b', 'x', 'y', {});
    expect(r.eligible).toBe(false);
  });

  test('never returns eligible without a workflow or industry', async () => {
    const r = await getCandidateEligibility({ mode: 'b2b' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/lookup_unavailable|not_found/);
  });
});

// canonicalComboKey stays consistent under casing/whitespace/mode collisions,
// so the fallback lookup can't be tricked by raw-label variants. (auditor #3)
describe('canonicalComboKey — normalization', () => {
  test('same triple, different mode → different key', () => {
    expect(canonicalComboKey('b2b', 'x', 'y')).not.toBe(canonicalComboKey('consumer', 'x', 'y'));
  });
  test('trailing whitespace / caps do not create a new key', () => {
    expect(canonicalComboKey('b2b', '  X  ', 'Y ')).toBe(canonicalComboKey('B2B', 'x', 'y'));
  });
});
