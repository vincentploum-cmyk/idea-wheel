import { authorize } from '@/lib/nhl-data/util';
import { resolveWeek, listSheets, ingestCheatSheet, rereadSheet, deleteSheet } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

async function weekOf(url) {
  return resolveWeek({ season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
}

// The week's cheat sheets.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const wk = await weekOf(new URL(request.url));
  return Response.json({ week: wk, sheets: await listSheets(wk) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

// Upload one or more cheat sheets (multipart `file`; optional `week`, `season`, `type`): from the UI's
// drop zone or the Mac folder sync (Bearer token). The week comes from the form, else the file's name
// (wk7 / week-7 / a date), else this week. A file with a stored name replaces it. A PDF of pictures is
// read by OCR in the background (`ocr.status` on the sheet); `?reread=<id>` parses a stored read again
// (`&full=1` runs the OCR once more).
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const reread = url.searchParams.get('reread');
  if (reread) {
    if (!/^[\w-]+$/.test(reread)) return Response.json({ error: 'bad id' }, { status: 400 });
    const wk = await weekOf(url);
    const entry = await rereadSheet(wk, reread, { full: url.searchParams.get('full') === '1' });
    if (!entry) return Response.json({ error: 'no such sheet' }, { status: 404 });
    return Response.json({ ok: !entry.error, week: wk, sheet: entry }, { status: entry.error ? 409 : 200 });
  }
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: 'expected multipart form data' }, { status: 400 }); }
  const files = form.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return Response.json({ error: 'no files' }, { status: 400 });
  const week = form.get('week') ? Number(form.get('week')) : null;
  const season = form.get('season') ? Number(form.get('season')) : null;
  const type = form.get('type') ? Number(form.get('type')) : null;
  const results = [];
  for (const f of files) {
    try {
      if (f.size > MAX_BYTES) throw new Error(`${f.name} is larger than 15 MB`);
      if (!/\.(csv|tsv|txt|xlsx|xlsm|xls|pdf)$/i.test(f.name)) throw new Error(`${f.name}: not a CSV / TSV / Excel / PDF file`);
      const buffer = Buffer.from(await f.arrayBuffer());
      results.push(await ingestCheatSheet({ buffer, fileName: f.name, week, season, type, source: auth.via === 'token' ? 'sync' : 'upload' }));
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
  const wk = await weekOf(url);
  const removed = await deleteSheet(wk, id);
  return Response.json({ ok: removed, id, week: wk }, { status: removed ? 200 : 404 });
}
