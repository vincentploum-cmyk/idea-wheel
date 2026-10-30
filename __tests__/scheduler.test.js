import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { JOBS, jobById, etInstant, etParts, latestSlot, nextSlot, callsFor, dueOf, slotDoneIn, RETRY_AFTER_MS } from '../lib/schedule-jobs';

// The scheduler's state lives in the store; an in-memory stand-in. With `mockLag.reads` set, the
// reads right after a write hand back the copy from before it, as Supabase Storage did on 2026-10-30.
const mockFiles = new Map();
const mockLag = { reads: 0, prev: new Map(), left: new Map() };
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => {
    const left = mockLag.left.get(path) || 0;
    if (left > 0) { mockLag.left.set(path, left - 1); const old = mockLag.prev.get(path); return old == null ? null : JSON.parse(old); }
    return mockFiles.has(path) ? JSON.parse(mockFiles.get(path)) : null;
  },
  writeJson: async (path, value) => {
    if (mockLag.reads) { mockLag.prev.set(path, mockFiles.get(path) ?? null); mockLag.left.set(path, mockLag.reads); }
    mockFiles.set(path, JSON.stringify(value));
  },
}));
const { STATE_PATH, mergeStates } = require('../lib/scheduler');
/** A fresh scheduler module (its own records), as a new server process has. */
const freshScheduler = () => { let m; jest.isolateModules(() => { m = require('../lib/scheduler'); }); return m; };

const job = (id) => jobById(id);
const iso = (s) => new Date(s);

