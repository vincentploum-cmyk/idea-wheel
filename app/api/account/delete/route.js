import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-log';

/**
 * POST /api/account/delete
 *
 * Self-serve account deletion — the promise made in the Privacy Policy.
 *
 * Body: { "confirm": "DELETE <email>" }   — must match the signed-in user's
 * email verbatim. This is enough friction for a one-click flow behind
 * an authenticated session; it stops accidental deletes and any XSRF that
 * doesn't already have the email.
 *
 * What we do:
 *   1. Delete rows in tables that DON'T have ON DELETE CASCADE from auth.users
 *      (moat-v2 tables, saved_ideas, user_spins, reviews).
 *   2. Anonymize rows in tables we keep for tax/legal reasons (stripe_orders
 *      → user_id NULL). The Privacy Policy discloses this 7-year retention.
 *   3. Delete the auth.users row (which cascades credits / credit_transactions
 *      / stripe_orders' non-anonymized siblings). This also revokes all
 *      sessions.
 *
 * The user's browser session is now stale; the client sends them to /goodbye.
 */

export const dynamic = 'force-dynamic';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function safeDelete(sb, table, userId, results) {
  try {
    const { error, count } = await sb.from(table).delete({ count: 'exact' }).eq('user_id', userId);
    if (error) results[table] = { error: error.message };
    else results[table] = { deleted: count ?? 0 };
  } catch (err) {
    results[table] = { error: err.message };
  }
}

async function safeAnonymize(sb, table, userId, results) {
  try {
    const { error, count } = await sb.from(table).update({ user_id: null }).eq('user_id', userId).select('*', { count: 'exact', head: true });
    if (error) results[table] = { error: error.message };
    else results[table] = { anonymized: count ?? 0 };
  } catch (err) {
    results[table] = { error: err.message };
  }
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return Response.json({ error: 'deletion_unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const expected = `DELETE ${user.email}`;
  if (body?.confirm !== expected) {
    return Response.json({
      error: 'confirmation_required',
      hint: `Body must contain {"confirm":"DELETE <your email>"}. Expected exactly: ${expected}`,
    }, { status: 400 });
  }

  const sb = createClient(url, svc, { auth: { persistSession: false } });
  const results = {};

  // Rows to fully delete.
  await Promise.all([
    safeDelete(sb, 'saved_ideas', user.id, results),
    safeDelete(sb, 'pipeline_validations', user.id, results),
    safeDelete(sb, 'blueprint_charges', user.id, results),
    safeDelete(sb, 'user_spins', user.id, results),
    safeDelete(sb, 'reviews', user.id, results),
  ]);

  // Rows to anonymize (kept for legal/accounting reasons per Privacy Policy).
  await Promise.all([
    safeAnonymize(sb, 'stripe_orders', user.id, results),
    safeAnonymize(sb, 'contact_messages', user.id, results),
  ]);

  // Finally: nuke the auth user. This cascades credits / credit_transactions /
  // etc. via the FK ON DELETE CASCADE set in credits-migration.sql.
  let authDeleted = false;
  try {
    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) throw error;
    authDeleted = true;
  } catch (err) {
    await logError({
      scope: 'api:account-delete',
      error: err,
      userId: user.id,
      route: '/api/account/delete',
      meta: { partialResults: results },
    });
    return Response.json({
      error: 'deletion_incomplete',
      detail: err.message,
      results,
      note: 'Some data was removed. Contact hello@ideareels.io to complete deletion.',
    }, { status: 500 });
  }

  return Response.json({
    ok: true,
    accountDeleted: authDeleted,
    tables: results,
    next: '/goodbye',
  });
}
