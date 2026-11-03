# The data jobs' clock

- The daily refreshes run on the server's own clock (`lib/scheduler.js`, started once per process by
  `instrumentation.js` through `experimental.instrumentationHook`; production server only, never in `next dev`
  or `next build`, off with `SCHEDULER=off`). Vincent, 2026-10-29: "fix the timing so the pulls run on
  schedule" — GitHub fires scheduled workflows hours late on busy days (that day the NBA 9:47 AM pull ran at
  3:12 PM, the NFL 9:33 AM one at 3:10 PM, the NHL 9:17 AM run at 2:57 PM; the 5:23 PM NBA pre-game pull of the
  28th at 9:01 PM, after tip-off). The Render service is the 2 GB Standard instance, which never sleeps
  (`render.yaml` still says `plan: free`; the dashboard decides).
- `lib/schedule-jobs.js` (pure) is the table, Eastern time: `nhl-morning` 09:17 (PropFinder, then the daily
  refresh), `nhl-late` 00:41 (the previous day), `nfl-morning` 09:33 (schedule, PropFinder), `nfl-late` 00:41
  Mon / Tue / Fri (the previous day's finals), `nba-morning` 09:47 (last night settled, tonight's schedule,
  PropFinder), `nba-pregame` 17:23, `nba-overnight` 02:11 (last night's box scores) — the workflows' own calls.
  Every minute `tick` runs each due job (`dueOf`: its latest slot once, within its `catchUp` — 4 h for the
  mornings, 6 h overnight, 1 h for the pre-game pull so it never lands after tip-off; a failed run tried again
  after 15 minutes, twice a slot) by POSTing the site's own refresh routes on `127.0.0.1:$PORT` with
  `NHL_ACTIONS_TOKEN`, so a refresh takes the one path it always took; one job at a time (a pull and a model
  run each need most of the memory), `gc()` between calls. Each run is recorded in `meta/scheduler.json` (slot,
  attempts, the calls with status, time and the reply's start), read past the cache and written only when a job
  runs (a write bumps the store's revision). **What the process wrote is its truth** (`local`, merged with the
  stored copy job by job, the newer record kept, `mergeStates`): Supabase Storage hands back the copy from before a
  write for a while, even read past the cache. On 2026-10-30, its first morning, that made the scheduler step aside
  from its own claim (re-read two seconds after writing it: four jobs ran on the 15-minute retry, 16 minutes late)
  and let the NFL late run's write wipe the NHL late run's record, so the backstop ran that job again at 7 AM; the
  claim's re-read is gone (one instance on Render; a slot run twice in a deploy's overlap is one extra refresh).
  `GET /api/site/scheduler` (admin or token) lists each job's last and next slot and its last run.
- The GitHub workflows (`nba-data.yml`, `nfl-data.yml`, `nhl-data.yml`) stay as the backstop: a scheduled run
  names its job from the cron that fired it (`github.event.schedule`, no longer the UTC hour it happened to run
  in: the 2:11 AM NBA slot fired at 8:53 AM and was read as a morning run) and passes `job=<id>`; the refresh
  routes answer `skipped` when the server already ran that slot well (`scheduledSlotDone`). A manual run always
  runs. The NHL workflow's first step, the beat writers' pages, always runs: gamedaytweets.com refuses the server.

