// lib/idea-safety.js
// A safety classification that runs ALONGSIDE (never replaced by) the viability
// score. The audit's point: the consumer banks can produce apps aimed at
// clinically vulnerable people — eating-disorder recovery, bipolar disorder, OCD,
// addiction/sobriety, medication adherence. Such an idea can be commercially
// plausible (score 60+) while still being medically risky. A high score must not
// suppress that concern, so risk is tracked on a different axis.
//
// Levels, least to most sensitive:
//   standard            — ordinary productivity/business niche.
//   financial           — money advice-adjacent (needs a "not financial advice" nudge).
//   health_wellness     — general wellness (sleep, fitness, nutrition); low risk.
//   clinical_high_risk  — targets a clinical condition or vulnerable population;
//                         gets a safety notice, is kept OUT of the curated public
//                         catalog and the trust queue, and is flagged for review.

const CLINICAL_TERMS = [
  'mental health', 'medication adherence', 'sobriety', 'eating disorder',
  'addiction recovery', 'bipolar', 'ocd', 'schizophren', 'ptsd', 'self-harm',
  'suicid', 'autis', 'chronic illness', 'long covid', 'perimenopause',
  'therapy', 'therapist', 'clinical', 'psychiatr', 'disorder', 'recovery',
];

const WELLNESS_TERMS = [
  'sleep', 'fitness', 'nutrition', 'meal planning', 'stress', 'workout',
  'recovery', 'energy pacing', 'wellbeing', 'wellness', 'caregiver',
  'medication', 'health',
];

const FINANCIAL_TERMS = [
  'personal finances', 'spending habits', 'financial independence',
  'wealth', 'side hustle', 'invoicing', 'billing', 'payroll',
  'accounts receivable', 'money', 'budget',
];

function haystack(...parts) {
  return parts.map((p) => String(p || '').toLowerCase()).join(' ');
}

function matches(text, terms) {
  return terms.filter((term) => text.includes(term));
}

/**
 * Classify an idea's risk from its parts (or a freeform string).
 * Returns { level, reasons } where reasons name the matched terms.
 */
export function classifyIdeaRisk({ action, workflow, industry, freeformIdea, modeName } = {}) {
  const text = haystack(action, workflow, industry, freeformIdea);

  const clinicalHits = matches(text, CLINICAL_TERMS);
  if (clinicalHits.length) {
    return { level: 'clinical_high_risk', reasons: clinicalHits };
  }
  const wellnessHits = matches(text, WELLNESS_TERMS);
  if (wellnessHits.length) {
    return { level: 'health_wellness', reasons: wellnessHits };
  }
  const financialHits = matches(text, FINANCIAL_TERMS);
  if (financialHits.length) {
    return { level: 'financial', reasons: financialHits };
  }
  return { level: 'standard', reasons: [] };
}

export function isHighRisk(level) {
  return level === 'clinical_high_risk';
}

/** Ideas that must not appear on public/curated surfaces without human review. */
export function isPubliclyEligible(level) {
  return level !== 'clinical_high_risk';
}

/** Founder-facing notice shown on the validation result and blueprint. */
export const SAFETY_NOTICES = Object.freeze({
  clinical_high_risk:
    'This idea targets a health-sensitive or clinically vulnerable group. A viability score can’t judge medical safety. Before building, check regulatory scope (HIPAA, FDA/medical-device rules), add crisis-safety flows, and get qualified clinical input — a high market score does not clear these.',
  financial:
    'This idea touches money decisions. It is not financial advice — plan for the rules that apply to financial tools in your market.',
});

export function safetyNoticeFor(level) {
  return SAFETY_NOTICES[level] || '';
}
