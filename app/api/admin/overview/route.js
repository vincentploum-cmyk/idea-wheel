import { createClient } from '@supabase/supabase-js';
import { percentile } from '@/lib/metrics';

/**
 * GET /api/admin/overview — the one endpoint for "how's the site doing?"
 * Combines counts, revenue, error buckets, and pipeline latency into a
 * single JSON payload the admin page renders. Bearer SEED_SECRET.
 */

export const dynamic = 'force-dynamic';

const SECRET = process.env.SEED_SECRET;

async function tryCount(sb, table, filter) {
  try {
    let q = sb.from(table).select('id', { head: true, count: 'exact' });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return { error: error.message };
    return { count: count ?? 0 };
  } catch (err) {
    return { error: err.message };
  }
}

async function trySum(sb, table, column, filter) {
  try {
    let q = sb.from(table).select(column);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { sum: (data || []).reduce((a, r) => a + (Number(r[column]) || 0), 0), rows: data?.length || 0 };
  } catch (err) {
    return { error: err.message };
  }
}

export async function GET(request) {
  if (!SECRET) return Response.json({ error: 'admin_not_configured' }, { status: 401 });
  if ((request.headers.get('authorization') || '') !== `Bearer ${SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'db_not_configured' }, { status: 503 });

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();
  const d24 = new Date(now.getTime() - 24 * 3600e3).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 3600e3).toISOString();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    users24,
    users7,
    spinsAllTime,
    validations24,
    blueprints24,
    contactsPending,
    errorsLast24,
    stripePaid,
  ] = await Promise.all([
    tryCount(sb, 'user_spins', (q) => q.gte('created_at', d24)),
    tryCount(sb, 'user_spins', (q) => q.gte('created_at', d7)),
    tryCount(sb, 'user_spins'),
    tryCount(sb, 'pipeline_validations', (q) => q.gte('created_at', d24)),
    tryCount(sb, 'blueprint_charges', (q) => q.gte('created_at', d24).eq('status', 'used')),
    tryCount(sb, 'contact_messages', (q) => q.gte('created_at', d7)),
    tryCount(sb, 'error_events', (q) => q.gte('created_at', d24)),
    trySum(sb, 'stripe_orders', 'amount_cents', (q) => q.gte('created_at', startMonth).eq('status', 'paid')),
  ]);

  // Pipeline latency for the 3 top-line stages
  const stagesToReport = ['validate', 'deep_research', 'build:designer', 'build:launch', 'build:infrastructure'];
  const stageStats = {};
  try {
    const { data: timings } = await sb
      .from('pipeline_stage_timings')
      .select('stage, duration_ms, status')
      .gte('created_at', d24)
      .in('stage', stagesToReport)
      .limit(5000);
    for (const t of (timings || [])) {
      if (!stageStats[t.stage]) stageStats[t.stage] = { ok: [], errors: 0 };
      if (t.status === 'error') stageStats[t.stage].errors += 1;
      else stageStats[t.stage].ok.push(t.duration_ms);
    }
    for (const s of Object.keys(stageStats)) {
      const sorted = stageStats[s].ok.slice().sort((a, b) => a - b);
      stageStats[s].p50 = percentile(sorted, 0.5);
      stageStats[s].p95 = percentile(sorted, 0.95);
      stageStats[s].count = sorted.length;
    }
  } catch {}

  // Error scope breakdown
  let errorScopes = {};
  try {
    const { data: errs } = await sb.from('error_events').select('scope').gte('created_at', d24).limit(1000);
    for (const e of (errs || [])) errorScopes[e.scope] = (errorScopes[e.scope] || 0) + 1;
  } catch {}

  return Response.json({
    generatedAt: now.toISOString(),
    windows: { last24h: d24, last7d: d7, monthStart: startMonth },
    counts: {
      spinsLast24h: users24,
      spinsLast7d: users7,
      spinsAllTime,
      validationsLast24h: validations24,
      blueprintsLast24h: blueprints24,
      contactMessagesPending7d: contactsPending,
      errorsLast24h,
    },
    revenue: {
      thisMonthCents: stripePaid?.sum ?? 0,
      thisMonthDollars: stripePaid?.sum != null ? Math.round(stripePaid.sum) / 100 : null,
      paidOrdersCount: stripePaid?.rows ?? 0,
    },
    latencyLast24h: stageStats,
    errorsByScope: errorScopes,
  });
}
