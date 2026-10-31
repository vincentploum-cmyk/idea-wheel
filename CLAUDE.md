# CLAUDE.md

This repo is the picks site served at https://ideareels.io: a start screen with three sports
(`/` → `components/site/Start.jsx`), the NHL Model 3.0 app at `/nhl` (everything below the
"Automation" heading), the NFL board at `/nfl` and the NBA board at `/nba`. It
replaced the former IdeaReels startup-idea product; that code is in git history before the
"Replace IdeaReels with NHL Model 3.0" commit.

## Site structure

- `app/page.js`: signed out → `Landing`; signed in but not admin → `Locked`; admin → `Start`
  (a dark band with the date, then three panels NFL · NBA · NHL from `/api/site/status`: the
  figures first (games, plays, the hit tally, sheets / lineups), the slate's games with logos,
  scores and tallies, the sources line; the NFL / NBA panels read their boards from the stored
  files, the NHL panel the day's schedule with scores). Links saved before the start
  screen existed (`/#teams/BUF`, `/#matchups`) are forwarded to `/nhl#…` by `Start`.
- `app/nhl|nfl|nba/page.js` gate through `lib/gate.js` (`gateSport`: sign-in redirect with
  `?next=`, then the admin list). The header (`components/nhl/SiteHeader.jsx`) takes `sport`
  for the mark and carries `components/site/SportNav.jsx` (NFL · NBA · NHL, the start screen's order).
- Every app's tabs are the URL hash (`components/site/hash-tab.js`: `tabOf`, `useHashTab(keys, fallback)`
  → `[tab, mounted]`, a visited panel stays mounted hidden so it keeps its state; `components/site/TabBar.jsx`
  draws the bar). The NFL and NBA pages have two: `#board` (Best plays: the board, the scorecard (the NFL's alone since
  2026-10-31), the data sources, the default; on the NBA page the night's plays in one ranked list over the games folded to a line each,
  below) and `#shuffle` (the shuffle), over one week / date picker (the `head()` in each app,
  drawn on both panels); the NBA page a third, `#firstbasket`. The NHL app has nine (below).
- The NHL app is unchanged apart from its path: hash tabs, routes, storage, model math.

## The picks core (NFL and NBA)

`lib/picks/*` is the sport-neutral pipeline both boards run on; each sport binds it with a
config and keeps its own markets, teams, feeds and slate key:

- `markets.js` (`makeMarkets`): a sport's markets ({ group, label, unit, fields (the box-score
  fields the market settles on, summed), yesNo, floor, defense, aliases }) → `marketFromText`
  (any spelling, whole-word match for short aliases like "PTS"), `statOf`, `defenseKey`.
- `pdf.js` (`pdfTables`): a PDF cheat sheet's pages as tables through pdf-parse's bundled pdf.js
  (`serverComponentsExternalPackages`): text runs on one baseline make a row, a gap wider than a
  character starts a cell, and cells are placed on the page's columns (`alignColumns`, cell
  starts clustered within 14 pt) so a blank cell a PDF does not draw keeps the others in place.
  `makeTextPdf` writes a small PDF for tests. The parser reads a PDF's tables with the previous
  page's header carried onto pages that run on; the first rows read are stored with the sheet
  (`preview`) and shown under Data sources, so a layout nothing parsed from can be checked there.
- `ocr.js`: a PDF made of pictures (one JPEG a page, `pdfImages` slices the DCTDecode XObjects out
  of the file, no renderer) is read by OCR: each page split into its two team columns, inverted,
  scaled 3× and binarised through sharp (`prepareColumn`), then tesseract.js (`createReader`, one
  worker a job, English data cached in the OS temp dir, PSM 6) gives the words with their boxes in
  page pixels (`ocrPdf` → `[{ page, width, height, half, left, right }]`). The store runs it in the
  background when the text parse finds nothing and the sport has a layout (`cfg.parseOcrPages`):
  the PDF is kept at `sheets/<id>.pdf`, the words at `sheets/<id>.ocr.json`, the sheet is listed at
  once with `ocr: { status: 'pending', page, pages }` (HTTP 200, so the folder sync records the file),
  the index entry follows page by page (read past the JSON cache, `readJson(…, { fresh: true })`,
  since the job and the status route may hold different module instances), and the rows land
  when the read is done (`status: 'done'`, with the games the pages paired) or `'failed'`.
  `POST /api/<sport>/sheets?reread=<id>` parses the stored words again (`&full=1` reads the PDF
  again); the Sources panel polls while pending and carries a "Read again" button. JPEG pages
  (DCTDecode) and Flate-compressed RGB / grey pages both come out (`pdfImages`); a page's soft mask
  is composited into it over white as a viewer draws it (`compositeOverWhite`, `masked: true`): the
  NBA sheets of 2026-10-26 kept the grey table rows' text in the mask alone, so without it those rows
  were black bands and every other player was missed (`__tests__/fixtures/ocr-nba-suns-okc.json`
  holds that page's words whole; `fixRank` also reads "1st" tiles that come out as "dst" / "IST" /
  "[St" and "3rd" as "31d"). A column is turned over only when it is dark (`prepareColumn`'s
  `invert: 'auto'` by mean luminance); the column scale follows its width (`scaleFor`: 3× a 594 px
  NFL column, 2× a 1040 px NBA one). About four minutes for the NFL's 14 pages on Render, half a minute for the NBA's three.
  The helpers both layouts share (`rowsOf`, `claimFragments`, `resolveName`, `similarity`) live in
  `ocr-layout.js`. A sheet row without a market and line is a **mention** (`board.js`,
  `mentionsOf`): it never makes a play of its own but confirms every PropFinder play of that
  player (`confirmed`, `sheetFiles`), lends his position, team and season average; a sheet's
  `meta.oppRanks` (what each team's opponent gives up per position and stat, rank 1 = most) stands
  in for PropFinder's defense table when the slate has no pull (`defenseFromSheets`).
- `cheatsheet.js` (`makeCheatSheetParser`): CSV / TSV / Excel / PDF in any column order; long layout
  = one row per prop with a market column, wide = one row per player with a column per market
  ("<market> odds" / "<market> L10 %" beside it); a sheet or file named after a market supplies
  it; hit rates as 7/10, 70% or 0.7. **A wide market column that does not hold lines holds his
  averages** (a book's line ends in .5; under 60% of a column's numbers on the .5 and the column is
  averages, `isLine`): the row is a mention (market null, group `players`, `avg` keyed by stat, with
  a MIN column as `avg.min`, the OCR sheets' shape), never a play, and the sheet's warnings say so —
  2026-10-29 an NBA sheet's Name · POS · MIN · PTS · REB · AST · 3PM table read as text put "Watson
  o3.4 Points" and "Allen o5 Points" on the board as PropFinder plays (his logs made them `pfBacked`).
- `board.js` (`makeBoard`; the sport bindings in `lib/nba/picks.js` and `lib/nfl/picks.js` must stay out of client
  components, which read `markets.js` instead: `board.js` reaches the server store through `nhl-data/names.js`): the sheets' rows and PropFinder's lines merged per player + market +
  line + side; the chance = hit rates over the line (L5 0.3, L10 0.3, season 0.4 by default, the sport's
  `hitWeights` below; PropFinder's logs when pulled, else the sheet's columns), shrunk toward the book's implied
  probability at n / (n + 6); per game and group the rows over the floor, three to four a table, fill-ins marked
  `under`, a "next" line; flame / snowflake (`formOf`) and the soft spot (`softSpot`, the opponent
  in the soft third at the position for the stat) are colour only; a stored box score grades
  every row (`actual`, `hit`; a `played: false` line reads DNP) and the game head tallies the
  plays over the floor. Notes written from the plays. `best` on the board: every play over the floor across the
  slate, one a player, market and side, the chance first, with his projection and the matchup at his spot (`SlateList`).
  **The NBA's best bets are rebounds, assists and threes alone** (`BEST_MARKETS` in `lib/nba/picks.js` →
  `makeBoard({ bestMarkets })`; Vincent, 2026-10-31: "I don't need turnovers in the best bets. Only rebounds / assists /
  threes"): `best`, each side's `picks` and the game line's count, best play and hit tally (counted on `best` in
  `NbaGame.jsx`) carry those markets; every market keeps its rows in the per-game tables, the cards and the scorecard's
  grading; the list's stat tabs are the groups it carries; `nbaBoard(cocktail, { bestMarkets: null })` lists every market.
  **The NBA's best bets are ranked by edge over the book** (`bestBy: 'edge'`, `edgeRows` in `board.js`; Vincent, 2026-10-31:
  "the best bets per game should be the ones with the biggest edge compared to the lines known … projected to get 30
  points and his line is 15 … that is where I can beat the books"): per active player and best-bets market, the book's
  main line read on his ladder — the rung's chance (his distribution centred on tonight's projection beside how often he
  cleared it, calibrated when the season's fit holds) for the over, its complement for the under — against each side's
  implied probability; the side the board gives 50% or better with the larger positive edge is the play (a line past
  `STEEP_IMPLIED` or without a price is none), `gap` = the projection minus the line, `implied` beside the price. `best`
  (the slate ranked by edge), each side's `picks` and the game line's best bet (its edge beside it) read it; the list says
  "the biggest edge over the book first" and every row's projection cell shows the gap to the line ("+3.3 vs line",
  green when it backs the side). `nbaBoard(cocktail, { bestBy: 'chance' })` is the hit-rate list as it was (the plays
  over the floor, the likeliest first), the per-game tables still the chance read; `__tests__/nba-best-edge.test.js`.
  **The reliable chance per market** (`lib/picks/reliability.js`, `reliabilityOf` from the season's graded nights, the over /
  yes plays as the board stated them; Vincent, 2026-10-31: "keep track of what % is reliable to bet on for threes, assists,
  rebounds and based on that the % for the players should be colored green / red", then "fill the cells green that are
  the best bets as per the model"): per market the lowest chance step (50% up by 5) from which `RELIABLE_MIN` = 25 plays
  or more landed at least their break-even at the book's prices (`RELIABLE_BAR` = 60% without a price); learned with the
  calibration in `scorecardFor` (`reliability` inside `nba/meta/calibration.json`, `sameCalibration` compares it) and on
  the board as `board.reliability`; the games' head line names each market's threshold ("Reliable from · REB 65% · AST
  70% · 3PM not yet", the figures on the hover), and `reliableTone` colours every chance — the ranked list, the strips,
  the court's chips, the Tonight table (its cell filled green when a play clears the threshold, `is-best`) — green at or
  over the market's threshold, red under it, by the chance as the model states it (`raw`); a market without one keeps the
  old colouring. `__tests__/picks-reliability.test.js`.
  **A best bet needs an edge over the book's price** (`BEST_EDGE_MIN` = 0 in `board.js`, `inBest`; Vincent, 2026-10-31:
  "I only want to see profitable bets with an edge"): `best`, each side's `picks`, the game line's count and best play
  carry only the plays over the floor whose chance (calibrated where the fit applies) beats the price's implied
  probability; a play without a price makes no best bet; the per-game tables, the cards and the grading keep every row.
  The Tonight table's cell is filled green on an edge and its chance red when priced without one; a court chip's chance
  on the book's line the same; the ranked list's and the strips' chances keep the reliability colour (every row there
  has an edge by construction).
  **A line the book prices past -400 is no play**
  (`STEEP_IMPLIED` = 0.8 on the book's implied probability; 2026-10-29: o4.5 points at -10421 read 100% at
  the top of the Points table, Vincent: "this is fucking useless"): the play carries `steep: true`, stays on
  the side player's `plays` (the card's "His lines tonight") and off the tables, the "next" line, the
  strips, the tally, the notes and the scorecard; the game carries `steep` = how many.
