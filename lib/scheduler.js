// The site's own clock for the daily data jobs (lib/schedule-jobs.js): started once per server
// process by instrumentation.js, it checks every minute which job is due and runs it by calling
// the site's own refresh routes on localhost with NHL_ACTIONS_TOKEN, exactly as the GitHub
// workflows call them from outside, so a refresh takes the one path it always took. One job at a
// time (a PropFinder pull and a model run each need most of the instance's memory). Each run is
// recorded in meta/scheduler.json, read past the cache, so a restart neither repeats a slot nor
// loses one within its catch-up window, and the workflows (the backstop, `job=<id>`) can see a slot
// the server already ran. Written only when a job runs, never on a tick: a write bumps the store's
// revision and drops the per-state builds.
//
// What this process wrote is the truth for it (`local`): storage can hand back the copy from before
// a write for a while, even read past the cache. On 2026-10-30 that stale copy made the scheduler
// step aside from its own claim (it re-read the file two seconds after writing it, saw the previous
// owner, and left the slot to the 15-minute retry: four jobs ran 16 minutes late), and the NFL late
// run's write, built on a copy read seconds after the NHL late run finished, wiped the NHL record,
// so the backstop ran that job again at 7 AM. Records now merge by time, the newer one kept, and the
// claim's re-read is gone: Render runs one instance, and a slot run twice in a deploy's overlap is
// one extra refresh.
import { readJson, writeJson } from './nhl-store';
import { JOBS, dueOf, callsFor, slotDoneIn } from './schedule-jobs';

export const STATE_PATH = 'meta/scheduler.json';
const TICK_MS = 60 * 1000;
const FIRST_TICK_MS = 45 * 1000;          // the server is listening by then
const CALL_TIMEOUT_MS = 9 * 60 * 1000;

const OWNER = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

/** The records this process wrote, job id → record: never older than what storage hands back. */
const local = {};

/** A record's time: when it finished, else when it started. */
const stampOf = (rec) => Date.parse(rec?.finishedAt || rec?.startedAt || '') || 0;

/** Two copies of the state merged job by job, the newer record kept. */
export function mergeStates(a, b) {
  const jobs = { ...(a?.jobs || {}) };
  for (const [id, rec] of Object.entries(b?.jobs || {})) if (!jobs[id] || stampOf(rec) >= stampOf(jobs[id])) jobs[id] = rec;
  return { ...(a || {}), ...(b || {}), jobs };
}

const readState = async () => mergeStates((await readJson(STATE_PATH, { fresh: true })) || { jobs: {} }, { jobs: local });

async function patchJob(id, rec) {
  local[id] = rec;
  await writeJson(STATE_PATH, await readState());
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
