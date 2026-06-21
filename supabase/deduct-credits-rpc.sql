-- Atomic credit deduction RPC
-- Run this in the Supabase SQL editor.
-- Replaces the in-process mutex in lib/credits.js with a true DB-level advisory lock.

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id              UUID,
  p_amount               INTEGER,
  p_reason               TEXT,
  p_blueprint_id         UUID    DEFAULT NULL,
  p_stripe_payment_intent TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance  INTEGER;
BEGIN
  -- Serialize all deductions for this user via a transaction-scoped advisory lock.
  -- hashtext() maps the UUID to a stable int4; cast to int8 for the lock API.
  -- The lock is automatically released when the transaction ends.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT)::BIGINT);

  -- Compute spendable balance (excludes idea-credit rows)
  SELECT COALESCE(SUM(change), 0)
  INTO v_balance
  FROM public.credits
  WHERE user_id = p_user_id
    AND reason != 'idea_credit_grant'
    AND reason NOT LIKE 'idea_unlock_%';

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok',      false,
      'reason',  'insufficient_credits',
      'balance', v_balance
    );
  END IF;

  INSERT INTO public.credits (user_id, change, reason, blueprint_id, stripe_payment_intent)
  VALUES (p_user_id, -p_amount, p_reason, p_blueprint_id, p_stripe_payment_intent);

  RETURN jsonb_build_object(
    'ok',          true,
    'new_balance', v_balance - p_amount
  );
END;
$$;

-- Only the service role (server) may call this function
REVOKE ALL ON FUNCTION public.deduct_credits FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits TO service_role;
