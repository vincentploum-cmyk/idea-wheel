import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { resolveSlate, ensureSchedule, pullPropfinderSlate, publicRefreshAllowed, relearnCalibration } from '@/lib/nba/store';
import { scheduledSlotDone } from '@/lib/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PUBLIC_MIN_GAP_MS = 15 * 60 * 1000;

// ?date=YYYY-MM-DD&only=schedule (ESPN: the date's games, scores and the finished games' box scores)
// | propfinder (the date's players, lines and defenses) | (default) both. Called by the admin UI and the
// scheduled workflow; anonymous calls only refresh the public ESPN data, one per 15 minutes.
async function handle(request) {
  const url = new URL(request.url);
  const auth = await authorize(request, { allowToken: true });
  const only = url.searchParams.get('only');
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });
  // The GitHub workflow is the backstop for the server's own clock (lib/scheduler.js): a scheduled run names its
  // job and steps aside when the server already ran that slot (GitHub fires its schedules hours late).
  const job = url.searchParams.get('job');
  if (job) { const done = await scheduledSlotDone(job); if (done) return Response.json({ ok: true, skipped: `the server's scheduler ran ${job} for ${done.date} at ${done.finishedAt}` }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (!auth.ok) {
    if (only === 'propfinder') return auth.response;
    const gate = await publicRefreshAllowed(PUBLIC_MIN_GAP_MS);
    if (!gate.ok) return Response.json({ skipped: true, reason: 'throttled', lastRun: gate.lastRun }, { status: 429 });
  }
  try {
    const slate = await resolveSlate({ date });
    const out = { slate };
    if (only !== 'propfinder') {
      const { schedule, fetched, resultsStored } = await ensureSchedule(slate, { force: true });
      out.schedule = { games: schedule?.games?.length || 0, finals: (schedule?.games || []).filter((g) => g.final).length, fetched, resultsStored };
      // New box scores: the season's scorecard graded again in the background, the board's calibration learned from it.
      if (resultsStored) relearnCalibration().catch((err) => console.warn('[nba] calibration relearn failed:', err.message));
    }
    if (auth.ok && only !== 'schedule') out.propfinder = await pullPropfinderSlate(slate, { force: url.searchParams.get('force') === '1' });
    return Response.json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[nba] refresh failed:', err);
    return Response.json({ error: 'refresh_failed', detail: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
