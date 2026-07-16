/**
 * Lightweight heuristics for public forms when Turnstile is not configured.
 * These will catch script-kiddie bots but not a determined attacker; combine
 * with rate limiting and Turnstile for real protection.
 */

// Honeypot: the form has a hidden field named `website`. Real users can't fill
// it (it's `display:none` + `tabindex=-1` + `autocomplete=off`). Bots naively
// fill every field.
export function honeypotTripped(body) {
  const website = typeof body?.website === 'string' ? body.website.trim() : '';
  return website.length > 0;
}

// Timing check: the form emits a `formLoadedAt` timestamp on render, sent back
// on submit. Real humans take > 2 seconds to fill even a short form; bots
// submit in <500 ms.
export function submittedTooFast(body, minMs = 1500) {
  const loaded = Number(body?.formLoadedAt);
  if (!Number.isFinite(loaded)) return false; // absent = accept; older forms don't send it
  const now = Date.now();
  return now - loaded < minMs;
}

// Content signals: obvious spam URL patterns
const SPAM_PATTERNS = [
  /https?:\/\/(?:bit\.ly|t\.co|goo\.gl|tinyurl\.com|is\.gd)/i,
  /\b(?:viagra|casino|crypto giveaway|bitcoin mining)\b/i,
];
export function looksLikeSpam(text) {
  if (!text) return false;
  return SPAM_PATTERNS.some((rx) => rx.test(text));
}
