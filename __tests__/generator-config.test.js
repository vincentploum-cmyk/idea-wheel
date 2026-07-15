import { describe, test, expect } from '@jest/globals';
import { buildAdaptiveGeneratorConfig, DEFAULT_MODE_CONFIGS } from '../lib/generator-config.js';

// No training data — pure defaults
const config = buildAdaptiveGeneratorConfig();
const consumer = config.modes.consumer;
const b2b = config.modes.b2b;

// Pairs that should never appear after the combination audit
const CONSUMER_BAD_PAIRS = [
  ['Builds', 'fitness'],
  ['Builds', 'learning'],
  ['Builds', 'focus & deep work'],
  ['Builds', 'language learning'],
  ['Reduces', 'mental health'],
  ['Reduces', 'digital wellbeing'],
  ['Plans', 'meal planning'],
];

describe('Consumer combinations', () => {
  test('pairMap is defined', () => {
    expect(consumer.pairMap).toBeTruthy();
  });

  test.each(CONSUMER_BAD_PAIRS)(
    '"%s" must not pair with "%s"',
    (action, workflow) => {
      const allowed = consumer.pairMap?.[action] ?? [];
      expect(allowed).not.toContain(workflow);
    }
  );

  test('every action maps to at least one workflow', () => {
    for (const [action, workflows] of Object.entries(consumer.pairMap ?? {})) {
      expect(workflows.length).toBeGreaterThan(0);
    }
  });

  test('every workflow in pairMap exists in the workflow bank', () => {
    const workflowBank = new Set(consumer.banks[1]);
    for (const [, workflows] of Object.entries(consumer.pairMap ?? {})) {
      for (const wf of workflows) {
        expect(workflowBank.has(wf)).toBe(true);
      }
    }
  });

  test('workflowIndustryMap: every industry exists in the industry bank', () => {
    const industryBank = new Set(consumer.banks[2]);
    for (const [, industries] of Object.entries(consumer.workflowIndustryMap ?? {})) {
      for (const ind of industries) {
        expect(industryBank.has(ind)).toBe(true);
      }
    }
  });

  test('"Eases" display alias applies to Reduces', () => {
    expect(consumer.display?.actions?.['Reduces']).toBe('Eases');
  });
});

describe('B2B combinations', () => {
  test('pairMap is defined', () => {
    expect(b2b.pairMap).toBeTruthy();
  });

  test('every B2B action maps to at least one workflow', () => {
    for (const [action, workflows] of Object.entries(b2b.pairMap ?? {})) {
      expect(workflows.length).toBeGreaterThan(0);
    }
  });

  test('every workflow in pairMap exists in the workflow bank', () => {
    const workflowBank = new Set(b2b.banks[1]);
    for (const [, workflows] of Object.entries(b2b.pairMap ?? {})) {
      for (const wf of workflows) {
        expect(workflowBank.has(wf)).toBe(true);
      }
    }
  });
});

// Fail-closed: every workflow a user can actually LAND ON (i.e. reachable through
// some action's pairMap) must have an explicit curated audience/industry map. A
// missing entry is what made the wheel silently fall back to the ENTIRE audience
// bank — the audit's central consumer-quality defect. This test regresses if any
// reachable workflow loses its map.
describe('Workflow→industry map completeness (no silent fallback)', () => {
  for (const modeKey of ['b2b', 'consumer']) {
    const defaults = DEFAULT_MODE_CONFIGS[modeKey];
    const reachable = new Set(Object.values(defaults.pairMap).flat());

    test(`[${modeKey}] every reachable workflow has a non-empty industry map`, () => {
      const missing = [...reachable].filter(
        (wf) => !Array.isArray(defaults.workflowIndustryMap[wf]) || defaults.workflowIndustryMap[wf].length === 0
      );
      expect(missing).toEqual([]);
    });

    test(`[${modeKey}] every mapped industry exists in the industry bank`, () => {
      const bank = new Set(defaults.banks[2]);
      for (const [wf, industries] of Object.entries(defaults.workflowIndustryMap)) {
        for (const ind of industries) {
          expect({ wf, ind, inBank: bank.has(ind) }).toEqual({ wf, ind, inBank: true });
        }
      }
    });
  }
});
