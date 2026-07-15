import { describe, test, expect } from '@jest/globals';
import { computeDeterministicScore, legacyDimensions, RUBRIC, RUBRIC_VERSION } from '../lib/scoring.js';

const FULL = {
  evidenceStrength: 20, painFrequency: 15, willingnessToPay: 15, marketSpecificity: 10,
  competitiveOpening: 15, customerReachability: 10, retention: 10, feasibility: 5,
};

describe('computeDeterministicScore', () => {
  test('is deterministic — same input, same output', () => {
    const a = computeDeterministicScore(FULL, {});
    const b = computeDeterministicScore(FULL, {});
    expect(a.overall).toBe(b.overall);
  });

  test('all components maxed sums to 100', () => {
    expect(computeDeterministicScore(FULL, {}).overall).toBe(100);
  });

  test('components sum, and over-max values are clamped', () => {
    const r = computeDeterministicScore({ evidenceStrength: 999, painFrequency: 10 }, {});
    // evidenceStrength clamps to 20, painFrequency 10, rest 0 => 30
    expect(r.overall).toBe(30);
    expect(r.breakdown.evidenceStrength.value).toBe(20);
  });

  test('a hard gate caps the score at 35 even with strong components', () => {
    const r = computeDeterministicScore(FULL, { noIdentifiableBuyer: true });
    expect(r.overall).toBeLessThanOrEqual(35);
    expect(r.gated).toBe(true);
    expect(r.gatesTriggered).toContain('noIdentifiableBuyer');
  });

  test('no gate => not gated', () => {
    expect(computeDeterministicScore(FULL, {}).gated).toBe(false);
  });

  test('NaN / missing components contribute 0', () => {
    const r = computeDeterministicScore({ evidenceStrength: 'x', painFrequency: null }, {});
    expect(r.overall).toBe(0);
  });

  test('rubric weights sum to 100', () => {
    expect(Object.values(RUBRIC).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('stamps the rubric version', () => {
    expect(computeDeterministicScore(FULL, {}).rubricVersion).toBe(RUBRIC_VERSION);
  });
});

describe('legacyDimensions mapping', () => {
  test('maxed components map to 100-scale dimensions', () => {
    const { breakdown } = computeDeterministicScore(FULL, {});
    const dims = legacyDimensions(breakdown);
    expect(dims.evidenceCoverage).toBe(100);
    expect(dims.specificity).toBe(100);
    expect(dims.wedgeClarity).toBe(100);
    expect(dims.defensibility).toBe(100);
  });
});
