// The site's own clock for the daily data jobs (lib/schedule-jobs.js): started once per server
// process by instrumentation.js, it checks every minute which job is due and runs it by calling
// the site's own refresh routes on localhost with NHL_ACTIONS_TOKEN, exactly as the GitHub
// workflows call them from outside, so a refresh takes the one path it always took. One job at a
// time (a PropFinder pull and a model run each need most of the instance's memory). Each run is
// recorded in meta/scheduler.json, read past the cache, so a restart neither repeats a slot nor
// loses one within its catch-up window, and the workflows (the backstop, `job=<id>`) can see a slot
// the server already ran. Written only when a job runs, never on a tick: a write bumps the store's
// revision and drops the per-state builds.
import { readJson, writeJson } from './nhl-store';
import { JOBS, dueOf, callsFor, slotDoneIn } from './schedule-jobs';

export const STATE_PATH = 'meta/scheduler.json';
const TICK_MS = 60 * 1000;
const FIRST_TICK_MS = 45 * 1000;          // the server is listening by then
const CALL_TIMEOUT_MS = 9 * 60 * 1000;
const CLAIM_SETTLE_MS = 2000;             // two processes overlapping in a deploy: the second claim wins, the first steps aside

const OWNER = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

const readState = async () => (await readJson(STATE_PATH, { fresh: true })) || { jobs: {} };

async function patchJob(id, rec) {
  const state = await readState();
  await writeJson(STATE_PATH, { ...state, jobs: { ...(state.jobs || {}), [id]: rec } });
}

/** The backstop's question: did the server run this job's latest slot, and run it well? */
export async function scheduledSlotDone(id, now = new Date()) {
  try { return slotDoneIn(await readState(), id, now); } catch { return null; }
}

/** What the scheduler has run, for the admin route. */
export async function schedulerState() {
  return readState();
}

async function call(base, token, path) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    const text = await res.text();
    return { path, status: res.status, ms: Date.now() - started, ok: res.ok, reply: text.slice(0, 400) };
  } catch (err) {
    return { path, status: 0, ms: Date.now() - started, ok: false, reply: String(err?.message || err).slice(0, 400) };
  }
}

async function runJob(job, due, { base, token, log }) {
  const startedAt = new Date().toISOString();
  await patchJob(job.id, { slot: due.slot, date: due.date, attempts: due.attempt, startedAt, owner: OWNER, ok: false, running: true });
  await new Promise((r) => setTimeout(r, CLAIM_SETTLE_MS));
  if ((await readState()).jobs?.[job.id]?.owner !== OWNER) { log.log(`[scheduler] ${job.id} ${due.date}: claimed by another process, skipped`); return; }
  log.log(`[scheduler] ${job.id} for ${due.date} (attempt ${due.attempt}) started`);
  const calls = [];
  for (const path of callsFor(job, due.date)) {
    calls.push(await call(base, token, path));
    globalThis.gc?.();
  }
  const ok = calls.every((c) => c.ok);
  await patchJob(job.id, { slot: due.slot, date: due.date, attempts: due.attempt, startedAt, finishedAt: new Date().toISOString(), owner: OWNER, ok, calls });
  log[ok ? 'log' : 'error'](`[scheduler] ${job.id} for ${due.date} ${ok ? 'done' : 'failed'}: ${calls.map((c) => `${c.status} ${Math.round(c.ms / 1000)}s ${c.path}`).join(' · ')}`);
}

let running = false;

/** One look at the clock: every due job, one after the other. */
export async function tick({ base, token, log = console, now = () => new Date() } = {}) {
  if (running) return;
  running = true;
  try {
    for (const job of JOBS) {
      const state = await readState();
      const due = dueOf(job, state.jobs?.[job.id], now());
      if (due) await runJob(job, due, { base, token, log });
    }
  } catch (err) {
    log.error('[scheduler] tick failed:', err);
  } finally {
    running = false;
  }
}

/** Starts the clock once per process (instrumentation.js). */
export function startScheduler({ log = console } = {}) {
  if (globalThis.__ideaScheduler) return globalThis.__ideaScheduler;
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  const token = process.env.NHL_ACTIONS_TOKEN || null;
  if (!token) log.error('[scheduler] NHL_ACTIONS_TOKEN is not set: the PropFinder pulls will be refused (the schedule refreshes still run)');
  const run = () => { tick({ base, token, log }); };
  const first = setTimeout(run, FIRST_TICK_MS);
  const every = setInterval(run, TICK_MS);
  first.unref?.(); every.unref?.();
  globalThis.__ideaScheduler = { startedAt: new Date().toISOString(), owner: OWNER, base, jobs: JOBS.map((j) => j.id) };
  log.log(`[scheduler] started (${OWNER}): ${JOBS.map((j) => `${j.id} ${j.at} ET`).join(', ')}`);
  return globalThis.__ideaScheduler;
}
