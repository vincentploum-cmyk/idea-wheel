// lib/scoring.js
// Deterministic viability scoring. The audit's point: the eval model used to
// return an "overall" score directly, so 59-vs-60 hung on a model's arithmetic
// mood. Now the model only EXTRACTS evidence into fixed-weight components; the
// overall is computed here in code, and hard gates (that a score can't buy its
// way past) are applied separately. Same inputs -> same score, every time.

export const RUBRIC_VERSION = 'v2.0';

// Component -> max points. Sums to 100.
export const RUBRIC = Object.freeze({
  evidenceStrength: 20,     // how real/verifiable the demand evidence is
  painFrequency: 15,        // how often & how badly the pain bites
  willingnessToPay: 15,     // evidence anyone will actually pay
  marketSpecificity: 10,    // a named, reachable buyer/user (not "everyone")
  competitiveOpening: 15,   // a genuine gap vs the incumbents
  customerReachability: 10, // can you actually get in front of them
  retention: 10,            // repeat use / staying power
  feasibility: 5,           // build + regulatory feasibility
});

// Gates operate SEPARATELY from the score. If any fires, the idea cannot present
// as viable no matter how the components add up.
export const RUBRIC_GATES = Object.freeze([
  'insufficientEvidence',
  'noIdentifiableBuyer',
  'illegalOrExploitative',
  'fabricatedOrContradictory',
]);

const GATE_CAP = 35;

function clampComponent(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/**
 * Compute the deterministic overall from the model's extracted components.
 * Returns the overall (0-100), the per-component breakdown, and which gates
 * (if any) fired. A gated idea is capped at GATE_CAP.
 */
export function computeDeterministicScore(components = {}, gates = {}) {
  const breakdown = {};
  let sum = 0;
  for (const [key, max] of Object.entries(RUBRIC)) {
    const value = clampComponent(components[key], max);
    breakdown[key] = { value, max };
    sum += value;
  }
  const gatesTriggered = RUBRIC_GATES.filter((g) => gates?.[g] === true);
  const gated = gatesTriggered.length > 0;
  const overall = gated ? Math.min(sum, GATE_CAP) : Math.max(0, Math.min(100, sum));
  return { overall, breakdown, gatesTriggered, gated, rawSum: sum, rubricVersion: RUBRIC_VERSION };
}

/**
 * Map the rubric components onto the legacy 0-100 dimension keys the adaptive
 * generator still reads (evidenceCoverage/specificity/wedgeClarity/defensibility),
 * so no retraining or data migration is needed.
 */
export function legacyDimensions(breakdown = {}) {
  const pct = (k) => (breakdown[k] ? Math.round((breakdown[k].value / breakdown[k].max) * 100) : 0);
  return {
    evidenceCoverage: pct('evidenceStrength'),
    specificity: pct('marketSpecificity'),
    wedgeClarity: pct('competitiveOpening'),
    defensibility: Math.round((pct('competitiveOpening') + pct('retention')) / 2),
  };
}
