# CLAUDE.md

This repo is the picks site served at https://ideareels.io: a start screen with three sports
(`/` → `components/site/Start.jsx`), the NHL Model 3.0 app at `/nhl` (everything below the
"Automation" heading), the NFL board at `/nfl` and the NBA board at `/nba`. It
replaced the former IdeaReels startup-idea product; that code is in git history before the
"Replace IdeaReels with NHL Model 3.0" commit.

## Site structure

- `app/page.js`: signed out → `Landing`; signed in but not admin → `Locked`; admin → `Start`
  (three tiles with a status line each from `/api/site/status`). Links saved before the start
  screen existed (`/#teams/BUF`, `/#matchups`) are forwarded to `/nhl#…` by `Start`.
- `app/nhl|nfl|nba/page.js` gate through `lib/gate.js` (`gateSport`: sign-in redirect with
  `?next=`, then the admin list). The header (`components/nhl/SiteHeader.jsx`) takes `sport`
  for the mark and carries `components/site/SportNav.jsx` (NFL · NBA · NHL, the start screen's order).
- The NHL app is unchanged apart from its path: hash tabs, routes, storage, model math.

## The picks core (NFL and NBA)

`lib/picks/*` is the sport-neutral pipeline both boards run on; each sport binds it with a
config and keeps its own markets, teams, feeds and slate key:

- `markets.js` (`makeMarkets`): a sport's markets ({ group, label, unit, fields (the box-score
  fields the market settles on, summed), yesNo, floor, defense, aliases }) → `marketFromText`
  (any spelling, whole-word match for short aliases like "PTS"), `statOf`, `defenseKey`.
- `cheatsheet.js` (`makeCheatSheetParser`): CSV / TSV / Excel in any column order; long layout
  = one row per prop with a market column, wide = one row per player with a column per market
  ("<market> odds" / "<market> L10 %" beside it); a sheet or file named after a market supplies
  it; hit rates as 7/10, 70% or 0.7.
