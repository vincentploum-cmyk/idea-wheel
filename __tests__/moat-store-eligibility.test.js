import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Point moat-store at a temp DATA_DIR before importing it, so ownership tests
// run against a clean JSONL fallback (no Supabase creds in the test env).
const TMP_DIR = path.join(os.tmpdir(), `moat-store-test-${process.pid}`);
process.env.MOAT_DATA_DIR = TMP_DIR;

let getValidationEligibility;
let findBlueprintChargeByKey;

beforeAll(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  const rows = [
    { id: 'v-alice', user_id: 'alice', eval: { scores: { overall: 70 }, deterministic: { rubricVersion: 'v2.0' } }, scout: {} },
    { id: 'v-legacy', eval: { scores: { overall: 70 }, deterministic: { rubricVersion: 'v2.0' } }, scout: {} }, // pre-migration row (no user_id)
    { id: 'v-stale', user_id: 'alice', eval: { scores: { overall: 70 }, deterministic: { rubricVersion: 'v1.0' } }, scout: {} },
    { id: 'v-broken', user_id: 'alice', eval: { scores: { overall: 90 }, deterministic: { rubricVersion: 'v2.0' } }, scout: { premiseFit: 'nonexistent' } },
    { id: 'v-low', user_id: 'alice', eval: { scores: { overall: 55 }, deterministic: { rubricVersion: 'v2.0' } }, scout: {} },
  ];
  await fs.writeFile(path.join(TMP_DIR, 'validations.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  await fs.writeFile(path.join(TMP_DIR, 'blueprint-charges.jsonl'),
    JSON.stringify({ id: 'ch-1', userId: 'alice', validationId: 'v-alice', status: 'authorized' }) + '\n');
  ({ getValidationEligibility, findBlueprintChargeByKey } = await import('../lib/moat-store.js'));
});

afterAll(async () => {
  await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
});

const OPTS = { minScore: 60, requiredVersion: 'v2.0' };

describe('getValidationEligibility — ownership (auditor #1)', () => {
  test('owner passes the gate', async () => {
    const r = await getValidationEligibility('v-alice', { ...OPTS, userId: 'alice' });
    expect(r.eligible).toBe(true);
    expect(r.score).toBe(70);
  });

  test("another user gets validation_not_found (never leaks existence)", async () => {
    const r = await getValidationEligibility('v-alice', { ...OPTS, userId: 'bob' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('validation_not_found'); // NOT 'not_yours' — privacy
  });

  test('missing id returns missing_validation_id', async () => {
    const r = await getValidationEligibility('', { ...OPTS, userId: 'alice' });
    expect(r.reason).toBe('missing_validation_id');
  });

  test('legacy row (no user_id) is pass-through so existing users keep working', async () => {
    const r = await getValidationEligibility('v-legacy', { ...OPTS, userId: 'alice' });
    expect(r.eligible).toBe(true);
  });
});

describe('getValidationEligibility — policy always enforced', () => {
  test('stale score version is rejected', async () => {
    const r = await getValidationEligibility('v-stale', { ...OPTS, userId: 'alice' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('stale_score_version');
  });

  test('premise-broken idea is capped at 35 → below threshold', async () => {
    const r = await getValidationEligibility('v-broken', { ...OPTS, userId: 'alice' });
    expect(r.eligible).toBe(false);
    expect(r.score).toBeLessThanOrEqual(35);
    expect(r.reason).toBe('below_threshold');
  });

  test('score below the bar is rejected', async () => {
    const r = await getValidationEligibility('v-low', { ...OPTS, userId: 'alice' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('below_threshold');
  });

  test('reason is always a string (safe for .includes) — auditor #5', async () => {
    for (const id of ['v-alice', 'v-stale', 'v-broken', 'v-low', 'missing-id']) {
      const r = await getValidationEligibility(id, { ...OPTS, userId: 'alice' });
      expect(typeof r.reason).toBe('string');
    }
  });
});

describe('findBlueprintChargeByKey — idempotency lookup (auditor #4)', () => {
  test('finds an existing charge by (userId, validationId)', async () => {
    const c = await findBlueprintChargeByKey({ userId: 'alice', validationId: 'v-alice' });
    expect(c?.id).toBe('ch-1');
  });

  test('returns null for missing (user, validation) pair', async () => {
    expect(await findBlueprintChargeByKey({ userId: 'alice', validationId: 'nope' })).toBe(null);
    expect(await findBlueprintChargeByKey({ userId: 'bob', validationId: 'v-alice' })).toBe(null);
  });

  test('returns null on missing inputs (never throws)', async () => {
    expect(await findBlueprintChargeByKey({})).toBe(null);
  });
});
