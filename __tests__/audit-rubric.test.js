import { auditBlueprint } from '../lib/audit-rubric.js';

const goodPayload = () => ({
  comp: {
    score: 72,
    scoreVersion: 'v2.0',
    scoreBreakdown: { a: 20, b: 15, c: 15, d: 10, e: 12 },
    players: [
      { name: 'A', weakness: 'no automation' },
      { name: 'B', weakness: 'too expensive' },
      { name: 'C', weakness: 'no SMS' },
    ],
    sources: [{ url: 'x', verified: true }, { url: 'y', verified: true }, { url: 'z', verified: false }],
    deepResearch: { demandSignals: ['a', 'b', 'c'], voiceOfCustomer: ['x', 'y'] },
  },
  design: { cursorPrompt: 'x'.repeat(250) },
  gtm: {
    icp: { trigger: 'quarterly compliance audit', disqualifier: 'no in-house ops team' },
    pricing: { price: '$450/mo' },
    cursorPrompt: 'x'.repeat(300),
  },
  infra: {
    services: [{ name: 'Stripe' }, { name: 'Supabase' }, { name: 'Twilio' }, { name: 'Sentry' }],
    costItems: [
      { service: 'Stripe processing', unitCost: 30 },
      { service: 'Twilio', unitCost: 7.5 },
    ],
  },
});

describe('auditBlueprint', () => {
  test('good payload passes', () => {
    const r = auditBlueprint(goodPayload());
    expect(r.pass).toBe(true);
    expect(r.hardPass).toBe(true);
    expect(r.summary).toBe('PASS');
  });

  test('overclaiming word fails hard', () => {
    const p = goodPayload();
    p.gtm.tagline = 'Our proprietary AI guarantees results';
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.no_overclaiming).toBe(false);
  });

  test('score below 60 fails hard', () => {
    const p = goodPayload();
    p.comp.score = 55;
    // rebalance breakdown so sum-check doesn't compound
    p.comp.scoreBreakdown = { a: 20, b: 15, c: 10, d: 5, e: 5 };
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.score_ge_60).toBe(false);
  });

  test('missing cursor prompt fails hard', () => {
    const p = goodPayload();
    p.design.cursorPrompt = '';
    p.gtm.cursorPrompt = '';
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.cursor_prompt_present).toBe(false);
  });

  test('paid product without payment line fails hard', () => {
    const p = goodPayload();
    p.infra.costItems = [{ service: 'Supabase', unitCost: 25 }];
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.cost_has_payment_line).toBe(false);
  });

  test('breakdown that does not sum to score fails hard', () => {
    const p = goodPayload();
    p.comp.scoreBreakdown = { a: 10, b: 10 };
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.breakdown_sums_to_score).toBe(false);
  });

  test('stale score version fails hard', () => {
    const p = goodPayload();
    p.comp.scoreVersion = 'v1.0';
    const r = auditBlueprint(p);
    expect(r.pass).toBe(false);
    expect(r.hard.score_version_current).toBe(false);
  });
});