- `board.js` (`makeBoard`): the sheets' rows and PropFinder's lines merged per player + market +
  line + side; the chance = hit rates over the line (L5 0.3, L10 0.3, season 0.4; PropFinder's
  logs when pulled, else the sheet's columns), shrunk toward the book's implied probability at
  n / (n + 6); per game and group the rows over the floor, three to four a table, fill-ins marked
  `under`, a "next" line; flame / snowflake (`formOf`) and the soft spot (`softSpot`, the opponent
  in the soft third at the position for the stat) are colour only; a stored box score grades
  every row (`actual`, `hit`; a `played: false` line reads DNP) and the game head tallies the
  plays over the floor. Notes written from the plays.
- `propfinder.js` (`makePropfinder`): `/<LEAGUE>/teams` and `/<LEAGUE>/players?teamIds=…&hydrate=stats&withOddsOnly=true`
  through `pfGetJson` in `lib/nhl-data/propfinder-api.js`. The NHL endpoints were checked; the
  NFL / NBA game-row field names have not been seen yet, so every stat is read through the
  sport's `FIELDS` spellings, prop lines through `playerProps`, and the pull records
  `fieldsSeen.unread`, shown under Data sources after the first pull. Fix the spellings there
  once a real pull shows them; never guess silently. `defenseAllowed` per position (the
  positions the Opponent rows carry), ranks 1 = most allowed.
- `store.js` (`makeStore`): `<sport>/<slate>/{schedule,sheets-index,propfinder}.json`,
  `sheets/<id>.json`, `results/<gameId>.json`, `<sport>/meta/*`; the schedule re-fetched when
  stale (6 h, 10 min while a game is on) with the finished games' box scores; a sheet with a
  stored name replaces it; `boardFor`, `statusFor`, `pullPropfinder`.
- `http.js`: the browser-agent GET (ESPN answers 403 to a user agent carrying a URL).
- UI: `components/picks/Board.jsx` (per game the sport's tables, a play-less game collapses to
  one line) and `Sources.jsx` (drop zone, stored sheets, PropFinder pull, ESPN refresh, folder
  sync note); `components/nfl/*` and `components/nba/*` bind them.
- The Mac folder sync (`tools/mac-sync/nhl-sync.sh`, `sync_sheets`) posts any `.csv` / `.xlsx`
  saved in `~/Desktop/NFL` to `POST /api/nfl/sheets` and in `~/Desktop/NBA` to `/api/nba/sheets`
  with the NHL sync token.

## NFL board (`/nfl`)

- Data: `lib/nfl/*`. `week.js` (ESPN's calendar stored at `nfl/calendar/<season>.json`, else the
  kickoff rule: the Wednesday before the Thursday after Labor Day starts week 1; weeks run
  Wednesday to Tuesday; `p1`–`p4` the postseason), `espn.js` (the week's schedule and scores,
  `parseSummary` for a finished game's box score: passing / rushing / receiving lines, return
  TDs, the first scorer from the scoring plays), `teams.js` (ESPN abbreviations; every other
  spelling maps through `teamAbbrFromText`), `markets.js` (the markets in four groups:
  touchdowns, passing, rushing, receiving; `marketFromText` reads any spelling), `odds.js`.
- The two cheat sheets Vincent uploads by hand: `cheatsheet.js` (`parseCheatSheet`: CSV / TSV /
  Excel, any column order; long layout = one row per prop with a market column, wide layout =
  one row per player with a column per market, "<market> odds" / "<market> L10 %" beside it; a
  sheet or file named after a market supplies it; hit rates as 7/10, 70% or 0.7). They arrive
  through the drop zone under Data sources on `/nfl`, or the Mac folder sync watching
  `~/Desktop/NFL` (`tools/mac-sync/nhl-sync.sh`, same sync token, `POST /api/nfl/sheets`); the
  week is read from the file name (`wk7`, `week-7`, a date) or is this week. Stored at
  `nfl/<season>/<wk>/sheets/<id>.json` with `sheets-index.json`; a file with a stored name replaces it.
- The rest from PropFinder: `propfinder-nfl.js` through `pfGetJson` in
  `lib/nhl-data/propfinder-api.js` (`/NFL/teams`, `/NFL/players?teamIds=…&hydrate=stats&withOddsOnly=true`).
  The NFL routes follow the NHL's, but a football game row's field names have not been seen
  yet: every stat is read through the spellings in `FIELDS`, prop lines through `playerProps`,
  and the pull records `fieldsSeen.unread` (game-row keys this file does not read), shown under
  Data sources after the first pull. Fix the spellings there once a real pull shows them; never
  guess silently. Stored at `nfl/<season>/<wk>/propfinder.json` (players with logs and lines,
  `defenseAllowed` per position with ranks 1 = most allowed).
- The board: `picks.js` (`buildBoard`, pure): the sheets' rows and PropFinder's lines merged per
  player + market + line + side; the chance = hit rates over the line (L5 0.3, L10 0.3, season
  0.4; PropFinder's logs when pulled, else the sheet's columns), shrunk toward the book's implied
  probability at n / (n + 6); per game and group the rows over the floor (0.55 yards markets,
  0.35 anytime TD, in `MARKETS`), three to four a table, fill-ins marked `under`, a "next" line;
  flame / snowflake (`formOf`) and the soft spot (`softSpot`, the opponent in the soft third at
  the position for the stat) are colour only; a stored box score grades every row (`actual`, `hit`)
  and the game head tallies the plays over the floor. Notes written from the plays.
- Routes (`authorize()`, admin session or sync token): `GET /api/nfl/picks?season&week&type|date`,
  `GET|POST|DELETE /api/nfl/sheets`, `POST /api/nfl/refresh?only=schedule|propfinder`
  (anonymous calls refresh ESPN only, throttled), `GET /api/nfl/status`, `GET /api/site/status`.
  `.github/workflows/nfl-data.yml` calls the refresh daily and after the Sunday / Monday /
  Thursday games. UI: `components/nfl/NflApp.jsx` (week picker), `NflBoard.jsx`, `NflSources.jsx`.
- Tests: `__tests__/nfl-*.test.js` (`fixtures/espn-nfl-summary.json` is a trimmed real summary).

## NBA board (`/nba`)

- The same pipeline keyed by the slate date (ET): `lib/nba/store.js` (`nba/<date>/…`,
  `resolveSlate({ date })`, a date in a sheet's file name picks the night, else today),
  `espn.js` (`scoreboard?dates=YYYYMMDD`, `parseSummary`: one stats block per team with points,
  rebounds, assists, 3PT made-attempted, FT, steals, blocks, turnovers; `didNotPlay` → `played:
  false`; `derived` adds PRA / PR / PA / RA / stocks / double-double / triple-double; ESPN labels
  the 2026-27 season 2027, `seasonOfDate` keeps the start year), `teams.js` (ESPN's codes: GS,
  NY, SA, NO, UTAH, WSH, PHX, BKN; `teamAbbrFromText` maps GSW / NYK / SAS / NOP / UTA / WAS /
  PHO / BRK), `markets.js` (five groups: points, rebounds, assists, threes, combos & defense:
  PRA, PR, PA, RA, steals, blocks, stocks, turnovers, FTM, double-double, triple-double),
  `propfinder-nba.js` (`/NBA/…`, positions PG / SG / SF / PF / C / G / F).
- Routes: `GET /api/nba/picks?date`, `GET|POST|DELETE /api/nba/sheets?date`,
  `POST /api/nba/refresh?date&only=schedule|propfinder`, `GET /api/nba/status?date`.
  `.github/workflows/nba-data.yml`: 9:47 ET and 5:23 PM ET (schedule + PropFinder), 2:11 AM ET
  (last night's box scores). UI: `components/nba/NbaApp.jsx` (date picker), `NbaBoard.jsx`,
  `NbaSources.jsx`. Tests: `__tests__/nba-board.test.js` (`fixtures/espn-nba-summary.json`).

## Canonical locations

- Local repo: `/Users/vincent/.openclaw/workspace/projects/idea-wheel`
- GitHub: `https://github.com/vincentploum-cmyk/idea-wheel`
- Production: `https://ideareels.io` (Cloudflare in front)
- Hosting: Render web service, auto-builds from GitHub `main` (`render.yaml`)
- Model source of truth for new logic: `~/Desktop/NHL/nhl-project/nhl-predictor/src/App.jsx`

## Workflow

1. Edit files in this repo.
2. `npm test` and `npm run build`.
3. Check `/`, `/nfl`, `/nba` and `/nhl` at 1440 and 390 widths (landing signed out; the start screen and
   the boards via `NHL_DEV_USER_EMAIL=... NHL_STORE_DRIVER=fs npm run dev`).
4. Commit, push `main`; Render deploys in ~2-3 min. CI smoke checks `/`, `/auth/login`,
   `/api/health` (commit match) and that `/api/nhl/runs` returns 401 when signed out.

## Automation

- `lib/nhl-data/*` pulls NHL API data into Supabase Storage and builds the model's
  input workbooks in the model's existing formats. Never change the model's
  parsers to fit the automation; change the builders instead. Every builder has a round-trip test
  through the model's own parser (`__tests__/nhl-pace.test.js`, `nhl-player-stats.test.js`): the
  home / away workbook once ran one column short of `parsePlayerHomeAway`'s map, which fed a
  skater's games-played count in as his away shot base and his shots as goals.
- Scheduled by `.github/workflows/nhl-data.yml` (daily results + lineups) and
  `nhl-lineups.yml` (hourly pre-game lineup reads); Mac folder sync in `tools/mac-sync`.
- Signed-in page = seven hash tabs (`#teams`, `#matchups`, `#defense`, `#firstgoal`, `#model`, `#league`, `#history`); it opens on
  Matchups. The Defense tab (`components/nhl/DefensePanel.jsx`, helpers in `lib/nhl-data/defense-board.js`, data from
  `/api/nhl/data/defense`, which also carries the date's games and MoneyPuck's team rates) is the ShotPropz-style cheat sheet:
  what every team gives up to each position group (C / LW / RW / D, C / W / D, F / D) in shots or goals **per skater at the
  position** a game (the study's read, section 13; `per` on every `defenseByPosition` cell, groups weighted by the skaters they
  carry), the Season span = `blendedDefense`: this season blended into last season's table at games / (games + 15) for shots and
  games / (games + 40) for goals (GP shows "this + last"), L10 / L5 the newest stored games across the seasons, by where the
  defender plays, rank 1 = the most allowed with ties shared, tinted by rank thirds; above the tables
  tonight's matchups read off the same tables (`matchupReads`, each shooting side's softest spot first, with the shooters the
  slate's lineup has at that spot named and clickable, `shootersAt`; the API's `tonight` games carry `sides[].skaters` from
  `buildSlate`), a track record (`lib/nhl-data/defense-grade.js`, `/api/nhl/data/defense/grade?to=`: every stored skater-game
  of the season replayed against each span's table as it stood that morning, by third of the opponent's table at the skater's
  position and at the side's softest spot, lift against the skaters' own blended rates and the 3+ SOG / 1+ G rate), and a team overview
  (GA / GP, SA / GP from the stored box scores; xGA / 60, high-danger shots against and pace from MoneyPuck), each column ranked;
  between them "Running hot" (`lib/nhl-data/streaks.js`, `streaks` in the defense API): every skater's current goal / point /
  3+ SOG streak from this season's stored games, his last game and tonight's opponent read off the same tables at his
  position (the study found no carry-over from a goal last game, so the streak is colour, the Tonight cell the matchup). The 1st goal tab (`lib/nhl-data/firstgoal.js`, `/api/nhl/data/firstgoal`, `FirstGoalPanel.jsx`) ranks
  tonight's skaters as first-goal candidates: own first-goal record from the rows' `fg` flag, the opponent's first
  goals given up to the position and slot at the venue, head to head, and the model's 1+ goal odds (score 0–100). The stored data (rosters, media, game history, league, MoneyPuck) is kept fresh by the
  morning run and shown, with repair buttons and the backfill, under Best bets → "Data sources"
  (`/api/nhl/data/setup`); there is no setup tab.
  Positions are captured per game from the newest lineup dated at or before it
  (`lib/nhl-data/positions.js`, `data/positions/<date>.json`; nothing is frozen: every read
  re-captures every game, a tweet posted more than 4 hours after puck drop belongs to the next
  game (`gdtCutoffs`), and games never snapshotted get the NHL.com preview at ingest). Stored
  box scores follow the latest read: `restampPositions` (after every lineup read, `ingestGames`
  with nothing new, `?only=restamp`) rewrites the day's games and season rows when a position or
  line changed; the morning run settles yesterday first (`ingestLineups(…, { settle: true })`,
  `?only=settle`) and posted GameDayTweets pages also settle the previous day's games
  (`settleGdtPages`). The stored skater rows carry the position plus its source (`posSrc`,
  `boxPos`) and the line slot (`line`: forward line 1-4 or defense pair 1-3, null for a
  box-score position), so results are logged per line (LW1, LW2, LW3 …; `defenseBySlot` in
  `lib/nhl-data/defense.js`, `slots` in `/api/nhl/data/defense`). Each game record carries its
  first goal (`firstGoal`, scorer's row flagged `fg`; shootouts excluded) and `firstGoalsAllowed`
  reads first goals given up per defending team by venue, position and line slot (the defense
  card's "1st goal" column, `firstGoals` in the defense API); games logged without it get it
  from the play-by-play via `stampFirstGoals` (`ingestGames` with nothing new, `?only=firstgoals`). The
  Matchups tab (`lib/nhl-data/slate.js`; each game drawn as two rinks in
  `components/nhl/Rink.jsx`, ice bands tinted by the opponent's SOG-allowed or goals-allowed rank per position (the slate-wide
  Shots / Goals switch above each rink, `metric` state in `MatchupsPanel`; the band labels, legend and the chips'
  h2h mark follow it: scorers (`h2hHot`) under Goals, shooters (`h2hShotsHot`) under Shots)
  for the window picked above the rink — home / away / L5 / L10 / L5 home / L5 away, defaulting to
  tonight's venue —
  above each rink the opponent's PropFinder defense table (`propfinderDefenseTabs` in
  `lib/nhl-data/propfinder.js`, drawn by `PropfinderDefense` in `components/nhl/Propfinder.jsx`:
  All/C/LW/RW/D rows, season tabs then L5 / L10 / L15, per game or total, PropFinder's ranks, sortable;
  a window PropFinder's API has not published for the current season is rolled from the stored
  box scores across the season boundary by `withStoredWindows`, the way PropFinder's own L5 counts),
  chips carrying the latest saved model run's λ shots / goals for the slate date from
  `lib/nhl-data/model-runs.js`, or a matchup read when no run exists; at the top of each rink card the model's plays
  for that team (`sidePlays` in `slate.js`, `ModelPlays` in `Rink.jsx`): the Best bets boards' rule, `boardPlays` in
  `model-core.js` (shared with the Model tab's boards and the scorecard's replay), two shots plays and two goal plays at
  most from the saved run, each on the floor it cleared with the attack-score tier, the picked skaters ringed on the ice,
  each play washed green (hit the floor) or red (fell short) with the box-score figure once the game is stored, dashed and dimmed when the skater has no box-score row, nothing shown without a run; finished games show the
  box score; above each game's team verdicts a game-total read, `gameTotalRead` in
  `lib/nhl-data/verdict.js`: the stored meetings' totals blended with MoneyPuck's expected
  goals and pace, high / low half a goal either side of the league average) and the per-team defense card
  (`lib/nhl-data/defense.js`) are descriptive views over the stored rows; the model's
  own math stays in `NhlModel.jsx`. Logos/headshots are copied into `data/media/*` and
  served by `/api/nhl/data/media`; standings/leaders live in `data/league/*`.
- Tonight's picks (`lib/nhl-data/picks.js` + `picks-pure.js`, `/api/nhl/data/picks`, `components/nhl/PicksPanel.jsx`,
  the list at the top of Best bets): the best shots plays and the best goal plays in every game: every skater over
  the floor (P(3+ SOG) 50%, P(1+ G) 35%), three to four a table (fill-ins marked `under`, the rest on a "next" line; a run row whose 3+ / 4+ pair is inverted is read off its λ; the run carries no 2+, it is read off the λ), with the break-even price, and the notes
  (softest spots, richest game, environment plays, near-ties, thin games, lineup sources) written from the picks.
  The numbers are the model's: with a run saved for the date, each row is the run's λ and 2+ / 3+ / 4+ SOG and 1+ G
  probabilities (`fromModel`) and only skaters the run projected are listed; the study's plain-rate read (fixed
  Poisson coefficients fitted on 2024-25 + 2025-26 by `tools/predictors/replay.py`, log features: the skater's rate,
  attempts, chances and TOI, this season blended into last season's base at n / (n + 18) shots, n / (n + 40) goals;
  home ice; back-to-back; and what the opponent allows **per skater at his position**, this season blended into last
  season's table at games / (games + 15) for shots and games / (games + 40) for goals, `positionAllowed`) rides on
  each API row as `study` and stands in when no run exists, but the panel shows one set of numbers only: player,
  2+ / 3+ / 4+ (1+ G) with the break-even price, and Got once final — no study, rate or opponent columns (the user
  wants the plays readable at a glance; the comparison lives on the History tab's scorecard). Beside the name, for
  the table's market: a flame / snowflake for his form (`formOf` in `picks-pure.js`, `heat` on the row: shots hot at
  1.4× his blended rate over his last five, cold at 0.7×; goals hot at 3+ in his last five, cold = none in ten when
  his rate owed him 1.5) and a green rink when the opponent is in the soft third at his position (`oppPos.softSog` /
  `softG`, `isSoftThird`). Colour only: the study found a streak adds nothing once the rate is in, so no number moves.
  The same flags (`components/nhl/flags.jsx`, `Flags`) sit on the Matchups tab: on each rink chip for the rink's
  metric (flame / snowflake only, `soft={false}`: the ice band under the chip already shows the environment, and by
  the picked window rather than the season table), on the plays strip per play, and in the all-skaters table's
  L5 S/G and Goals cells; `buildSlate` puts
  `heat` and `oppPos` on every skater and `sidePlays` carries them onto the plays. A stored game grades the rows
  (`withActuals` / `hitOf` in `picks-pure.js`: each skater's box-score SOG and goals ride on his row as `actual`,
  null when he did not play): every probability cell green when he reached that market's floor, red when he fell
  short, the row on its lead market, a "Got" column with the figure and a tally in the game head. The model's math is untouched.
  Study: `docs/shots-goals-predictors.md` (section 13 is the every-angle scan and the replay; `tools/predictors/run.sh <year>`
  rebuilds it, `explain.py` reads one skater-game).
- Lineups: `lib/nhl-data/gamedaytweets.js` reads the beat writers' lines from
  gamedaytweets.com/lines?team=XXX (roster-aware name matching: the roster decides a row's group, a pair
  holds a defenseman and two forwards side by side are a short forward line, three pairs at most, and a
  shared surname is the player the tweet did not place elsewhere; `applyPositions` keeps the box score's
  forward / defense group over a lineup slot that contradicts it) for every slate team; a
  game-day tweet beats the NHL.com preview, otherwise the preview, then an older tweet, then
  the roster; "game-day" is decided by timestamp (tweet id vs the preview's updated time), and a tweet
  from the warm-up window (`GDT_FINAL_WORD_MIN`, 90 minutes before puck drop, or after it) beats the
  preview whatever its updated time. A tweet
  that only confirms the lines ("Same lineup, Swayman in net", "no changes", `confirmsSameLines`)
  stands for the newest lines tweet before it, even past the date floor: the lines are that
  tweet's, the time and link the confirmation's (`meta.confirmed`, `meta.linesFrom`). A prose
  change tweet ("line changes: Gritsyuk is headed up to the Jack Hughes line with Bratt. Mercer up
  with Timo and Nico.", `parseLineChanges`: a change cue plus sentences naming two or three roster
  players, lone first names included) is applied onto the newest full lines tweet before it
  (`applyLineChanges`: each group lands on the line it shares players with, stayers keep their
  slots, newcomers fill the vacated slots in the order named, a lone move swaps); the read
  carries the change tweet's time and link (`meta.changed`, `meta.linesFrom`).
  gamedaytweets.com challenges cloud addresses (Cloudflare "Just a moment": Render and the GitHub
  runner alike), so its pages are fetched elsewhere and posted: the Mac sync (`tools/mac-sync/nhl-sync.sh`,
  hourly and every 15 minutes from an hour before a game until ten minutes after, sync token, multipart `date` + one file per team code) and both workflows via
  `tools/gdt-pages.sh` (plain curl, then `tools/gdt-browser.mjs` with Chrome through playwright-core), to
  `POST /api/nhl/data/lineups/gdt` (Bearer `NHL_ACTIONS_TOKEN`, a repo secret that must equal the
  Render env var; `authorize()` accepts it beside the stored sync token), where `ingestGdtPages`
  parses them against the rosters, merges (never erasing earlier lines), snapshots and auto-runs.
  Without a tweet or preview the snapshot uses PropFinder's depth chart (`propfinder-depth.json`).
  Slots a capture leaves empty (no lineup yet, or a partial one) are filled from the team's last
  known lineup (`data/lineups/last/<ABBR>.json`, written from each team's own capture) with
  players still on the roster, marked `carried`; the slate does the same for a game with no snapshot.
  `nhl-lineups.yml` re-reads lineups (`only=lineups&due=150` on a cron tick) on the rule: from 60 minutes
  before puck drop, every 15 minutes until the game's lineups are found (`linesFound` in
  `lib/nhl-data/lines-chain.js`: both teams have a tweet from the 45 minutes before the start, the warm-up window, so an afternoon
  projected-lines tweet does not stop the reads; the site reports
  `gdtAt` per team in the refresh response via `gdtTimes`) or the game is 10 minutes old. GitHub's cron only
  seeds it (2 of 24 slots fired on 2026-10-07): every run hands itself on with its own token (`tools/lines-chain.mjs`,
  a wait for the first window, then 15-minute hops; skipped while another run is queued or running; 40 hops a
  chain), and the Matchups tab's "Refresh lines" button dispatches a run on demand
  (`/api/nhl/data/refresh?only=lineups&dispatch=1` → `lib/nhl-data/github-dispatch.js` → `workflow_dispatch`,
  needs `GITHUB_DISPATCH_TOKEN` on Render; the panel then polls the slate until a new page delivery shows).
  The post-game settle is a separate, unchanged path. Each rink shows when its source last changed
  and the Matchups header when the beat writers' pages last arrived (`sourceMeta.gdtFetchedAt`). After every lineup capture (and every matchup-file import for a
  coming slate) `lib/nhl-data/autorun.js` runs the model on the server with the stored
  PropFinder workbooks + snapshot lineups + built history/home-away inputs + the pace workbook built from
  MoneyPuck's team pace (`buildPace` in `lib/nhl-data/build.js`: CF+CA per 60 written per rostered skater in the
  pace export's layout, so the model's pace parser reads it unchanged; also the Model tab's auto Pace slot) and saves the run
  (source "auto", deduped by autoKey); the rink shows that run. The model's pure pipeline
  (parsers + `buildProjections`) lives in `components/nhl/model-core.js` so the server can import
  it; `NhlModel.jsx` keeps the UI and imports from it. Port logic changes into model-core.js.
- PropFinder API (`lib/nhl-data/propfinder-api.js`): with `PROPFINDER_EMAIL` / `PROPFINDER_PASSWORD`
  in the server env, `dailyRefresh` pulls the slate from api.propfinder.app each morning (and the
  hourly lineup reads pull when the slate's files are still missing): skater and team tables into
  `data/propfinder/*` and the season + L5 matchup workbooks through `ingestMatchupFile`, in the
  exports' exact layouts, then the auto run. Admin button and `POST /api/nhl/data/propfinder/pull`.
  Keep producing the CSV/workbook shapes the parsers already read; never adapt the parsers to the API.
  The season workbook's numbers are blended, not raw (the predictor study's shrinkage, `docs/shots-goals-predictors.md`
  sections 3 and 9): each skater's "Season" row is this season's regular-season games blended with last season's at
  n / (n + 18) for shots, attempts and chances, n / (n + 40) for goals, assists and points, n / (n + 5) for TOI
  (`blendedSeasonRates`; last season's alone until his first game, this season's alone without a 10-game prior), and
  each "Defense (Season)" block is the team's season to date blended with last season's full figure at n / (n + 15)
  for shots, attempts and chances and n / (n + 40) for goals and assists (`defenseBlocks`; no L10 window any more).
  GP is this season's count. The L5 workbook and the stored CSV-shaped tables stay PropFinder's own numbers; a
  manually uploaded PropFinder export is stored as exported.
- PropFinder CSV exports (skater per-game rates for the season or last N games, team stats for and
  against with ranks, opponent stats per position tagged by a `-lw/-c/-rw/-d` file-name suffix) are imported by
  `lib/nhl-data/propfinder.js` into `data/propfinder/*` (one snapshot per season; the
  bundled `lib/nhl-data/seed/propfinder-<year>.js` is the fallback, regenerated with
  `node tools/propfinder-seed.mjs <season> <csv…>`). They are descriptive views, not model
  inputs; the slate's defense edges fall back to the per-position opponent tables while a
  team has fewer than 10 stored games at a venue.
- Player card (`components/nhl/PlayerCard.jsx`, data from `/api/nhl/data/player`): laid out as
  PropFinder's player view — top bar (headshot, position badge, shot form, graph average, average
  TOI; the badge is the night's lineup slot, "LW1 tonight", read from the position snapshot for the
  panel's slate date (`slotOnSnapshot` → `tonight` in the payload; the panel's date rides on every open()
  through `SlateDateContext`), the roster position noted when it differs), market tabs carrying the hit rate for the pressed split, the Over + line block, the
  per-game bar graph (green over / red under, iCF outline with "Total shots", the average pill),
  the split tiles ('25-'26, H2H, Home/Away, L5, L10, L20; press one to draw its games), the splits
  table, and on the right the opponent's "Defense Allowed" panel (`DefenseAllowed` in
  `components/nhl/pf-ui.jsx`: Year / Range / Position dropdowns, per game ↔ total, rank-tinted
  cells, the by-position rows) fed by `defense` in the player payload (`propfinderDefenseTabs`), and under it the
  team page's game log for that opponent (`TeamGameLog` with `compact`, the same `/api/nhl/data/defense/log`):
  every stored skater-game at the player's position against the team, opened at tonight's venue, the shots / goals
  column and line following the card's market tab, the player's own games against them tinted, and the skaters who
  shoot and score like him washed violet (`--like-*` tokens; `?like=<id>` on the log route → `shootingProfiles` /
  `similarProfile` in `lib/nhl-data/profile.js`: this season blended with last at the study's weights, within 15% of
  his shots and 30% of his goals per game, 10+ games behind the read).
  The PropFinder-style table pieces (`PfTable`, `SortTh`, `PosBadge`, `Tag`, `UnderlineTabs`,
  `Sel`) live in `pf-ui.jsx` and dress the slate's skater table and League's PropFinder skaters.
