// Coerce a blueprint stage back onto the shape the UI renders.
//
// WHY THIS EXISTS
// Every blueprint stage is raw model JSON. The prompts ask for strings and
// string arrays, but a drifting model returns objects instead — coreFeatures as
// [{name, description}] rather than ["…"], pricing.price as {amount, currency},
// setupSteps as [{step}]. Nothing between the model and the screen checked that,
// so the object reached JSX, React threw "Objects are not valid as a React
// child", and with no route-level error boundary the throw escaped all the way
// to app/global-error.js. The user saw "Something broke." — after paying two
// credits — and the whole app was replaced by the fallback screen.
//
// Reproduced against a production build: 10 of 12 plausible drift shapes took
// the page down that way. Pipeline failures never did; they already surface as
// an inline, resumable error. Drift was the only path to the fallback screen.
//
// These helpers are pure and run on BOTH sides on purpose:
//   • the build route normalizes before persisting, so a drifted blueprint is
//     never written to a saved idea in the first place;
//   • the client normalizes on receive and on load, so the blueprints already
//     stored with a drifted shape stop crashing too.
//
// Values that already match the schema pass through unchanged (strings are only
// trimmed), so a healthy blueprint is identical before and after.

const MAX_DEPTH = 4;

// When a model wraps a sentence in an object, one of these keys usually holds it.
const PRIMARY_KEYS = [
  'text', 'value', 'step', 'action', 'claim', 'tactic', 'feature',
  'title', 'name', 'label', 'summary', 'description', 'detail',
  'point', 'item', 'content',
];

// Plumbing, never prose — leaving these out keeps the rendered sentence readable.
const SKIP_KEYS = new Set(['id', 'key', 'index', 'order', 'type', 'icon']);

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Render any model-supplied value as a single readable string.
 * A string comes back trimmed; an object becomes "head (the, other, values)".
 */
export function plainText(value, depth = 0) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value !== 'object') return '';
  if (depth >= MAX_DEPTH) return '';

  if (Array.isArray(value)) {
    return value.map((item) => plainText(item, depth + 1)).filter(Boolean).join(', ');
  }

  const entries = Object.entries(value).filter(([key, val]) => (
    !SKIP_KEYS.has(key.toLowerCase()) && val !== null && val !== undefined && val !== ''
  ));
  if (entries.length === 0) return '';

  const primary = entries.findIndex(([key]) => PRIMARY_KEYS.includes(key.toLowerCase()));
  const headIndex = primary === -1 ? 0 : primary;
  const head = plainText(entries[headIndex][1], depth + 1);
  const rest = entries
    .filter((_, i) => i !== headIndex)
    .map(([, val]) => plainText(val, depth + 1))
    .filter(Boolean)
    .join(', ');

  if (!head) return rest;
  return rest ? `${head} (${rest})` : head;
}

/**
 * Render any model-supplied value as a list of strings. Accepts an array, a
 * keyed object ({step1: "…", step2: "…"}), or a lone value.
 */
export function textList(value) {
  if (value === null || value === undefined || value === '') return [];
  const items = Array.isArray(value)
    ? value
    : (isRecord(value) ? Object.values(value) : [value]);
  return items.map((item) => plainText(item)).filter(Boolean);
}

/**
 * Force a value the UI calls `.map()` on into an array. `(x || []).map(...)`
 * does NOT protect against this: an object or a string is truthy, so the
 * fallback never fires and `.map is not a function` throws instead.
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (isRecord(value)) return Object.values(value);
  return [value];
}

/** Copy `source`, replacing the named keys with their text / list form. */
function coerce(source, { text = [], list = [] }) {
  const out = { ...source };
  for (const key of text) {
    if (key in out) out[key] = plainText(out[key]);
  }
  for (const key of list) {
    if (key in out) out[key] = textList(out[key]);
  }
  return out;
}

/**
 * Every value of a record becomes text. Arrays are covered too — the UI walks
 * these with Object.entries(), which happily accepts one and then hands the
 * element straight to JSX.
 */
