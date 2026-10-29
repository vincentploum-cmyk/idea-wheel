import { authorize } from '@/lib/nhl-data/util';
import { readJson, writeJson } from '@/lib/nhl-store';
import { resolveWeek, ensureSchedule, pullPropfinderWeek } from '@/lib/nfl/store';
import { scheduledSlotDone } from '@/lib/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PUBLIC_MIN_GAP_MS = 15 * 60 * 1000;

// ?only=schedule (ESPN: the week's games, scores and the finished games' box scores) | propfinder (the
// week's players, lines and defenses) | (default) both. Called by the admin UI and the scheduled
// workflow; anonymous calls only refresh the public ESPN data, one per 15 minutes.
async function handle(request) {
  const url = new URL(request.url);
  const auth = await authorize(request, { allowToken: true });
  const only = url.searchParams.get('only');
  // The GitHub workflow is the backstop for the server's own clock (lib/scheduler.js): a scheduled run names its
  // job and steps aside when the server already ran that slot (GitHub fires its schedules hours late).
  const job = url.searchParams.get('job');
  if (job) { const done = await scheduledSlotDone(job); if (done) return Response.json({ ok: true, skipped: `the server's scheduler ran ${job} for ${done.date} at ${done.finishedAt}` }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (!auth.ok) {
    if (only === 'propfinder') return auth.response;
    const marker = 'nfl/meta/public-refresh.json';
    const last = await readJson(marker);
    if (last?.at && Date.now() - Date.parse(last.at) < PUBLIC_MIN_GAP_MS) return Response.json({ skipped: true, reason: 'throttled', lastRun: last.at }, { status: 429 });
    await writeJson(marker, { at: new Date().toISOString() });
  }
  try {
    const wk = await resolveWeek({ date: url.searchParams.get('date') || undefined, season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
    const out = { week: wk };
    if (only !== 'propfinder') {
      const { schedule, fetched, resultsStored } = await ensureSchedule(wk, { force: true });
      out.schedule = { games: schedule?.games?.length || 0, finals: (schedule?.games || []).filter((g) => g.final).length, fetched, resultsStored };
    }
    if (auth.ok && only !== 'schedule') out.propfinder = await pullPropfinderWeek(wk, { force: url.searchParams.get('force') === '1' });
    return Response.json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nfl] refresh failed:', err);
    return Response.json({ error: 'refresh_failed', detail: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
