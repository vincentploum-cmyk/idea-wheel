import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock @supabase/supabase-js before imports resolve
const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: jest.fn(), insert: jest.fn() }),
    rpc: mockRpc,
  }),
}));

import { deductCredits, CREDIT_COSTS, FREE_SPIN_LIMIT } from '../lib/credits.js';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Constants', () => {
  test('FREE_SPIN_LIMIT is 0 (no free spins)', () => {
    expect(FREE_SPIN_LIMIT).toBe(0);
  });

  test('blueprint costs 2 credits', () => {
    expect(CREDIT_COSTS.blueprint).toBe(2);
  });

  test('spin costs 1 credit', () => {
    expect(CREDIT_COSTS.spin).toBe(1);
  });
});

describe('deductCredits — RPC path', () => {
  test('returns ok:true and new balance on success', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, new_balance: 3 }, error: null });
    const result = await deductCredits('user-1', 2, 'blueprint');
    expect(result).toEqual({ ok: true, newBalance: 3 });
    expect(mockRpc).toHaveBeenCalledWith('deduct_credits', expect.objectContaining({
      p_user_id: 'user-1',
      p_amount: 2,
      p_reason: 'blueprint',
    }));
  });

  test('returns ok:false with reason on insufficient credits', async () => {
    mockRpc.mockResolvedValue({ data: { ok: false, reason: 'insufficient_credits', balance: 1 }, error: null });
    const result = await deductCredits('user-1', 2, 'blueprint');
    expect(result).toEqual({ ok: false, reason: 'insufficient_credits', balance: 1 });
  });

  test('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    await expect(deductCredits('user-1', 2, 'blueprint')).rejects.toThrow('deductCredits RPC failed');
  });

  test('passes blueprintId and stripeRef through', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, new_balance: 0 }, error: null });
    await deductCredits('user-1', 2, 'blueprint', { blueprintId: 'bp-42', stripe_payment_intent: 'pi_abc' });
    expect(mockRpc).toHaveBeenCalledWith('deduct_credits', expect.objectContaining({
      p_blueprint_id: 'bp-42',
      p_stripe_payment_intent: 'pi_abc',
    }));
  });
});
