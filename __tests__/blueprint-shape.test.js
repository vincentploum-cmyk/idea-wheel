import { describe, test, expect } from '@jest/globals';
import {
  plainText,
  textList,
  normalizeDesign,
  normalizeGtm,
  normalizeInfra,
  normalizeBlueprint,
} from '../lib/blueprint-shape.js';

// Anything React would refuse to render as a child. This is the exact predicate
// the bug turned on: an object reaching JSX threw "Objects are not valid as a
// React child", which escaped to app/global-error.js as "Something broke.".
function assertRenderable(value, path = 'root') {
  if (value === null || value === undefined) return;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertRenderable(item, `${path}[${i}]`));
    return;
  }
  throw new Error(`${path} is a ${type} React cannot render: ${JSON.stringify(value)}`);
}

/** Every field the blueprint screen renders directly as a JSX child. */
function assertBlueprintRenderable({ design, gtm, infra }) {
  for (const key of ['name', 'tagline', 'niche', 'differentiator', 'productLogic',
    'landingAngle', 'plainSummary', 'problemEvidence', 'coreFeatures', 'takeaways']) {
    assertRenderable(design?.[key], `design.${key}`);
  }
  for (const key of ['revenueGoal', 'persona', 'whereToFind', 'whyNow', 'buildTime',
    'cursorPrompt', 'plainSummary', 'firstFiveCustomers', 'takeaways']) {
    assertRenderable(gtm?.[key], `gtm.${key}`);
  }
  for (const key of Object.keys(gtm?.icp || {})) assertRenderable(gtm.icp[key], `gtm.icp.${key}`);
  for (const key of Object.keys(gtm?.pricing || {})) assertRenderable(gtm.pricing[key], `gtm.pricing.${key}`);
  for (const key of ['schema', 'aiWiring', 'buildOrder', 'plainSummary', 'envVars',
    'deploySteps', 'takeaways']) {
    assertRenderable(infra?.[key], `infra.${key}`);
  }
  for (const [i, service] of (infra?.services || []).entries()) {
    for (const key of ['name', 'purpose', 'freeTier', 'setupTime', 'setupSteps']) {
      assertRenderable(service?.[key], `infra.services[${i}].${key}`);
    }
  }
  for (const key of Object.keys(infra?.monthlyCost || {})) {
    assertRenderable(infra.monthlyCost[key], `infra.monthlyCost.${key}`);
  }
}

describe('plainText', () => {
  test('leaves a schema-shaped string alone apart from trimming', () => {
    expect(plainText('  Turns invoices into entries. ')).toBe('Turns invoices into entries.');
  });

  test('renders numbers and booleans', () => {
    expect(plainText(300)).toBe('300');
    expect(plainText(0)).toBe('0');
    expect(plainText(true)).toBe('Yes');
  });

  test('nullish and empty values become an empty string', () => {
    expect(plainText(null)).toBe('');
    expect(plainText(undefined)).toBe('');
    expect(plainText({})).toBe('');
  });

  test('a single-key wrapper unwraps to its value', () => {
    expect(plainText({ step: 'Create an account' })).toBe('Create an account');
  });

  test('a {name, description} pair leads with the name', () => {
    expect(plainText({ name: 'Email inbox', description: 'Forward invoices in.' }))
      .toBe('Email inbox (Forward invoices in.)');
  });

  test('the sentence-bearing key leads even when it is not first', () => {
    expect(plainText({ source: 'estimate', claim: '400 invoices a month' }))
      .toBe('400 invoices a month (estimate)');
  });

  test('plumbing keys are dropped', () => {
    expect(plainText({ id: 'svc_1', text: 'Sign up' })).toBe('Sign up');
  });

  test('an array joins into one line', () => {
    expect(plainText(['alpha', 'beta'])).toBe('alpha, beta');
  });

  test('deep nesting terminates instead of recursing forever', () => {
    const cyclic = { text: 'top' };
    cyclic.child = cyclic;
    expect(() => plainText(cyclic)).not.toThrow();
  });
});