describe('the jobs’ clock, in Eastern time', () => {
  test('an ET wall-clock time lands on the right instant either side of the November change', () => {
    expect(etInstant('2026-10-29', 9, 47).toISOString()).toBe('2026-10-29T13:47:00.000Z');   // EDT, UTC-4
    expect(etInstant('2026-11-02', 9, 47).toISOString()).toBe('2026-11-02T14:47:00.000Z');   // EST, UTC-5
    expect(etInstant('2026-11-01', 0, 41).toISOString()).toBe('2026-11-01T04:41:00.000Z');   // before 2 AM the change has not happened
    expect(etParts(iso('2026-10-29T23:27:00Z'))).toMatchObject({ date: '2026-10-29', hour: 19, minute: 27, weekday: 4 });
  });
  test('the latest and next slot of a job', () => {
    const now = iso('2026-10-29T19:12:00Z');   // 3:12 PM ET, when GitHub ran the 9:47 AM pull
    expect(latestSlot(job('nba-morning'), now)).toEqual({ at: iso('2026-10-29T13:47:00Z'), date: '2026-10-29' });
    expect(latestSlot(job('nba-pregame'), now)).toEqual({ at: iso('2026-10-28T21:23:00Z'), date: '2026-10-28' });
    expect(nextSlot(job('nba-pregame'), now)).toEqual({ at: iso('2026-10-29T21:23:00Z'), date: '2026-10-29' });
    // The NFL's late run is Monday, Tuesday and Friday only (Thursday 2026-10-29 → Tuesday the 27th).
    expect(latestSlot(job('nfl-late'), now).date).toBe('2026-10-27');
    expect(nextSlot(job('nfl-late'), now).at.toISOString()).toBe('2026-10-30T04:41:00.000Z');
  });
  test('each run calls the routes the workflows call, for the slot’s ET date', () => {
    expect(callsFor(job('nba-morning'), '2026-10-29')).toEqual(['/api/nba/refresh?date=2026-10-28&only=schedule', '/api/nba/refresh?date=2026-10-29&only=schedule', '/api/nba/refresh?date=2026-10-29&only=propfinder']);
    expect(callsFor(job('nba-overnight'), '2026-10-30')).toEqual(['/api/nba/refresh?date=2026-10-29&only=schedule']);
    expect(callsFor(job('nhl-morning'), '2026-10-29')).toEqual(['/api/nhl/data/refresh?date=2026-10-29&only=propfinder', '/api/nhl/data/refresh?date=2026-10-29']);
    expect(callsFor(job('nhl-late'), '2026-10-30')).toEqual(['/api/nhl/data/refresh?date=2026-10-29']);
    expect(callsFor(job('nfl-morning'), '2026-10-29')).toEqual(['/api/nfl/refresh?date=2026-10-29&only=schedule', '/api/nfl/refresh?date=2026-10-29&only=propfinder']);
    expect(JOBS.map((j) => j.id)).toEqual(['nhl-morning', 'nhl-late', 'nfl-morning', 'nfl-late', 'nba-morning', 'nba-pregame', 'nba-overnight']);
  });
  test('due once a slot, within its catch-up window, a failure tried again once', () => {
    const j = job('nba-morning');
    const slot = '2026-10-29T13:47:00.000Z';
    expect(dueOf(j, null, iso('2026-10-29T13:46:00Z'))?.slot).not.toBe(slot);            // not yet: yesterday's slot is past its window
    expect(dueOf(j, null, iso('2026-10-29T13:46:00Z'))).toBeNull();
    expect(dueOf(j, null, iso('2026-10-29T13:48:00Z'))).toEqual({ slot, date: '2026-10-29', attempt: 1 });
    expect(dueOf(j, { slot, ok: true, attempts: 1, startedAt: slot }, iso('2026-10-29T14:30:00Z'))).toBeNull();
    const failed = { slot, ok: false, attempts: 1, startedAt: '2026-10-29T13:48:00.000Z' };
    expect(dueOf(j, failed, iso('2026-10-29T13:55:00Z'))).toBeNull();                      // too soon to try again
    expect(dueOf(j, failed, new Date(Date.parse(failed.startedAt) + RETRY_AFTER_MS))).toEqual({ slot, date: '2026-10-29', attempt: 2 });
    expect(dueOf(j, { ...failed, attempts: 2 }, iso('2026-10-29T15:00:00Z'))).toBeNull();
    // A server down at the slot catches up within the window (a deploy), not after it.
    expect(dueOf(j, null, iso('2026-10-29T17:40:00Z'))?.attempt).toBe(1);
    expect(dueOf(j, null, iso('2026-10-29T17:50:00Z'))).toBeNull();
    // The pre-game pull never runs more than an hour late: games start soon after.
    expect(dueOf(job('nba-pregame'), null, iso('2026-10-29T22:20:00Z'))?.attempt).toBe(1);
    expect(dueOf(job('nba-pregame'), null, iso('2026-10-29T22:30:00Z'))).toBeNull();
  });
  test('the backstop sees a slot the server ran well, and only that slot', () => {
    const state = { jobs: { 'nba-morning': { slot: '2026-10-29T13:47:00.000Z', date: '2026-10-29', ok: true, finishedAt: '2026-10-29T13:49:00.000Z' } } };
    expect(slotDoneIn(state, 'nba-morning', iso('2026-10-29T19:12:00Z'))).toMatchObject({ date: '2026-10-29' });
    expect(slotDoneIn(state, 'nba-morning', iso('2026-10-30T19:12:00Z'))).toBeNull();      // the next day's slot is not done
    expect(slotDoneIn({ jobs: { 'nba-morning': { ...state.jobs['nba-morning'], ok: false } } }, 'nba-morning', iso('2026-10-29T19:12:00Z'))).toBeNull();
    expect(slotDoneIn(state, 'no-such-job', iso('2026-10-29T19:12:00Z'))).toBeNull();
  });
});

