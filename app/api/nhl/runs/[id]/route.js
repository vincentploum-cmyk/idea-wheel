import {
  requireNhlAdmin, isValidRunId, getRun, getRunResults, addRunFiles, deleteRun, NHL_SLOTS,
} from '@/lib/nhl-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(params) {
  const gate = await requireNhlAdmin();
  if (gate.response) return gate;
  if (!isValidRunId(params?.id)) return { response: Response.json({ error: 'bad run id' }, { status: 400 }) };
  return gate;
}

export async function GET(request, { params }) {
  const gate = await guard(params);
  if (gate.response) return gate.response;
  const run = await getRun(params.id);
  if (!run) return Response.json({ error: 'not_found' }, { status: 404 });
  const withResults = new URL(request.url).searchParams.get('results') === '1';
  const results = withResults ? await getRunResults(params.id) : undefined;
  return Response.json({ run, results }, { headers: { 'Cache-Control': 'no-store' } });
}

// Attach extra inputs to an existing run (e.g. next-day box scores for audit).
export async function PATCH(request, { params }) {
  const gate = await guard(params);
  if (gate.response) return gate.response;
  let form;
  try { form = await request.formData(); } catch {
    return Response.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const files = {};
  for (const slot of NHL_SLOTS) {
    const f = form.get(slot);
    if (f && typeof f === 'object' && typeof f.arrayBuffer === 'function') files[slot] = f;
  }
  if (!Object.keys(files).length) return Response.json({ error: 'no files' }, { status: 400 });
  try {
    const run = await addRunFiles(params.id, files);
    if (!run) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ run });
  } catch (err) {
    console.error('[nhl] attach files failed:', err);
    return Response.json({ error: 'save_failed', detail: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const gate = await guard(params);
  if (gate.response) return gate.response;
  try {
    await deleteRun(params.id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[nhl] delete run failed:', err);
    return Response.json({ error: 'delete_failed', detail: err.message }, { status: 500 });
  }
}