- Team pages deep-link as `#teams/BUF` (`components/nhl/links.jsx`: `teamHref`, `teamFromHash`, `TeamLink`);
  every team logo / name on Matchups (game head, verdict heads, rink heads, PropFinder defense heads,
  skater-table heads) is a `TeamLink`, and picking a team on the Teams tab writes the hash.
- Team page game log (`components/nhl/TeamGameLog.jsx`, `/api/nhl/data/defense/log?team=XXX`,
  `gameLogAgainst` in `lib/nhl-data/defense.js`): PropFinder's "RW vs TOR" view — every stored
  skater-game against the team, newest first, with the skater's line slot (LW1 … RW4, D1 … D3),
  filtered by slot, venue (@ / vs), the team's result and season; a Shots / Goals toggle with a
  line colours that column green over, red under, and L5 / L10 badges give the over / under share.
- Scorecard (`lib/nhl-data/scorecard.js`, `/api/nhl/data/scorecard?from=&to=&rows=1`,
  `components/nhl/Scorecard.jsx` at the top of the History tab): every stored game is graded
  against the newest saved run created before its puck drop (`runForGame`; a run saved after the
  game never counts), players matched by `modelKey`. Per market (3+/4+/5+ SOG, 1+/2+ G, 1+/2+ PT):
  calls, the model's average probability, hit rate, Brier, calibration buckets, by gate / position /
  line slot, and the best-bet calls (`bestBetLabel`, now in `model-core.js`); the Model tab's Top 5
  boards replayed per slate; and the window predictors — own L5 / L10 / L15 / season from the stored
  rows (full window required) and PropFinder L5 / season as the run saw them (`shotsL5`, `shotsSeason`
  on the result rows) and the study's λ as it stood that morning (`studyRead`: the Best bets plain-rate
  read rebuilt leak-free from the stored rows before each date) with a half-and-half model + study blend —
  scored beside λ on the rows every covered predictor shares (MAE, bias, Poisson 3+ SOG / 1+ G Brier).
  Descriptive only; nothing feeds the model. The board blends only through `NHL_PICKS_STUDY_WEIGHT` on
  Render (the study's share, `blendProjection` in `picks-pure.js`, `studyWeight` in `picks.js`; unset =
  the model alone), to be set once that table shows the blend beating the model. The same comparison runs
  offline on the `?rows=1` export with `tools/predictors/grade_blend.py`.
