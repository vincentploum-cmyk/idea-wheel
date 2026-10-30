import { authorize } from '@/lib/nhl-data/util';
import { schedulerState } from '@/lib/scheduler';
import { JOBS, latestSlot, nextSlot, dueOf } from '@/lib/schedule-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The data jobs' clock (lib/scheduler.js): per job its time (ET), its last and next slot, and what the
// server's last run of it did (the calls with their status and the first characters of each reply).
export async function GET(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const now = new Date();
  const state = await schedulerState();
  const jobs = JOBS.map((job) => {
    const rec = state.jobs?.[job.id] || null;
    const last = latestSlot(job, now);
    const next = nextSlot(job, now);
    return {
      id: job.id, at: `${job.at} ET`, days: job.days || null,
      lastSlot: last?.at.toISOString() || null, nextSlot: next?.at.toISOString() || null,
      ranLastSlot: !!rec && rec.slot === last?.at.toISOString(), due: !!dueOf(job, rec, now), run: rec,
    };
  });
  return Response.json({ now: now.toISOString(), enabled: process.env.SCHEDULER !== 'off', jobs }, { headers: { 'Cache-Control': 'no-store' } });
}
