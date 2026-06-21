import { describe, test, expect } from '@jest/globals';
import { CREDIT_PACKS } from '../lib/credits.js';

// These are the values Stripe checkout and the webhook both depend on.
// If a pack changes here, the webhook logic must change too.

describe('CREDIT_PACKS', () => {
  test('starter pack: 5 spin credits at $3.99', () => {
    const pack = CREDIT_PACKS.find(p => p.id === 'starter');
    expect(pack).toBeDefined();
    expect(pack.credits).toBe(5);
    expect(pack.price_cents).toBe(399);
    expect(pack.type).toBe('spin');
  });

  test('pro pack: 1 idea credit at $9.99', () => {
    const pack = CREDIT_PACKS.find(p => p.id === 'pro');
    expect(pack).toBeDefined();
    expect(pack.ideaCredits).toBe(1);
    expect(pack.price_cents).toBe(999);
    expect(pack.type).toBe('idea');
  });

  test('power pack: 2 idea credits at $19.99', () => {
    const pack = CREDIT_PACKS.find(p => p.id === 'power');
    expect(pack).toBeDefined();
    expect(pack.ideaCredits).toBe(2);
    expect(pack.price_cents).toBe(1999);
    expect(pack.type).toBe('idea');
  });

  test('all packs have required fields', () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.id).toBeTruthy();
      expect(pack.label).toBeTruthy();
      expect(typeof pack.price_cents).toBe('number');
      expect(pack.price_display).toMatch(/^\$/);
    }
  });

  test('no pack has both spin credits and idea credits', () => {
    for (const pack of CREDIT_PACKS) {
      const hasSpin = (pack.credits ?? 0) > 0;
      const hasIdea = (pack.ideaCredits ?? 0) > 0;
      expect(hasSpin && hasIdea).toBe(false);
    }
  });
});