describe('textList', () => {
  test('a list of strings is unchanged', () => {
    expect(textList(['one', 'two'])).toEqual(['one', 'two']);
  });

  test('a list of objects becomes a list of strings', () => {
    expect(textList([{ step: 'Push to GitHub' }, { step: 'Create the service' }]))
      .toEqual(['Push to GitHub', 'Create the service']);
  });

  test('a keyed object becomes its values', () => {
    expect(textList({ step1: 'First', step2: 'Second' })).toEqual(['First', 'Second']);
  });

  test('a lone string becomes a one-item list', () => {
    expect(textList('Only step')).toEqual(['Only step']);
  });

  test('missing and empty values become an empty list', () => {
    expect(textList(undefined)).toEqual([]);
    expect(textList([null, '', '  '])).toEqual([]);
  });
});

describe('a schema-shaped blueprint is passed through unchanged', () => {
  const design = {
    name: 'Invoice Autopilot',
    niche: 'US law firms with 5-50 staff.',
    problemEvidence: ['400 invoices a month (estimate)'],
    coreFeatures: ['Email-in inbox', 'Matter-code extraction'],
  };
  const gtm = {
    revenueGoal: '$2,400 = 8 × $300/mo',
    icp: { buyer: 'Firm administrator', user: 'Billing coordinator' },
    pricing: { price: '$300/mo', rationale: 'Under half the admin cost.' },
    firstFiveCustomers: ['Post the math in r/LawFirm.'],
    plan: [{ week: 1, theme: 'Discovery', actions: ['Interview 8 buyers'] }],
  };
  const infra = {
    schema: 'organizations → members → invoices',
    envVars: ['OPENAI_API_KEY=...'],
    deploySteps: ['1. Push to GitHub.'],
    services: [{ name: 'Supabase', purpose: 'Database', setupSteps: ['1. Sign up.'] }],
  };

  test('design, gtm and infra survive intact', () => {
    expect(normalizeDesign(design)).toEqual(design);
    expect(normalizeGtm(gtm)).toEqual(gtm);
    expect(normalizeInfra(infra)).toEqual(infra);
  });
});

describe('drifted shapes are made renderable', () => {
  // Each of these took the production build to the "Something broke." screen
  // before normalization; the assertions below are what stops that recurring.
  const CASES = {
    'design.coreFeatures as objects': {
      design: { coreFeatures: [{ name: 'Email inbox', description: 'Forward invoices in.' }] },
    },
    'design.problemEvidence as objects': {
      design: { problemEvidence: [{ claim: '400 invoices a month', source: 'estimate' }] },
    },
    'gtm.firstFiveCustomers as objects': {
      gtm: { firstFiveCustomers: [{ tactic: 'Post in r/LawFirm', where: 'reddit' }] },
    },
    'gtm.icp.segment as an object': {
      gtm: { icp: { segment: { size: '40k', description: 'US law firms' } } },
    },
    'gtm.pricing.price as an object': {
      gtm: { pricing: { price: { amount: 300, currency: 'USD', period: 'mo' } } },
    },
    'gtm.revenueGoal as an object': {
      gtm: { revenueGoal: { target: '$2,400', math: '8 x $300' } },
    },
    'infra.deploySteps as objects': {
      infra: { deploySteps: [{ step: 'Push to GitHub' }] },
    },
    'infra service setupSteps as objects': {
      infra: { services: [{ name: 'Supabase', setupSteps: [{ step: 'Create an account' }] }] },
    },
    'infra service freeTier as an object': {
      infra: { services: [{ name: 'Supabase', freeTier: { limit: '500MB' } }] },
    },
    'infra.monthlyCost values as objects': {
      infra: { monthlyCost: { dev: { amount: 0 }, at100users: { amount: 132 } } },
    },
  };

  for (const [label, parts] of Object.entries(CASES)) {
    test(label, () => {
      const normalized = normalizeBlueprint({
        design: parts.design || {},
        gtm: parts.gtm || {},
        infra: parts.infra || {},
      });
      expect(() => assertBlueprintRenderable(normalized)).not.toThrow();
    });
  }

  test('every drifted case at once still renders', () => {
    const merged = { design: {}, gtm: {}, infra: {} };
    for (const parts of Object.values(CASES)) {
      Object.assign(merged.design, parts.design || {});
      Object.assign(merged.gtm, parts.gtm || {});
      // services/monthlyCost would overwrite each other; merge services by hand
      const { services, ...restInfra } = parts.infra || {};
      Object.assign(merged.infra, restInfra);
      if (services) merged.infra.services = [...(merged.infra.services || []), ...services];
    }
    expect(() => assertBlueprintRenderable(normalizeBlueprint(merged))).not.toThrow();
  });

  test('the content survives rather than being dropped', () => {
    const { design } = normalizeBlueprint({
      design: { coreFeatures: [{ name: 'Email inbox', description: 'Forward invoices in.' }] },
    });
    expect(design.coreFeatures).toEqual(['Email inbox (Forward invoices in.)']);
  });
});

