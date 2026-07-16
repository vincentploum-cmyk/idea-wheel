import { createClient } from '@supabase/supabase-js';
import { addCredits, getBalance } from '@/lib/credits';
import { logError } from '@/lib/error-log';

/**
 * POST /api/admin/refund — issue a credit adjustment to a user.
 * Bearer SEED_SECRET. For manual customer-support cases (runbook Playbook 2).
 *
 * Body: {
 *   userId: uuid,                 // required
 *   amount: number,               // positive integer, credits to grant
 *   reason: string,               // free-form audit note; prefixed with 'admin_refund:'
 *   note?: string,                // optional context stored on the ledger row
 * }
 *
 * Grants are idempotent per (userId, reason) via the credit-integrity indexes
 * — pass a distinct reason for each grant (e.g. include a ticket ID).
 */

export const dynamic = 'force-dynamic';

const SECRET = process.env.SEED_SECRET;

export async function POST(request) {
  if (!SECRET) return Response.json({ error: 'admin_not_configured' }, { status: 401 });
  if ((request.headers.get('authorization') || '') !== `Bearer ${SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, amount, reason, note } = body || {};

  if (typeof userId !== 'string' || !userId) {
    return Response.json({ error: 'userId_required' }, { status: 400 });
  }
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0 || amt > 1000) {
    return Response.json({ error: 'amount_must_be_positive_integer_le_1000' }, { status: 400 });
  }
  if (typeof reason !== 'string' || reason.length < 3) {
    return Response.json({ error: 'reason_required' }, { status: 400 });
  }

  // Quick sanity: does the user actually exist? (Not a security control —
  // the SEED_SECRET already gated us — but avoids granting credits to a
  // typo'd UUID that will never be redeemable.)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: userRow, error: userErr } = await sb.auth.admin.getUserById(userId);
  if (userErr || !userRow?.user) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }

  const auditedReason = `admin_refund:${reason.trim().slice(0, 100)}`;
  const result = await addCredits(userId, amt, auditedReason, {
    note: note?.slice?.(0, 500) || null,
    grantedAt: new Date().toISOString(),
  });

  if (!result.ok && !result.duplicate) {
    await logError({
      scope: 'api:admin-refund',
      error: `addCredits failed: ${result.error || 'unknown'}`,
      userId,
      route: '/api/admin/refund',
      meta: { amt, reason: auditedReason },
    });
    return Response.json({ error: 'grant_failed', detail: result.error || 'unknown' }, { status: 500 });
  }

  const balance = await getBalance(userId);
  return Response.json({
    ok: true,
    userId,
    userEmail: userRow.user.email,
    granted: result.duplicate ? 0 : amt,
    duplicate: !!result.duplicate,
    reason: auditedReason,
    newBalance: balance,
  });
}
