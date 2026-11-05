# Performance: what is computed once and kept

The data layer is CPU-bound, not I/O-bound: two seasons of stored skater-games (~50k rows a
season) are read into every NHL tab, and before 2026-10-27 the slate was rebuilt from them on
every API call (56 s cold on a synthetic two-season store, every tab paying it again:
`propfinderDefenseTabs` rolled the five PropFinder windows over a fresh filtered copy of the
rows per side, thirty-two times a night). Now (3 s cold, 0 ms after):

- `lib/memo.js` (pure, no store import, so the client bundles that share `lib/nhl-data` helpers
  stay clean): `memoByRows(rows, key, compute)` keeps a value per rows array (a WeakMap: it goes
  with the array; another array with the same content is a new computation); `inputsMemo` keeps
  a value per set of input objects (identity); `asyncMemo({ ttl, max, revision })` keeps an
  async build per key while the store's revision, the inputs' identities and the TTL hold, and
  shares a build in flight. A memoised value is shared between requests: **read-only**.
- `lib/nhl-store.js`: `dataRevision()` bumps on every write / invalidation (and on a run saved
  or deleted); `readJson` shares an in-flight download between requests that arrive together
  (`invalidate` drops it, so a read after a write never joins the one before it); the blob cache
  (logos, headshots, `readBlob(…, { cache: true })`) is an LRU within a byte budget
  (`BLOB_BUDGET_BYTES`, 32 MB) instead of 200 entries. `loadRows` (`build.js`) shares an
  in-flight load per `asOf` and hands back the same array while the season files are unchanged.
- Per rows array (`memoByRows`): `defense.js` builds one per-game aggregate per kind
  (`aggregate(rows, 'pos' | 'slot')`, one pass over the rows) and every table off it
  (`defenseByPosition` with `lastN` and the `games: 'regular'` filter, `defenseBySlot`,
  `blendedDefense` without filtering the rows), `pairRows` (defending team | attacking team →
  rows) behind `defenseVsTeam` and `verdict.js`'s `h2hTotals`, `firstGoalsAllowed`,
  `playerBaselines`; `propfinder.js`'s `storedWindowTables` (so `withStoredWindows` rolls each
  window once a store state, not once a side); `picks-pure.js`'s `seasonSplit(rows, season)`
  (this season's and last season's rows per player, the flat lists, each team's last game,
  `shotsAllowed`, `positionAllowed`: the slate, the picks and the first-goal board read the same
  split); `slate.js`'s `h2hByOpponent`; `firstgoal.js`'s `firstGoalRecord`; `defense-grade.js`'s
  `gradeDefenseReads` (the whole replay, when no `trace`).
- Per store state (`asyncMemo` with `revision: dataRevision`, 15 min): `buildSlate(date)` (inputs:
  the rows, the positions snapshot, the lineups and games files, `latestModelRun`), `buildPicks`
  (board and `withSkaters`, inputs: the slate and the rows; `buildShuffle` reshapes it),
  `buildFirstGoalBoard`, and the Defense tab's payload in `app/api/nhl/data/defense/route.js`.
  `loadMoneyPuck` and `loadPlayers` are `memoizeByInputs` (the same object while the files are).
  A write through the store (a lineup read, a stored game, a pull, a run) drops them at once; a
  run saved through `/api/nhl/runs` (its own module copy) shows within `latestModelRun`'s minute.
- NFL / NBA (`lib/picks/store.js`): `boardFor` keeps the built board per slate files (the
  schedule, the pull, the sheets, the results: `inputsMemo`), `shuffleFor` the shuffle per board
  and market; a sheet whose OCR is done is read through the cache (fresh only while pending, or
  when the cached copy is still the pending one), the sheets index stays a fresh read.
- NBA player card (`lib/nba/store.js`): the card's payload reads only the slate's files; the vs-position block is a
  second request (`part=vs`) over the season's nights, read in parallel and kept per night (`nightMemo`, `pullMemo`,
  dropped by `pathRevision` on a write under the date). Cold: ~9 s → ~65 ms for the card, ~0.8 s for the block at
  60 ms a bucket read (2026-11-05).
- `middleware.js` skips `/api/nhl/data/media` (hundreds of image requests a page, the route checks
  the session itself); the media route's CDN fallback redirect is cacheable for a day.
- Tests: `__tests__/memo.test.js` (the helpers, the tables off one aggregate),
  `__tests__/nhl-slate-memo.test.js` (the builders through the bucket mock, the blob budget, the NBA
  board). When adding a builder a page waits on, wrap it the same way and name its inputs.

