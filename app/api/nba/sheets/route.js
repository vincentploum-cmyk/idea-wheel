import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, listSheets, ingestCheatSheet, deleteSheet } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

// The date's cheat sheets.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const slate = await resolveSlate({ date: new URL(request.url).searchParams.get('date') });
  return Response.json({ slate, sheets: await listSheets(slate) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

// Upload one or more cheat sheets (multipart `file`; optional `date`): from the UI's drop zone or the
// Mac folder sync (Bearer token). The date comes from the form, else the file's name, else today (ET).
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'expected multipart form data' }, { status: 400 }); }
  const files = form.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return Response.json({ error: 'no files' }, { status: 400 });
  const date = form.get('date') ? String(form.get('date')) : null;
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  const results = [];
  for (const f of files) {
    try {
      if (f.size > MAX_BYTES) throw new Error(`${f.name} is larger than 15 MB`);
      if (!/\.(csv|tsv|txt|xlsx|xlsm|xls|pdf)$/i.test(f.name)) throw new Error(`${f.name}: not a CSV / TSV / Excel / PDF file`);
      const buffer = Buffer.from(await f.arrayBuffer());
      results.push(await ingestCheatSheet({ buffer, fileName: f.name, date, source: auth.via === 'token' ? 'sync' : 'upload' }));
    } catch (err) {
      results.push({ ok: false, fileName: f.name, error: err.message });
    }
  }
  const ok = results.some((r) => r.ok);
  return Response.json({ ok, results }, { status: ok ? 200 : 422 });
}

export async function DELETE(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id || !/^[\w-]+$/.test(id)) return Response.json({ error: 'bad id' }, { status: 400 });
  const slate = await resolveSlate({ date: url.searchParams.get('date') });
  const removed = await deleteSheet(slate, id);
  return Response.json({ ok: removed, id, slate }, { status: removed ? 200 : 404 });
}
