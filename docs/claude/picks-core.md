# The picks core (NFL and NBA)

`lib/picks/*` is the sport-neutral pipeline both boards run on; each sport binds it with a
config and keeps its own markets, teams, feeds and slate key:

- **The value layer** (`lib/picks/value.js`, pure and client-safe; Mr B's restructure brief for Vincent, 2026-10-31, "Best
  matchups, immediately visible": "chance is a vanity metric … rank on EV%, not chance"): every play and every ladder rung
  carries its expected value at the book's price — `decimal` = american > 0 ? american / 100 + 1 : 100 / |american| + 1,
  `ev` = p × (decimal − 1) − (1 − p), the return a unit staked (`evOf`; a 99% lock at -5000 is +1%, a 47% TD at +145
  +15%), `edge` = p − 1 / decimal as before — and **everything ranks by EV** (`orderBy`; `board.best`, each side's `picks`,
  the per-game tables, the chance only breaking ties: chance-sorting inverts the P&L). **Two floors by default** (`DEFAULTS`:
  `minEv` 0.05, `maxJuice` -200, `minChance` null): a play failing one is marginal — `failsOf` names the floor ('price',
  'juice', 'ev', 'chance', 'thin', 'out'), `passes` — and stays off the overview, the side's picks and the tables' rows
  (a table lists the rows that pass, the best value first, `marginal` the rest, three fill-ins marked `under` when fewer
  pass; `next` the first four marginal). **The Matchup Score per game** (`matchupScore`, `g.matchup` on every board game):
  the top three passing plays' EV summed (`base`) + 0.5 × the passing count (`breadth`), × 1 + 0.15 × the leak tier
  (`gameLeak`: the softer defense's tier from the profile's words — Allows / Soft spots "Leaky" = 1, "Very leaky" = 2 —
  with the NBA's game script folded in, pace and total both up +1, both down −1), × the blowout dampener on the spread
  (`blowoutFactor`: 1 to 9 points, 0.7 from 16; the NBA's starters sit late in a blowout), × 100; `top` the ids, `topPlay`.
  **The NBA's minutes gate**: a side player projected under `MIN_MINUTES` = 20 is `thin` and his plays marginal; `b2b` when
  his newest log is the night before the slate (a badge); `thin` / `b2b` / `minutes` ride on the plays, the best rows and
  the side players. `board.value` = the defaults, `minMinutes`, `top` (the passing plays' ids by EV) and `ranked` (the games
  by score). The server runs it at the defaults; the panels run the same functions with the user's own floors
  (`components/picks/value-filters.js` `useValueFilters(sport)`: localStorage `ir:value:<sport>`, through
  `useSyncExternalStore` so the server render shows the defaults; `rankGames` / `topPlays` re-read `board.best` and
  `g.matchup`), so a slider never refetches. `ladderValue(rungs, side)` prices every rung for the ladder view, the best-EV
  rung marked. **The read API** (`lib/picks/v1.js`, `GET /api/v1/slate/{nba|nfl}?date[&season&week&type][&minEv&maxJuice
  &minChance&sort&marginal=1]` → { games: [{ matchup, kickoff, line, leak_tier, matchup_score, plays_with_edge, top_plays }]
  by score, top_plays by EV }, `GET /api/v1/picks/{sport}/{gameId}` → the tables with every row's value, the marginal rows,
  both sides' players with ranges and ladders; each row player, market, model_chance, fair_price, book_price, EV_pct, edge,
  status, result; admin or the sync token, `Cache-Control: private, max-age=60`). `__tests__/picks-value.test.js`.
- **The three-level layout both boards share** (the brief's IA; `components/picks/SlateOverview.jsx`): level 1, the slate
  overview at the top — `ValueControls.jsx` (the min EV, max juice and min chance sliders, the sort EV% · Matchup · Chance,
  "Show marginal", Defaults), **Top Matchups** (`MatchupCards`: the games by Matchup Score, a card each — the matchup, the
  tip, the leak badges, "N +EV plays", the top play with its EV and price, the score's heat green / amber / grey against the
  slate's best; hover for the arithmetic; press one to open the game) and **Top Plays** (`SlateList.jsx`: every +EV play
  across the slate, EV the headline column with the edge under it, the price beside it with the chance it implies, then
  the chance, the projection against the line and the matchup; the market tabs, "Soft matchups only", the marginal rows
  dimmed with the floor they miss when the switch is on; a row opens the card on the NBA, the **ladder** button opens
  level 3 under the row — `Ladder.jsx`, the alternate lines with the board's chance, the price and the EV of every rung,
  the best-EV rung ringed, the main line marked; the NBA card's rung buttons carry the same EV and ring). Level 2, the
  games **folded to one line, closed by default**, in the overview's order (the NFL's `Board.jsx` `GameHead` +
  `GameSummary`, the NBA's `NbaGame.jsx` `GameFold`: the matchup, the tip, the leak badges, "N +EV", the top play with its
  EV, the score; Expand all / Collapse all; a Top Matchups card or the NBA head's dropdown opens one game alone); inside,
  the profile, the strips / the courts and the tables (`GroupTable`: EV · Price · Chance, the marginal rows behind the
  panel's switch, re-read at the user's floors). The games-first-and-open layout of 2026-10-30 gave way to this on
  2026-11-01; `RowBadges` (`badges.jsx`) marks DTD, thin minutes and a back-to-back on every row. **An opened NBA game
  leads with PropFinder's tables, the players under them** (Vincent, 2026-11-01: "put the propfinder tables back. under
  the tables, we just list the players", and his read — PropFinder's L10 per position, the cheat sheet to confirm it, then
  the player's own home / away / h2h figures for the projected number): `TeamColumn` in `NbaGame.jsx` per side — who is
  out, the `AllowedTable` opening on **L10** when PropFinder has one (`sheetMarks`: the cheat sheet's tile in every cell,
  "✓ #4" green in the same third as PropFinder's rank, "✗ #19" red otherwise), the stat tabs (the slate's `metric`), and
  `Roster`: every active player with his projection per stat (the book's line, chance and EV under it), and for the picked
  stat his average at tonight's venue / in his last meetings with the opponent (`splits[market]` on the side player,
  `venueSplits` in `board.js`: { venue: { avg, n, at }, h2h: { avg, n }, season: { avg, n, stand } } over this season's
  regular-season games, his last `seasonCap` standing in until three; a pressed table row keeps that position's players,
  a row opens the card); the courts and the five group tables behind "Show the courts and the tables".
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
  (the notes' "Vacated production" line says the share), **the ceiling read** (`reach` 0.3, `reachDown` 0, `reachK` 10;
  Vincent, 2026-10-31: "look at what a player is capable of and then determine the ceiling … Dosunmu has a great matchup
  today, his line is over 3.5 rebounds but he is capable of getting more when the matchup is good"): in a soft matchup the
  ladder's centre moves from the stated figure (his rate × the matchup × the side's factor, `base` on every rung and range)
  toward his ceiling — the top quarter of his nights over his last 82 as a ratio on tonight's figure (`up`) — by reach ×
  `where`, the opponent's rank at his spot placed in the league (1 the softest, 0 the middle; `reachOf` in `projection.js`:
  the cheat sheet's tile in full, PropFinder's rank at gp / (gp + reachK), blended as the matchup factor is); a steady
  player has no ceiling over his rate and does not move; the hovers spell it out (`reachText`), the shuffle's Projected cell
  carries ⇡, the scorecard's "Before the ceiling read" row (sparse, the nights it moved) grades it against the projection.
  Measured on 2025-26 (125,045 projections, `docs/audits/2026-10-31-nba-ceiling.md`): a player with upside clears his
  ceiling as often in the soft third as in the tough one (26.7% / 27.5% / 27.6%) — the table says how much a defense gives
  up, not on which night his big game comes — so the read is set where it helps (MAE 2.513 → 2.505, most of it the board's
  low bias; the rungs 0.1393 → 0.1391, the main rung as it was) and no further (reach 1: 2.542, the 60–70% rungs landing
  55%); the pull toward his floor cost at every weight and is off, and `pull` (Vincent, 2026-10-29: "we can't treat them all
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
- **The per-stat recipe** (the cocktail's `recipe`, with `withoutSplit` and `teamCeiling`; `RECIPE` / `COCKTAIL` in
  `lib/nba/picks.js`, the NBA's cocktail since 2026-11-03, the one before kept as `COCKTAIL_BEFORE_RECIPE`; Vincent, 2026-11-03:
  "what can predict threes the best, rebounds the best, points the best and assists the best?", then "yes build it and run the
  replay"; `docs/audits/2026-11-03-nba-stat-drivers.md`): `logAverages` puts `dec` on a stat's windows — his rate a minute over
  his regular-season games across the seasons, each game's weight halving every `rate[stat]` games (points and assists 15,
  rebounds and threes 20, the rest 15; `decayRate`), × his minutes (`recipeMinutes`: this season's decayed at `minutes` = 3
  from his first game, last season's average before it, n / (n + 0.5) between) — and `ownRate` reads `dec` before the windows'
  blend and the volume read (`decRate`, `decMin`, `decHl` ride along, `recipeText` / `recipeOf` word them). The matchup reads the
  opponent in all positions (`sidesOf`'s `allRatio`: `totals[opp].against` or its last ten over `leagueFor`, shrunk toward 1 at
  gp / (gp + `matchupK` = 10), the last ten at K / 2; `posRatio` its last-ten cell at his spot), × Π ratio^b per `matchup[stat]`
  (points season 0.94; rebounds last ten 0.65; assists season 0.62 · position last ten 0.18 · 3PA allowed 0.51; threes 3PA
  allowed 1.12), the cheat sheet's tile at his spot in full beside it (their mean), a combo on its parts weighted by his rates
  when a part reads the recipe; `matchupFrom.from: 'team'` (the scorecard's "The opponent in all positions" group); a stat it
  does not name keeps the cell at his position. The teammates out (`outRead` on the side: the out players who played 3 of the
  team's last 5 games this season at 20+ minutes — an older absence is in everyone's own games — their production a game
  decayed at 10 games over the team's `totals.for`, (1 + V / T)^b per `out[stat]`: points 0.7, rebounds 0.53, assists 0.77,
  threes 0.64, PRA 0.68, else 0.6) multiply into the ladder's `env` (`out` / `outFrom` on the range), in place of the vacated
  lifts and the minutes factor (`minutesTonight` still runs for the minutes shown and the thin gate); no team totals, no factor.
  `withoutSplit: false` drops the without-teammate split from the rate, the rungs and the shuffle; `teamCeiling: false` keeps
  the expected total and scales nothing. **The ceiling's sum leaves out the roster players without a game this season** once the
  team has three (2026-11-05; Vincent, of DEN at half its figures — Jokic 6.9 rebounds, Gordon 3.1, Murray 2.6: PropFinder's
  roster since 2026-11-02 brought two-way, G League and long-injured players at last season's minutes, the sum ran to twice the
  team's total and the ×0.5 floor hit), and the NBA's floor is `ceilingFloor` = 0.8 (the default 0.5 elsewhere). Counting only
  the 240 minutes of the expected rotation was tried first and read 0.06 points and 0.02 rebounds worse on the replay; the fix as
  shipped reads the same as before on the full-roster replay (rebounds 1.844 → 1.839, the bias −0.22 → −0.14).
  `__tests__/nba-recipe.test.js`. The site's cocktail: the recipe, the without split off, the role pull off (`pull: null`:
  the decayed memory reads a player's first games better), the team ceiling on. Replayed on 2025-26 and this season: every stat's
  miss and every market's rung Brier down over the season (points 4.96 → 4.92, rebounds 1.99 → 1.97, assists 1.46 → 1.45, threes
  1.012 → 1.005, PRA 6.52 → 6.42), the pieces priced in the audit. `--cocktail before | recipe | site+{json} | before+{json}` on
  the replay; `tools/audit/nba_ab_rows.py` compares variants on the same player-games. `__tests__/nba-recipe.test.js`.
- **A ladder priced against itself** (2026-11-07, Vincent's screenshot: a 25-point scorer's o5.5 points at -143 between o3.5 at
  -24900 and o7.5 at -6150, the card's main line with a +68.6% edge): `playerProps` drops a line priced under a higher line of
  its market by more than `LADDER_CLASH` = 15 points of implied chance (another market's line filed under it), the line in the
  most clashes first, the lone book's of two; and `ladderOf` marks main only the pull's line (`prop.line`), never the rungs a
  book flags main on its alternate ladder (the first flagged, the lowest, had read as the night's line on the ranges, the
  shuffle and the card).
- **The outlier nights** (the cocktail's `countTail` and `lineup`; `OUTLIERS` on the NBA's `COCKTAIL` since 2026-11-07, the board
  before it `COCKTAIL_BEFORE_OUTLIERS`, the replay's `--cocktail outliersOff`; Vincent, 2026-11-07: "a few players were projected
  by us to get 4 or 5 rebounds but they actually got 10+ … that is where the money is for nba. The big players are nuked in odds
  anyways"; `docs/audits/2026-11-07-nba-outliers.md`, `tools/audit/nba_spikes.py`). **A count's tail** for the markets in
  `countTail` (the NBA: rebounds, assists, threes, steals, blocks): `ladderOf`'s model half is `countTail(line, proj, sd)` in
  `projection.js` (the negative binomial with the ladder's centre and spread, the Poisson where the spread is narrower than
  √centre) in place of `upperTail`, `tail: 'count'` on the rung; the range's floor and ceiling are its quartiles
  (`countQuantile`); the shuffle recentres the same tail (`tailOf`, the row's `tail`); the Big games' unfitted marks read it
  (`nbaBigChance`'s `ctx.tail`), the fitted ones keep the normal they were fitted on; the scorecard's predictor table stays on
  the normal. Over 2025-26 the normal said 2.4% for threes at the centre + 3 (3.5% landed), 2.0% for rebounds + 6 (2.5%), 0.5%
  for assists + 6 (1.2%); the count 3.7 / 2.9 / 1.4%; every count stat's rungs scored better with it on both seasons, points and
  PRA worse near the line on 2025-26 and keep the normal. **Tonight's starting five** (`lineup` { up, down, games, min }; the NBA
  0.1, 0.1, 10, 5): `sidesOf`'s `lineupRead` reads the board's `lineups` (RotoWire's, the store passes `lineupsOf(feed)` into
  `buildBoard` and keys the board's memo on the feed; `gradeSlate` the slate's stored copy) against his starts over his last
  `games` regular-season games with PropFinder's `starter` flag (sparse: 1 a start, absent off the bench, null a row without
  the flag; read only when some row of the pull carries a 1, from `min` flagged games): in the five from under half of them
  (promoted) or out of it from half or more (demoted), his projection moves by his minutes with the five over his minutes
  without it (`lineupMinutes`, the cocktail's `lineup.model` / `lineup.base`: `dec` this season's minutes decayed at `hl`,
  `split` his average in tonight's role over his last `history` games shrunk at `splitK`, `vac` the minutes of the teammates
  out by outRead's rule; clipped to `clip`; `LINEUP_MINUTES` in `lib/nba/picks.js`, Vincent, 2026-11-07: "can we predict
  player's minutes based on lineups?"), × (1 + up) / × (1 − down) without a model, into the ladder's `env` beside the
  teammates-out factor (`ranges[market].lineup`; `lineup` { factor, role: promoted | demoted | starter | bench, share, n,
  status, minutes { tonight, before, dec, split, vac } } on the side player; the lineup's minutes are `minutes.tonight`, with
  `minutes.lineup`, for the Min column, the thin gate and the plays; `lineupText` words it on the court's and the card's
  hovers). Minutes' miss 4.75 (the board's read) → 4.65 over 2025-26, 4.91 → 4.66 this season. Over 2025-26 a promoted player landed 1.21–1.30× his
  projection (28.2 minutes against 24.4), a demoted one 0.89–0.92×; this season's 17 nights 1.00–1.12× and 0.79–0.86×.
  Replayed over 2025-26, the board before → the flat × 1.1 / × 0.9 → the minutes: points 4.903 → 4.883 → 4.875, PRA 6.352 →
  6.315 → 6.297, every market's rung Brier lowest with the minutes. `__tests__/nba-outliers.test.js`.
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
- **The Defensive Matchups route** (the NBA; Vincent, 2026-11-08: "add the endpoint to the pull", after asking whether the
  projections read it — they did not: the board's `allowed` table is `/NBA/teams`' Opponent rows). Every pull reads
  `/NBA/defensive-matchups?season=<slate's>&lastNGames=0&since=2025-10-21&sportsbooks=betmgm|draftkings|fanduel|prizepicks|underdog`
  (the page's own query as Vincent copied it; `defensiveMatchupsPath` in `propfinder-nba.js`, `PROPFINDER_NBA_DEFENSIVE_MATCHUPS_PATH`
  with `{season}` replaces it on Render) through `fetchDefensiveMatchups` in `propfinder.js`, never failing the pull. The page
  sits behind the login, so the answer's shape was never seen: it is stored whole (up to `DM_MAX_CHARS`) in
  `nba/<date>/propfinder-defensive-matchups.json` beside the pull, not read by the board, served by
  `GET /api/nba/propfinder?part=defensive-matchups`; `readDefensiveMatchups` reads rows { team, pos, player, stats { key:
  { value, rank } } } through the FIELDS spellings (`<spelling>Rank` beside), and the pull's `defensiveMatchups` report
  (Data sources) carries the item count, the rows read, the keys, the figures no spelling read (`unread`) and
  `checkDefensiveMatchups`: how many cells read the same as the `/teams` table within `DM_SAME` = 0.15, the first
  differences. **The projections do not read it yet**: the first real pull says whether it is the `/teams` data again or
  another window (its `since` is the 2025-26 opener, the board's table this season's alone — the rule of 2026-10-27), and
  what it adds (the opposing player, a line); then decide. The status's `propfinder.file` now passes `samples` too (Data
  sources read `pf.file.samples`, which the status never sent). `__tests__/nba-propfinder-pull.test.js`.
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
  player's logged games, `withoutGames` his games without them, **his games for this team only** (`teamRows`, Vincent, 2026-11-05: Desmond
  Bane's "w/o Banchero + Suggs" read 60/79 over his Memphis games of 2024-25, the game rows carrying no team; it was 5
  games for Orlando): `absentByTeam` hangs `teamGames` (Map gameId → the team's pulled players who took part, not
  enumerable) on each team's list and `withoutOf` keeps his rows from his first game with one of them on, none against
  the team, before `keyAbsences` / `withoutGames` read them (the card's w/o tile, the board's blend and the w/o edge
  alike; a teammate who arrived later moves nothing); `withoutOf` the split (≥ `WITHOUT_MIN`
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
  n, weight, rate, avg, seasonAll. **The w/o edge** (Vincent, 2026-11-05, on the card's "w/o Banchero + Suggs 60/79
  76%": "because books don't price it accordingly"): `without.all` is his record at the play's line and side over every
  logged regular-season game of the split (any season, the card's w/o tile), `without.with` the same over his games with
  them; `without.edge` = { rate, hits, n, implied, gap, with } when `all` beats the price's implied chance by
  `WO_EDGE.gap` = 10 pts or more on `WO_EDGE.n` = 15 games or more **and** beats `with` (else the line is no edge of the
  absence's). A flag, not a change to the chance: `woEdge` on the play and the side's play; the Games tab's row carries the
  widest flagged line of the stat (`tierRows` → `woEdge`, the green "w/o edge o21.5 · 76% vs 50%" tag, `WoEdgeTag` in
  `NbaPlayerCard.jsx`, wrapping onto its own line under 700px), the card the stat's flagged lines over the w/o note and in
  its plays table. The scorecard records `woEdge` / `woRate` per graded play and `summarize` → `woEdge` (scorePriced + the
  split's average `split` + `board`), the "W/o edge" row under the edge table: after a few weeks it says whether those plays
  won more than the price said. The ESPN replay carries no prices, so it was never backtested. **The production an out player leaves goes to his active
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
  `nba:injury-override` event). **The stored box score settles who played** (`applyBoxScores` in `injuries.js`, run by
  `buildBoard` on the pull it is given, by `shuffleOf` and by `playerFor`; Vincent, 2026-10-31: Nembhard played for IND on
  Oct 30 and the court still showed him out — the report's row was read at the pull, and `markStale` only sees the logs
  the pull carries, never the game itself): once a slate game has a stored result, a pulled player with minutes in it is
  in whatever the report, the depth chart or an override said (`injury` null, `injuryFrom: 'boxscore'`, `injuryPlayed`
  { min, date }, the listing kept as `injuryListed`; his report row marked `stale: { playedOn, boxscore: true }`), and a
  player on the box score who did not play is out ('Out', "did not play", a `boxscore: true` row added), so he leaves the
  tables, the shuffle and the lifts as any out player does; the notes say "Played despite the report: …"; the card's slot
  line names the box score and draws no override buttons. The replay in `gradeSlate` reads the same correction (the
  board graded knows who sat, the pre-game board did not). **ESPN's league injury feed is the second word before the game**
  (`parseInjuries` / `fetchInjuries` in `lib/nba/espn.js`, `site.api.espn.com/…/nba/injuries`, free, no login; Vincent,
  2026-10-31: "Can't we just find another source for the confirmed NBA lineups?" — the NBA's own report PDF and NBA.com's
  live data answer 403 to the server, ESPN's feeds are served): one dated entry a listed player with RotoWire's word for
  tonight in `details.fantasyStatus` — OUT / OFS = Out, GTD = a game-time decision (the "Day-To-Day" players and the ones
  "Out" for their last game who may go tonight), not out — the injury as detail, the expected return and the comment;
  a player not listed is in. Stored per slate at `nba/<date>/injuries-espn.json` by the store's `ensureInjuries` (with
  `boardFor`'s refresh and `POST /api/nba/refresh?only=schedule`, read again every `INJURIES_FRESH_MS` = 20 min while the
  slate is today or later with a game to play, `cfg.injuriesLive`; a past slate keeps its copy) and merged by `pfFor`
  (`applyEspnInjuries` in `injuries.js`, before the overrides: the hand beats the feed, the box score beats both): the
  newer word wins — PropFinder's listing stands only when dated after ESPN's entry (or after the feed, for a player ESPN
  does not list) or when it says the same health class; `injuryFrom: 'espn'`, `injuryEspn` { status, raw, fantasy,
  returnDate, comment, date }, the listing it replaced as `injuryListed`, the report's rows following (`stale: { espn }`,
  ESPN's rows `source: 'espn'`, `espnAt`). The notes say what the feed moved ("ESPN's injury feed (read …): Nembhard (IND)
  in, PropFinder had him Out"), the card's slot line reads " · ESPN" with the entry on the hover, Data sources' PropFinder
  block says when the feed was read and how many it lists on the slate (`injuries` on `statusFor`), `injuriesAt` rides on
  the board payload. The feed has no starting fives (ESPN's pre-game summary carries `injuries` per team and no roster;
  the box score's `starter` flag arrives at tip), so "confirmed" means the report an hour before tip, not the lineup
  card — **the starting fives come from RotoWire** (`lib/nba/rotowire.js`, 2026-11-04: `parseLineups` reads
  https://www.rotowire.com/basketball/nba-lineups.php — served to the server, today's night alone, its date in the head; each
  team's status line "Expected Lineup" / "Confirmed Lineup" (the class or the words, `statusOf`: the confirmed markup had not been
  seen when it shipped), its five starters and who may not play, RotoWire's codes read through `teamAbbrFromText`; `getText` in
  `lib/picks/http.js`): the store's `ensureLineups` (`cfg.fetchLineups` / `cfg.lineupsLive`: the slate is today ET and a game is
  still to start) keeps it at `nba/<date>/lineups.json`, read again every `LINEUPS_FRESH_MS` = 10 min by `boardFor` and with the
  refresh route's schedule branch (`lineups` in its answer), a page dated for another night never stored; the board payload
  carries `lineups` { at, source, url, teams: { ABBR: { status, starters, mayNotPlay } } } (no number reads it).
  **The NFL board reads the same feed** (Vincent, 2026-10-31: "do the same for the NFL board"; `parseInjuries` /
  `fetchInjuries` in `lib/nfl/espn.js`, `fetchInjuries` / `injuriesLive` on the NFL store — live while the week has a game
  to play —, the refresh route's schedule branch; `nfl/<season>/<wk>/injuries-espn.json`): the week's practice reports
  (Active = he cleared, listed as such and read as In; Questionable; Doubtful; Out) and the reserve lists (`NFL_FANTASY`:
  IR and IR-R = IR, PUP-R = PUP, NFI-R = NFI, RESERVE-SUS = Suspended, INACTIVE = Out; `statusOf` reads "Suspension" as
  Suspended). The parser both sports share is `parseInjuryFeed` in `lib/picks/injury-feed.js` (client-safe: no names.js),
  each sport passing its team-code reader and fantasy-status spellings. `__tests__/picks-espn-injuries.test.js`
  (`fixtures/espn-nba-injuries.json`, the NBA feed of 2026-10-31 trimmed to IND, POR and UTA; `espn-nfl-injuries.json`, the
  NFL's the same day trimmed to SEA and DEN). **With and without each teammate** (`teammateSplits`, PropFinder's Lineup Lab as
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
  head and the tables, both sides side by side — Vincent's ask, 2026-10-27) and `Sources.jsx` (the PropFinder pull, ESPN refresh, the injury feed; since 2026-11-04 — Vincent: "I will not get the cheat
  sheet anymore" — no drop zone and no folder-sync note, a date that stored sheets still listing them to read again or remove); `components/nfl/*` and `components/nba/*` bind them.
- The Mac folder sync (`tools/mac-sync/nhl-sync.sh`, `sync_sheets`) posts any `.csv` / `.xlsx` / `.pdf`
  saved in `~/Desktop/NFL` to `POST /api/nfl/sheets` and in `~/Desktop/NBA` to `/api/nba/sheets`
  with the NHL sync token.

