import { ingestMatchupFile } from '@/lib/nhl-data/matchups';
import { authorize, DATE_RE } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PropFinder matchup workbooks from the Mac folder sync (Bearer token) or the UI.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  let form;
  try { form = await request.formData(); } catch {
    return Response.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const date = form.get('date');
  if (date && !DATE_RE.test(String(date))) return Response.json({ error: 'bad date' }, { status: 400 });
  const files = form.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return Response.json({ error: 'no files' }, { status: 400 });
  const results = [];
  for (const f of files) {
    try {
      const buffer = Buffer.from(await f.arrayBuffer());
      results.push({ file: f.name, ...(await ingestMatchupFile({ buffer, fileName: f.name, date: date || null, source: auth.via })) });
    } catch (err) {
      results.push({ file: f.name, error: err.message });
    }
  }
  const ok = results.some((r) => !r.error);
  return Response.json({ ok, results }, { status: ok ? 200 : 422 });
}
