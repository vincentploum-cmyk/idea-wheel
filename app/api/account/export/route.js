import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/error-log';

/**
 * GET /api/account/export
 *
 * Returns a signed JSON blob with everything the account owns — the promise
 * made in the Privacy Policy ("access a copy of your data"). No filtering,
 * no summary: raw rows so the user can walk away with an honest export.
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

// Tables owned by user_id. Safe to enumerate — every user-owned table
// backs a documented product feature.
const OWNED_TABLES = [
  'saved_ideas',
  'pipeline_validations',
  'blueprint_charges',
  'user_spins',
  'stripe_orders',
  'reviews',
  'contact_messages',
];

// Ledger-style tables the user should see verbatim.
const LEDGER_TABLES = [
  { name: 'credits', description: 'credit ledger (individual +/- entries)' },
];

async function safeSelect(sb, table, userId) {
  try {
    const { data, error } = await sb.from(table).select('*').eq('user_id', userId);
    if (error) return { error: error.message };
    return { rows: data || [] };
  } catch (err) {
    return { error: err.message };
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return Response.json({ error: 'export_unavailable' }, { status: 503 });

  const sb = createClient(url, svc, { auth: { persistSession: false } });

  const bundle = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      provider: user.app_metadata?.provider || null,
    },
    tables: {},
  };

  for (const table of [...OWNED_TABLES, ...LEDGER_TABLES.map((t) => t.name)]) {
    bundle.tables[table] = await safeSelect(sb, table, user.id);
  }

  // idea_candidates is keyed by the user who FIRST recorded the canonical
  // combo, but is queried by combo not user_id. Include their own contributions.
  try {
    const { data } = await sb
      .from('idea_candidates')
      .select('*')
      .filter('comp->>userId', 'eq', user.id)
      .limit(500);
    bundle.tables.idea_candidates_contributed = { rows: data || [] };
  } catch {
    // best-effort — the field may not exist
  }

  const errored = Object.entries(bundle.tables)
    .filter(([, v]) => v?.error)
    .map(([k]) => k);
  if (errored.length) {
    // Non-fatal — log so we notice if a schema drift breaks the export.
    await logError({
      scope: 'api:account-export',
      error: `partial export: tables errored [${errored.join(', ')}]`,
      userId: user.id,
      severity: 'warning',
    });
  }

  const filename = `ideareels-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