describe('values the UI calls .map() on are forced into arrays', () => {
  // `(x || []).map(...)` does not protect against these: an object or a string
  // is truthy, so the fallback never fires and `.map is not a function` throws.
  test('infra.services as a keyed object becomes an array', () => {
    const out = normalizeInfra({ services: { supabase: { name: 'Supabase', setupSteps: ['1. Sign up.'] } } });
    expect(Array.isArray(out.services)).toBe(true);
    expect(out.services[0].name).toBe('Supabase');
  });

  test('infra.services as a bare string becomes a one-service array', () => {
    const out = normalizeInfra({ services: 'Supabase' });
    expect(out.services).toEqual([{ name: 'Supabase', setupSteps: [] }]);
  });

  test('gtm.channels and gtm.plan as keyed objects become arrays', () => {
    const out = normalizeGtm({
      channels: { community: { name: 'Community', tactic: 'Answer threads' } },
      plan: { w1: { week: 1, theme: 'Discovery', actions: ['Interview buyers'] } },
    });
    expect(Array.isArray(out.channels)).toBe(true);
    expect(Array.isArray(out.plan)).toBe(true);
    expect(out.plan[0].actions).toEqual(['Interview buyers']);
  });

  test('design.evidenceVerified as a keyed object becomes an array', () => {
    const out = normalizeDesign({ evidenceVerified: { a: { claim: '400 a month', verified: true } } });
    expect(Array.isArray(out.evidenceVerified)).toBe(true);
    expect(out.evidenceVerified[0].claim).toBe('400 a month');
  });

  test('infra.monthlyCost as an array of objects still renders', () => {
    const out = normalizeInfra({ monthlyCost: [{ amount: 0 }, { amount: 132 }] });
    expect(() => assertRenderable(Object.values(out.monthlyCost), 'monthlyCost')).not.toThrow();
  });

  test('absent keys are not invented', () => {
    expect('services' in normalizeInfra({ schema: 'x' })).toBe(false);
    expect('channels' in normalizeGtm({ persona: 'x' })).toBe(false);
    expect('evidenceVerified' in normalizeDesign({ name: 'x' })).toBe(false);
  });
});

describe('normalizeInfra leaves the cost inputs alone', () => {
  test('costItems, usageAssumptions and costModel keep their numbers', () => {
    const infra = {
      costItems: [{ service: 'OpenAI', quantity: 16000, unit: 'requests', unitCost: 0.002 }],
      usageAssumptions: { customers: 100, storageGb: 20 },
      costModel: { monthlyTotal: 132, items: [{ service: 'OpenAI', monthlyCost: 32 }] },
    };
    const out = normalizeInfra(infra);
    expect(out.costItems).toEqual(infra.costItems);
    expect(out.usageAssumptions).toEqual(infra.usageAssumptions);
    expect(out.costModel).toEqual(infra.costModel);
  });
});

describe('non-object stage results are left as they are', () => {
  test('a string, an array or null passes straight through', () => {
    expect(normalizeDesign('a product design')).toBe('a product design');
    expect(normalizeGtm(null)).toBe(null);
    expect(normalizeInfra([1, 2])).toEqual([1, 2]);
    expect(normalizeBlueprint(undefined)).toBe(undefined);
  });

  test('a non-string prototype becomes an empty string', () => {
    expect(normalizeBlueprint({ prototypeHtml: { html: '<p>hi</p>' } }).prototypeHtml).toBe('');
  });
});
