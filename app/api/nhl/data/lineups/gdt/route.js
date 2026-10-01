import { ingestGdtPages } from '@/lib/nhl-data/ingest';
import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GameDayTweets pages fetched by the GitHub Actions runner (tools/gdt-pages.sh), posted
// with the automation token: { date, pages: { ABBR: html } }. The site refuses this
// server's own requests, so the lines arrive this way and are parsed here as usual.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  // JSON { date, pages: { ABBR: html } } (GitHub Actions) or a multipart form with `date`
  // and one file field per team code (the Mac sync: curl -F PHI=@PHI.html …).
  let date;
  let pages = {};
  try {
    if (/multipart\/form-data/i.test(request.headers.get('content-type') || '')) {
      const form = await request.formData();
      date = form.get('date');
      for (const [key, value] of form.entries()) {
        if (/^[A-Z]{3}$/.test(key) && value && typeof value.text === 'function') pages[key] = await value.text();
      }
    } else {
      const body = await request.json();
      date = body?.date;
      pages = body?.pages && typeof body.pages === 'object' ? body.pages : {};
    }
  } catch { return Response.json({ error: 'expected JSON { date, pages } or a multipart form' }, { status: 400 }); }
  date = date || todayET();
  if (!DATE_RE.test(String(date))) return Response.json({ error: 'bad date' }, { status: 400 });
  if (!Object.keys(pages).length) return Response.json({ error: 'no pages' }, { status: 400 });
  try {
    const result = await ingestGdtPages(date, pages);
    return Response.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] gdt pages failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
