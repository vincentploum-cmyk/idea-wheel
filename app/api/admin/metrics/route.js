import { createClient } from '@supabase/supabase-js';
import { percentile } from '@/lib/metrics';

/**
 * GET /api/admin/metrics — p50/p95 latency per stage over a window.
 * Bearer <SEED_SECRET>.
 *
 * Query params:
 *   ?hours=24    (max 168)
 *   ?stage=validate    (optional filter)
 */

export const dynamic = 'force-dynamic';

const SECRET = process.env.SEED_SECRET;

export async function GET(request) {
  if (!SECRET) return Response.json({ error: 'admin_not_configured' }, { status: 401 });
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${SECRET}`) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'db_not_configured' }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const hours = Math.min(168, Math.max(1, parseInt(params.get('hours') || '24', 10)));
  const stageFilter = params.get('stage') || null;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let q = sb.from('pipeline_stage_timings').select('stage, duration_ms, status').gte('created_at', since);
  if (stageFilter) q = q.eq('stage', stageFilter);
  const { data, error } = await q.limit(10000);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const byStage = {};
  for (const row of data || []) {
    if (!byStage[row.stage]) byStage[row.stage] = { ok: [], error: [] };
    if (row.status === 'error') byStage[row.stage].error.push(row.duration_ms);
    else byStage[row.stage].ok.push(row.duration_ms);
  }

  const summary = {};
  for (const [stage, buckets] of Object.entries(byStage)) {
    const okSorted = [...buckets.ok].sort((a, b) => a - b);
    const total = buckets.ok.length + buckets.error.length;
    summary[stage] = {
      count: total,
      okCount: buckets.ok.length,
      errorCount: buckets.error.length,
      errorRate: total > 0 ? buckets.error.length / total : 0,
      p50Ms: percentile(okSorted, 0.5),
      p95Ms: percentile(okSorted, 0.95),
      p99Ms: percentile(okSorted, 0.99),
      minMs: okSorted[0] ?? null,
      maxMs: okSorted[okSorted.length - 1] ?? null,
    };
  }

  // SLO check for the marketing claims
  const validate = summary['validate'];
  const slos = {
    firstVerdictUnder30s: validate ? { p95Ms: validate.p95Ms, ok: validate.p95Ms != null && validate.p95Ms <= 30_000 } : null,
    // "under 5 minutes" = validate + deep_research + all build stages combined;
    // reported per-stage — client can sum if desired.
  };

  return Response.json({ windowHours: hours, since, sampleTotal: data?.length || 0, summary, slos });
}
