/**
 * Strict rubric for auditing generated blueprints (Gate 1 in the launch audit).
 *
 * A blueprint passes when EVERY hard check passes AND the soft-score is >= 0.75.
 * Runs deterministically over the JSON payload; no LLM required for the
 * mechanical checks. An optional LLM pass in scripts/blueprint-audit.mjs
 * catches the "reads like a hallucination" failures the mechanical checks can't.
 */

const REQUIRED_TOP_LEVEL = ['comp', 'design', 'gtm', 'infra'];

// Words that ChatGPT's audits repeatedly flagged as overclaiming — banned in prose.
const OVERCLAIMING_WORDS = [
  'proprietary',
  'guaranteed',
  'guarantee',
  'high precision',
  'revolutionize',
  'exceptionally difficult to imitate',
];

// Providers we require the runbook to reference by name — proxies for "did the
// model actually produce concrete infra?"
const KNOWN_PROVIDERS = ['stripe', 'supabase', 'twilio', 'sendgrid', 'resend', 'render', 'cloudflare', 'auth0', 'sentry', 'r2', 's3'];

export function auditBlueprint(payload) {
  const hard = {};
  const soft = {};
  const notes = [];

  // ── HARD (must-pass) ─────────────────────────────────────────────────────

  // 1. All four top-level sections present
  for (const k of REQUIRED_TOP_LEVEL) {
    hard[`has_${k}`] = !!payload?.[k] && typeof payload[k] === 'object';
    if (!hard[`has_${k}`]) notes.push(`missing top-level section: ${k}`);
  }

  // 2. Score present and >= 60 (the gate)
  const scoreNum = Number(payload?.comp?.score);
  hard.score_ge_60 = Number.isFinite(scoreNum) && scoreNum >= 60;
  if (!hard.score_ge_60) notes.push(`comp.score not >= 60 (got ${payload?.comp?.score})`);

  // 3. Score version present and matches expected
  hard.score_version_current = payload?.comp?.scoreVersion === 'v2.0';
  if (!hard.score_version_current) notes.push(`scoreVersion should be v2.0, got ${payload?.comp?.scoreVersion}`);

  // 4. Deterministic breakdown present and sums to score (± 1 for rounding)
  const breakdown = payload?.comp?.scoreBreakdown;
  if (breakdown && typeof breakdown === 'object') {
    const sum = Object.values(breakdown).reduce((a, v) => a + (Number(v) || 0), 0);
    hard.breakdown_sums_to_score = Math.abs(sum - scoreNum) <= 1;
    if (!hard.breakdown_sums_to_score) notes.push(`scoreBreakdown sums to ${sum}, score is ${scoreNum}`);
  } else {
    hard.breakdown_sums_to_score = false;
    notes.push('scoreBreakdown missing or malformed');
  }

  // 5. No banned overclaiming words in the full JSON
  const flatText = JSON.stringify(payload).toLowerCase();
  const overclaims = OVERCLAIMING_WORDS.filter((w) => flatText.includes(w));
  hard.no_overclaiming = overclaims.length === 0;
  if (!hard.no_overclaiming) notes.push(`overclaiming words found: ${overclaims.join(', ')}`);

  // 6. Infrastructure names at least 2 real providers by name
  const infraText = JSON.stringify(payload?.infra || '').toLowerCase();
  const providersHit = KNOWN_PROVIDERS.filter((p) => infraText.includes(p));
  hard.infra_names_real_providers = providersHit.length >= 2;
  if (!hard.infra_names_real_providers) notes.push(`infra names < 2 real providers (${providersHit.join(', ') || 'none'})`);

  // 7. Competitor matrix has at least 3 entries and each has both a "serves" and a "misses"
  const competitors = payload?.comp?.players || payload?.comp?.competitorMatrix || [];
  hard.competitors_present = Array.isArray(competitors) && competitors.length >= 3;
  if (!hard.competitors_present) notes.push(`< 3 competitors listed (got ${competitors.length})`);
  hard.competitors_have_gaps = Array.isArray(competitors)
    && competitors.slice(0, 5).every((c) => (c?.weakness || c?.misses || c?.coverage));
  if (hard.competitors_present && !hard.competitors_have_gaps) notes.push('some competitors lack weakness/gap field');

  // 8. GTM has an ICP object with a real trigger + a real disqualifier
  const icp = payload?.gtm?.icp;
  hard.icp_specific = !!(icp?.trigger && icp?.disqualifier);
  if (!hard.icp_specific) notes.push('gtm.icp missing trigger or disqualifier');

  // 9. Cost model has a payment processing line when the product charges money
  const costItems = payload?.infra?.costItems || [];
  const hasPaymentLine = costItems.some((c) => /stripe|payment|processing/i.test(c?.service || ''));
  const hasPrice = /\$/.test(payload?.gtm?.pricing?.price || '');
  hard.cost_has_payment_line = !hasPrice || hasPaymentLine;
  if (!hard.cost_has_payment_line) notes.push('product has a price but no payment-processing cost line');

  // 10. Cursor prompt present + non-trivial
  const cursorLen = (payload?.gtm?.cursorPrompt || payload?.design?.cursorPrompt || '').length;
  hard.cursor_prompt_present = cursorLen >= 200;
  if (!hard.cursor_prompt_present) notes.push(`cursor prompt too short (${cursorLen} chars, want >= 200)`);

  // ── SOFT (weighted score) ────────────────────────────────────────────────

  // Verified sources ratio
  const sources = payload?.comp?.sources || [];
  const verifiedCount = sources.filter((s) => s?.verified).length;
  soft.verified_sources_ratio = sources.length > 0 ? verifiedCount / sources.length : 0;

  // Deep-research signal richness
  const dr = payload?.comp?.deepResearch || {};
  soft.demand_signals_count = Math.min(1, ((dr.demandSignals || []).length) / 3);
  soft.voice_of_customer_count = Math.min(1, ((dr.voiceOfCustomer || []).length) / 2);

  // Infra depth
  const services = payload?.infra?.services || [];
  soft.infra_services_count = Math.min(1, services.length / 4);

  // Overall soft mean
  const softValues = Object.values(soft).filter((v) => Number.isFinite(v));
  const softMean = softValues.length ? softValues.reduce((a, b) => a + b, 0) / softValues.length : 0;

  const hardPass = Object.values(hard).every(Boolean);
  const pass = hardPass && softMean >= 0.75;

  return {
    pass,
    hardPass,
    softMean,
    hard,
    soft,
    notes,
    summary: pass
      ? 'PASS'
      : hardPass
        ? `SOFT FAIL — softMean ${softMean.toFixed(2)} < 0.75`
        : `HARD FAIL — ${notes.length} issue(s)`,
  };
}