function coerceRecordValues(value) {
  if (!isRecord(value) && !Array.isArray(value)) return value;
  const out = Array.isArray(value) ? [] : {};
  for (const [key, val] of Object.entries(value)) out[key] = plainText(val);
  return out;
}

const DESIGN_TEXT = [
  'name', 'tagline', 'niche', 'differentiator', 'productLogic', 'userFlow',
  'buildSpec', 'landingAngle', 'dataMoat', 'defensibilityPlan', 'wowMoment',
  'plainSummary',
];
const DESIGN_LIST = ['problemEvidence', 'coreFeatures', 'takeaways'];

/** Normalize the designer stage. */
export function normalizeDesign(design) {
  if (!isRecord(design)) return design;
  const out = coerce(design, { text: DESIGN_TEXT, list: DESIGN_LIST });
  if ('evidenceVerified' in out) {
    // The PDF matches these back to problemEvidence by exact string, so the
    // claim has to be coerced the same way its evidence item was.
    out.evidenceVerified = toArray(out.evidenceVerified).filter(isRecord).map((entry) => ({
      ...entry,
      claim: plainText(entry.claim),
      sourceUrl: plainText(entry.sourceUrl),
    }));
  }
  return out;
}

const GTM_TEXT = ['revenueGoal', 'persona', 'whereToFind', 'whyNow', 'buildTime', 'cursorPrompt', 'plainSummary'];
const GTM_LIST = ['firstFiveCustomers', 'takeaways', 'stack', 'communities'];

/** Normalize the launch / go-to-market stage. */
export function normalizeGtm(gtm) {
  if (!isRecord(gtm)) return gtm;
  const out = coerce(gtm, { text: GTM_TEXT, list: GTM_LIST });
  out.icp = coerceRecordValues(out.icp);
  out.pricing = coerceRecordValues(out.pricing);
  if ('channels' in out) {
    out.channels = toArray(out.channels).map((channel) => (isRecord(channel)
      ? coerce(channel, { text: ['name', 'tactic', 'timeline'] })
      : { name: plainText(channel), tactic: '', timeline: '' }));
  }
  if ('plan' in out) {
    out.plan = toArray(out.plan).filter(isRecord).map((week) => ({
      ...week,
      week: typeof week.week === 'number' ? week.week : plainText(week.week),
      theme: plainText(week.theme),
      actions: textList(week.actions),
    }));
  }
  return out;
}

// buildTime / cursorPrompt belong to the launch stage in the paid pipeline, but
// the seeded catalog entries carry them on infra — cover both.
const INFRA_TEXT = ['schema', 'aiWiring', 'memoryLoop', 'buildOrder', 'plainSummary', 'buildTime', 'cursorPrompt'];
const INFRA_LIST = ['envVars', 'deploySteps', 'entities', 'takeaways', 'stack'];

/**
 * Normalize the infrastructure stage. `costItems`, `usageAssumptions` and
 * `costModel` are deliberately untouched: they hold the numbers the cost total
 * is computed from, and every render path already stringifies them.
 */
export function normalizeInfra(infra) {
  if (!isRecord(infra)) return infra;
  const out = coerce(infra, { text: INFRA_TEXT, list: INFRA_LIST });
  if ('services' in out) {
    out.services = toArray(out.services).map((service) => {
      if (!isRecord(service)) return { name: plainText(service), setupSteps: [] };
      return coerce(service, {
        text: ['name', 'purpose', 'url', 'docsUrl', 'freeTier', 'setupTime'],
        list: ['setupSteps'],
      });
    });
  }
  out.monthlyCost = coerceRecordValues(out.monthlyCost);
  return out;
}

/** Normalize a whole stored blueprint (saved idea, catalog entry, resume). */
export function normalizeBlueprint(blueprint) {
  if (!isRecord(blueprint)) return blueprint;
  return {
    ...blueprint,
    design: normalizeDesign(blueprint.design),
    gtm: normalizeGtm(blueprint.gtm),
    infra: normalizeInfra(blueprint.infra),
    prototypeHtml: typeof blueprint.prototypeHtml === 'string' ? blueprint.prototypeHtml : '',
  };
}