- **The cocktail** (`makeBoard({ cocktail })`, `COCKTAIL_DEFAULTS` in `board.js` = the board as it was, which the NFL
  keeps; the NBA's is `COCKTAIL` in `lib/nba/picks.js`, `nbaBoard(cocktail)` builds the board with any other for the
  audit's A / B): the weights behind the projection and the chance, measured on two seasons of box scores
  (`docs/audits/2026-10-28-nba-cocktail.md`; Vincent, 2026-10-28: "can't you just figure out yourself what the best
  cocktail is"). `windows` = his windows' weights (`blendWindows` in `projection.js`, renormalised over the windows he
  has; set, `logAverages` puts `w` on his windows, with `scope` when not every game, and his last twenty when the
  weights name it; `blendText` words it for the hovers); `scope` = the games every window of his reads (`windowGames`:
  'all', his newest games whatever the season, last season's playoffs in — the board until 2026-10-28; 'regular', the
  same without the playoffs; 'season', this season's regular season alone, his last `seasonCap` regular-season games
  standing in until he has played — for the averages, the hit rates, the minutes, `ownWindows`; his spread and the
  volume read's long-run percentage stay on his regular season across the boundary); `matchupK` = PropFinder's table
  counted at gp / (gp + k) of itself (`matchupOf`'s `damp`, `dampOf(allowed, pos)`, `k` on the side's `allowed` and the
  card's tables; `matchupFrom` carries `raw` / `weight` / `gp`, `dampText` for the hovers); **the cheat sheet's tile
  counts in full**, alone or beside PropFinder's, which comes in at its weight: 1 + ((sheet − 1) + w (pf − 1)) / (1 + w)
  (Vincent, 2026-10-29: "the cheat sheets and the data from PropFinder should be the start of everything in
  basketball"; on 2026-10-28 the damping applied to the two's mean and cut the sheet's tile to a tenth in the first
  week, measured on PropFinder's tables alone — the replay has no sheets); `hitWeights` = the hit rates' L5 / L10 / season weights in the plays'
  chance and a rung's cleared-it half; `ladderModel` = the tail's share of a rung's chance, `empK` the cleared-it
  half handing its weight to the tail in his first games (min(n, 17) / (… + empK) kept, n his games this season),
  `wModel` on every rung (the shuffle's `pAt` / `readAt` recentre the tail at it), `spreadA` / `spreadB` his spread
  × (1 + a · b / (n + b)); `vacatedShare` and `factorMax` (the minutes factor's ceiling, `minutesTonight`). The NBA:
  windows season 0.65 · L10 0.35 with scope 'season' (Vincent, 2026-10-28, before the merge: "look at the last 10
  games for now; I don't want to blend with last season's games because playoffs were at the end"; the first cut
  read season 0.4 · L10 0.2 · L5 0.1 · L20 0.3 across the seasons), matchupK 40, hitWeights 0.1 / 0.3 / 0.6, ladderModel 0.7, empK 6,
  spreadA 0.2 at 5 games, factorMax 1 (minutes that fell cut a rate, minutes that rose lift none; an out teammate's
  production still arrives through the vacated lift, whole since nothing comes off it for minutes), vacatedShare 0.2
  (the notes' "Vacated production" line says the share), and `pull` (Vincent, 2026-10-29: "we can't treat them all
  the same, they depend on different dynamics"): in his first games this season his read, after the without split
  and the volume read and before the minutes factor and the lift, moves toward his role — `roleRates[stat][G|F|C]`,
  the league's rate a minute at his position group from the slate's own sources first — the cheat sheets' player tables
  (`mentionsOf`, each row a game's worth of his minutes and averages, a row past what a minute can hold left out) and
  PropFinder's players' games this season — with 2025-26's rates behind them at `roleMinutes` = 500 (`roleRatesOf`,
  `from` { sheet, propfinder, reference } minutes on the pull), × the minutes behind his rate — his own read counting at n / (n + K),
  n his games this season, K per stat: points 1, rebounds 2 (the position says the most), assists 0.5 (his role is his
  own), threes 1.5, PRA 1; none before his first game (last season's regular season stands in as it is). **His role off
  his own opportunity** where PropFinder's game rows carry it (`opportunity`: { pts: 'usg', reb: 'rebCh', ast: 'potAst' };
  Vincent, 2026-10-29: "add usage, rebound chances and potential assists to the projections"): points = his usage
  (minutes-weighted, this season) × the slate's points per usage-minute (`roleConv.pts` = 2025-26's 0.02396 behind it
  at 500 minutes of 20% usage), rebounds = his rebound chances a minute × the slate's rebounds per chance, assists =
  his potential assists a minute × the slate's assists per potential assist (no reference: the slate's alone, from
  `OPP_MIN` = 500 minutes), each × the minutes behind his rate; PRA on the three (`basis: 'parts'`); the position's
  rate where the rows lack them (`basis: 'position'`). A player's own role pulls harder (`pullOpportunity`: points
  12, PRA 5 — replayed with usage computed from ESPN's box scores: points 5.09 → 4.99 this season, 5.095 → 5.062 over
  2025-26; rebounds 2 and assists 0.5 as the position's, no public tracking to fit them on). `pull` {
  prior, w, n, K, group, min, basis, opp, oppGames } rides on `own[stat]`, `ranges[market]` and the shuffle row, `ladderOf` takes it,
  `ownRate` applies it, `pullText` words it for the court's, the card's and the shuffle's hovers. `volume` (true)
  switches the volume read off for the audit's A / B.
- `shuffle.js` (`makeShuffle` → `shuffleOf`, and the pure readers the panel runs: `readAt`, `pAt`, `survivorsAt`,
  `fallenAt`, `curveOf`, `thinsAt`, `linesAt`, `centreOf`): the shuffle, a bar per stat (`SHUFFLE_MARKETS` in each sport's
  `markets.js`: market, min, max, step, start). `GET /api/<sport>/shuffle?…&market=pts` reads every player on the
  slate with logs at every height of the bar through `ladderOf` with the heights as rungs (`lines`; a height h
  clears the line h − 0.5), the book's priced rungs beside them, his windows (`ownWindows`: last 3 / 5 / 10 / 20,
  this season alone from three games), the opponent's rank at his spot and, once final, his figure; one request a
  market, every bar move local. `components/picks/Shuffle.jsx` (on both boards, above the tables; the NBA's rows open
  the card) opens on **Pick the chance** (Vincent, 2026-10-30: "shuffle with the % chance instead so reverse the
  shuffling"): a chance slider (50–90%, 70% to start) and the stat, every player showing the highest height of the bar
  he clears at it (`linesAt`, `thinsAt` per player: the line, his chance there, the chance one step higher, the book's
  rung at it or the nearest above with its price and edge), the highest line first or the best edge first (the rows
  without a price last), a player without a height at the chance left off; **Pick the line** is the shuffle as it was: the bars with the count of survivors at the floor ("keep players at 35% or better"), the curve of
  survivors per height, the survivors at the bar sorted by the projection, the highest on top (Vincent, 2026-10-27; by edge before), then the chance (the chance there with its fair price, how often he
  cleared it, the book's rung at the bar or the nearest above it with its price and edge, his projection — the board's, with
  its unit and the quartiles of his range, the Projected column that replaced Thins out on 2026-10-27 (Vincent: the projected
  points / rebounds / yards per player must be on the row); the Centre column, the window × the matchup the chance is read
  around, shows only when the read is not the board's blend — and Got once final) and the fallen strip (each with the bar he
  still clears), each row with a **Health** word first (`healthOf` in `injuries.js`, `health` on every side player and
  shuffle row: In = nothing listed or listed active, DTD = on the report but not ruled out; the pill's hover names the
  status and detail as listed; **a player out tonight is left off the shuffle** — no row, no count at the floor, no
  place on the curve or in the fallen strip (Vincent, 2026-10-29: "I don't need the players listed who are out in the
  shuffle view"; until then an Out row was dimmed, and before 2026-10-27 any listed status dimmed the row);
  it sits on each board's Shuffle tab (`#shuffle`; `NflShuffle` in `NflBoard.jsx`,
  `NbaShuffle` in `NbaBoard.jsx` with its own card host), mounted on the tab's first visit and kept. The Matchup cell
  carries the opponent's rank at his spot with its factor on his rate
  (`matchup`) and, apart from it, his side's factor (`teamFactor`, "team × 1.12"); `env` on the row is their product,
  the multiplier in his projection. **Read from** (`READ_FROM`): the board's blend (default), last 5 / last 10 / season (his
  window × the matchup as the centre of his distribution), head to head (his last 4 meetings with the opponent as
  PropFinder's logs hold them, 2 at least, as it is — no matchup on top; the blend stands in without two; `SPARSE_READS`:
  scored on the tab, never ranked best) or the book's line; only the model half of the chance moves,
  the hit-rate half stays. The panel reads the season's scorecard once per sport and season (`bestReadFrom`: each read's
  over-the-line Brier — the `× matchup` predictors, the projection, the line — pooled over the bars' markets, 100 plays at
  least) and **opens on the read that has predicted best** (`readFromOf`: the tab pressed this session, else the
  verdict, else the board's blend; the verdict's tab is green, `is-best` in `globals.css`, pressed or not, with the
  figures in the note under the tabs — "Reading from last 10, the green tab: …"; press any tab to override for the
  session; Vincent's ask, 2026-10-27: no reading the note to know which to pick). A stat he never records (a
  quarterback's receiving yards) gets no ladder and no row.
- `scorecard.js` (`asOf`, `gradeBoard`, `gradePredictors`, `summarize`; the store's `gradeSlate` / `scorecardFor`,
  one finished slate memoised ten minutes): the picks scorecard, `GET /api/nba/scorecard?from&to` (ET dates, the
  season to date by default) and `GET /api/nfl/scorecard?season&from&to` (week ordinals, 19–22 the postseason), drawn
  by `components/picks/Scorecard.jsx` under the NFL board. **The NBA page draws no scorecard** (Vincent, 2026-10-31: "Why
  do we have grading now? I never asked for that"): the NBA's grading runs out of sight, behind the calibration and the
  shuffle's verdict, and the route stays for them. Every stored slate's board is rebuilt from its files with each
  player's PropFinder log cut before the ET date of his team's game (`asOf`: a pull run after the games cannot grade a
  game with its own line in the rates) and graded: every play (chance, price, edge, whether it made a table) → said /
  hit / diff / Brier overall, on the board, by chance bucket, market, matchup third, source (confirmed / PropFinder
  alone / sheet alone), form, and by edge against the book with the flat-stake return at the book's price; every ladder
  rung (model tail vs hit rate vs the blend, Brier each, the main rung, the 20–35% ceiling rungs); and the
  **predictors** (`PREDICTORS`): his last 3 / 5 / 10 / 20, season to date, his head to head (`h2h`: his last 4 meetings
  with the opponent before the game, `H2H_MIN` = 2 of them at least, from `ownWindows` with `opp`; `sparse`, so it never
  thins the rows the others are compared on: scored on the common rows that have it, with the projection and the blend
  scored on those same rows beside it, `against`, and the panel's bold is not for it), the last 5 / 10 / season × the
  matchup (the centres the shuffle reads from), the board's blend, the projection with the matchup in it and the book's
  line, each against his figure (bias, MAE, RMSE) and as an over-the-line read (said / hit / Brier), on the rows every
  predictor covers, and **his role** (`role`, sparse: the pull's anchor as a read of its own — his opportunity at the
  league's conversion × the minutes factor, plus the lift, × the environment — scored on the rows that have it with
  the projection and the blend beside it; the read that says whether rebound chances and potential assists earn a
  stronger pull). Descriptive only; the question it answers is whether a plain window
  of his own results beats the board's read, in which case the board should read from it. Beside it **the matchup,
  graded** (`matchupReport`, `matchups` per market in the summary, `MatchupTable` in `Scorecard.jsx`; every predictor
  row carries `mFrom` and `matchup`): per stat and by where the matchup came from (the cheat sheet, the cheat sheet
  and PropFinder, PropFinder alone, no table), the projection's average miss as it stood and with the matchup taken
  out, green where the matchup helped — the cheat sheets graded on the stored nights, which the replay cannot do.
- **The calibration** (`calibration.js`; Vincent, 2026-10-30, after the NHL's: "do the same calibration for the NBA board"):
  the NBA board prints its chances calibrated to what the same stated chance has landed on this season's graded nights.
  Two reads, fitted per market: a play's chance (`chanceOf`; over / yes and under / no apart, `playKey`) and a rung's
  (`ladderOf`'s tail + cleared-it mix, which the Tonight table, the court's bar, the card's ladder and the shuffle print);
  the NHL's fit (`fitHeight` in `lib/nhl-data/calibration-pure.js`: landed = σ(a + b · logit(stated)), ridge toward the
  identity, 300 chances and 25 hits at least). **A fit prints only after it has beaten the stated chance on nights it never
  saw** (`fitChecked`: fitted again on the nights before the last `CHECK_NIGHTS` = 3 and scored there, Brier, `CHECK_MIN` =
  100 chances; `use` on the fit), since no export of the site's graded nights had been read when it shipped. The
  board's math is untouched: `makeBoard`'s `buildBoard({ calibration })` moves a play's `p` (the floors, the order, the
  edge and the fair price read it) and every rung's `p` (`ladderOf(…, { cal })`, `rungFit`), the stated chance beside it as
  `raw` on the play, the rung, `ranges[market]`, the side's picks and `best`; `board.calibration` = `appliedOf` + the
  fits; the shuffle reads the market's rung fit off the board (`calibrated` on its payload): the board's blend prints
  calibrated, a window or the line under Read from as stated (`readAt`'s `raw` only on the blend). Every hover of a
  printed chance names the stated figure (`asStated`). Learned by the store's `scorecardFor(…, { save: true })`
  (`nba/meta/calibration.json`, `calibrate: true` in the NBA store's config; never rewritten unchanged): the scorecard
  route's season-to-date read (the shuffle's verdict on open) and `relearnCalibration` in the
  background whenever a refresh stores new box scores (the 2:11 AM job). The grading reads the chances as stated
  (`gradeSlate` replays without it, `raw ?? p` on its records); the route's report carries the calibration (`calibration`,
  no panel draws it since the NBA scorecard came off the page on 2026-10-31); `GET
  /api/nba/scorecard?rows=1` (the sync token reads it too) exports every graded play and rung as stated. Replayed walk-forward
  (`nba-audit.mjs`'s "The calibration, walked forward", `--graded` writes the rows): `docs/audits/2026-10-30-nba-calibration.md`.
  The NFL board passes none: its chances print as stated.
- `propfinder.js` (`makePropfinder`): `/<LEAGUE>/teams` and `/<LEAGUE>/players?teamIds=…&hydrate=stats&withOddsOnly=true`
  through `pfGetJson` in `lib/nhl-data/propfinder-api.js`. The NHL endpoints were checked; the
  NFL / NBA game-row field names have not been seen yet, so every stat is read through the
  sport's `FIELDS` spellings, prop lines through `playerProps`, and the pull records
  `fieldsSeen.unread`, shown under Data sources after the first pull. Fix the spellings there
  once a real pull shows them; never guess silently. `defenseAllowed` per position (the
  positions the Opponent rows carry), ranks 1 = most allowed, this season's rows as published (last
  season's only before a team's first game, `held`). **A stat a team row leaves out is 0 when other rows of
  the pull carry it** (PropFinder drops a zero: on 2026-10-30 WSH, LAL and HOU had allowed no blocks to PGs
  and their rows had no `blocks` key, so the board had no cell and the matchup read as no table; a stat no
  row carries stays unread, in `fieldsSeen.unread`, never a guessed 0).
- `injuries.js`: PropFinder's injury report and the without-teammate ("w/o") splits, pulled live with
  the slate, never from a file. The report is `injuryReport` on the games payload the site's own
  pages load (`GET /<LEAGUE>/v2?sportsbooks=…`, read from the bundle 2026-10-27: a JSON string whose
  `data` lists { team: { id }, player: { id, name, position }, status, type }; the per-team
  `/injuries/<league>/<teamId>` route is the fallback), statuses read into one spelling (`statusOf`),
  `isOut` = Out / Doubtful / IR / LTIR / Suspended / PUP / NFI. `fetchInjuries` in `propfinder.js`
  stores it with the pull as `data.injuries.rows`, `applyInjuries` puts `injury` / `injuryDetail` on
  every player (the report, then the depth chart's espn flag), and the players out whom the odds-only
  call left out are read one by one (`/<LEAGUE>/player/<id>`, `readFor: 'injury'`, `MAX_ABSENT_READS`)
  so their logs say which games they took part in: every game row carries `gameId`, `gamesPlayed` is a
  teammate's rows with minutes, `keyAbsences` the out teammates who took part in ≥ 40% (and 2) of a
  player's logged games, `withoutGames` his games without them, `withoutOf` the split (≥ `WITHOUT_MIN`
  = 1 game, and not every game: PropFinder's Injury Splits page speaks from one game and so does the
  board since 2026-10-27, the n / (n + 8) weight keeping one game a whisper; it was 3 and 5 together,
  which in October's fifth game left nothing to show — Vincent: "why are you not implementing the injury
  splits?"). **No injury-splits table on the page** (Vincent, the same day, after one was drawn under the
  out lines: "I don't need to see the injury splits, I need us to implement it in our prediction model in
  the background; it's getting way too messy in the layout already"): the splits reach the figures through
  `withoutOf` / `blendWithout` (the season rate and average behind every projection and rung) and the
  vacated lifts, nothing is drawn; `injurySplits` in `injuries.js` (the page's table from the logs: every
  teammate in the games the out players sat, the combination and each alone) stays as a tested helper
  for the model's use, off the board's payload. Keep new reads in the numbers, not in new panels. On the board (`board.js`) a player out keeps his chip, muted, and
  loses his table rows (`out`, the game's `out` count); for everyone else **the split drives the read**
  (Vincent, 2026-10-27, "you should use the data on the injury split tab for our predictions": until then
  it moved the season window alone at n / (n + 8), a +8 split moving a projection a point): `ownRate`
  (`lib/picks/projection.js`, where `WITHOUT_K` = 4 and `withoutWeight` live, the client-safe module
  `injuries.js` re-exports them from) moves his whole rate — the season blended with his last ten, or the
  volume read — toward his average in the games without the teammates out tonight (`own[stat].without`
  over `.n` games, `.all` the plain season) at n / (n + 4): one game a fifth of the way, two a third, four
  halfway, eight two thirds; the ladder's rungs move the whole empirical hit rate the same way and the
  play's chance every window (`blendWithout`); `without` on the play and the side's player carries names,
  n, weight, rate, avg, seasonAll. **The production an out player leaves goes to his active
  teammates** (`vacatedLifts` in `injuries.js`, 2026-10-27, Vincent: a point guard out, his assists must
  land on someone): per stat, each out player's own rate (`ownRate` of his windows; the players the
  odds-only pull left out are read one by one, so they have logs) × how much of the teammate's window he
  was part of (`playedShare`: the share of the teammate's games this season, else his last ten, the out
  player took part in — a season-long absence hands over nothing, the averages were earned without him)
  × `VACATED_SHARE` = 0.6 (the rest to the bench the pull never lists; 0.2 on the NBA board since 2026-10-28, the
  cocktail's `vacatedShare`), shared by the active players'
  own rates for the stat; where the teammate has a without split of his own, the split speaks first and
  the lift counts at 1 − its weight. The lift rides on his windows as `own[stat].lift` / `.liftFrom`, so
  `ownRate` carries it into every projection (the ladder's centre takes it as `lift`, `ranges[market]`
  and the shuffle row name it — the shuffle reads the split through the binding's `withoutFor`, since
  `shuffle.js` is bundled by the client and `injuries.js` reaches the server store —, the hovers spell
  it out, the notes' "Vacated production" line names the three biggest a side); the hit rates behind
  the chance stay his own. **The rotation** (`lib/picks/rotations.js`, `minutesTonight`, Vincent's ask of
  2026-10-27 for PropFinder's Rotations page; its data, minutes a game, is in the pull's logs, `coverage.field`):
  each active player's minutes tonight = his last five blended half and half into the minutes behind his rate
  (the season with his last ten, `RECENT_WEIGHT`), plus the out players' minutes handed to the ones who play
  (each out player's minutes × `playedShare` × the priced players' share of the 240, by their own minutes, the
  vacated minutes taking nobody past `coverage.cap` = 38); over the minutes behind his rate = `minFactor`
  (0.75–1.3, `FACTOR_MIN` / `FACTOR_MAX`; the NBA's cocktail caps it at 1 since 2026-10-28, so on the NBA board the
  minutes cut a rate and lift none) on every stat's rate through `ownRate` (`own[stat].minFactor`; the
  ladder takes it as `minFactor`), `minutes` { base, recent, vacated, tonight, factor, from } on the side player,
  the shuffle row and `ranges[market].minutes`; what his extra minutes already add of a stat comes off his
  vacated lift, so the minutes carry the opportunity and the lift the role on top; the notes' "Rotation" line
  names the minutes that moved most. PropFinder's Rotations page's own route is not known (the site's pages and
  their chunks sit behind the login; the shared bundle names only the team, player and image routes):
  `fetchSamples` reads it once a pull when `PROPFINDER_<LEAGUE>_ROTATIONS_PATH` (or `…_SAMPLE_PATHS`) names it on
  Render (`{teamIds}`, `{date}` filled in) and stores the answer's keys and first 2000 characters as
  `samples.rotations` on the pull, shown under Data sources, so the read can be written from what the page sends. **The volume
  behind a made count** (`volumeOf` in `board.js`, Vincent's ask of 2026-10-27 for PropFinder's Volume Trends;
  `volumeMarkets` per sport: the NBA's threes off `tpa` and free throws off `fta`, the NFL's receptions off `tgt`):
  his attempts a game over his last 5 / 10 / the season (the rate's own blend) × his percentage, this season's made
  over attempts shrunk toward his long run (his last `seasonCap` games) at attempts / (attempts + `VOLUME_K` = 40),
  so a 4-of-8 start reads a little over his usual rate, not as 50%; `own[stat].volume` { att, pct, pctSeason,
  pctLong, attN, field } on the side player, `ranges[market].volume` and the shuffle row carry it, `ownRate` reads
  attempts × percentage in place of the made count when the logs carry attempts (a without split's move on the
  made count rides over as a ratio), the made count stands without them (the field's spelling unseen in the pull);
  the hovers spell it out and the card's splits table carries FGA, 3PA and FTA a game beside the made counts.
  **A report row the logs have overtaken is left aside** (`markStale` in `injuries.js`, run by `applyInjuries` at
  the pull; Vincent, 2026-10-27: Dončić read as out while he was playing): a row listing a player out with a date
  before a game row of his with minutes (he played since) is marked `stale: { playedOn }`, `absentByTeam` and the
  boards skip it, the player carries `injuryStale` (the card's slot line and the shuffle's Health hover say so), the
  pull's `injuries.stale` lists them under Data sources; a row without a date stands as listed. The report is read
  one row a player, the newest dated (`latestReport`; `raw` keeps the status as listed, `date` reads `date` /
  `gameDate` / `reportDate` / `updatedAt`). **The admin's word over the report**: `POST /api/nba/injuries?date` with
  { team, key, status: 'Active' | 'Out' | null, detail, name } (`setOverride`, `nba/<date>/injury-overrides.json`),
  `GET` lists them; `pfFor` in `store.js` reads the pull through them (`applyOverrides`, a fresh object per pull +
  overrides, `injuryFrom: 'override'`, the rows replaced), so the board, the shuffle and the card follow at once;
  the card's slot line carries "He plays" / "Mark out" / "Back to the report" (the page's board reloads on the
  `nba:injury-override` event). **With and without each teammate** (`teammateSplits`, PropFinder's Lineup Lab as
  far as the logs reach; Vincent's ask, 2026-10-27): `teammates` on the card's payload = for every pulled teammate
  who took part in three of his games at least, his averages (minutes, points, rebounds, assists, threes) over the
  games they shared and over his games the teammate sat, the gap, and the teammate's health tonight; drawn under
  the splits table. The page's own route is behind the login: name it in `PROPFINDER_NBA_SAMPLE_PATHS`
  ("rotations=/NBA/…;lineups=/NBA/…", `fetchSamples`, `samples` on the pull) to see what it sends. The
  notes name who is out and the reads moved; the card's
  "w/o X" tile draws the split (`without.gameIds` from `/api/<sport>/player`); the pull's `injuries`
  meta (source, counts, the players read one by one, errors) shows under Data sources. No live pull
  had been seen when this was written: an empty report there means the route or the field names
  differ — `fieldsSeen.sample.injury` and `sample.gamesPayload` show what came back.
- `characteristics.js` (`makeCharacteristics`, bound in `lib/nba/characteristics.js` and `lib/nfl/characteristics.js`,
  `characteristics` on every board game through `makeBoard({ characteristics })`; drawn by `components/nhl/Characteristics.jsx`
  from `Board.jsx` between the game head and the sport's view, the NHL card's layout with the sport's logos and, for the
  NBA, the sides' expected points as the head pill): each team's strengths and weaknesses with a badge (`lib/picks/levels.js`,
  the three cards' shared `levelOf`: the top quarter Strong, the top three Very strong, the bottom quarter Weak, the
  bottom three Very weak; three lines a list with "View more"; the numbers on the hover only) from the pull's team rows — `totals[ABBR].for` (the team's own per-game
  row: NBA scoring, rebounding, ball movement, threes, the line, ball security; NFL the passing and running games, the
  end zone, ball security) and `.against` (NBA limiting points / rebounds / assists / threes / free throws, forcing
  turnovers, with rim protection and active hands off its own blocks and steals; NFL pass and run defense, the end
  zone, takeaways), each ranked over the teams in the pull (a `held` row reads last season's) — plus the positions its
  defense leaks to and holds from the per-position table (NBA points to the five positions, NFL yards: passing to
  quarterbacks, rushing to backs, receiving to receivers and tight ends), one line each way; the team's pill is its
  defense in thirds on the headline stat (points / touchdowns allowed); and a **style of play** from its own shares
  against the league (NBA: lives on the three / scores inside the arc, gets to the line, shares the ball /
  isolation-heavy, shootouts / low-scoring games; NFL: pass- or run-heavy, downfield or short passing, shootouts /
  low-scoring games). The NBA card also carries the NHL card's trend line (`trend: { stat, unit }` in the config:
  "Defense loosening / tightening over the last ten" when the team's rank on points allowed over its last ten,
  `totals[ABBR].l10.against` from PropFinder's All row at lastN 10, drifts `TREND_DRIFT` = 5 places from its season
  rank, over `TREND_MIN_TEAMS` = 10 teams with a last-ten row at least).
- `store.js` (`makeStore`): `<sport>/<slate>/{schedule,sheets-index,propfinder}.json`,
  `sheets/<id>.json`, `results/<gameId>.json`, `<sport>/meta/*`; the schedule re-fetched when
  stale (6 h, 10 min while a game is on) with the finished games' box scores; a sheet with a
  stored name replaces it; `boardFor`, `statusFor`, `pullPropfinder`. **The pull is stored gzipped**
  (`writeJson(…, { gzip: true })` in `lib/nhl-store.js`; `readJson` reads either form back by the gzip
  magic bytes, so the path and every reader stay as they were): the NFL pull (28 teams' priced players
  with their logs and ladders, the absent players read one by one) outgrew the bucket's 15 MB file
  limit on 2026-10-28 — "The object exceeded the maximum allowed size" in `nfl/meta/propfinder-pull.json`,
  the NFL board without a pull for two days. The store's limit stays 15 MB.
- `http.js`: the browser-agent GET (ESPN answers 403 to a user agent carrying a URL).
- UI: `components/picks/Board.jsx` (per game the sport's tables, a play-less game collapses to
  one line; the NFL's view, its `GroupTable`, `BoardNotes`, `teamMark` and `expectedPill` reused by the NBA's), `SlateList.jsx`
  (the slate in one ranked list from `board.best`: every play over the floor on the night, his likeliest line a
  player, market and side (the tables' dedupe), the chance first, with `proj` { exp, floor, ceiling } off the side's
  `ranges` drawn as a bar against the line (`rangeBar`) and `spot` { pos, rank, value, count } = the side's allowed
  table at his envPos (rankBlend, the court's and the shuffle's read; the play's own soft spot without one, `spotTone`
  by third); stat tabs by group with counts, "Soft matchups only", 25 rows then "Show all"; the NBA's first view; under 700 px
  each row stacks into four short lines — name · chance, game · price, play · matchup, projection · got — by CSS grid areas
  on the `ir-sl-*` cells, and the shuffle's rows the same way on its `sh-*` cells, Health shown only when not In), `SidePicks.jsx` (the strip above a side's view, the NHL rink's model plays for the picks boards: the board's
  best plays for the team, `side.picks` in `board.js` = the table rows over the floor for its players, one a player by
  chance, `PICKS_MAX` = 4, with the price and the edge, graded with the rows once the game is stored; the NBA draws it at
  the top of each court card with the picked players' chips ringed and a play opening the card, the NFL between the game
  head and the tables, both sides side by side — Vincent's ask, 2026-10-27) and `Sources.jsx` (drop zone, stored sheets, PropFinder pull, ESPN refresh, folder
  sync note); `components/nfl/*` and `components/nba/*` bind them.
- The Mac folder sync (`tools/mac-sync/nhl-sync.sh`, `sync_sheets`) posts any `.csv` / `.xlsx` / `.pdf`
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
  The "detailed" sheet (`NFL_<season>_W<week>_detailed.pdf`: one page a game, one team a column, a
  defense snapshot on top and the player tables under it, all pictures) goes through OCR and
  `cheatsheet-detailed.js` (`parseDetailedPages`): the team from the column's head ("SEA 63 players"),
  checked against the snapshot line ("DEN Defense Snapshot (use for evaluating SEA's …)") and the
  week's schedule (`pairTeams`); in the Quarterbacks, Running Backs — Standard and WR / TE — Standard
  tables the header's Line / Lines / Rec line and ATD words fix the columns, every row with two
  numbers is a player, his name the fragments the layout wraps around his numbers (each text-only
  row goes to the nearest numeric row), resolved against the slate's PropFinder players
  (`resolveName`, edit distance: "Bammer" → Barner; the nearest week's pull stands in when the
  week has none, `nearSlates`), book lines get their dropped decimal back (`fixLine`: "665/95" →
  66.5 / 9.5, lines end in .5) and the ATD column is the American price (`fixPrice`). Rows: pass /
  rush / rec yards with the line and no odds, anytime TD at the price; no hit rates, so on the board
  they take PropFinder's logs (a row whose player has no pull is dropped by `chanceOf`). Fixture:
  `__tests__/fixtures/ocr-nfl-detailed-page1.json` (page 1's real words, SEA · DEN).
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
- Ladders by configuration: `LADDER_MARKETS` in `picks.js` (pass / rush / receiving yards, receptions, rush + rec
  yards, pass TDs, targets, rush attempts, completions) with a `step` per market in `markets.js` (pass yards 25, rush and
  receiving yards 10, receptions 1 …), so each side's players carry `ladders` and `ranges`; the environment is the
  opponent's row at the depth-chart slot when PropFinder lists one (WR1 … RB2, `envPosFor`), else the position.
- **The matchup profile** under each game head (`lib/nfl/profile.js`, `gameProfile(g, defense, sides)` through
  `makeBoard({ profile })`, drawn by the shared `components/nhl/MatchupProfile.jsx` from `components/picks/Board.jsx`;
  Vincent, 2026-10-31: "now do the same profile for the NFL board"): the two teams side by side, five rows — Passing
  (yards a game with the passing touchdowns), Rushing (yards with the rushing touchdowns), End zone (touchdowns a game
  with the interceptions thrown, 1st = the fewest), Allows (yards allowed, passing and rushing, 1 = the most, with the
  touchdowns allowed and the last ten when the pull carries them), Soft spots (passing to the quarterbacks, rushing to
  the backs, receiving to the receivers and tight ends in the soft third, from the opponent side's `allowed` table,
  PropFinder's rank with the cheat sheet's tile blended) — each cell a word over one line with the rank phrases toned
  (`lib/picks/profile-words.js`, the NHL's and the NBA's words), the defense pill in each head (yards allowed in
  thirds), the expected touchdowns as the card's pill when the sides carry `teamProj.td`; the characteristics card stays
  as the fallback for a game without a profile. `__tests__/nfl-profile.test.js` (the builder, the render; `MOCK_OUT`
  writes `profile-nfl-<theme>.html` for `tools/mock/screenshot-profile.mjs`).
- Routes (`authorize()`, admin session or sync token): `GET /api/nfl/picks?season&week&type|date`,
  `GET /api/nfl/shuffle?season&week&type&market`, `GET /api/nfl/scorecard?season&from&to`,
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
- The NBA cheat sheet (`nba_<date>.pdf`, pictures: one page a game, one team a column, the logo on
  top, twenty rank tiles and a Name · POS · MIN · PTS · REB · AST · 3PM table of season averages;
  no lines, prices or hit rates) goes through OCR and `cheatsheet-ocr.js` (`parseNbaPages`): the
  team is named through the roster (the logo is not text: the column's players matched against the
  slate's PropFinder pull, or the nearest night's, `nearSlates` ±3 days; the schedule fills the
  other side), the tiles are read by grid position (five rows PG · SG · SF · PF · C, four columns
  pts · reb · ast · tpm, `parseTiles`; "d0th" / "qth" = 10th) as what the column's opponent gives
  up (`meta.oppRanks`), the table's header fixes the columns and each player's name joins the
  fragments around his numbers; averages and minutes get their dropped point and colon back
  (`fixAvg`: "38" → 3.8, "1156" → 11.5; `fixMinutes`: "2744" → 27.7). Rows are mentions (market
  null, group `players`, `avg: { min, pts, reb, ast, tpm }`), so the board marks the sheet's
  players' PropFinder plays confirmed. Fixture: `__tests__/fixtures/ocr-nba-page1.json` (BOS · DET).
- **The board's layout** (Vincent, 2026-10-30, of the courts and the per-game tables: "you have built a website which
  makes it so incredibly difficult to find good match ups easily"): `NbaBoard` draws `SlateList` (every play on the
  night ranked, a row opening the card with the side's entry for the player), then the games folded to a line each
  (`components/nba/NbaGame.jsx`, `GameFold`: the teams, the tip or the score, how many are out, the plays over the
  floor and the best one). Opened: the characteristics card, then a column per team — who is out, **PropFinder's table
  of what the opponent gives up per game to each position** (the court's `AllowedTable`, exported: every stat the table
  carries with its figure and rank chip tinted by third, the window tabs '26-'27 · '25-'26 · L5 / L10 / L15 / L20 over
  it (`onWin`; the season table the projections read is the default), the league's average in a last row, Lg; a
  ranks-only grid for five stats stood there on 2026-10-30 for a day — Vincent: "I need the propfinder data above each
  court again like how we had it") and every active player's projection per stat (`ranges[stat].exp`) tinted soft / tough by the
  matchup at his envPos, a play over the floor ringed with its line and chance under the figure, a row opening the card
  — and "Show the courts and the tables" for the courts below and the five group tables. **Since that evening the games
  come first, open** (Vincent, after the courts gained the bar: "I don't see the courts nor the shuffle bars in the best
  plays tab", then "too many clicks. I need the games listed first along with the best bets"): `NbaBoard` draws the games
  before the ranked list, every game open (`closed` set in `NbaSlate`, Collapse all / Expand all in the head, `GameFold`
  takes `open` / `onToggle`), and an opened game shows **the matchup profile** (`components/nba/NbaProfile.jsx` = the NHL card,
  `components/nhl/MatchupProfile.jsx`, on `profile` from the board game; `lib/nba/profile.js` `gameProfile(g, defense,
  sides)` through `makeBoard({ profile })`; Vincent, 2026-10-31: "now do the same profile for the NBA board" — the
  firsthalfscore layout of 2026-10-30 and its offense / defense toggle are gone): the two teams side by side, **five rows**
  — Scoring (points a game with the threes and their share of its points), Rebounding, Playmaking (assists with the
  turnovers, 1st = the fewest), Allows (points allowed, 1 = the most, with the last ten and tightening / loosening at
  `TREND_DRIFT` = 5 ranks), Soft spots (the positions in the soft third it gives points, rebounds, assists and threes to,
  from the opponent side's `allowed` table, PropFinder's rank with the cheat sheet's tile blended, `rankBlend`) — each
  cell a word over one line with the rank phrases toned (`lib/picks/profile-words.js`, shared with the NHL's builder:
  `levelOf`, `badgeOf`, `cellOf`, `rankPart`; Elite · Strong · Average · Weak · Poor for an attack, Elite · Tight ·
  Average · Leaky · Very leaky for a defense; green = more points likely from that side's angle, red = fewer), the
  defense pill in each head, the game script and the expected points as the card's pill, both reads on the hover;
  **the game script** (`gameScript`; Vincent, 2026-10-31: "I need to know the game script. Will it be a fast paced game or
  not"): the two teams' pace this season from PropFinder (`paceStats` on its team objects → `pace` on the pull, `paceTable`
  in `lib/picks/propfinder.js`: possessions a game with rank and offensive / defensive efficiency, last season's for a team
  without a row, `held`), their mean against the league's — Fast / Average / Slow at `PACE_EDGE` = 1.5 — and the book's total
  and spread as the schedule carries them (ESPN's line, `odds` on the game), High / Average / Low against twice the league's
  points a game at `TOTAL_EDGE` = 5: the pill reads "Fast pace · high total 236.5 · DET -2.5 · 212 points expected
  · …", green (`tier: 'high'`) when both point up, red when both point down, the possessions on the hover; the game line
  carries the words too (`script` on the profile); a pull made before 2026-10-31 has no pace (the next pull adds it); the profile passes its own
  `title`, `legend` and head `sub` to the shared card. `__tests__/nba-profile.test.js`, `nba-profile-render.test.js`
  (`MOCK_OUT` pages `profile-nba-<theme>.html` for `tools/mock/screenshot-profile.mjs`); the Offense / Defense toggle that
  opened on Defense that morning (`profileView` held in `NbaSlate`, still threaded to the card and ignored there) is gone with the
  two views; the characteristics card stays as the fallback for a game
  without a profile and on the NFL board), then the two courts (each with PropFinder's table, the stat tabs and the
  shuffle bar, every player's projections, **who is out under the court** — Vincent, the same night — and the Tonight
  table), and "Show the team columns and the tables" folds the columns and the five group tables. A player listed day-to-day
  is no longer greyed on the court or in the Tonight table (`p.out`, not any injury listing). Class names `ir-gf-*`:
  the start screen owns `ir-game` / `ir-games`.
- The courts (`components/nba/NbaCourt.jsx`, the rink's basketball twin, drawn by `GameFold` behind the opened
  game's switch, above the five tables): per team a half court (50 × 47 ft, the basket on
  top) with five zones — PF · C · SF under the basket, SG · PG on the perimeter (`ZONES`; G joins the
  guards, F the wings, `layoutCourt`; PropFinder's depth chart places a player by his slot when the pull
  carries one — `depthChart` in `lib/picks/propfinder.js` reads `team.depthChart.positions[SLOT].players`
  (the NHL team objects' shape) into `data.depth[team][SLOT]`, `sidesOf` puts `slot` / `depth` on each
  player and orders the side starters first, the chip's badge reads "PG1", `lineup: 'propfinder'` on the
  side; else the roster position — three chips a front zone, four a back one, the rest listed under it) — each tinted by what
  tonight's opponent gives up to that position for the stat picked in the tabs above each court (Points ·
  Rebounds · Assists · Threes · Steals · Blocks, `COURT_METRICS`, one setting for the slate as the rink's Shots / Goals
  switch; steals and blocks since 2026-10-30, `LADDER_MARKETS` in `lib/nba/picks.js` and `SHUFFLE_MARKETS` carry them,
  so every player has a range and a ladder for both). **The card's order since that night: PropFinder's table with its window tabs, the Players picker, the stat tabs
  (Points to start) with the shuffle bar under them, then the court** (Vincent: "put the shuffle bar right
  under the propfinder table so I can see the table, the bar (incl type) and the court in 1 view"). **The stat's shuffle bar** (`CourtBar`, Vincent,
  2026-10-30: "a shuffle bar that I can move … the % displayed next to the player on the court"): the Shuffle tab's
  heights for the stat (`SHUFFLE_MARKETS`), one height per stat for the slate (`CourtShuffleProvider` in `NbaCourt.jsx`,
  wrapping the board in `NbaBoard.jsx`: the bar heights and the night's shuffle payload per stat — `GET /api/nba/shuffle`,
  read once a stat when a court first asks for it, every court sharing it), every chip carrying his chance to clear the
  bar from his shuffle row (`readAt` in `lib/picks/shuffle.js`, so the court's figure is the Shuffle tab's; the book's price
  beside it when a book prices that exact line; "out" or "no logs" for a player the shuffle has no row for; once the game is
  final his figure against the bar's line), the bar's note counting the side's players at 50% or better. **At the book's
  main line the chip prints the board's play chance** (`mainAt` in `shuffle.js`: `pAt` / `readAt` return `main.p` on the
  blend read when the height's line is the player's main line, `play: true` on the read, the rung's edge on it too; the
  Shuffle tab's rows the same; Vincent, 2026-10-31, "conflict": the strip said Schröder o2.5 rebounds 72%, the chip 3+
  80% on the same line — two reads of one line, the play's `chanceOf` and the ladder's rung; one number now). **Every chip
  shows his four projections** (`CHIP_STATS`: PTS · REB · AST · 3PM as P · R · A · 3P, the picked stat appended when it is
  steals or blocks, the picked one marked; `ranges[stat].exp` through `boardRead`; Vincent: "by default I need to see per
  player the projected number for points / assists / threes / rebounds"), so the chips flow in a column per zone
  (`.ir-court-stack`, no two overlap; `ZONE_MAX` three a zone, the rest under the court). **A row of the PropFinder table
  above the court pressed rings that position's chips and fades the others** (`onPos` / `hiPos` on `AllowedTable`,
  `is-hi` / `is-dim`; press again to show everyone; the **Players** picker under the table — All · PG · SG · SF · PF · C,
  Vincent, 2026-10-31: "an 'all' option to select all players" — does the same, All bringing every player back)
  over the tab picked beside them (**this season's table as PropFinder publishes it**, the default and the table the
  board reads, labelled by its years, "'26-'27"; last season's in full, "'25-'26", `allowed.prior` from
  `defense.prior`, a comparison only; then L5 / L10 / L15 / L20 = PropFinder's `lastNGames` rows as published,
  `defenseAllowed` → `defense.windows[l5]` with their own ranks and `league` = the league's average per position
  and stat; `windowsOf` / `tableFor` / `windowLabel` in the court, `zoneTone` by rank third, rank 1 = the most
  permissive), the zone's foot carrying the rank; **above the table, who is out tonight** (`OutLines`: the side's
  team then the opponent, from `side.out` = PropFinder's injury report through `absentByTeam`, name, position,
  status and detail; Vincent's ask, 2026-10-27);
  every chip his **projection for tonight**: **the board's figure** (`ranges[stat].exp` on the side's
  player, `boardRead` in the court: `lib/picks/projection.js`'s `ownRate` = his season blended with his last
  ten at 0.65 / 0.35, this season's games alone (the cocktail's `windows` and `scope`), × `envFactor` = 1 + 0.6 × (the opponent's allowed at his spot over
  the league's average − 1) **on the season table**, counted at gp / (gp + 40) of itself for the games behind
  the table (`matchupK`), × the side's factor; `rate` / `matchup` / `team` /
  `env` ride on the range so the hover spells it out; green over the line, red under). **A window moves
  no figure** (Vincent, 2026-10-27: the shuffle said #26 PF × 0.96 and 15.8 for Randle at BOS while the
  court on L10 said #10 and 17.3, the chip's projection then following the window): the L5 / L10 tabs
  tint the zones and fill the table, the chip, the Tonight table, the shuffle's Expected and the card
  all show the one board projection, and the chip's hover says what the picked window would have read
  (`windowRead`); the shuffle's Matchup hover names the season table it reads. The chip also carries the
  book's main line and the chance for the stat (`playFor`: the over or yes side), ✓ when
  the cheat sheet names him (the hover names the file), flame / snowflake / soft spot, his projection
  alone when he has no line; above the court the opponent-allowed table (per position, every stat
  PropFinder's table carries, value + rank chip, the `nhlx-pfd-*` styles, the picked stat's column
  marked, the league's average on hover) and under it "Props by player": each player's projection, line
  and chance per market (PTS · REB · AST · 3PM · PRA) — no: the one table under each court ("Tonight",
  `PlayersTable` / `RangeCell`) reads per player and market **what he is expected to get, his
  floor–ceiling and the book's line with his chance to clear it** (`ranges[market]` on the player: `exp`
  = the ladder's centre, `floor` / `ceiling` = the quartiles of his distribution, he lands between them
  half the nights, `line` / `p` / `odds` = the main rung), the whole ladder in the hover; a ladder table
  was tried (2026-10-20) and read as a wall of numbers; the card draws the picked market's ladder as rung
  buttons over the bars. The data is `sides` on every
  board game (`sidesOf` in `lib/picks/board.js`: per team its players with their plays, `own` = his
  { l5, l10, season } averages per stat from his logs, and `ladders` per market (`ladderOf`, the markets in
  `LADDER_MARKETS` of `lib/nba/picks.js`: the book's rungs when the prop carries `lines`, else rungs by the
  market's `step` around the main line, two under and four over; each rung with his realistic chance of
  clearing it tonight — 0.7 his own distribution's tail over the rung (a normal centred on `ownRate` ×
  the opponent's `envFactor` at his spot from the season table, his spread over his last 82 games floored
  at a quarter of the projection, × 1 + 0.2 · 5 / (n + 5) in his first games, `upperTail`), 0.3 how often he
  actually cleared it (L5 0.1 / L10 0.3 / season 0.6, the season rate this season's from his first game), that
  share handed to the tail in his first games at 6 / (n + 6) (the cocktail's `ladderModel` / `empK` / `spreadA` /
  `hitWeights`; half and half before 2026-10-28; `wModel` on the rung is the tail's share); no price in
  the number, the book's price beside its rung; `model`, `emp`, `proj`, `sd`, `env` on every rung). **A side's
  projections add up to the team's expected total tonight**: the pull keeps every team's own per-game row
  (type Team, All) and what it gives up in all (`defense.totals[ABBR].for / .against`, `leagueFor`, the
  same held / blend rule); `sidesOf` reads the team's expected figure per stat (its own × the opponent's
  all-positions environment, damped) as `teamProj`, **a ceiling on the side's projections, never a lift**: only
  when the active players' own rates (the lifts and the without splits in) add up to more than it does the side
  scale down to it, `scale[stat]` (0.5 at the least; the combos on their parts), on the side and on every player;
  `projectFor(own, allowed, pos, stat, scale)` multiplies it in and the ladder's `env` carries it, so a roster of
  last season's shares on other teams no longer adds up to 150 points. Until 2026-10-27 the factor also lifted:
  the total pro-rated to the priced players' minutes (`coverage` in `lib/nba/picks.js`, `share` / `minutes` still
  on the side for the hover) over their rates, capped at 1.5 — the pull is odds-only, the rates never add up to the
  team, and the factor put the same ×1.5 on a non-shooter's threes as on the shooters' (Castle at 3.6 threes
  against a +800 book; Vincent: realistic figures, and an out player's production to his teammates, which the
  lifts above do player by player),
  the PropFinder players without a play too, and
  `allowed` = the opponent's rows with ranks, `league`, and `windows`, every cell carrying the cheat
  sheet's tile for it as `sheet` when the sheet has one, with `sheetValue` (the tile's rank placed on
  PropFinder's spread for the position and stat: the value the defense of that rank allows, `sheetValueOf`
  in `sidesOf`, a 30-team rank mapped onto the teams the table has) and `rankBlend` (the two ranks' mean,
  the court's tint). **The matchup is the cheat sheet first, PropFinder next, blended** (`matchupOf` in
  `lib/picks/projection.js`; Vincent, 2026-10-28: the sheets say how the matchups look, PropFinder adds
  the player stats, everything combined into one figure a player): the sheet's read is its tile on
  PropFinder's spread (`envFactor` of `sheetValue`), or on the standard spread without a table
  (`sheetFactor`: rank 1 × 1.09, the last × 0.91, `SHEET_SPREAD` = 0.3 damped by `ENV_WEIGHT`), PropFinder's
  its value over the league; with both the factor is their mean, with one it stands alone, so the sheet
  alone now moves the number (a pull without a defense table read no matchup at all before). The
  factor rides as `matchup` on the range and the shuffle row with `matchupFrom` { pf, sheet, from:
  'blend' | 'propfinder' | 'sheet' }, the court's zones and table cells tint by `rankBlend`, the shuffle's
  Matchup cell shows it, and the hovers on a zone foot, a chip, a card and a shuffle row name both reads
  (`sheetCheck` still says whether the tile reads the same third). Until 2026-10-28 the sheet confirmed the
  environment on a hover and never changed a number; or the sheet's tiles with ranks only when the
  slate has no pull. A row standing in from last season reads "last season" in place of the GP count. PropFinder's NBA team rows are per-game figures already (`rowsPerGame: true` in
  `propfinder-nba.js`; 2026-10-20 the table read 0.3 points a game after a second division), and only
  regular-season rows (`seasonType` REG) make a season table. **A player's season window is this season's from his first game**
  (`SEASON_MIN` = 1 in `lib/picks/board.js` and in the card; Vincent, 2026-10-27: this season, never last
  season's; last season's games, his last 82, stand in only until he plays, when the card's season tile
  reads "'25-'26"), the ladders' rungs' season rate the same. **A team's season table is this season's** as PropFinder publishes it, from its
  first game (Vincent, 2026-10-27: the Season table reads this season for every sport, never last
  season's; the ten-game hold and the games / (games + 15) blend that stood in `defenseAllowed` are
  gone); last season's row stands in only for a team without a game yet (`held: true`), and the
  court's row reads "last season" until then. Last season's full table rides along as `defense.prior`, the second
  tab on the court and the card ("'25-'26"), a comparison only; the team totals carry the last ten this season as
  `totals[ABBR].l10` and last season as `.prior` (the characteristics card's trend line). A chip shows the book's main line (`playerProps` in `lib/picks/propfinder.js`: of the lines a
  book flags main the one nearest his own last-ten average — a book flags its alternate ladder main too,
  which put Drummond on o1.5 points on 2026-10-20 — else the line priced both ways with the most books;
  the whole ladder rides on the prop as `lines`; preseason rows, seasonType PRE, are left out of the logs
  and the anchor — they put LeBron on o14.5 points; markets the board does not settle whose names carry a
  market's word — "Player Made Two Pointers", "Player Fantasy Score", "… Attempted" — are skipped by
  `NOT_A_MARKET`, the live pull of 2026-10-20 filed them under points and threes; **the main line is the one the
  book prices nearest a coin flip** — `balance` in `playerProps`, the over's implied probability with the vig split
  against 0.5 — before the one priced both ways by the most books and the one nearest his average: on 2026-10-29 the
  books priced their whole alternate ladders both ways and "the most books" put Wiggins, Dort and Merrill on o4.5
  points at 100% and -10421, Okongwu on o3.5 rebounds at -772; **a window of minutes is no game line** — "Points in the
  First 3 Minutes", "first5MinPoints", "points3min" are skipped as the quarters are (`WINDOW`), and a line under 40% of his
  own last-ten average (4 a game and up) stays on the ladder and out of the pick: 2026-10-30 the list's top read Coward
  o0.5 and Boozer o1.5 points, projected 14.6 and 23.5), one stat line, three
  chips under the basket and four on the perimeter (`ZONE_MAX`). PropFinder's NBA depth chart arrives as a
  JSON string in `team.depthChart.data` (`depthChart` parses it; `starter` = `nba_com_starter`, `injury` =
  `espn_injury_status`); usage comes as `usagePct`, a fraction, read as a percentage. "Pull PropFinder" sits in the board head beside Reload (the same call as
  under Data sources: `POST /api/nba/refresh?only=propfinder&force=1`).
- The player card (`components/nba/NbaPlayerCard.jsx`, the NHL card's layout; `NbaPlayerCardProvider`
  wraps the board, `useNbaPlayerCard()` opens it from any chip or "Props by player" row with
  `{ key, player, team, opp, venue, market }`): the top bar (logo, position, tonight's game, PTS /
  REB / AST a game this season), market tabs with the hit rate for the pressed split, the Over +
  line block with the board's chance, price and sheet check for that line (the line menu lists the
  book's ladder with its prices, his plays' lines and ±3 around the one shown) and his projection for
  tonight — the board's (`board` in the `/api/nba/player` payload: his entry on the slate's board from
  `boardFor`, `envPos`, `scale`, `ranges`, `ladders`, `plays`, so the card shows the same figure, ladder
  rungs and lines whichever view opened it, the shuffle's rows included; `projectFor` on the season
  table only for a market without a ladder; the tabs on the right — this season's table, last season's
  (`prior` in the payload), the windows — fill the allowed table and the hover says what that tab would read), the per-game bars against the line (`Bars`: green over, red
  under, the average pill), the split tiles (L5 · L10 · L20 · season · vs opp · home / away; press one
  to draw its games), the splits table (GP, MIN, PTS, REB, AST, 3PM, PRA, over %), and on the right
  the opponent's allowed table (Season / L5 / L10 … tabs, his position marked, the league's average at
  his spot under it) and "His lines tonight" (every play the board has on him, click one to draw it).
  Data: `GET /api/nba/player?key&date` → `playerFor` in `lib/picks/store.js` (the slate's PropFinder
  pull: his logs newest first, his props with their ladders, the game, the opponent's rows with ranks,
  `league` and `windows`); the plays ride in from the opener. Hit rates and splits are
  computed in the card (`hitRate`, `splitGames`: season = this season's games from his first,
  else his last 82). Usage rate, rebound chances and potential assists (PropFinder's
  player-summary figures) are read per game row as optional `FIELDS` (`usg`, `rebCh`, `potAst`;
  `optional: true` reads null when the row lacks the key, so an unknown spelling shows as "—" on
  the card and in the pull's unread list, never as 0) and averaged per split in the top bar and
  the splits table.
- **First basket** (`#firstbasket`, `components/nba/NbaFirstBasket.jsx`, `GET /api/nba/firstbasket?date[&backfill=0]`,
  `firstBasketFor` in `lib/nba/store.js`, the model in `lib/nba/firstbasket.js`; Vincent's ask, 2026-10-27, after
  PropFinder's First Basket page): who scores the first field goal of each game. ESPN's summary carries the plays, so
  `parseOpening` in `lib/nba/espn.js` stores with every box score an `opening` — the tip (the two jumpers, who gained
  possession, by team), the first basket (scorer, team, 2 or 3), the first points (a free throw counts) and each team's
  first shot (`__tests__/fixtures/espn-nba-summary-plays.json` is DAL at MIA of 2026-10-26, trimmed); results stored
  before it lack it and the tab's load reads a dozen of them again from ESPN each time (`MAX_BACKFILL`, `missing` in
  the payload says how many remain; a summary without plays is marked `openingMissing`). The season's record
  (`firstBasketRecord` over the season's stored results, ten minutes a cache): per player (ESPN id, joined to the pull
  by `normName`) his starts, first baskets, first points, first shots and jump balls won / jumped; per team its tips,
  first baskets scored and conceded; and how often the team with first possession scored first. Each starter (the
  depth chart's: the nba.com starter flag, then depth 1 a slot; the five most-played pulled players without a chart,
  `startersOf`; the out left aside, the overrides in through `pfFor`) gets P(team first) × his share: P(first
  possession) is the starting centre's jump record ((won + 2) / (jumped + 4), `TIP_K`), the team's tip record standing
  in, half without either, × `FIRST_POSSESSION_EDGE` = 0.57 (the season's own share once 40 games are on record); his
  share is his field-goal attempts among the five starters × his finishing (`FINISH_WEIGHT`), moved toward his first-shot
  share this season at n / (n + `SHARE_K`), the five normalised; his own first baskets over starts blend in at starts /
  (starts + `OWN_K`). The chance carries its fair price and the book's first-basket price when the pull has one
  (`firstBasketOdds` in `lib/picks/propfinder.js`: the items naming a first basket / first field goal, not a team's or
  first points, the best price as `firstBasket` on the player, never a market), with the edge; the score is the chance
  × 4 on 0–100. Once stored, who scored first, the first points and the tip are on the game and the rows are graded.
- `tools/check-defensive-matchups.mjs <export.csv> <picks.json>` compares PropFinder's Defensive Matchups page export (what each team allows per position, with ranks) against the board's `sides[].allowed` table in a saved `GET /api/nba/picks?date` payload, cell by cell; the export itself is never ingested (its "OPPOSING PLAYER" header is no player column, the parser reads zero rows and the store rejects it).
- Routes: `GET /api/nba/picks?date`, `GET /api/nba/shuffle?date&market`, `GET /api/nba/scorecard?from&to`, `GET|POST|DELETE /api/nba/sheets?date`,
  `POST /api/nba/refresh?date&only=schedule|propfinder`, `GET /api/nba/status?date`, `GET /api/nba/player?key&date`,
  `GET|POST /api/nba/injuries?date` (the admin's injury overrides); `POST /api/nba/refresh?only=calibration` (token or
  admin) grades the season again now and relearns the calibration and the reliable chances without waiting for new box
  scores — the workflow's `what: calibration` runs it with the site's token (Vincent, 2026-10-31: "open the shuffle tab
  to relearn the calibration", which this container cannot).
  `.github/workflows/nba-data.yml`: 9:47 ET and 5:23 PM ET (schedule + PropFinder), 2:11 AM ET
  (last night's box scores). UI: `components/nba/NbaApp.jsx` (date picker), `NbaBoard.jsx`,
  `NbaSources.jsx`. Tests: `__tests__/nba-board.test.js` (`fixtures/espn-nba-summary.json`).

## The data jobs' clock

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

## Performance: what is computed once and kept

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
- `middleware.js` skips `/api/nhl/data/media` (hundreds of image requests a page, the route checks
  the session itself); the media route's CDN fallback redirect is cacheable for a day.
- Tests: `__tests__/memo.test.js` (the helpers, the tables off one aggregate),
  `__tests__/nhl-slate-memo.test.js` (the builders through the bucket mock, the blob budget, the NBA
  board). When adding a builder a page waits on, wrap it the same way and name its inputs.

## Audits

- `tools/audit/` (README there): the boards' reads replayed leak-free over the season from public data with
  the site's own functions, and one slate laid out game by game, graded. `npm run audit:nhl -- --date …` replays
  the plain-rate read (`picks-pure.js`: the goals read since 2026-10-27, the shots stand-in) over the NHL API's
  box scores with the variants beside it (the study's blends, the table blended / shrunk / last season's / none,
  the goal-rate shrink); `npm run audit:nba -- --date …` rebuilds the NBA board (`buildBoard` on a pull built from
  ESPN's logs, graded by `lib/picks/scorecard.js` as `gradeSlate` does; pseudo lines, no price). The store is not
  needed; the model run's shots λ is not in it (the History tab's export + `grade_blend.py`). Reports in
  `docs/audits/`. The first, 2026-10-27 (`docs/audits/2026-10-27-model-audit.md`, 6,505 NHL skater-games and
  30,532 NBA rungs): this season's opponent table at ten games reads 1.5–2.4× as wide as a season's and
  correlates 0.1–0.5 with it, so inside the formula it hurts (Brier 0.1501 against 0.1459 blended, the Best bets
  shots rows 62% said → 55% hit); the NBA matchup from a ≤ 5-game table costs 0.24 of MAE on every projection;
  the NBA ladder is over-confident above 60% (his spread ~1.4× too narrow, the hit-rate half unshrunk); "hot"
  plays hit 36% on a 55% said. No number was changed by the audit; the changes it asks for are listed there.
- The NBA cocktail (`docs/audits/2026-10-28-nba-cocktail.md`, `tools/audit/nba_cocktail.py` and the board replayed
  with `--cocktail old|site|<json>` on both seasons, `nba_ab.py` side by side): the windows, the matchup's damping, the
  hit-rate weights, the tail's share, the spread, the minutes cap and the vacated share tuned on 2025-26 and checked
  on 2026-27 from opening night, shipped as the NBA's `COCKTAIL` (above). The backtest, this season's 56 games night
  by night: the points projection missed by 5.39 on average (the board as it was 5.59, a plain last ten 5.43), every
  ladder but rebounds' and assists' a little better than the old board's. The windows on this season's games alone
  cost the first two weeks of a season (5.08 with last season's games behind them this week, 5.27 against 5.43 over
  2025-26's first two weeks) and nothing after; last season's playoffs themselves did no harm (the regular season
  alone behind them, `scope: 'regular'`, 5.11). Open: the team scale's ceiling helps this season and costs last
  season (most of a −1.05 points bias there); a per-minute rate. The book's game total and spread, home, rest and a
  stronger teammates-out read were measured and left out.
- The NBA projections, stat by stat (`docs/audits/2026-10-29-nba-projections.md`, `tools/audit/nba_stats.py report |
  pull`; Vincent, 2026-10-29: look at how far off the projected points / rebounds / assists / threes are, separately).
  This season with the pull, the average miss: points 5.09 (his typical figure 11.7), rebounds 2.06, assists 1.53,
  threes 1.01, PRA 6.79; last season even his whole season's average known in hindsight missed by 4.80 / 1.93 / 1.42
  / 0.99, the rest is the game's own swing. A sixth of the points miss is his minutes (12% of rebounds', 9% of
  assists', 7% of threes'); threes read off attempts × percentage (1.02 against 1.09 off the made count). Before the
  pull a player's first games ran to the ends (each projected point over the middle worth 0.77 this season, a three
  0.62), the pull's K fitted per stat on 2025-26's first two weeks. Window weights, the matchup and the minutes lift
  read the same way for every stat; the team ceiling splits (helps every stat this season, cost points, assists and PRA
  over 2025-26), kept and to read again at mid-season. Next lever: the minutes read. The same day the role went to
  his own opportunity (usage, rebound chances, potential assists; the replay computes usage from ESPN's box scores,
  `usg` on its rows): points 4.99 this season, PRA 6.70.
- The NBA projections, what else moves them (`docs/audits/2026-10-31-nba-accuracy.md`, `tools/audit/nba-fetch.mjs` for the
  raw feeds, `tools/audit/nba_minutes.py`; Vincent, 2026-10-31: "increase accuracy where possible"): this season's 71
  games replayed with the cocktail as shipped. The points miss is 5.00 (4.10 had the board known his minutes); last
  season's regular season behind the windows 5.03, a last-five window 5.01, the matchup / ceiling / lift each worth
  nothing measurable, the undamped matchup 5.46. Better minutes predictors exist (his season to date misses by 4.36
  minutes against the board's 4.75) but re-projecting on them moves no stat (points 5.05 against 5.03): the minutes are
  the night's own swing. A linear shrink of the spread overfits a week. A wider rung spread (`spreadA` 0.5) trades the
  main rung (Brier 0.2374 → 0.2350) for the tail rungs (the 20–35% band lands 21% instead of 25%), the ladder as a whole
  unmoved; the hit-rate half shrunk to ½ lands the 60–80% bands but drags the low rungs (0.152 against 0.1405). Nothing
  changed; the next audit is the site's own graded nights with real lines and prices, by market and edge.
- The game script, tested (`docs/audits/2026-10-28-game-script.md`, `tools/audit/nhl_game_script.py`; Vincent's
  question of 2026-10-28: a team strong at home against a visitor leaking over its last ten dominates, and the shots
  and goals divide by the opponent's weaknesses). On 2025-26 and 2026-27's box scores: a team's shots tonight follow
  its own volume (elasticity 0.99) and what the opponent allows (0.92), season to date, + 2.4% at home, ∓ 4% on a
  back-to-back; a team's own home split (half-season correlation −0.23) and the last ten add nothing; teams projected
  at 56%+ of a game's shots took 59% and won 69%, yet in one game shot share and goal share correlate 0.09 (score
  effects). Which position a defense gives its shots to is not a trait (C / LW / RW −0.09 to 0.13, D 0.40): the
  opponent's weakness is how much it allows, not to whom, so the volume divides by the skaters' own shares. The
  model's Stage 1 steps (−6% at most for a tight defense) lose to the fitted elasticity (deviance 1.47 vs 1.27 this
  season) and its team goals read loses to the league average early; the script read at the skater level puts the
  Best bets rows from 62% said → 55% hit to 60% → 58% (goals 40% → 35% to 39% → 39%). Proposals there; nothing changed.
- The NBA board's chances, calibrated (`docs/audits/2026-10-30-nba-calibration.md`, `nba-audit.mjs`'s walk-forward section;
  Vincent, 2026-10-30: "do the same calibration for the NBA board"). The replay is at stand-in lines without a price. Over
  2025-26, walked forward (refitted weekly, with the site's check), every market printed at or under its stated Brier
  (plays 0.2381 → 0.2366, rungs 0.1408 → 0.1404). The play read overstates (a stated 60–70% landed 55%; 57% as printed,
  b 0.52–0.68 for points, rebounds, assists, PRA). The rungs were near honest (b 0.82–0.88), steals and blocks less so
  (0.71–0.74). This season's first week overstated more than the nights after, so the check kept points, rebounds,
  assists and PRA rungs as stated through Oct 29. The site's own fit, on book lines, is the one the board prints.
- What it takes (`docs/audits/2026-10-30-nhl-what-it-takes.md`, `tools/predictors/thresholds.py`; Vincent, 2026-10-30:
  what a skater needs in stats and environment to get 3 / 4 / 5 / 6 shots and 1 / 2 / 3 goals, the last three weeks,
  then "forget about last season": this season's numbers alone). 5,159 skater-games, Oct 9–29, rules fitted on the
  first two weeks and checked on the third. Base rates 21.6% / 9.7% / 4.1% / 1.7% for 3+ … 6+ SOG, 15.1% / 2.0% / 13
  games for 1+ … 3+ goals. At 3.5+ shots a game: 3+ 52%, 4+ 34%, 5+ 22%, 6+ 11.5%, 1+ goal 33% (56% / 37% / 25% / 14% /
  35% with 5+ games behind the rate; a rate from one to four games reads well short). Attempts and shots a game sort
  the shot nights (AUC 0.71–0.82), scoring chances the goals (0.68–0.88). The opponent's position table, read against
  the league's at the position (the raw per-skater figure sorts forwards from defensemen), sorted nothing for shots or
  one goal (0.50–0.55); the opponent's goals against a game leaned toward the big shot nights (0.53–0.60), the shots it
  allows at the position toward multi-goal nights; the goalie's save % nothing; home a little. The rare marks' rules
  fell back to the base rate on the check week. Descriptive; nothing changed.
- Patterns (`docs/audits/2026-10-30-nhl-patterns.md`, `tools/predictors/patterns-rows.mjs` → `patterns.py`; Vincent, 2026-10-30:
  every data point, rules per line, pills; then "expand to October 16 through October 29", the check weeks): 6,648
  skater-games of this season (all 148 games), 239 figures each, a beam search of one- to three-condition rules per line
  on Oct 1–15 (12+ skaters a rule, every condition worth two points), checked on Oct 16–29 (3,370 skater-games): the
  check weeks kept 90% / 99% / 100% / 94% of the lift for 3+ / 4+ / 5+ / 6+ SOG and 90% / 66% for 1+ / 2+ goals. 3+ SOG
  is volume, minutes and a ceiling (a 6+ shot game on record, 18–20+ minutes lately, chances at the venue: 55–63%); 4+
  SOG attempts per 60 or unblocked attempts with minutes (36–44%); 1+ goal his volume at tonight's venue with first-line
  minutes (40–49%); the opponent's goals against L5 adds 3–5 points inside the shot rules; among 2+ shots-a-game skaters
  the opponent's attempts / chances / shots allowed move 3+ SOG 6–8 points bottom fifth to top on Oct 1–15 and 11–14 on
  Oct 16–29, as the tables fill; streaks are colour but for the point streak; one rule clears 20% for 5+ SOG, none the
  bar at 6+ SOG or 2+ goals (the 3.5+ shots-a-game tier fills 6+). The rules feed the Patterns tab (above).
- The season backtest (`docs/audits/2026-10-30-nhl-season-backtest.md`, `tools/predictors/patterns_backtest.py`; Vincent,
  2026-10-30: "did you backtest and improve / combine rules to get as close as possible to 100%", then "just backtest it on
  all games of the 26/27 season"): every night from Oct 8 graded with what was known that morning — the Patterns rules
  re-mined weekly on the weeks before, a logistic + boosted-trees model on all 239 figures retrained every morning, volume
  alone, Vincent's environment + streak picks, and the hindsight ceiling (Poisson at each skater's true season rate, his
  future games in). The ceiling's best three a night land 3+ SOG 61% and 1+ goal 35%: 100% is not on the table. The
  model's 60%+ calls landed 61% at 3+ SOG (8 a night), its 70%+ 66% (2 a night); the walk-forward pills' 50%+ picks
  landed 46% (30 a night), their 1+ goal picks 33% — the pills' figures run high. Environment + streak: for goals the
  environment adds a point on top of the run (a goal last game 21%, with a top-10 opponent 22%); for shots it adds 5–9
  (3+ SOG in two straight 41%, with a top-10 high-danger-chances opponent over its last five 50%).
- The top of the night (`docs/audits/2026-10-30-nhl-top-of-night.md`, `tools/predictors/precision_curve.py`; Vincent, 2026-10-30:
  "it's always 46%. I don't buy this"): on 2025-26 from November (40,524 skater-games, every rate a month in), the top 1–3
  picks a night land 3+ SOG 64–67% whatever the read (his rate, the model, his true rate in hindsight) and 1+ goal 37–48%;
  the league's best shooter (MacKinnon, 4.41 a game) went 3+ in 76% of his games, its best scorers scored in 42–49% of
  theirs. The 46% of the season backtest was every pick over the bar, 30 a night, not the top of the night.
- The model, checked on this season (`docs/audits/2026-10-30-nhl-model-check.md`, `tools/predictors/model_check.py` on the
  scorecard export; Vincent, 2026-10-30: "test whether the model still works on this season's games"): 158 games, 5,371
  skater-games against the run saved before each puck drop. It ranks the night right (3+ SOG: its top pick a night 73%,
  16 of 22) but overstates the top: 60%+ calls said 73% and landed 57%, 80%+ said 86% and landed 61%; 4+ SOG at 50%+ said
  61%, landed 43%. Its 1+ goal figure does not hold: 35%+ calls said 50%, landed 25%; 50–60% calls landed 18%. The
  study's read on the same rows says it straight (1+ goal at 35%+: 40% said, 37% landed). The same day Best bets and the
  shuffle print the board's chances calibrated (Vincent: "yes build the calibration and merge it"; the bullet
  "Calibration" under Automation): a logistic recalibration per height, fitted before Oct 22 and read after it, landed
  where it says (3+ SOG said 54% → landed 53%, said 45% → 50%; the run's own figures said 65% → 46%, 79% → 59%).

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
- Signed-in page = nine hash tabs (`#teams`, `#matchups`, `#defense`, `#firstgoal`, `#model`, `#shuffle`, `#patterns`, `#league`,
  `#history`); it opens on Matchups. The Defense tab (`components/nhl/DefensePanel.jsx`, helpers in `lib/nhl-data/defense-board.js`, data from
  `/api/nhl/data/defense`, which also carries the date's games and MoneyPuck's team rates) is the ShotPropz-style cheat sheet:
  what every team gives up to each position group (C / LW / RW / D, C / W / D, F / D) in shots or goals **per skater at the
  position** a game (the study's read, section 13; `per` on every `defenseByPosition` cell, groups weighted by the skaters they
  carry), the Season span = `seasonDefense`: this season's stored games alone (Vincent, 2026-10-27; last season's table
  stands in for a team without a game yet at the venue, GP "last season"; the games / (games + 15) blend is gone from the
  tab, the study's λ keeps its own in `picks-pure.js`; the slot and first-goal Season tables, and the stored-games season
  tables behind the rinks, verdicts and characteristics, are this season's rows too — `season` on `defenseTablesFor`,
  the last-N windows and the head to head still across the boundary), L10 / L5 the newest stored regular-season games across the seasons (last season's playoff rows are not
  loaded, `loadRows`), by where the
  defender plays, rank 1 = the most allowed with ties shared, tinted by rank thirds; above the tables
  tonight's matchups read off the same tables (`matchupReads`, each shooting side's softest spot first, with the shooters the
  slate's lineup has at that spot named and clickable, `shootersAt`; the API's `tonight` games carry `sides[].skaters` from
  `buildSlate` and, once the game is stored, `result` = the score and every skater's shots and goals by id, which the
  Result column on the right grades per listed shooter at 3+ SOG / 1+ goal with a tally, `resultsAt`), a track record (`lib/nhl-data/defense-grade.js`, `/api/nhl/data/defense/grade?to=`: every stored skater-game
  of the season replayed against each span's table as it stood that morning, by third of the opponent's table at the skater's
  position and at the side's softest spot, lift against the skaters' own blended rates and the 3+ SOG / 1+ G rate, and by the
  opponent's rank — `ranks` per span and metric, each rank's read with `top`, ranks 1 through it together, drawn as the strip
  under the thirds table so the tab says how far down the table the soft read holds), **by line** (Vincent, 2026-10-30:
  "against which line a team allows the most goals / shots, LW1, LW2 …"; `LineTable` off the API's `slots` =
  `defenseBySlot` for the span, `slotBoard` / `facingAt` / `SLOT_LINES` in `defense-board.js`): every team's shots or
  goals given up to the skater at each slot a game, LW1 … RW4 under their line and D1 … D3 under the pairs, every column
  ranked and tinted by third, a cell from 3 skater-games, and the **softest line** first — the slot where the team ranks
  highest against the league, a tie to the one furthest over the league's mean (its raw highest is nearly always its
  first line) — with the opponent's skater at that slot tonight, clickable to his card; a slot's header sorts by it, and a team overview
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
  All/C/LW/RW/D rows, season tabs then L5 / L10 / L15, per game or total, PropFinder's ranks, sortable; **the table
  and the PropFinder tint open on this season's tab** whenever PropFinder has published it (Vincent's call, 2026-10-27:
  the teams on the ice are this season's; last season's tab is there to compare against, never the default; a window
  is never the default), `defaultDefenseTab` in `propfinder-csv.js`; the rink's tint defaults to PropFinder (this
  season's tab) when the opponent has a table, else to the Rink's stored games;
  a window PropFinder's API has not published for the current season is rolled from the stored
  box scores across the season boundary by `withStoredWindows`, the way PropFinder's own L5 counts; a window
  published for the league that lacks a team short of its games this season — CBJ had L5 and L15 and no L10
  above its rink on 2026-10-27 — gets that team's row from the stored window, ranked among the table's teams,
  `stood` on the table and the tab marked `source: 'stored'`, `withStoodTeams`),
  **the by-line read on the ice** (Vincent, 2026-10-31, of the Defense tab's slot badges LW1 · C2 · D2: "How can we
  make this visible on the matchup view?"): every chip carries his slot tonight as a badge (`SlotBadge` in `Rink.jsx`,
  `.nhlx-rk-slot`) tinted by the opponent's rank against that slot for the rink's metric — the Defense tab's by-line
  table, `slotBoard(defenseBySlot(rows, { season }))` at both venues, read once a slate in `buildSlate` and carried per
  side as `side.lines = linesOf(boards, opp)` ({ sog, g } → { gp, cells, softest, league }, `linesOf` in
  `defense-board.js`), green = top third, red = bottom third, grey = no record (the hover: the figure, the rank, the
  league's mean, the skater-games) — and the rink head names the opponent's softest line with its rank and figure and
  this side's skater at that slot (`SoftestLine`, click to his card); colour only, no number moves;
  chips carrying the latest saved model run's λ shots / goals for the slate date from
  `lib/nhl-data/model-runs.js`, or a matchup read when no run exists; at the top of each rink card the model's plays
  for that team (`sidePlays` in `slate.js`, `ModelPlays` in `Rink.jsx`): the Best bets boards' rule, `boardPlays` in
  `model-core.js` (shared with the Model tab's boards and the scorecard's replay), two shots plays and two goal plays at
  most from the saved run, each on the floor it cleared with the attack-score tier, the picked skaters ringed on the ice,
  each play washed green (hit the floor) or red (fell short) with the box-score figure once the game is stored, dashed and dimmed when the skater has no box-score row, nothing shown without a run; finished games show the
  box score; above each game's team verdicts a game-total read, `gameTotalRead` in
  `lib/nhl-data/verdict.js`: the stored meetings' totals blended with MoneyPuck's expected
  goals and pace, high / low half a goal either side of the league average; and above both, the **matchup
  profile** (`lib/nhl-data/matchup-profile.js`, `matchupProfile`, `profile` on every slate game; drawn by
  `components/nhl/MatchupProfile.jsx`; Vincent, 2026-10-30, with a soccer first-half profile as the form: "remove this
  and replace it with a summary of data from both the rink and propfinder", then "the summary needs to be compact. 5 rows
  max."): the two teams side by side, **five rows at tonight's venue** — Shooting (shots and goals a game), Allows (shots
  and goals allowed), Power play (PP% and the power plays drawn a game), Penalty kill (PK% and the power plays given,
  rank 1 = the softest kill), Last 10 (shots for and against over the last ten), and since 2026-10-31 **Saves** between
  Allows and Power play (Vincent: "I should be able to see the projected goalkeeper saves for NHL games in the short game
  summary"): the shots the opponent is expected to put on the team's goalie — the saved run's λ shots summed over the
  opponent's lineup (ten skaters at least), else ShotPropz's boards (the opponent's shots a game at its venue and the
  team's shots allowed at its own, the geometric mean) — × the team's save percentage this season (`spzSavePct` in
  `shotpropz-pure.js`: 1 − GA/SA on the defense board, all games, ranked 1 = the best, the `goalie` kind's words, a
  strong goalie red; the rink's venue table without a snapshot, unranked). The boards carry no goalies, so the team's
  figure stands for the starter's and the hover says so — each cell a word over one line of
  figures: Elite · Strong · Average · Weak · Poor for an attack, Elite · Tight · Average · Leaky · Very leaky for a
  defense (`levelOf`: the top three, the top quarter, the bottom quarter, the bottom three; the word on the shots),
  Rising / Steady / Falling for the last ten against the season (`FORM_EDGE` a tenth). **Green = more shots and goals
  likely in the game from that side's angle, red = fewer** (a strong attack and a leaky defense green, a tight defense
  and a strong kill red), the rink's one colour rule. **ShotPropz's team boards lead every row** (`lib/nhl-data/shotpropz.js`;
  Vincent, 2026-10-30: "get the offensive and defensive stats from shotpropz.com … whether the team is good at home in
  powerplay kill, how many powerplays they are getting, whether they shoot a lot, whether they allow a lot"): the free
  Team Offensive / Defensive Stat Overview pages (server-rendered HTML, four tables a page — GF/GP, SF/GP, power plays
  for a game, PP%; GA/GP, SA/GP, power plays against a game, PK% — ranked 1 = the most / the softest, with
  `?season=26_27&span=YTD|recent&location=All|Home|Away`; the server echoes the filters it applied in the selects,
  `parseOverview` reads them and `refreshShotpropz` refuses a page served on other filters) are read as a browser twelve
  pages at a time (2 boards × 3 locations × 2 spans, a pause between) by the morning refresh (`dailyRefresh`, after
  MoneyPuck), `POST /api/nhl/data/refresh?only=shotpropz`, `POST /api/nhl/data/shotpropz` (the Data sources row's button;
  `GET` returns the snapshot) and stored at `data/shotpropz/<year>.json` (`boards[offense|defense][all|home|away][ytd|l10][stat]
  = { teams: { ABBR: { gp, value, rank } }, count }`, `pageUpdated` the page's "Last updated" stamp; `loadShotpropz`
  memoised on the file, last season's standing in; the first pull ran 2026-10-30, 12 of 12 pages from Render). The profile
  reads it through `spzTeamRead` in `shotpropz-pure.js` (client-safe: the builder is bundled by the client): per stat the
  venue cell, the all-games cell and the last ten, **the venue cell leading from `SPZ_MIN_VENUE_GAMES` = 4 games there**,
  all games until then (the head says "all games until four there"). Without a snapshot the rink and PropFinder stand
  in: the team's own stored shots and goals a game (`teamRates`, from `MIN_OWN_GAMES` = 5 this season, PropFinder's team
  table before that), PropFinder's table above the rink for Allows (the stored venue table without one), PropFinder's
  season PP% / PK%, the stored last ten; every source rides on the cell's hover (`title`), nothing else is drawn. The
  game-total read and the verdicts fold under it as "The numbers behind the reads". Tests:
  `__tests__/nhl-matchup-profile.test.js` (the builder on the MTL @ DAL fixture, `fixtures/matchup-profile-mtl-dal.js`,
  with and without the snapshot), `nhl-matchup-profile-render.test.js` (the card server-rendered; with `MOCK_OUT=<dir>` it
  writes standalone mock-up pages that `tools/mock/screenshot-profile.mjs` photographs at 1440 and 390 — the `.jsx` files
  go through Next's SWC transformer in `jest.config.js`) and `nhl-shotpropz.test.js` (the two boards as served on
  2026-10-30, `fixtures/shotpropz-offense.html`, `-defense.html`). The former card, each team's **characteristics** (`lib/nhl-data/characteristics.js`,
  `teamCharacteristics`; drawn by `components/nhl/Characteristics.jsx`, WhoScored's layout), stays on the Teams tab and
  the picks boards: its
  strengths and weaknesses as traits with a badge (`levelOf` in `lib/picks/levels.js`: the top quarter of the league
  Strong, the top three Very strong, the bottom quarter Weak, the bottom three Very weak — thirds and a top four
  wore a dozen badges on a bad team, 2026-10-27; no number in the line, the figures ride on the trait as `detail`
  for the hover; each list shows its three most telling lines, `SHOWN`, with "View more (n)" per team for the rest) — shot volume, creating chances, high-danger
  chances, controlling the puck, finishing (GF over xGF, `ratioRanks`, 10 games), limiting chances /
  high-danger chances, goaltending (GA under xGA) from MoneyPuck; limiting shots / goals at tonight's
  venue, the positions it leaks to and holds (one line each way), its last ten against the season
  (loosening / tightening at five ranks' drift) and conceding the first goal at the venue from the
  stored tables — and its **style of play** as plain traits (fast pace / slow game; where its shots come
  from — the point, the wingers, the centres —, the top line carrying the scoring or scoring spread
  across the lines, shooting from dangerous areas or the perimeter, scoring first or chasing games;
  `shotProfiles` from the team's own stored rows, this season from ten games, last season's until
  then, judged against the league's shares at `PROFILE_EDGE` = 15%); the Matchups tab shows the two
  teams side by side under the game head with the total's pill and folds the game-total read and the
  verdicts under "The numbers behind the reads" (Vincent, 2026-10-27: the bullets, and a prose script
  tried the same day, were too much to digest into how the game would go; WhoScored's strengths /
  weaknesses / style was the ask); the Teams tab carries the same card for the picked team with an
  At home / Away switch (`TeamCharacteristicsCard` → `GET /api/nhl/data/characteristics?team=XXX[&date=]`,
  games through the date, both venues with the verdict's headline; the side's defense object comes
  from `opponentDefense(opp, defVenue, tables, vs)` and `defenseTablesFor(rows, pf)` in `slate.js`, the
  same builders `buildSlate` uses for every side, `moneypuckBlock` the MoneyPuck block) and the per-team defense card
  (`lib/nhl-data/defense.js`) are descriptive views over the stored rows; the model's
  own math stays in `NhlModel.jsx`. In the Matchups fold "Defense tables and all skaters" the defense card and the
  skater table's Opp S/G read PropFinder's table above the rink **on the tab the rink is on** (`defenseCardFromTabs` in
  `propfinder-csv.js`; the rink's tab is lifted into `MatchupsPanel` as `pfKeys`, `Rink` taking `pfKey` / `onPfKey`;
  the card's L10 column is PropFinder's L10 tab, the first-goal column and the MoneyPuck line stay the stored games'
  and MoneyPuck's; the stored venue table stands in, named, for a team without a table), and `edge()` in `slate.js`
  reads PropFinder's per-position season table first (the stored venue table standing in, `thin` under 10 games), so
  the skater table's edges and the slate's matchup read (`vs`, `projSog` / `projG`: the chips without a run, `top`)
  sit on the same table as the ice, the flags and the shuffle (Vincent, 2026-10-27: "fold the defense card into the
  same table too"; until then the stored venue table led once it had 10 games). The verdicts and the
  characteristics still read `side.defense`, the venue table, as the prose reads they are. Logos/headshots are copied into `data/media/*` and
  served by `/api/nhl/data/media`; standings/leaders live in `data/league/*`.
- Tonight's picks (`lib/nhl-data/picks.js` + `picks-pure.js`, `/api/nhl/data/picks`, `components/nhl/PicksPanel.jsx`,
  the list at the top of Best bets): the best shots plays and the best goal plays in every game: every skater over
  the floor (P(3+ SOG) 50%, P(1+ G) 35%), three to four a table (fill-ins marked `under`, the rest on a "next" line; a run row whose 3+ / 4+ pair is inverted is read off its λ; the run carries no 2+, it is read off the λ), with the break-even price, and the notes
  (softest spots, richest game, environment plays, near-ties, thin games, lineup sources) written from the picks.
  The shots numbers are the model's: with a run saved for the date, each row is the run's λ and 2+ / 3+ / 4+ SOG
  probabilities (`fromModel`) and only skaters the run projected are listed; the 1+ G is the study's read since
  2026-10-27 (`studyWeightGoals`, the scorecard bullet below); the study's plain-rate read (fixed
  Poisson coefficients fitted on 2024-25 + 2025-26 by `tools/predictors/replay.py`, log features: the skater's rate,
  attempts, chances and TOI, this season's alone from his fifth game (`blendRates`; last season's regular season stands
  in until then, `held`; his goal rate shrunk toward the league's at his position at n / (n + 8) within the season,
  `GOAL_RATE_SHRINK` in `project`, a held rate not shrunk — the 2026-10-27 replay had raw this-season reads over 40%
  running 5–10 points high, 0.6+ scorers said .39 and hit .31 / .35, calibrated at k = 8); home ice; back-to-back; and what the opponent allows **per skater at his position** this season
  (`positionAllowed`; last season's regular season only for a team with no game yet, `held`). Vincent's call, 2026-10-27,
  twice over: this season's rate and this season's table — the study's n / (n + 18), n / (n + 40) and games / (games + 15),
  games / (games + 40) blends stay on record in sections 3, 13, 15 and 16 and in no number) rides on
  each API row as `study` and stands in when no run exists, but the panel shows one set of numbers only: player,
  2+ / 3+ / 4+ (1+ G) with the break-even price, and Got once final — no study, rate or opponent columns (the user
  wants the plays readable at a glance; the comparison lives on the History tab's scorecard). Beside the name, for
  the table's market: a flame / snowflake for his form (`formOf` in `picks-pure.js`, `heat` on the row: shots hot at
  1.4× his blended rate over his last five, cold at 0.7×; goals hot at 3+ in his last five, cold = none in ten when
  his rate owed him 1.5) and a green rink when the opponent is in the soft third at his position **on PropFinder's table
  above the rink on Matchups, the tab it opens on** (`spot` on every slate skater, candidate and play: `spotFromTab` in
  `propfinder-csv.js` off `defaultDefenseTab`, PropFinder's rank, soft = the top third of the tab's teams; Vincent,
  2026-10-27, after the shuffle's Matchup column moved to that table: one environment read everywhere it is colour). The
  study's per-skater table (`oppPos`, `isSoftThird`) stays the study λ's environment and stands in for a team without a
  PropFinder table, named in the flag's hover. The notes' softest spots and environment plays read PropFinder's All row the
  same way (`oppRank` / `oppSog` on the candidate, `allowed.notesFrom` on the payload, the stored team totals when no team
  has a table), rank 1 = allows the most — until 2026-10-27 the softest-spots note read rank 32 as the most and named the
  three stingiest teams. Colour only: the study found a streak adds nothing once the rate is in, so no number moves.
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
  **Goalies and the Saves table** (`lib/nhl-data/goalies-pure.js` + `goalies.js`; Vincent, 2026-10-31: "record the saves as part
  of the box scores … they should be listed as a best bet if it's applicable"): the game records have carried every goalie's
  line since the first ingest (`game.goalies` in `game.js`: shots against `sa`, saves `sv`, goals against `ga`, `toi`, the
  `starter` flag, the `decision`); `writeGoalieRows` (every `ingestGames`) indexes them per season at
  `data/goalie-rows/<season>.json` (`GOALIE_ROW_FIELDS`, the skater rows' shape) and `POST /api/nhl/data/refresh?only=goalies
  [&season=]` rebuilds a season's file from every stored game (`rebuildGoalieRows`, run once on 2026-10-31 for 2026);
  `loadGoalieRows(date)` reads this season's and last season's. `goalieBook(rows, season, { through })` reads every team's
  goalies before the date (appearances, starts, shots, saves, the raw and the **shrunk save percentage** — his own toward
  the league's at shots / (shots + `SV_K` = 150), the league's this season from 2,000 shots, `LEAGUE_SV` = .900 before —,
  saves a start, his last five starts, starts in the team's last `STARTER_WINDOW` = 10 games; last season's goalies stand in
  for a team without a game, `held`) and `likelyStarter(book, team, date)` names the goalie likely in net: the most starts
  over the team's last ten, **the other goalie on the second night of a back-to-back when the usual one started last night**
  (`reason` says which; no confirmed starter is read anywhere — the beat writers' goalie lines are skipped by the lineup
  parser, so the rink's "in net" is a read, not a report). The slate puts him on every side as `goalie` (with `other`, the
  team's second goalie) and the stored game's goalie lines on `log.goalies`. **The profile's Saves row** reads his own
  percentage from three starts (the team's from ShotPropz until then), names him ("Montembeault likely · .908 over 7
  starts") and, once stored, the goalie who played and his line ("got Oettinger 30 of 33"). **Best bets' Saves table**
  (`saves` on every board game in `picks.js`, `SavesTable` in `PicksPanel.jsx`, the third table of the grid): each side's
  likely starter facing the shots the board expects of the opponent (its lineup's λ shots summed, ten skaters at least) ×
  his save percentage = the projected saves (`savesRow`), the chance of 25 / 30 / 35 saves (`savesChance`: a normal around
  the projection, `SAVES_SD` = 6 shots × the save percentage) with the break-even price, **30+ the play** (`SAVES_LEAD`,
  a row under `SAVES_FLOOR` = 50% there is dimmed as under the floor, `pickSaves`); once the game is stored the goalie's
  own line grades the row (`withSavesActuals`: 30+ hit or miss, "another goalie played" when the read was on the wrong
  man, `played: false`), and the game head's tally counts the saves plays with the shots and goal plays. **The book's saves lines come from PropFinder's
  pull** (`lib/nhl-data/goalie-props.js`; Vincent, 2026-10-31: "pull the goalie saves lines from PropFinder and show the
  edge... I just need over x saves with a %"): the odds-only players call lists the goalies with their props, `goalieSavesProps`
  reads the items whose market names saves (a period's or a window's left out) with the NBA reader's spellings, the main
  line the one priced nearest a coin flip, and the pull stores them at `data/propfinder/goalie-props.json` ({ at, date,
  goalies: [{ pfId, name, key, team, line, odds, underOdds, book, books, implied, lines }], withLines, `sample` = the
  first goalie's raw items for the spelling check — no NHL goalie item had been seen when it shipped; the pull meta's
  `goalieProps` counts show under Data sources). The slate puts the line on each side's `goalie.prop` (`savesLineFor`,
  the NHL name against PropFinder's through `normName`, the surname on the team as the fallback; only a pull made for
  the slate's date), `savesRow` reads it (`line`, `mark` = o27.5 → 28+, `pLine` his chance of clearing it, `odds`,
  `implied`, `edge` = pLine − implied, the ladder as `lines`): **the over is the play when the edge is positive**
  (`isSavesPlay`; the 50% floor on the line without a price, the 30-save mark without a line), `pickSaves` orders by the
  edge, `savesHit` grades over the line. The Saves table shows one Over cell ("o27.5 · 61%", the price and the edge
  under it) when any row has a line, the three marks otherwise; the profile's Saves row appends "o25.5 59% at -120",
  green on an edge. The lines arrive with the next pull. `__tests__/nhl-goalies.test.js`, `nhl-goalie-props.test.js`.
  The **shuffle** on its own tab (`#shuffle`, `components/nhl/ShufflePanel.jsx` with its own slate-date picker, the
  date riding on every card open; `GET /api/nhl/data/shuffle?date=` → `buildShuffle` in `picks.js`, which is
  `buildPicks(date, { withSkaters: true })` reshaped; the pure readers in `lib/nhl-data/shuffle-pure.js`): a bar for
  shots (1+ … 8+, starts at 3+, floor 50%) and one for goals (1+ … 4+, 1+, 35%). Every skater of every game is read at every height off the board's own λ (`skaterRow`: lamS / lamG,
  the study's λ beside them, `ownOf` = his last 5 / 10 / 20 and this season's mean shots and goals from the stored
  rows with how many of his last ten and of this season's games reached each height, the opponent's rank at his
  position, `heat`, `actual` once final), the chance at a height the Poisson tail of the λ (`chanceAt`: 3+ here is
  the board's 3+ figure, 6+ the same λ further up), survivors at the floor sorted by the projected figure, the board's λ, the highest on top (Vincent, 2026-10-27; by the chance before), then the chance, with the break-even
  price, how often he reached the bar, his projected shots or goals (the board's λ with its unit: the Projected column that
  replaced Thins out on 2026-10-27; the Centre column, the λ the chance is read from, shows only when the read is not the
  board's) and Got once final; the fallen strip under it, each with the bar he still clears. The **Matchup column reads the
  opponent's PropFinder defense table**, the one above each rink on Matchups, on the same tabs (a "Matchup from" row under
  Read from: last season, this season, L5, L10, L15, L5 home, L5 away, opening on the Matchups tab's default, this season's;
  `defense` on the shuffle payload = each team's table trimmed, keyed by the defending team, `trimDefenseTabs` /
  `matchupTabs` / `matchupTabOf` / `matchupOf` in `shuffle-pure.js`), so the rank it shows is the rank that tab shows on
  Matchups (Vincent, 2026-10-27: the shuffle read Boldy at UTA as #25 RW off the study's per-skater table while the Matchups
  tab's L10 read #20 — two tables and two units, per skater against per game, for one matchup); the study's per-skater table
  (`oppPos`, what the study's λ reads) stands in for a team without one, marked "stored" and named in the hover; colour only,
  no number moves with the tab, and the row carries no soft-spot flag (the cell shows the environment, as the ice does under
  a rink chip). Beside "Matchup from", **Position** (`POSITIONS` / `atPosition` in `shuffle-pure.js`: All · C · LW ·
  RW · D; Vincent's ask, 2026-10-27, to shuffle the defensemen or the left wings alone): the bars' counts, the curve,
  the list and the fallen strip read the picked position's skaters alone, and every row carries his line slot tonight
  (LW1, D2, the rink chip's badge; the position alone when the lineup has no slot for him). "Read
  from" (`READ_FROM`) moves the λ to the study's or a window of his own results (a window he lacks falls back to the
  board's), or, on the goals bar, to the run's own goal λ with the opponent in it ("Model · matchup",
  `goalOpportunityLambda` on the result rows → `gOpp` in `indexModelRows` → `lamGOpp` on the candidate and the shuffle
  row): the published λ goals (`lambdaGDisplay` in `model-core.js`) is the points λ × his finisher share × 0.9, so the
  opponent's goals table reaches the board's 1+ G only through the points step's defense multiplier (45% of a
  multiplier damped by tier and capped at 1.02–1.20, beside 0.35 × the assists allowed, which pull the other way when
  a team is soft on goals and tight on assists) and his last-five goal form multiplier (`l5GoalFormMult`) not at all
  (his last five reach it as points only, at 0.35); `goalOpportunityLambda` carries both. Not graded as of 2026-10-27: the scorecard's "Windows and sources" table scores
  it beside the board's λ (`modelOpp`), and nothing on the board reads it until that table says it predicts better.
  The panel opens on the read the History tab's scorecard rates best for the active bar (`readFromOf`: the
  tab pressed this session, else the verdict, else the board's λ), that tab green (`is-best`), the note saying which
  is on and why. The verdict is stored (`lib/nhl-data/best-read.js`, `data/scorecard/best-read.json`: one
  `bestReadFrom` result per bar — each read's Brier at the bar's floor height, the scorecard's model / matchup (`modelOpp`, goals only) / study / own5 /
  own10 / ownSeason predictors (`READ_FROM_PREDICTOR`) on the rows every predictor covers, 100 at least — written by every season-range
  `buildScorecard`, i.e. the History tab's first grade and the morning refresh in the background after `dailyRefresh`,
  never rewritten unchanged since a write drops the per-state builds; the scorecard itself reads every stored game and
  run, tens of seconds on a cold server, so the shuffle never waits for it) and rides on `GET /api/nhl/data/shuffle`
  as `bestRead`, so the tab is green on first paint and the note says when the verdict was built; only without a
  stored verdict does the panel build the scorecard live, once a page load, with "grading…" on the row meanwhile
  (2026-10-27: the tab stayed uncoloured while that build ran). It follows the verdict until a tab is pressed, the
  figures in the note under the tabs. One request a slate, every bar move local; no
  number on the board changes. The chance at 1+ G is the
  run's own 1+ G figure (`fromModel` keeps the run's three-decimal λ), the Model tab's Top goals board ranks by that
  same figure (`scoreTopBoardRow` in `NhlModel.jsx`: shots by 3+, goals by 1+, points by 1+, the next rung breaking
  ties; the tags are pills only, since 2026-10-27 — before that the tag bonuses put a 43% scorer first while the
  shuffle listed him fourth), and the panel's head says when `NHL_PICKS_STUDY_WEIGHT` blends the study into the λ;
  only the Top 5 boards, the rinks' strips and the scorecard's replay keep `boardPlays`' rule (4+ / 5+ with the attack
  score, 1+ / 2+ with a slice of it), so they can reorder near-ties.
- **Calibration** (`lib/nhl-data/calibration-pure.js` + `calibration.js`; Vincent, 2026-10-30, after the model's own figures
  were graded on this season — its 60%+ 3+ SOG calls said 73% and landed 57%, its 35%+ goal calls said 50% and landed
  25% —: "yes build the calibration and merge it"): **Best bets and the shuffle print the board's chances calibrated** to
  what the same stated chance has landed this season. Per read (`board` = the run's λ blended with the study's at the
  board's weights, `study` = the study's alone, for a slate without a run) and per height (1+ … 8+ SOG, 1+ … 3+ goals) a
  logistic recalibration of the stated chance on the season's graded runs, landed = σ(a + b · logit(stated)) by maximum
  likelihood with a light ridge toward the identity (`fitHeight`, `CAL_RIDGE` = 2; a height under `CAL_MIN` = 300 games
  or 25 hits keeps the stated chance); a skater's chance at a height through it, never above his chance one height lower
  (`calibratedChance`). On this season's runs the run's 3+ / 4+ SOG tails came out at b ≈ 0.5 on every split (a stated
  80% prints about 62%), the study's goal read at b ≈ 0.9; binned rates shrunk toward the stated chance were tried first
  and kept too much of the overstatement at the top on the held-out week. **The model's math is untouched**: the run's λ
  and its own odds stay the run's (the Model tab, the rinks' strips, the scorecard grade them as they are); only the
  printed chance moves. `computePicks` reads it with the slate (`loadCalibration`: `data/scorecard/calibration.json`, else
  the seed `lib/nhl-data/seed/calibration.json`, fitted on the scorecard export of Oct 30 by
  `tools/predictors/calibration-seed.mjs`) and runs every candidate through `calibrateProjection` — p2 / p3 / p4 / p1g
  calibrated, the stated ones as `raw`, the floors and the notes on the calibrated figure — when the stored fit was
  learned at the board's weights (`calibrationFits`: another `NHL_PICKS_STUDY_WEIGHT` is another read, printed as stated
  until the next build); the payload's `calibration` { read, at, from, to, games, fits } goes to the panel's head and the
  shuffle, whose rows carry the fits (`row.cal`) so `chanceAt` / `readAt` print the board's read calibrated (every other
  "Read from" as its Poisson tail; `raw` on the read for the hover). Learned again by every season-range `buildScorecard`
  (`saveCalibration` beside `saveBestRead`: the History tab's first grade, the morning refresh), never rewritten
  unchanged. Hover a chance on Best bets or the shuffle for the figure as stated.
- **Patterns** (`#patterns`, `components/nhl/PatternsPanel.jsx` with its own slate-date picker, `GET /api/nhl/data/patterns?date=`
  → `buildPatterns` in `lib/nhl-data/patterns.js`; Vincent, 2026-10-30: "look at literally every data point that is
  available to detect patterns … rules per line … the outcome should be pills like firsthalfscore.com"): every skater in
  tonight's lineups gets a pill per line — 3+ / 4+ / 5+ / 6+ SOG, 1+ / 2+ / 3+ goals — solid with a check (a pick) when a
  rule the study kept fires and its rate clears the line's bar (`bar` per mark: 50 / 33 / 20 / 11%, 35 / 9 / 3%, about
  what a book asks), outlined with his figure otherwise (the strongest rule he meets, else his shots-a-game tier, else the
  base rate); the conditions behind the picks underneath as small pills (`describe`, his values), with notes beside them
  (a point / 3+ SOG / goal run, his venue split at ±20%, the opponent's high-danger chances allowed to his position over
  the last five in its top or bottom sixth, a top-five goals-against team); "Strongest tonight" per line, then every game
  folded to a line; picks ringed green / red once the game is stored; hover a pill for its rule, its check week and its
  record since. The features: `lib/nhl-data/patterns-pure.js` (pure, shared with the study): `makeTracker` / `patternTable`
  walk this season's stored rows date by date (`seasonStart`; nothing from last season, Vincent's call of the same day),
  each skater-game's 239 figures from the games before it — his sog / icf / iff / iscf / ihdcf / g / a / pts / toi / hits
  / blk over the season and his last 3 / 5 / 10, per 60, his hit shares and runs (`str_*`, `cold_*`, `since_*`), his split
  at tonight's venue (`ven_*`), his head to head, what the opponent gives up per skater at his position by window and at
  the venue (`opp_pos_<stat>[_l5|_l10|_ven]`, `_x` = × the league's at the position, `_rk` = rank, 1 the most), to his slot
  (`opp_slot_*`), the teams' totals for and against with ranks (`opp_{s,c,f,sc,hdc,g}a`, `team_*f`), pace, rest. The rules:
  `lib/nhl-data/patterns-rules.json`, written by `tools/predictors/patterns.py` (below, Audits); `pillsFor` picks the
  strongest rule a skater meets, `rulesCatalog` sends each rule once and the pills carry `rule` + `vals`. A rule's rate
  moves with the games after the study (`patternRecord`: from `rules.builtThrough` on, each night read with the rates as
  they stood that morning, the study's out-of-sample figure carried in at 30 skater-games), and those nights are the
  record shown under the head. The season walked once per stored rows and date (`memoByRows`), the build per store state.
  Re-mine with the study's commands (the README in `tools/predictors/`) to move `builtThrough`.
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
  `gdtAt` per team in the refresh response via `gdtTimes`) or the game is 10 minutes old; **then one post-game read per
  game** (`SETTLE_AFTER_START_MIN`: 3 h 30 after puck drop once the NHL schedule says the game is final, about an hour
  after a regulation final; again every 20 minutes while it is still on, until the 4-hour tweet cutoff): the hop is
  dispatched with `settle=1`, posts the pages (the lines the writers put up at or during the game: a late scratch, a
  swap at warm-up, the pairs as they skated) and calls `only=settle` (the previews' final update, the snapshot
  re-captured, the stored box scores re-stamped), and `settled` carries the done game ids from hop to hop, so a
  skater's position and line slot for a game are the ones he actually played. GitHub's cron only
  seeds it (2 of 24 slots fired on 2026-10-07): every run hands itself on with its own token (`tools/lines-chain.mjs`,
  a wait for the first window, then 15-minute hops, then the post-game reads; skipped while another run is queued or running; 60 hops a
  chain), and the Matchups tab's "Refresh lines" button dispatches a run on demand
  (`/api/nhl/data/refresh?only=lineups&dispatch=1` → `lib/nhl-data/github-dispatch.js` → `workflow_dispatch`,
  needs `GITHUB_DISPATCH_TOKEN` on Render; the panel then polls the slate until a new page delivery shows).
  The morning and late runs (`nhl-data.yml`, 9:17 and 00:41 ET) post yesterday's teams' pages before today's, so
  every team that played is settled from the lines posted during its game, not only the ones playing again today
  (the backstop for a chain that broke), and the Mac sync reads once more 3 h 30 to 4 h after puck drop.
  `autoRunModel` never runs for a past date (a run saved after the games would only replace the pre-game run the
  rink shows; the scorecard grades the newest run saved before puck drop). `GET /api/nhl/data/lineups/audit?from&to`
  (`lib/nhl-data/lineup-audit.js`) says which stored games still owe a post-game read: per team where its positions came
  from (a tweet from the warm-up window or the game = settled; an earlier tweet; the preview; the depth chart or roster;
  no snapshot), the tweet's minutes from puck drop, and what a re-stamp would change; the `backfill_from` input of
  `nhl-lineups.yml` settles every date from there to the date input (pages posted per date, then `only=settle`). Each rink shows when its source last changed
  and the Matchups header when the beat writers' pages last arrived (`sourceMeta.gdtFetchedAt`). After every lineup capture (and every matchup-file import for a
  coming slate) `lib/nhl-data/autorun.js` runs the model on the server with the stored
  PropFinder workbooks + snapshot lineups + built history / home-away inputs (this season's games alone, Vincent's call 2026-10-27: the history
  workbook's skater-games vs each opponent by position, and the home / away split, written for a skater once he has
  five games at each venue this season, else left out so the model reads his season row; `BUILDERS_VERSION` 4) + the
  pace workbook built from
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
  The pull also reads the injury report live (`fetchInjuryReport`, `/NHL/v2`, parsed by
  `lib/picks/injuries.js`, stored at `data/propfinder/injuries.json`, `injuries` in the pull meta): the
  slate's skaters carry `injury` / `injuryDetail` (the rink chip's title) and `depthChartLines` leaves
  the players out off the fallback lineup; the beat writers' and NHL.com lineups are untouched, and
  nothing in the model's math reads it.
  Keep producing the CSV/workbook shapes the parsers already read; never adapt the parsers to the API.
  The season workbook's numbers are this season's, not a blend (Vincent's call, 2026-10-27; the predictor study's
  shrinkage, `docs/shots-goals-predictors.md` sections 3 and 9, stays there and in no number): each skater's "Season"
  row is this season's regular-season games alone from his fifth (`blendedSeasonRates`, the name kept; last season's
  regular season stands in until then when it has 10+ games, GP this season's count), and
  each "Defense (Season)" block is the team's season to date as PropFinder publishes it (`defenseBlocks`; Vincent's
  call, 2026-10-27: the blend into last season's figure at n / (n + 15) and n / (n + 40) is gone, last season's row
  stands in only for a team with no game yet; no L10 window any more). GP is this season's count. The L5 workbook and the stored CSV-shaped tables stay PropFinder's own numbers; a
  manually uploaded PropFinder export is stored as exported.
- PropFinder CSV exports (skater per-game rates for the season or last N games, team stats for and
  against with ranks, opponent stats per position tagged by a `-lw/-c/-rw/-d` file-name suffix) are imported by
  `lib/nhl-data/propfinder.js` into `data/propfinder/*` (one snapshot per season; the
  bundled `lib/nhl-data/seed/propfinder-<year>.js` is the fallback, regenerated with
  `node tools/propfinder-seed.mjs <season> <csv…>`). They are descriptive views, not model
  inputs; the slate's defense edges fall back to the per-position opponent tables while a
  team has fewer than 10 stored games at a venue this season.
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
  read rebuilt leak-free from the stored rows before each date) with a half-and-half model + study blend, and the
  run's matchup goal λ (`modelOpp`, `goalOpportunityLambda` on the result rows, goals only; `lambdaGOpp` on the
  `?rows=1` export) —
  scored beside λ on the rows every covered predictor shares (MAE, bias, Poisson 3+ SOG / 1+ G Brier).
  Descriptive only; nothing feeds the model. The board's shots blend only through `NHL_PICKS_STUDY_WEIGHT` on
  Render (the study's share, `blendProjection` in `picks-pure.js`, `studyWeight` in `picks.js`; unset =
  the model alone), to be set once that table shows the blend beating the model. **The board's goals read the
  study's λ** since 2026-10-27 (`studyWeightGoals`: `NHL_PICKS_STUDY_WEIGHT_GOALS`, 1 unless set, 0 = the run's goal λ
  back; `blendProjection`'s fourth argument; the shuffle's head and note say so): Vincent's call on the FLA @ WPG board
  after the day's input changes — the run's published goal λ is built from his points rate, so Connor on nine goals in
  eleven games read 28% and Reinhart fell from 28% to 21% on an unchanged goal rate as his assists dropped, while the
  study's λ reads his goal rate, chances and shots this season, home ice and the opponent's row at his position (the
  data study's section 16: his goal rate is the forecast). The scorecard's "board" replay still grades the run's rows. The same comparison runs
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
- Last season means the regular season: `loadRows` (`rowsBefore` in `lib/nhl-data/build.js`) drops the previous
  season's playoff rows (`isPlayoffGame` in `util.js`, the game id's type digits) from every base — a skater's rates
  before his fifth game, his last 5 / 10 / 20 across the boundary, the flame / snowflake, the Defense tab's spans and track record, the
  profiles, the first-goal record, the history and home / away workbooks the model is given; this season's rows come
  whole, so the playoffs under way in April–June are the data. The opponent's table in any number is this season's
  (`positionAllowed`, `defenseBlocks`, and the Defense tab's `seasonDefense`). (Vincent's call, 2026-10-27: the final games of a season on record are playoff games and read
  over to nothing; the teams on the ice are this season's.)
- Keep the model's math untouched when restyling; port logic changes from the local app into
  `components/nhl/model-core.js` (pipeline) and `NhlModel.jsx` (UI). One change went the other
  way (2026-10-13, port it into `App.jsx`): the published shots odds `p3s` / `p4s` / `p5s` (and `p2s`)
  are the Poisson tails of the row's `lambdaS`; the shot ladder's figures ride along as
  `ladderP3s` / `ladderP4s` / `ladderP5s` and still set the attack score and shot tiers. The same
  on 2026-10-20 for the goals (port it too): `p1g` / `p2g` / `p3g` are the Poisson tails of `lambdaG`,
  the goal ladder rides along as `ladderP1g` / `ladderP2g` / `ladderP3g` and still sets the attack
  score and the goal tier (`__tests__/nhl-model-odds.test.js` holds both)
  (`docs/shots-goals-predictors.md` section 12). And on 2026-10-27 (port it too): the home / away split's share of a
  skater's goal base (it used to replace his season goal rate outright, and so reached the published λ goals through
  the points step) and the historical-profile (position vs opponent) multipliers on the goal ladder are cut to a
  quarter — `VENUE_SPLIT_WEIGHT` and `H2H_WEIGHT` at the top of `model-core.js`, `venueMix`; 1 restores the model as
  it was, 0 turns the factor off; Vincent's call after the study's section 16 (`__tests__/nhl-model-weights.test.js`).
  `node tools/port-model-core.mjs [App.jsx]` applies all three ports on the Mac (the 2026-10-13 shots odds, the
  2026-10-20 goal odds, the 2026-10-27 weights), each group all-or-nothing by exact-text anchors: a backup beside the
  file, a group already there reported as ported, a group with a differing anchor skipped and named, `--check` to
  look first. On 2026-10-27 App.jsx had neither odds port: the local app had published the ladder's odds since Oct 13.
- Secrets stay out of git (Render env + `.env.local`).
- Site is `noindex` by design (robots.txt disallow + X-Robots-Tag).
