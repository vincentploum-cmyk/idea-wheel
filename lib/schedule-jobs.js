// The daily data jobs on the site's own clock (Eastern time), pure: what runs when and which
// refresh routes each run calls. lib/scheduler.js runs them inside the server; the GitHub
// workflows stay as a backstop and pass `job=<id>` so a slot the server already ran is skipped.
//
// Why (2026-10-29): GitHub fires scheduled workflows hours late on busy days. That day the NBA
// 9:47 AM pull ran at 3:12 PM, the 5:23 PM pre-game pull of the 28th at 9:01 PM (after tip-off),
// the NFL 9:33 AM pull at 3:10 PM and the NHL 9:17 AM run at 2:57 PM.
//
// A job: { id, at: 'HH:MM' ET, days: ET weekdays (0 = Sunday, all when absent), catchUp: how long
// after its slot a missed run (a restart, a deploy) still runs, calls({ today, yesterday }) → the
// paths, called in order; `today` is the slot's ET date }.

const H = 3600 * 1000;
const M = 60 * 1000;

export const JOBS = [
  // NHL: PropFinder first, as its own request (the pull and the model run each need most of the
  // instance's memory), then the daily refresh (yesterday's games, today's lineups, the model run).
  { id: 'nhl-morning', at: '09:17', catchUp: 4 * H, calls: ({ today }) => [`/api/nhl/data/refresh?date=${today}&only=propfinder`, `/api/nhl/data/refresh?date=${today}`] },
  // The late finals belong to the previous ET day.
  { id: 'nhl-late', at: '00:41', catchUp: 6 * H, calls: ({ yesterday }) => [`/api/nhl/data/refresh?date=${yesterday}`] },
  // NFL: the week's schedule and scores, then the PropFinder pull.
  { id: 'nfl-morning', at: '09:33', catchUp: 4 * H, calls: ({ today }) => [`/api/nfl/refresh?date=${today}&only=schedule`, `/api/nfl/refresh?date=${today}&only=propfinder`] },
  // Sunday, Monday and Thursday night finals.
  { id: 'nfl-late', at: '00:41', days: [1, 2, 5], catchUp: 6 * H, calls: ({ yesterday }) => [`/api/nfl/refresh?date=${yesterday}&only=schedule`] },
  // NBA: last night settled first (finals, box scores), then tonight's schedule and the pull.
  { id: 'nba-morning', at: '09:47', catchUp: 4 * H, calls: ({ today, yesterday }) => [`/api/nba/refresh?date=${yesterday}&only=schedule`, `/api/nba/refresh?date=${today}&only=schedule`, `/api/nba/refresh?date=${today}&only=propfinder`] },
  // Lines and logs again before tip-off; an hour late at most, so a pull never lands after the games
  // start and replaces their pre-game lines.
  { id: 'nba-pregame', at: '17:23', catchUp: 1 * H, calls: ({ today }) => [`/api/nba/refresh?date=${today}&only=schedule`, `/api/nba/refresh?date=${today}&only=propfinder`] },
  // Last night's finals and box scores; no pull for a played date.
  { id: 'nba-overnight', at: '02:11', catchUp: 6 * H, calls: ({ yesterday }) => [`/api/nba/refresh?date=${yesterday}&only=schedule`] },
];

export const jobById = (id) => JOBS.find((j) => j.id === id) || null;

/** A failed run is tried again this long after it started, up to MAX_ATTEMPTS a slot. */
export const RETRY_AFTER_MS = 15 * M;
export const MAX_ATTEMPTS = 2;

const ET = 'America/New_York';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: ET, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });

/** An instant's Eastern wall clock: { date: 'YYYY-MM-DD', hour, minute, weekday }. */
export function etParts(d) {
  const o = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour), minute: Number(o.minute), weekday: WEEKDAYS.indexOf(o.weekday) };
}

/** The instant an Eastern wall-clock time falls on (EST or EDT, whichever holds that day). */
export function etInstant(date, hh, mm) {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall + 5 * H;
  for (let i = 0; i < 2; i++) {
    const p = etParts(new Date(t));
    const [py, pm, pd] = p.date.split('-').map(Number);
    t += wall - Date.UTC(py, pm - 1, pd, p.hour, p.minute);
  }
  return new Date(t);
}

export const addDays = (date, n) => { const t = new Date(`${date}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const hhmm = (job) => job.at.split(':').map(Number);

/** The job's most recent slot at or before `now`: { at: Date, date: its ET date }, or null. */
export function latestSlot(job, now = new Date()) {
  const [hh, mm] = hhmm(job);
  let date = etParts(now).date;
  for (let i = 0; i < 8; i++, date = addDays(date, -1)) {
    if (job.days && !job.days.includes(weekdayOf(date))) continue;
    const at = etInstant(date, hh, mm);
    if (at <= now) return { at, date };
  }
  return null;
}

/** The job's next slot after `now`. */
export function nextSlot(job, now = new Date()) {
  const [hh, mm] = hhmm(job);
  let date = etParts(now).date;
  for (let i = 0; i < 8; i++, date = addDays(date, 1)) {
    if (job.days && !job.days.includes(weekdayOf(date))) continue;
    const at = etInstant(date, hh, mm);
    if (at > now) return { at, date };
  }
  return null;
}

/** The paths a run of the job for the slot's ET date calls, in order. */
export const callsFor = (job, date) => job.calls({ today: date, yesterday: addDays(date, -1) });

/**
 * Whether the job is due now, given its stored record ({ slot, ok, attempts, startedAt }):
 * { slot (ISO), date, attempt } or null. Its latest slot runs once, within `catchUp` of it; a
 * failed run is tried again after RETRY_AFTER_MS, MAX_ATTEMPTS a slot.
 */
export function dueOf(job, rec, now = new Date()) {
  const s = latestSlot(job, now);
  if (!s || now - s.at > job.catchUp) return null;
  const slot = s.at.toISOString();
  if (!rec || rec.slot !== slot) return { slot, date: s.date, attempt: 1 };
  if (rec.ok) return null;
  const attempts = rec.attempts || 1;
  if (attempts >= MAX_ATTEMPTS) return null;
  if (now - Date.parse(rec.startedAt) < RETRY_AFTER_MS) return null;
  return { slot, date: s.date, attempt: attempts + 1 };
}

/** Whether the job's latest slot was run, and run well, by the server (the backstop's skip). */
export function slotDoneIn(state, id, now = new Date()) {
  const job = jobById(id);
  const rec = state?.jobs?.[id];
  if (!job || !rec?.ok) return null;
  const s = latestSlot(job, now);
  return s && rec.slot === s.at.toISOString() ? rec : null;
}