- MoneyPuck team metrics (`lib/nhl-data/moneypuck.js`, `data/moneypuck/*`) feed the team
  page, Matchups defense cards and League; credit MoneyPuck.com wherever shown.
- Theme: dark by default (`<html data-theme>`, toggle in the header, tokens in
  `globals.css`). `NhlModel.jsx` carries inline light colours, so it renders inside a
  `.nhlx-light` island; keep new UI on the tokens, never hard-coded tints.

## Design

- Design context, brand words, palette and type rules live in `.impeccable.md`; read it
  before any visual change. Tokens only (`globals.css`), no hard-coded tints, no nested
  cards, no gradient text, no side-stripe borders.

## Rules

- The site is admin-only: `NHL_ADMIN_EMAILS` on Render when set, else `DEFAULT_ADMIN_EMAILS` in `lib/nhl-admin.js`
  (both lists must carry a new person). Every `/api/nhl/*`, `/api/nfl/*` and `/api/site/*` route must call
  `requireNhlAdmin()` or `authorize()`.
- Keep the model's math untouched when restyling; port logic changes from the local app into
  `components/nhl/model-core.js` (pipeline) and `NhlModel.jsx` (UI). One change went the other
  way (2026-10-13, port it into `App.jsx`): the published shots odds `p3s` / `p4s` / `p5s` (and `p2s`)
  are the Poisson tails of the row's `lambdaS`; the shot ladder's figures ride along as
  `ladderP3s` / `ladderP4s` / `ladderP5s` and still set the attack score and shot tiers
  (`docs/shots-goals-predictors.md` section 12).
- Secrets stay out of git (Render env + `.env.local`).
- Site is `noindex` by design (robots.txt disallow + X-Robots-Tag).
