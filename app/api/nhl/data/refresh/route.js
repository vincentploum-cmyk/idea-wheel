import { dailyRefresh, ingestGames, ingestLineups, restampPositions, stampFirstGoals } from '@/lib/nhl-data/ingest';
import { pullPropfinder, propfinderConfigured } from '@/lib/nhl-data/propfinder-api';
import { dispatchLinesWorkflow } from '@/lib/nhl-data/github-dispatch';
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
  const only = url.searchParams.get('only'); // games | lineups (&due=<minutes>: only games starting within that window) | settle (a played date: previews' last update + re-stamp) | restamp (stored games follow the snapshot) | firstgoals (stored games get their first goal) | propfinder | (default) daily
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });

  if (!auth.ok) {
    // One anonymous call per 15 minutes per mode, so the schedule can run the PropFinder
    // pull and the daily refresh back to back (each is its own request and memory peak).
    const marker = `data/meta/public-refresh${only ? `-${only}` : ''}.json`;
    const last = await readJson(marker);
    if (last?.at && Date.now() - Date.parse(last.at) < PUBLIC_MIN_GAP_MS) {
      return Response.json({ skipped: true, reason: 'throttled', lastRun: last.at }, { status: 429 });
    }
    await writeJson(marker, { at: new Date().toISOString() });
  }

  try {
    let result;
    if (only === 'games') result = await ingestGames(date, { force: url.searchParams.get('force') === '1' });
    else if (only === 'lineups') {
      // The admin UI's "Refresh lines" also starts the GitHub run that fetches the GameDayTweets
      // pages this server is refused (and then reads every 15 minutes through each warm-up window). Never from the
      // runner's own token calls, and at most once a minute. Started first, so the pages are on their
      // way while NHL.com is read and the model runs (which can outlive the gateway's 100 s).
      let dispatch = null;
      if (auth.via === 'session' && url.searchParams.get('dispatch') === '1') {
        const marker = 'data/meta/gdt-dispatch.json';
        const last = await readJson(marker);
        if (last?.at && Date.now() - Date.parse(last.at) < 60 * 1000) dispatch = { ok: false, skipped: `already requested at ${last.at}` };
        else {
          dispatch = await dispatchLinesWorkflow({ date, due: null, chain: 40 });
          if (dispatch.ok) await writeJson(marker, { at: dispatch.at, date });
        }
      }
      // The admin UI asks for the read in the background (`background=1`): the reply comes at once and
      // the read, the re-stamp and the model run go on in this process (Render keeps it alive), so the
      // gateway's 100-second limit never cuts the reply. The panel watches the slate for the result.
      if (auth.via === 'session' && url.searchParams.get('background') === '1') {
        const startedAt = new Date().toISOString();
        ingestLineups(date, { dueWithinMin: null })
          .then((r) => console.log(`[nhl-data] background lineup read for ${date} done: ${r.withLineups}/${r.scheduled} lineups, ${r.gamedaytweets} GDT, model ${r.model?.ran ? 'ran' : r.model?.skipped || r.model?.error || 'n/a'}`))
          .catch((e) => console.error(`[nhl-data] background lineup read for ${date} failed:`, e));
        return Response.json({ ok: true, started: true, startedAt, result: { dispatch } }, { headers: { 'Cache-Control': 'no-store' } });
      }
      result = await ingestLineups(date, { dueWithinMin: Number(url.searchParams.get('due')) || null });
      if (dispatch) result.dispatch = dispatch;
    }
    else if (only === 'settle') result = await ingestLineups(date, { settle: true });
    else if (only === 'restamp') result = await restampPositions(date);
    else if (only === 'firstgoals') result = await stampFirstGoals(date);
    else if (only === 'propfinder') result = propfinderConfigured() && date >= todayET() ? await pullPropfinder(date) : { ok: false, skipped: propfinderConfigured() ? 'past date' : 'PropFinder credentials are not configured' };
    else result = await dailyRefresh(date);
    return Response.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nhl-data] refresh failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
