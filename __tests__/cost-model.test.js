import { describe, test, expect } from '@jest/globals';
import { computeCostModel, parseMoney } from '../lib/cost-model.js';

describe('parseMoney', () => {
  test('pulls the number from a price string', () => {
    expect(parseMoney('$300/mo')).toBe(300);
    expect(parseMoney('$1,499/yr')).toBe(1499);
    expect(parseMoney('free')).toBe(null);
  });
});

describe('computeCostModel — the audit flagship (Stripe % fee)', () => {
  const infra = {
    usageAssumptions: { customers: 100 },
    costItems: [
      { service: 'OpenAI', quantity: 16000, unit: 'requests', unitCost: 0.002 },
      { service: 'Stripe', quantity: 100, unit: 'transactions', unitCost: 0.029 },
      { service: 'Render', quantity: 1, unit: 'workspace', unitCost: 25 },
      { service: 'Supabase Postgres', quantity: 1, unit: 'instance', unitCost: 20 },
    ],
  };

  test('Stripe is recomputed as 2.9% + $0.30 per charge, not qty×0.029', () => {
    const cm = computeCostModel(infra, { monthlyPrice: 300 });
    const stripe = cm.items.find((i) => /stripe/i.test(i.service));
    // 100 × ($300 × 2.9% + $0.30) = 100 × $9.00 = $900
    expect(stripe.monthlyCost).toBe(900);
    expect(cm.notes.join(' ')).toMatch(/percentage/i);
  });

  test('per-unit items still compute qty × unitCost', () => {
    const cm = computeCostModel(infra, { monthlyPrice: 300 });
    expect(cm.items.find((i) => i.service === 'OpenAI').monthlyCost).toBe(32);
  });

  test('total is the exact sum of the recomputed rows', () => {
    const cm = computeCostModel(infra, { monthlyPrice: 300 });
    const sum = cm.items.reduce((s, i) => s + i.monthlyCost, 0);
    expect(cm.monthlyTotal).toBe(Math.round(sum * 100) / 100);
    // 32 + 900 + 25 + 20 = 977 (no longer the absurd $42.85)
    expect(cm.monthlyTotal).toBe(977);
  });

  test('is marked an estimate', () => {
    expect(computeCostModel(infra, { monthlyPrice: 300 }).isEstimate).toBe(true);
  });
});

describe('computeCostModel — payment line + nonzero floors', () => {
  test('adds a payment line when the model omits Stripe from cost items', () => {
    const infra = {
      usageAssumptions: { customers: 100 },
      costItems: [
        { service: 'OpenAI', quantity: 16000, unit: 'requests', unitCost: 0.002 },
        { service: 'Supabase', quantity: 1, unit: 'db', unitCost: 0 },      // free-tier optimism
        { service: 'Render', quantity: 1, unit: 'workspace', unitCost: 25 },
      ],
    };
    const cm = computeCostModel(infra, { monthlyPrice: 300 });
    const pay = cm.items.find((i) => /payment|stripe/i.test(i.service));
    expect(pay).toBeTruthy();
    expect(pay.monthlyCost).toBe(900); // 100 × ($300 × 2.9% + $0.30)
    // Supabase $0 raised to the $20 baseline
    expect(cm.items.find((i) => /supabase|database/i.test(i.service)).monthlyCost).toBe(20);
    // 32 + 900 + 20(bumped) + 25 = 977
    expect(cm.monthlyTotal).toBe(977);
  });
});

describe('computeCostModel — known metered rates correct $0 lines', () => {
  test('Twilio at $0 is repriced at the real per-segment rate', () => {
    const infra = {
      usageAssumptions: { customers: 100 },
      costItems: [
        { service: 'Twilio', quantity: 1000, unit: 'messages', unitCost: 0 },
        { service: 'Render', quantity: 1, unit: 'ws', unitCost: 25 },
        { service: 'Neon Postgres', quantity: 1, unit: 'db', unitCost: 20 },
      ],
    };
    const cm = computeCostModel(infra, { monthlyPrice: 0 }); // no payment line (price 0)
    const twilio = cm.items.find((i) => /twilio/i.test(i.service));
    expect(twilio.unitCost).toBe(0.0083);
    expect(twilio.monthlyCost).toBe(8.3); // 1000 × 0.0083
  });
});

describe('computeCostModel — enforced floors', () => {
  test('adds hosting + database baselines when the model omits them', () => {
    const cm = computeCostModel({ usageAssumptions: { customers: 50 }, costItems: [{ service: 'OpenAI', quantity: 1000, unit: 'req', unitCost: 0.002 }] }, { monthlyPrice: 100 });
    expect(cm.items.some((i) => /host|render/i.test(i.service))).toBe(true);
    expect(cm.items.some((i) => /database|postgres/i.test(i.service))).toBe(true);
  });

  test('does not double-add floors already present', () => {
    const cm = computeCostModel({ usageAssumptions: { customers: 50 }, costItems: [{ service: 'Render Pro', quantity: 1, unit: 'ws', unitCost: 25 }, { service: 'Neon Postgres', quantity: 1, unit: 'db', unitCost: 19 }] }, {});
    expect(cm.items.filter((i) => /host|render/i.test(i.service)).length).toBe(1);
    expect(cm.items.filter((i) => /postgres|database/i.test(i.service)).length).toBe(1);
  });
});

// The audit's pricing contradiction: "$4,500 = 15 × $300" printed next to a
// $450/mo price. Reconciliation must derive the formula from the real price.
describe('pricing reconciliation (deterministic)', () => {
  const reconcile = (priceStr, goalStr) => {
    const price = parseMoney(priceStr);
    const goal = parseMoney(goalStr);
    if (!(price > 0 && goal > 0)) return null;
    const customers = Math.max(1, Math.round(goal / price));
    return { customers, total: Math.round(customers * price) };
  };
  test('$450/mo with a $4,500 goal reconciles to 10 customers, not 15 × $300', () => {
    expect(reconcile('$450/mo', '$4,500')).toEqual({ customers: 10, total: 4500 });
  });
  test('$300/mo with a $4,500 goal reconciles to 15 customers', () => {
    expect(reconcile('$300/mo', '$4,500')).toEqual({ customers: 15, total: 4500 });
  });
  test('never yields zero customers', () => {
    expect(reconcile('$999/mo', '$100').customers).toBe(1);
  });
});
