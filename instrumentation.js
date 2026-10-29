// Runs once when the server starts (Next's instrumentation hook): the data jobs' clock,
// lib/scheduler.js. Production server only: not in `next dev`, not during `next build`, and
// off when SCHEDULER=off (the GitHub workflows then run the jobs on their own, late or not).
// The import sits inside the NEXT_RUNTIME check, Next's documented form: the hook is also
// compiled for the edge runtime, which has no fs or zlib, and drops the block there.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const off = process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build' || process.env.SCHEDULER === 'off';
    if (!off) {
      const { startScheduler } = await import('./lib/scheduler');
      startScheduler();
    }
  }
}
