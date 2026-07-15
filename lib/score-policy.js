// lib/score-policy.js
// Single source of truth for every score threshold in the product. Before this
// existed the same "does this idea clear the bar?" question was answered with a
// different magic number in each file (61 in the validation UI and profile, 75
// on the public catalog, 80 for premium). That drift is exactly what the audit
// flagged: an idea scoring 60 was called "no potential" even though 60 is the
// stated visibility bar. Import from here instead of hard-coding a number.
//
// Naming is deliberate — these are DIFFERENT questions, not one threshold reused:
//   visibleMin  — the idea has enough of an opening to show the founder the
//                 opportunity view (gap, key players, blueprint-forward CTA).
//   catalogMin  — stricter bar for the curated public /ideas library.
//   premiumMin  — the "get the blueprint now" tier.

export const SCORE_POLICY = Object.freeze({
  visibleMin: 60,
  // The blueprint gate is the SAME bar as visibility: an idea that qualifies to
  // be shown as "has potential" is exactly the one allowed to buy a blueprint.
  // Named separately so the intent reads clearly at every call site.
  blueprintMin: 60,
  catalogMin: 75,
  premiumMin: 80,
  // Bumped to v2.0 when scoring moved to the deterministic rubric (lib/scoring.js).
  // Kept in lockstep with RUBRIC_VERSION so candidates/caches scored under the old
  // method fall out of the pool until re-scored.
  version: 'v2.0',
});

function numericScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when the idea clears the visibility bar (>= 60). null/NaN never pass. */
export function hasPotential(score) {
  const n = numericScore(score);
  return n !== null && n >= SCORE_POLICY.visibleMin;
}

/** True for the curated public catalog (>= 75). */
export function meetsCatalog(score) {
  const n = numericScore(score);
  return n !== null && n >= SCORE_POLICY.catalogMin;
}

/** True for the premium blueprint-now tier (>= 80). */
export function isPremium(score) {
  const n = numericScore(score);
  return n !== null && n >= SCORE_POLICY.premiumMin;
}

/**
 * True when an idea may receive a blueprint (>= 60). null/NaN fail closed.
 * This is the single predicate the client CTA and the server build gate share,
 * so they can never disagree about who is allowed a blueprint.
 */
export function isBlueprintEligible(score) {
  const n = numericScore(score);
  return n !== null && n >= SCORE_POLICY.blueprintMin;
}
