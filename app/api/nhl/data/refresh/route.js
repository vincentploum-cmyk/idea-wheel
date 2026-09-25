import { dailyRefresh, ingestGames, ingestLineups } from '@/lib/nhl-data/ingest';
import { authorize, todayET, DATE_RE } from '@/lib/nhl-data/util';
import { readJson, writeJson } from '@/lib/nhl-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PUBLIC_MIN_GAP_MS = 15 * 60 * 1000;

// Called by the scheduled GitHub workflow (no secret: it only pulls public NHL
// data, so anonymous calls are allowed but throttled) and by the admin UI.
async function handle(request) {
  const url = new URL(request.url);
  const auth = await authorize(request, { allowToken: true });
  const date = url.searchParams.get('date') || todayET();
  const only = url.searchParams.get('only'); // games | lineups | (default) daily
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });

  if (!auth.ok) {
    const last = await readJson('data/meta/public-refresh.json');
    if (last?.at && Date.now() - Date.parse(last.at) < PUBLIC_MIN_GAP_MS) {
      return Response.json({ skipped: true, reason: 'throttled', lastRun: last.at }, { status: 429 });
    }
    await writeJson('data/meta/public-refresh.json', { at: new Date().toISOString() });
  }

  try {
    let result;
    if (only === 'games') result = await ingestGames(date, { force: url.searchParams.get('force') === '1' });
    else if (only === 'lineups') result = await ingestLineups(date);
    else result = await dailyRefresh(date);
    return Response.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] refresh failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
