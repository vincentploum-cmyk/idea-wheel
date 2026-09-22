import { requireNhlAdmin, listRuns, createRun, NHL_SLOTS } from '@/lib/nhl-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireNhlAdmin();
  if (gate.response) return gate.response;
  try {
    const runs = await listRuns();
    return Response.json({ runs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl] list runs failed:', err);
    return Response.json({ error: 'list_failed', detail: err.message }, { status: 500 });
  }
}

// multipart/form-data: one File per slot name, plus `summary` (JSON string)
// and optional `results` (JSON Blob).
export async function POST(request) {
  const gate = await requireNhlAdmin();
  if (gate.response) return gate.response;
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const files = {};
  for (const slot of NHL_SLOTS) {
    const f = form.get(slot);
    if (f && typeof f === 'object' && typeof f.arrayBuffer === 'function') files[slot] = f;
  }
  if (!files.season || !files.l5) {
    return Response.json({ error: 'season and l5 matchup files are required' }, { status: 400 });
  }
  let summary = {};
  try { summary = JSON.parse(form.get('summary') || '{}'); } catch {}
  let results = null;
  const rawResults = form.get('results');
  if (rawResults) {
    try {
      results = JSON.parse(typeof rawResults === 'string' ? rawResults : await rawResults.text());
    } catch { results = null; }
  }
  try {
    const run = await createRun({ files, summary, results, user: gate.user });
    return Response.json({ run }, { status: 201 });
  } catch (err) {
    console.error('[nhl] save run failed:', err);
    return Response.json({ error: 'save_failed', detail: err.message }, { status: 500 });
  }
}
