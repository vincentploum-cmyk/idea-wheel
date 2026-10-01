import { ingestMatchupFile } from '@/lib/nhl-data/matchups';
import { ingestPropfinderCsv } from '@/lib/nhl-data/propfinder';
import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { autoRunModel } from '@/lib/nhl-data/autorun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PropFinder files from the Mac folder sync (Bearer token) or the UI: matchup
// workbooks (.xlsx) and the skater / team stats CSV exports.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  let form;
  try { form = await request.formData(); } catch {
    return Response.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const date = form.get('date');
  const importMode = form.get('mode') === 'import';
  if (date && !DATE_RE.test(String(date))) return Response.json({ error: 'bad date' }, { status: 400 });
  const files = form.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return Response.json({ error: 'no files' }, { status: 400 });
  const results = [];
  for (const f of files) {
    try {
      const buffer = Buffer.from(await f.arrayBuffer());
      const source = importMode ? 'import' : auth.via;
      const result = /\.csv$/i.test(f.name)
        ? await ingestPropfinderCsv({ buffer, fileName: f.name, source })
        : await ingestMatchupFile({ buffer, fileName: f.name, date: date || null, source });
      results.push({ file: f.name, ...result });
    } catch (err) {
      results.push({ file: f.name, error: err.message });
    }
  }
  const ok = results.some((r) => !r.error);
  // A matchup workbook for today or a coming slate: run the model if the lines are already in.
  const model = {};
  for (const d of [...new Set(results.filter((r) => !r.error && r.kind && r.date >= todayET()).map((r) => r.date))]) {
    model[d] = await autoRunModel(d).catch((err) => ({ ran: false, error: String(err?.message || err) }));
  }
  return Response.json({ ok, results, model }, { status: ok ? 200 : 422 });
}
