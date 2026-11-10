# NBA board (`/nba`)

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
  makes it so incredibly difficult to find good match ups easily"; and 2026-10-31, "I need to be able to select the
  games from a dropdown on top of the screen": the slate head's first control on the Best plays tab is a game dropdown
  (`gameId` in `NbaApp`, the Matchups tab's `nhlx-mu-gamepick` styles, "All games (n)" then "IND @ DET · 7:00 PM" /
  "· final 110–104"), a pick showing that game alone, open, with the ranked list cut to its plays and an "All games"
  button in the games head; the pick is kept across reloads of the same slate and cleared when the date changes):
  `NbaBoard` draws `SlateList` (every play on the
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
- **The court head's verdict and the chips' Q1 badge** (Vincent, 2026-11-10, after the NHL rink's: "build the court
  headline verdict plus a Q1 badge"). The head: "CHI **gives up a lot of points** · 121.4 a game · #2 of 30" for the stat
  the court shows (`AllowsLine` in `NbaCourt.jsx`, `.nhlx-rk-verdict` shared with the rink; `side.allows` from
  `sideAllows(defense, opp)` in `lib/nba/profile.js`, set on every side in `makeBoard` through `profile.sideAllows`:
  PropFinder's team row `totals[opp].against`, last season's standing in early, ranked over the pull, 1 = the most), tinted by
  third — green "a lot of", amber "an average number of", red "few". The chips: a **Q1** badge on the name line for points,
  rebounds, assists and threes (`Q1Badge`; none for steals and blocks), `p.q1[stat]` from `q1Read(q1Book(results, { through }),
  player, opp)` in `lib/nba/quarter.js`, put on the board by `boardFor` in `lib/nba/store.js` (`withQ1Reads` over the season's
  stored ESPN results before the slate, `seasonResults`; the book kept while the date and the results (id + `storedAt`) are the same, the decorated board per built board so its identity holds): the opponent's 1st-quarter
  figure allowed a game ranked among teams with `Q1_MIN_TEAM_GAMES` = 3, plus the player's own 1st quarter a game ranked in
  his ESPN group (guards / forwards / centers) with `Q1_MIN_PLAYER_GAMES` = 5, each by third (+1 / 0 / -1), the sum green at
  +1 or more, amber at 0, red at -1 or less, the read on the hover (the NHL's `periodRead` rule). Results stored before the
  1st-quarter lines were parsed (2026-11-01) have `q1Pts` null and are skipped; `firstBasketFor`'s re-read now also takes
  those (the ones ESPN had no plays for last), and `nba-data.yml`'s `what: q1` walks it until none remain. The 2026-11-10
  look (150 games from ESPN): a team gives up 28.2 points, 11.4 rebounds, 6.9 assists and 3.4 threes in a 1st quarter;
  CHI the most points (35.7), BOS the fewest (24.1). Colour only; `__tests__/nba-q1-allows.test.jsx`.
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
  main line the chip prints the board's figure for that line** (`mainAt` in `shuffle.js`: `pAt` / `readAt` return `main.p` on the
  blend read when the height's line is the player's main line, `play: true` on the read, the rung's edge on it too; the
  Shuffle tab's rows the same; Vincent, 2026-10-31, "conflict": the strip said Schröder o2.5 rebounds 72%, the chip 3+
  80% on the same line — two reads of one line, the play's `chanceOf` and the ladder's rung; one number now). **On the
  NBA board that figure is the ladder's main rung** (`mainOf` in `shuffle.js`, `main.from: 'ladder'`, since the best bets
  rank by edge and the strip and the list read the rung there, `board.bestBy` on the binding; the game table's hit-rate
  read rides beside it as `main.hitRate` for the hover): the same evening Holiday at POR read 51% at 14+ (the play's hit
  rates, shrunk toward -133) and 39% at 13+ (the ladder) — a lower bar can never be less likely — so the chip is the
  ladder at every height and its chances fall as the bar rises; a board ranked by chance (the NFL's) keeps the play's
  figure at the main line, the tables' and the strip's number there. **Every chip
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
  `defenseAllowed` → `defense.windows[l5]` with their own ranks (**a team short of N games this season reads its season row
  there**, `short` on the row, the note "ATL has played 8 games this season, all 8 here"; 2026-11-02, Vincent: ATL's L10 tab
  read last season's last ten, "10 GP", labelled "of last season (no games this season yet)" — PropFinder publishes no
  last-N row until a team has N games; last season's last N stands in only for a team without a game this season, and a
  window PropFinder publishes for no team in either season is no tab) and `league` = the league's average per position
  and stat; `windowsOf` / `tableFor` / `windowLabel` in the court, `zoneTone` by rank third, rank 1 = the most
  permissive), the zone's foot carrying the rank; **above the table, who is out tonight** (`OutLines`: the side's
  team then the opponent, from `side.out` = the injury report (ESPN's league feed since 2026-11-08, PropFinder's before) through `absentByTeam`, name, position,
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
  under, the average pill), **the attempts behind them** (`ATTEMPTS`: 3PA behind threes, FGA behind points, an outline
  with "made/attempted" over each bar and an "Attempts" switch, on by default; a chip with the split's attempts a game and
  the percentage made; Vincent, 2026-11-03: "I need attempts in this view as well"; `__tests__/nba-card-attempts.test.js`), the split tiles (L5 · L10 · L20 · season · vs opp · home / away; press one
  to draw its games), the splits table (GP, MIN, PTS, REB, AST, 3PM, PRA, over %), and on the right
  the opponent's allowed table (Season / L5 / L10 … tabs, his position marked, the league's average at
  his spot under it), **what other players at his position did against the opponent** (`VsPosition` in the card,
  `vsPosition` on the payload from `lib/nba/store.js` `playerFor` → `lib/nba/vs-position.js`; Vincent, 2026-10-31: "on the
  individual player card, I need to see what other players in the same position did"): the opponent's stored games this
  season before the slate (`datesWithData` + `seasonResults`), every opposing player who played with his line (MIN · PTS ·
  REB · AST · 3PM · PRA · STL · BLK), position tabs PG … C opening on his spot (`myPos`), the card's market column read
  against the card's line (green over, red under), his own games against them tinted ("· him"), the head counting the
  player-games, the average a player, how many cleared the line and the position's total per game beside PropFinder's table
  figure for it. ESPN's box score places a player only as G / F / C, so the positions come from the stored PropFinder pulls
  of those nights (`positionBook`: the depth chart's slot first, else the roster position, G → SG and F → SF as `envPosFor`);
  a player no pull knows keeps ESPN's group and shows at both spots it covers (`atPosition`, `WIDE` in the client-safe
  `vs-position-pure.js`), marked "· G" / "· F". The block comes in **its own request** (`/api/nba/player?part=vs` → `vsPositionCard`), fetched beside the card's,
  so the card opens on its logs while the season is read ("Loading what other players did against …" until it lands;
  2026-11-05, "the load of the player card takes too long": the card waited ~9 s cold on some 150 reads one after the
  other). `seasonResults` reads six nights at a time and each night's games together; a past night whose games are all
  final and stored is kept six hours (`nightMemo`, `NIGHT_TTL_MS`) and each past night's pull is kept cut to its
  positions (`pullMemo`), both until a write under the date (`pathRevision` in `lib/nhl-store.js`: the first-basket
  backfill rewriting a result drops its night). The read is kept ten minutes per opponent and date (`vsMemo`, two cards
  opened together share the read under way); `__tests__/nba-card-load.test.js`. **The players like him are washed purple** (Vincent, 2026-10-31: "mark the players in purple when they are
  similar to the player on the player's card"; the NHL card's violet look-alikes, the `--like-*` tokens): every player's
  averages this season before tonight from the same stored box scores (`seasonProfiles` in `vs-position.js`: minutes,
  points, rebounds, assists, threes a game, any opponent), the card's own beside each opposing player's (`likeHim`,
  `similarLine` in `vs-position-pure.js`: every figure inside his band — minutes ±20% (4 at least), points ±25% (3),
  rebounds and assists ±35% (1.5), threes ±40% (0.8), `LIKE_BAND` — read off `LIKE_MIN_GAMES` = 3); `like` { profile,
  alike } on the payload, the rows `is-like` (the market cell keeps its green / red), a line over the tabs ("2 players at
  PF like him · his line: …"), the look-alike's line on the row's hover. `__tests__/nba-vs-position.test.js` (the builder on the MIA at ORL fixture, the table rendered, the look-alikes) and "His
  lines tonight" (every play the board has on him, click one to draw it).
  Data: `GET /api/nba/player?key&date` → `playerFor` in `lib/picks/store.js` (the slate's PropFinder
  pull: his logs newest first, his props with their ladders, the game, the opponent's rows with ranks,
  `league` and `windows`); the plays ride in from the opener. Hit rates and splits are
  computed in the card (`hitRate`, `splitGames`: season = this season's games from his first,
  else his last 82). Usage rate, rebound chances and potential assists (PropFinder's
  player-summary figures) are read per game row as optional `FIELDS` (`usg`, `rebCh`, `potAst`;
  `optional: true` reads null when the row lacks the key, so an unknown spelling shows as "—" on
  the card and in the pull's unread list, never as 0) and averaged per split in the top bar and
  the splits table.
- **Everything PropFinder sends is loaded** (2026-11-01, Vincent: "do the same for the NBA board", after the NFL's; the
  pull's markets printed in full by `nba-data.yml`): the items are filed by PropFinder's own category first
  (`CATEGORY_MARKETS` in `propfinder-nba.js`), the NBA's skip rule narrowed to the fantasy score and the first basket
  (`notAMarket`; `NOT_A_MARKET` had kept the shooting lines from being read as points or threes, now each is its own
  market), and **new markets** in two groups (`lib/nba/markets.js`): Shooting (field goals made / attempted, two-pointers
  made / attempted = the field goals less the threes, `derived` in `espn.js`, threes and free throws attempted) and
  1st quarter & first minutes (1st-quarter points, rebounds, assists, the points in the first 3 minutes: `q1_*`, `m3_pts`,
  the full game's matchup table; `periodOf`, now `lib/picks/periods.js` shared with the NFL, reads "1st 3 Minutes …",
  "… - First 3 Minutes", "first3MinPoints", "points3min" as `m3`, a window without a market — the first five — off).
  The game rows' new sparse fields: `q1Pts` / `q1Reb` / `q1Ast` / `q1Tpm` / `q1Min`, `pts3m`, the first-basket flags
  (`firstFg`, `firstPt`, `firstTeamFg`, `firstThree`: loaded, the First Basket tab's model still reads ESPN's openings),
  `starter`, `passes`, `contestedReb`, `deferredReb`, `techFouls`, `blockedAtt`. **ESPN grades the first quarter off its
  play-by-play** (`periodLines` in `lib/nba/espn.js`: the scorer first among a scoring play's participants, the assister
  second when the text names one, the rebounds off the rebound plays, the first three minutes the clock from 12:00 to
  9:00; on POR at UTA, 2026-10-31, every player's points, rebounds and assists summed over the four quarters equal his box
  score; a summary without plays leaves them null, ungraded). **The rest is kept as sent** (`keepExtra`, as the NFL's:
  `nba/<date>/propfinder-extra/<ABBR>.json` + `index.json`, `GET /api/nba/propfinder?date&player|team`), with **every
  rostered player the odds-only call leaves out** (`rosterExtra`: a second players call without `withOddsOnly`, two teams
  a call, each answer cut to the unpriced players; `offBoard: true` and his logs in the board's row shape) — kept with the
  extra and, **since 2026-11-02, on the board too** (`rosterOnBoard` in `propfinder-nba.js`; Vincent, of IND with ten players
  out: "why the hell do I only have 2 players listed for Indiana???" — the players taking the absentees' minutes had no
  lines yet, so the odds-only board had no row for them): every rostered player of the slate's teams is a side player with
  his logs and no lines (`props: []`, no play, off `best`), with ranges, ladders and a shuffle row, so the Games tab lists
  him with his projection; the minutes, the team scale and the vacated lifts now read the whole roster, as the audits'
  replays (every player of ESPN's logs) always did. The Games tab and the stat lists keep every active player with a
  projection, a mark or not (`tierBoard(…, { keepAll: true })`, "—" in a tier he does not reach; `ladderBoard(…, { keepAll:
  true })` the same on the book's rungs until the shuffle loads — that line, copied in without the option, threw
  `keepAll is not defined` and broke `/nba#reb` on a past night, 2026-11-07); the Boards tab still
  lists only players with a mark. The game rows' kept
  figures are everything but the board row's own keys (`ROW_KEYS`: the win, the margin, the division game are kept too,
  the NFL's as well). `__tests__/nba-propfinder-all.test.js` (every market name of that pull; the play-by-play of POR at
  UTA, `fixtures/espn-nba-summary-por-uta.json`), `nba-propfinder-pull.test.js` (the pull against a stand-in API).
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
- **Boards** (`#boards`, `NbaBoards` in `components/nba/NbaBoard.jsx` → `components/picks/Boards.jsx`, the pure builders in
  `lib/picks/boards.js`; Vincent, 2026-11-01, with his own NFL lists as the form — "Best Receiving Ladders · 1. Puka Nacua
  100+ / 110+ / 125+" —, then "I don't care about edge etc… I just want to know what I should bet on: 10+ points (strong),
  20+ points (lean), 30+ points (thin)" and "TD candidates we should list with chance%"; the NBA's built here, the NFL's
  elsewhere): per stat a numbered list across the slate (`NBA_BOARDS`: points, rebounds, assists, threes, PRA), each player
  with **the highest round mark he clears at each tier** — `TIERS`: strong 70%+, lean 55%+, thin 40%+ on the board's chance
  (`tierOf`), a mark shared by two tiers listed once at the stronger — "15+ strong · 20+ lean · 25+ thin", ranked by the
  strong mark, then the lean, then the thin. The marks are round (`step` per spec: points and PRA by 5, rebounds and
  assists by 2, threes by 1) and read off the shuffle's payload (`tierBoard`: `GET /api/nba/shuffle?date&market` per
  stat, fetched by the tab, every height read with `pAt`, the court's and the Shuffle tab's figure); until it arrives the
  board reads the book's ladder rungs (`ladderBoard`, `round: false`, the note says so). No price and no EV on the line
  (the price on a mark's hover). **Double-double candidates** (`candidateBoard`, the NBA's touchdown list) by his chance
  alone, coloured by tier. A player out is off the boards, a game-time decision reads "if he plays" and thin minutes
  "if role confirmed" (`caveatOf`); `PER_BOARD` = 10 then "Show all"; the head's game dropdown cuts every board to one
  game (`gameId`); a name opens the card. **Every line carries the matchup its projection reads** (`matchupOf` /
  `matchupText` in `boards.js`; Vincent, 2026-11-01: "I also need to know the matchup from propfinder / cheat sheet so I
  know where the projection is coming from"): his spot (`envPos`), PropFinder's rank there on the season table the
  projection reads ("PF #3", tinted by third, 1 = gives up the most), the last ten ("L10 #5") when PropFinder published
  it, the cheat sheet's tile ("✓ sheet #4" when it sits in PropFinder's third, "✗" when not) and the factor on his rate
  (`ranges[market].matchup`, "×1.06"); the hover names the figures, the league's average and whether the factor is the
  sheet and PropFinder blended or one alone; "no table" when the pull has none. `__tests__/picks-boards.test.js`.
- **Only who plays is listed** (Vincent, 2026-11-10: "I see a lot of players that are not playing still listed … I only need
  the players listed that will be playing"): `idle` on a side player (board.js `idleOf`, the cocktail's `idleGate`): the team
  has 3+ games this season, he averaged under 5 minutes over its last five (a game he sat counts 0), no book prices him, he is
  not in RotoWire's five, and he is no regular back from an absence (20+ a game this season over 3+ games). The idle and the
  out are off the court's chips and Tonight table, the Games tab (`ladderBoard` / `tierBoard`), the boards and the shuffle;
  the out stay in the lines under the court. A flag only: the minutes, the ceiling and the out reads are as before.
  Box scores 2024-25 to now: the full roster 89.5k player-nights (half under 10 minutes), the gate 60.3k, hiding 4.9% of
  those who played 10+ before the five and the lines keep theirs. `__tests__/nba-star-out.test.js`.
- **A star out** (Vincent, 2026-11-09: "Reaves had 40+ points … Doncic was out … our model was still way too conservative";
  `docs/audits/2026-11-09-nba-star-out.md`): the board had Reaves at 19.4 because Doncic was not on ESPN's report, so nobody
  was lifted and the ceiling cut LAL 12% for his 40 a game. Now RotoWire's lineups sit who the report missed (`lineupOuts`),
  every out player of this season lifts each teammate by the share of his memory they shared (`outRule: 'overlap'`), and the
  ceiling sums the lifted rates (`ceilingOut`); the bullet in `picks-core.md`. 2025-26's out nights had run 0.73 points low;
  points 4.88 → 4.84, PRA 6.30 → 6.22. Measured and not shipped: the second option taking more than his share (the box
  scores say less: the lift is biggest for the small shares, through minutes), the opponent's absences.
- **The outlier nights** (Vincent, 2026-11-07: "we need to start calibrating the nba model … players were projected by us to
  get 4 or 5 rebounds but they actually got 10+"; `docs/audits/2026-11-07-nba-outliers.md`): the rebounds', assists', threes',
  steals' and blocks' rungs read a count's tail (the negative binomial with the ladder's centre and spread: a 4.5-rebound
  projection at 2.5 says 10+ 3.8%, the normal said 2.3%), and RotoWire's starting five predicts the minutes of a player whose
  role changed tonight (Vincent, same day: "can we predict player's minutes based on lineups?") — a bench player starting about
  4 more, a starter out of the five about 3 fewer — and his projection moves with them (the cocktail's `countTail` / `lineup`,
  `LINEUP_MINUTES`, the bullet "The outlier nights" in `picks-core.md`); the Games tab's Min column shows the lineup's minutes
  with ↑ / ↓ and both figures on the hover. The ladders, the ranges, the shuffle, the best bets, the boards and the Big games' unfitted
  marks all read it; the calibration was fitted on the old tails and relearns with the next grading (or the workflow's
  `what: calibration`). What did not see a spike coming: the opponent's misses and rebounds allowed, pace, his own past big
  nights, his best recent game; the start and the teammates out did. The cheat sheet (`#guide`) names the start.
- **PropFinder's starters against ours** (Vincent, 2026-11-08: "compare their starters against ours", after the Defensive
  Matchups route read 630 of 630 cells the same as `/teams`: its new part is the starter each defense faces per position,
  `starterSource: "lineup"`). `startersCheck` (`lib/nba/starters-check.js`, pure) against RotoWire's five (`board.lineups`) and
  the board's spot (`envPos`): per team the same five or not, who is in one five only with his board role and starts share
  (`theirPromotions`: in PropFinder's five alone, under half his last ten started — a promotion the board does not make;
  `theirDemotions` the other way), and per player in both PropFinder's slot, RotoWire's and the board's. `startersCheckFor`
  in `lib/nba/store.js` reads the stored answer again (a night pulled before the reader kept the starters' details compares
  too) and the board without refreshing; `GET /api/nba/propfinder?part=starters&date`; the data workflow prints its summary
  and every team that differs after each pull. Read only: nothing on the board follows PropFinder's five until a few nights
  say whose five is right more often. `__tests__/nba-starters-check.test.js`.
- **Big games** (`#big`, `components/nba/NbaBigGames.jsx`, `lib/nba/big.js`; Vincent, 2026-11-01: "Do the same big games
  study for the NBA"; `docs/audits/2026-11-01-nba-big-games.md`, `tools/audit/nba_big.py`): per stat the night's likeliest
  30+ / 40+ points, 12+ / 15+ rebounds, 10+ / 12+ assists, 5+ / 7+ threes and 40+ / 50+ PRA (`NBA_BIG`, `nbaBigChance`: the
  board's normal tail at the mark off `ranges[market].exp` and the ladder's `sd` (`boardTail`), moved by σ(a + b · logit +
  w · context) where a context beat it on both checks — his share of his last 20 games at the mark (points, 12+ rebounds,
  10+ assists, PRA), his threes attempted over his last five (5+ threes); 15+ rebounds, 12+ assists and 7+ threes read the
  board's tail as it is; the matchup, pace, the line, home and back-to-backs added nothing). `nbaBigGames` runs in the
  binding's `buildBoard` (`board.big` = { rows, lists }, the logs off the pull, `BIG_MIN_GAMES` = 5, `NBA_BIG_LIST_MIN` = 5%),
  the reason beside each name ("30+ in 7 of his last 20"), the head's game dropdown cuts it, a name opens the card.
  **Outliers** beside it (a Big games / Outliers switch over the stat pills; Vincent, 2026-11-07: "build the outliers list on the
  big games tab", the 10-rebound nights from a 4–5 projection): per stat (rebounds, threes, assists, points; `NBA_OUTLIERS`) the
  night's likeliest to reach **double his projection** and at least + 4 rebounds / assists, + 2 threes, + 10 points
  (`outlierMark`), from `OUTLIER_MIN_MINUTES` = 12 minutes tonight and the stat's projection floor; the chance is the board's
  tail at the mark (a count's for the counts) through σ(a + b · logit) fitted on 2025-26's replayed board at that mark
  (`outlierChance`; threes as they are) **where his ladder has no rung at the mark; where it has one the chance is that rung's,
  his card's number for the line** (`from: 'ladder' | 'fit'`; Vincent, 2026-11-07: the list said 18% for McCollum's 4+ threes,
  his card's o3.5 16%), `OUTLIER_LIST_MIN` = 3%; the row carries the book's main line, the book's price at the mark when its
  ladder has the rung (`book` { line, odds, implied, edge, ev }), why (a start off the bench, the teammates out, **his games at
  the mark this season, then last season's to make 20** — `record` { season, last }, "4+ in 0 of 5 this season · 5 of 15 last
  season"; Vincent: "we should look at threes per game not across games", the note had read "4+ in 5 of his last 20" off
  last season alone —, his minutes: `outlierWhy`) and what he got. **The mark is a rung on his ladder** (the cocktail's `outlierRungs`,
  `OUTLIER_RUNGS` = each stat's `add`; Vincent, 2026-11-07, "Ok" to: the card shows the line the list reads), so every listed row
  is his card's number (`outlier: true` on the rung, kept from a 1% tail: no o51.5 points on a star's card).
  **The table reads Projected · Floor · Ceiling · Outlier · Chance · Book · Got** (Vincent, 2026-11-07: "why can't you keep
  things simple? Like projected, floor and ceiling": the range's floor and ceiling as on the court, "Outlier" for the mark, the
  Line column gone; on a phone "Proj", no note under the name, no rank).
  **The rebounds' high lines are fitted** (`HIGH_LINES` / `highLineFit`, the cocktail's `highLines`: from 1.5 × his centre,
  in full at 2 ×; Vincent, 2026-11-07, "fix the rebounds and assists chances too" — assists' high lines measured right, no fit). **Every column sorts** (`sortOutliers` / `OUT_SORTS`: a click
  sorts by the column, a second flips it, nulls last; Book by the edge, Why by his rate at the mark this season; Chance first). `nbaOutliers` runs in the binding's
  `buildBoard` (`board.big.outliers` = { rows, lists }); the replay's `--board` dump carries both lists.
  `__tests__/nba-big.test.jsx`.
- **Cheat sheet** (`#sheet`, `components/nba/NbaSheetMatchups.jsx`, the pure reader `lib/nba/sheet-matchups.js`; Vincent,
  2026-10-31: "create a new view with best cheat sheet matchups per game"): per game the cheat sheet's soft tiles — the
  cells of each side's `allowed` table carrying the sheet's rank (`sheet`, 1 = the opponent gives up the most of 30) for
  points, rebounds, assists or threes at a position, the top `SHEET_SOFT` = 10 — both sides ranked together, the sheet's
  rank first, then whether PropFinder's season table puts the cell in its soft third too (`agree`), then PropFinder's
  rank; each row with PropFinder's figure, rank and the league's, and the side's active players at that spot (`envPos`,
  the highest projection first, `PER_SPOT` = 3): his projection for the stat, the book's main line with the board's chance,
  the price and the edge, and "best bet" when the play is in `board.best`; a player opens his card. Six rows a game, then
  "Show all"; the head's game dropdown picks one game as on Best plays. Read off the board the page already holds, no
  request of its own; without a sheet for the date the tab says where to drop one. `__tests__/nba-sheet-matchups.test.js`.
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