describe('the runner', () => {
  beforeEach(() => { mockFiles.clear(); mockLag.reads = 0; mockLag.prev.clear(); mockLag.left.clear(); jest.useRealTimers(); });
  const quiet = { log: () => {}, error: () => {} };

  test('runs a due job’s calls in order with the token, records it, and does not run it twice', async () => {
    const seen = [];
    global.fetch = jest.fn(async (url, opts) => { seen.push([url, opts.method, opts.headers.Authorization]); return { ok: true, status: 200, text: async () => '{"ok":true}' }; });
    const { tick, scheduledSlotDone } = freshScheduler();
    const now = () => iso('2026-10-29T13:48:00Z');
    // At 9:48 AM ET the three morning jobs are due (9:17, 9:33, 9:47), one after the other; the late and
    // overnight runs are past their windows.
    await tick({ base: 'http://127.0.0.1:3000', token: 'tok', log: quiet, now });
    expect(seen).toEqual([
      ['http://127.0.0.1:3000/api/nhl/data/refresh?date=2026-10-29&only=propfinder', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nhl/data/refresh?date=2026-10-29', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nfl/refresh?date=2026-10-29&only=schedule', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nfl/refresh?date=2026-10-29&only=propfinder', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nba/refresh?date=2026-10-28&only=schedule', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nba/refresh?date=2026-10-29&only=schedule', 'POST', 'Bearer tok'],
      ['http://127.0.0.1:3000/api/nba/refresh?date=2026-10-29&only=propfinder', 'POST', 'Bearer tok'],
    ]);
    const rec = JSON.parse(mockFiles.get(STATE_PATH)).jobs['nba-morning'];
    expect(rec).toMatchObject({ slot: '2026-10-29T13:47:00.000Z', date: '2026-10-29', ok: true, attempts: 1 });
    expect(rec.calls.map((c) => c.status)).toEqual([200, 200, 200]);
    await tick({ base: 'http://127.0.0.1:3000', token: 'tok', log: quiet, now });
    expect(seen).toHaveLength(7);
    expect(await scheduledSlotDone('nba-morning', iso('2026-10-29T19:12:00Z'))).toMatchObject({ ok: true });
  }, 15000);

  test('a failed call marks the run failed, so it is tried again later and the backstop does not skip', async () => {
    global.fetch = jest.fn(async (url) => (url.includes('propfinder') ? { ok: false, status: 500, text: async () => 'boom' } : { ok: true, status: 200, text: async () => '{}' }));
    const { tick, scheduledSlotDone } = freshScheduler();
    await tick({ base: 'http://x', token: 'tok', log: quiet, now: () => iso('2026-10-29T13:48:00Z') });
    const rec = JSON.parse(mockFiles.get(STATE_PATH)).jobs['nba-morning'];
    expect(rec.ok).toBe(false);
    expect(rec.calls.at(-1)).toMatchObject({ status: 500, ok: false, reply: 'boom' });
    expect(await scheduledSlotDone('nba-morning', iso('2026-10-29T19:12:00Z'))).toBeNull();
  }, 15000);

  test('a store that hands back the copy from before a write neither delays a job nor wipes the one before it (2026-10-30)', async () => {
    mockLag.reads = 3;
    const seen = [];
    global.fetch = jest.fn(async (url) => { seen.push(url.replace('http://x', '')); return { ok: true, status: 200, text: async () => '{}' }; });
    const { tick } = freshScheduler();
    // 12:42 AM ET on a Friday: the NHL and NFL late runs are both due, one after the other.
    await tick({ base: 'http://x', token: 'tok', log: quiet, now: () => iso('2026-10-30T04:42:00Z') });
    expect(seen).toEqual(['/api/nhl/data/refresh?date=2026-10-29', '/api/nfl/refresh?date=2026-10-29&only=schedule']);   // each on its first attempt
    const jobs = JSON.parse(mockFiles.get(STATE_PATH)).jobs;
    expect(jobs['nhl-late']).toMatchObject({ ok: true, attempts: 1, date: '2026-10-30' });   // not wiped by the NFL run's write
    expect(jobs['nfl-late']).toMatchObject({ ok: true, attempts: 1 });
    // A minute later nothing runs again.
    await tick({ base: 'http://x', token: 'tok', log: quiet, now: () => iso('2026-10-30T04:43:00Z') });
    expect(seen).toHaveLength(2);
  }, 15000);

  test('two copies of the state merge job by job, the newer record kept', () => {
    const a = { jobs: { x: { startedAt: '2026-10-30T04:41:00Z', ok: false }, y: { finishedAt: '2026-10-30T05:00:00Z', ok: true } } };
    const b = { jobs: { x: { startedAt: '2026-10-30T04:41:00Z', finishedAt: '2026-10-30T04:43:00Z', ok: true }, y: { startedAt: '2026-10-29T05:00:00Z', ok: false } } };
    expect(mergeStates(a, b).jobs).toEqual({ x: b.jobs.x, y: a.jobs.y });
  });
});
