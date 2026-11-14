# NHL app (`/nhl`): automation, data and model

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
  ranked and tinted by third, a cell from 3 skater-games, and first **the slot the team gives the most to** (`most` on each
  `slotBoard` team: the raw leader with its figure and its rank against the league at that slot, the teams sorted by the
  figure; Vincent, 2026-10-31, after the rink head's line: the rank-based `softest` — the slot where the team ranks highest
  against the league, a tie to the one furthest over the league's mean — stays on the board for the sort it gave and names
  nothing on the page) with the opponent's skater at that slot tonight, clickable to his card; a slot's header sorts by it
  (`__tests__/nhl-defense-line-table.test.jsx`), and a team overview
  (GA / GP, SA / GP from the stored box scores; xGA / 60, high-danger shots against and pace from MoneyPuck; **PP SOG to D**,
  the share of the power-play shots on goal the team allowed that defensemen took over the span and venue picked, rank 1 = the
  biggest, the counts and the league's share on the hover, 10+ power-play shots at the least, `PP_SHARE_MIN` — Vincent,
  2026-11-12: "add D share of PP shots to the Defense tab"; the one power-play split that held from one half of 2025-26 to the
  next, r 0.52, the forwards' shares r ≈ 0, `tools/predictors/pp_shots.py`), each column ranked;
  between them "Running hot" (`lib/nhl-data/streaks.js`, `streaks` in the defense API): every skater's current goal / point /
  3+ SOG streak from this season's stored games, his last game and tonight's opponent read off the same tables at his
  position (the study found no carry-over from a goal last game, so the streak is colour, the Tonight cell the matchup). The 1st goal tab (`lib/nhl-data/firstgoal.js`, `/api/nhl/data/firstgoal`, `FirstGoalPanel.jsx`) ranks
  tonight's skaters as first-goal candidates: own first-goal record from the rows' `fg` flag, the opponent's first
  goals given up to the position and slot at the venue, head to head, and the 1+ goal odds as Best bets prints them for
  the saved run (the board's read, `slateWithBoardReads`; the run's own on the hover) (score 0–100). The stored data (rosters, media, game history, league, MoneyPuck) is kept fresh by the
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
  `lib/nhl-data/defense.js`, `slots` in `/api/nhl/data/defense`). Every skater row carries his power-play shots on goal
  (`ppSog`, the last row column since 2026-11-12: `ppShotsOf` / `stampPpShots` in `game.js` off each play's situationCode, the
  shooter's side up a skater with the other goalie in net, the shootout out; null on rows stored before it until the
  `firstgoals` backfill mode stamps them, which `stampFirstGoals` now also does; `ppSog` is a `DEF_METRICS` column, so every
  defense table has it per position; **`ppG`, his power-play goals, the same way and the last column since 2026-11-14**:
  `ppGoalsOf`, stamped by `stampPpShots`, backfilled by the same `firstgoals` mode, a `DEF_METRICS` column). Each game record carries its
  first goal (`firstGoal`, scorer's row flagged `fg`; shootouts excluded) and `firstGoalsAllowed`
  reads first goals given up per defending team by venue, position and line slot (the defense
  card's "1st goal" column, `firstGoals` in the defense API); games logged without it get it
  from the play-by-play via `stampFirstGoals` (`ingestGames` with nothing new, `?only=firstgoals`). The
  Matchups tab (`lib/nhl-data/slate.js`; each game drawn as two rinks in
  `components/nhl/Rink.jsx`, ice bands tinted by the opponent's rank per position (**since 2026-11-12**, graded in
  `docs/audits/2026-11-12-nhl-shots-environment.md`: under Shots its Shots/G, ICF/G and IFF/G ranks weighted 2 : 1 : 1,
  `shotsEnvRank`; under Goals its ISCF/G rank, `goalsEnvRank`, Goals/G having predicted nothing; both in
  `propfinder-csv.js`, read by `tintRank` in `Rink.jsx` and by `spotFromTab`'s soft flags; the band label reads
  `#8 shots · #13 ISCF`, every column on its hover; before, the SOG-allowed or goals-allowed rank) (the slate-wide
  Shots / Goals switch above each rink, `metric` state in `MatchupsPanel`; the band labels, legend and the chips'
  h2h mark follow it: scorers (`h2hHot`) under Goals, shooters (`h2hShotsHot`) under Shots)
  for the window picked above the rink — home / away / L5 / L10 / L5 home / L5 away, opening on L10 since
  2026-10-31 (tonight's venue before, still marked with a dot) —
  above each rink the opponent's PropFinder defense table (`propfinderDefenseTabs` in
  `lib/nhl-data/propfinder.js`, drawn by `PropfinderDefense` in `components/nhl/Propfinder.jsx`:
  All/C/LW/RW/D rows, season tabs then L5 / L10 / L15, per game or total, PropFinder's ranks, sortable; **the table
  and the PropFinder tint open on the L10 tab** whenever the team has one (Vincent, 2026-10-31: "make sure that last 10
  is the default when loading the matchup view"; `defaultDefenseTab` in `propfinder-csv.js`: L10, else this season's,
  else last season's — the stored window stands in for an L10 PropFinder has not published, so a team without it is
  rare; from 2026-10-27 until then this season's table led, Vincent's call that the teams on the ice are this season's,
  and `seasonDefenseTab` keeps that read for the matchup profile's Allows stand-in, whose Last 10 row carries the window
  already); the same default opens the rink's own stored-games window picker on L10 (the venue window keeps its dot, and
  stands in while the tables lack an L10 window), the shuffle's "Matchup from" column, the fold's defense card and the
  soft-spot flags, since they all read the tab the rink opens on; colour only, no number moves with it. The rink's tint
  defaults to PropFinder (that tab) when the opponent has a table, else to the Rink's stored games;
  **tinted from PropFinder, the ice takes the table's split** (`bandTone` in `Rink.jsx` → `rankThird` in `pf-ui.jsx`:
  the tint rank at 1–11 green, 12–22 amber, 23–32 red of 32, the colours of the cells above), so the ice reads the way
  the table does; tinted from the Rink's stored games the bands keep `zoneTone`'s 11 / 10 / 11, as do the rink head's
  verdict and the shuffle (Vincent, 2026-11-12, of WSH's LW at #22 SOG, amber in the table and red on the ice: "the rink
  should be colored as per the table when 'propfinder' is selected"; `__tests__/nhl-rank-third.test.js`);
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
  league's mean, the skater-games); **untinted since 2026-11-12** (Vincent, of a red RW1 beside a soft-spot flame: "But
  the red RW1 means a bad matchup, no?" — the slot table predicted nothing over a skater's rate, the audit below, so the
  badge is a plain label and the figure stays on its hover, the rink head's slot too) — and **the rink head names the slot the opponent gives the most to** ("PIT gives the most shots to the C1 · 2.9 a game ·
  #3 of 32 at that slot · tonight Kapanen": `most` on each `slotBoard` team and on `linesOf`'s read, the raw leader with its
  rank against the league at that slot and this side's skater there, `SoftestLine`, click to his card; the hover says the
  cell is a dozen skater-games that say where the shots went, not where they will go; `__tests__/nhl-rink-line.test.jsx`.
  Vincent, 2026-10-31, twice: "leaks most to the C3" on a #7 rank at 1.8 shots while the C1 took 2.9 a game, then the
  rank read and the raw leader side by side were confusing, and "some teams allow more shots against lines 2 or 3" —
  6 of 32 teams led at a second-line slot on the season's box scores — so the rank-based `softest` stays on the Defense
  tab's by-line table and off the rink head); colour only, no number moves — and checked the same
  day on both seasons' box scores (`docs/audits/2026-10-31-nhl-lines.md`, under Audits): the softest slot's skater was the
  top shooter at the slot's base rate (9.4%), the slot cell adds nothing to the position table, so the badges stay colour;
  **the PP badge beside the slot badge** (Vincent, 2026-11-08, of the profile's Power play and Discipline rows: "we should
  know whether there will be a lot of powerplays... Then, we need to find out who is on the powerplay ... Rotowire is the
  only website that gives insight in the powerplay lineups ... a small PP symbol next to the players on the rink that are
  predicted to get a lot of powerplay minutes"; `PpBadge` in `Rink.jsx`, `.nhlx-rk-pp`, `p.pp` from `ppRead` in
  `lib/nhl-data/pp-units.js`): RotoWire's POWER PLAY #1 / #2 (`lib/nhl-data/rotowire.js`, `parseNhlLineups` on
  https://www.rotowire.com/hockey/nhl-lineups.php — goalie and his Confirmed / Expected word, both five-man units, the
  injuries; the page serves today alone, so `ingestLineups` stores it for today's date at `data/rotowire/<date>.json`
  through `refreshRotowire`, every lineup read, a team the new page lacks keeping its entry; the slate reads the file,
  `side.ppUnits` the names) × the power plays the team should get tonight (`specialTeamsRead`'s `ppFor.expected`, the
  profile's "tonight ≈ 3.6"; the league's 3.2 without ShotPropz) × a unit skater's minutes per power play
  (`PP_MIN_PER_PP`, the 2026-11-07 TOI audit's section B: forwards 0.98 / 0.48, defensemen 0.95 / 0.45 on the first /
  second unit). Drawn from `PP_SHOW` = 2.0 minutes (the first unit nearly always, the second on a 4.2+ power-play
  night); **the second unit is always drawn since 2026-11-14**, dimmed (`.is-dim`) while under `PP_SHOW` (Vincent: "show pp2
  for every second-unit player"; `PpBadge`, `pp.show` unchanged); **coloured by the opponent since 2026-11-13** (Vincent: "I want to know per team 1) if they allow a lot of
  powerplays and if so, to which position are they allowing the most shots. Based on this, you should mark the pp in the
  rink either amber, green or red"): `ppAllowedBook` / `ppAllowedAt` in `pp-units.js` off the slate's season table, the
  opponent's power-play shots on goal allowed a game to his position this season (both venues, the rows' `ppSog`), ranked
  1 = the most among the teams with `PP_ALLOWED_MIN_GAMES` = 5 games, green / amber / red by the rink's thirds (`ppTone`;
  grey without a ranked read), the hover leading with it ("MTL gives a lot of power-play shots to LW: 2.18 a game, #1 of
  32 · 6.65 … in all · 33% of them to LW (league 24%), the most to LW"); per game to a position answers both at once (a
  kill short a lot gives every position more; the share says where); **under the rink's Goals switch the badge reads the
  opponent's power-play goals allowed a game to his position instead** (Vincent, 2026-11-14: "the pp should color based on
  the toggle shots/ goals"; `ppAllowedAt(book, opp, pos, 'g')` off the rows' `ppG`, `pp.toneG` / `pp.textG`, `PpBadge`'s
  `metric`; grey until the stored rows carry `ppG`, i.e. until the backfill has run, and a thin read: a team allows a
  handful of power-play goals to a position), and it is colour only — the 2026-11-13 study
  (`pp_d.py`, audits) found the kill's read does not move a defenseman's shots over his rate, and a forward position's
  share does not carry half to half; until then green meant `PP_LOT` = 3.5 minutes, which stays on the read as `lot`; "PP"
  for the first unit, "PP2" the second; the read on the hover and in the chip's title. Matched by full name, then last
  name with the first initial (`ppUnitOf`). Descriptive only: the model's power-play share stays `PP_WEIGHTS` by line
  slot; `__tests__/nhl-pp-units.test.jsx` (the page as served 2026-11-08, `fixtures/rotowire-nhl-lineups.html`);
  **the rink head's verdict first** (Vincent, 2026-11-10: "rephrase the shooting headline for each team so that I can
  quickly see if the specific team allows shots or not"; `SoftestLine` in `Rink.jsx`, `.nhlx-rk-verdict`, `side.allows`
  from `allowsOf(teamAllowsBook(rows, season), opp)` in `defense-board.js`): "CHI **allows a lot of shots** · 30.1 a game
  · #1 of 32 · most to the C1 (2.9 a game, #3 at that slot) · tonight Celebrini" — the opponent's shots (goals under the
  Goals switch) allowed a game this season from the stored rows, ranked among the teams with `ALLOWS_MIN_GAMES` = 3,
  the verdict tinted by third (green "a lot of", amber "an average number of", red "few"); the slot part follows as
  before, and stands alone in its old words ("PIT gives the most shots to the C1 …") while the team has no rank;
  `__tests__/nhl-rink-line.test.jsx`;
  **the 1 · 2 · 3 period badges beside the PP badge** (Vincent, 2026-11-10, after a look at shots by period: "a simple
  1, 2, 3 next to the player on the board colored in green / amber / red to define the match up (opposing team allows +
  own production)"; `PeriodBadges` in `Rink.jsx`, `.nhlx-rk-per`, `p.periods` from `periodRead(periodBook(rows, season), id,
  opp)` in `lib/nhl-data/periods-pure.js`): per regulation period the opponent's shots allowed a game in that period
  ranked among the teams with `MIN_TEAM_GAMES` = 3 (top third +1, bottom third -1) plus the skater's own shots a game in
  it ranked among his position group, forwards or defensemen, with `MIN_SKATER_GAMES` = 5; the sum reads green (+1 or
  more), amber (0) or red (-1 or less); a side short of games counts 0 and says so on the hover; no badges while neither
  side ranks. This season's rows only. The data: `sp` = [p1, p2, p3] shots on goal (goals in, overtime and shootout out)
  on every skater of a game record (`periodShotsOf` / `stampPeriodShots` in `game.js`, every new ingest) and `sp1` /
  `sp2` / `sp3` at the end of `ROW_FIELDS` (older rows read null and are skipped); games stored before 2026-11-10 get
  them from the play-by-play through `stampFirstGoals` (the backfill workflow's `firstgoals` mode, which now also stamps
  any game whose skaters lack `sp`). Colour only, no number moves. The 2026-11-10 look (274 games): the league takes
  8.8 / 9.6 / 8.7 shots a team by period; a team's period table is ~150 shots after a month, so ±1 a game is within the
  noise; `__tests__/nhl-periods.test.jsx`;
  chips carrying the latest saved model run's λ shots / goals for the slate date from
  `lib/nhl-data/model-runs.js` — printed as the board reads them since 2026-10-31 (`slateWithBoardReads`, the bullet
  "One number per skater" under Automation; the run's own on the hover) —, or a matchup read when no run exists; at the
  top of each rink card the model's plays for that team (`sidePlays` in `slate.js`, `ModelPlays` in `Rink.jsx`): the
  Best bets boards' rule, `boardPlays` in `model-core.js` (shared with the Model tab's boards and the scorecard's
  replay), two shots plays and two goal plays at most from the saved run on the board's figures, each on the floor it cleared with the attack-score tier, the picked skaters ringed on the ice,
  each play washed green (hit the floor) or red (fell short) with the box-score figure once the game is stored, dashed and dimmed when the skater has no box-score row, nothing shown without a run; finished games show the
  box score; above each game's team verdicts a game-total read, `gameTotalRead` in
  `lib/nhl-data/verdict.js`: the stored meetings' totals blended with MoneyPuck's expected
  goals and pace, high / low half a goal either side of the league average; and above both, the **matchup
  profile** (`lib/nhl-data/matchup-profile.js`, `matchupProfile`, `profile` on every slate game; drawn by
  `components/nhl/MatchupProfile.jsx`; Vincent, 2026-10-30, with a soccer first-half profile as the form: "remove this
  and replace it with a summary of data from both the rink and propfinder", then "the summary needs to be compact. 5 rows
  max."): the two teams side by side, **five rows at tonight's venue** — Shooting (shots and goals a game), Allows (shots
  and goals allowed), Power play (PP% and the power plays drawn a game), **Discipline** (the power plays the team gives away a
  game, its times short-handed, ShotPropz's `ppoa`: rank 1 = gives the most, the words Very disciplined · Disciplined ·
  Average · Undisciplined · Very undisciplined, green when it gives many; then "≈ 3.0 tonight" and its PK% as a plain
  figure; left out without a ShotPropz snapshot since PropFinder's table has no power plays given. It was a Penalty kill
  row worded on PK% with "softest" ranks until 2026-11-08, Vincent: "a penalty kill is the ability to prevent powerplay
  goals... What I want to know is whether a team is giving away a lot of powerplays or whether they more disciplined"),
  Last 10 (shots for and against over the last ten), and since 2026-10-31 **Saves** between
  Allows and Power play (Vincent: "I should be able to see the projected goalkeeper saves for NHL games in the short game
  summary"): the shots the team is expected to allow (the goalie's `shotsAgainst`, the Saves table's read below, since
  2026-11-08; without a goalie on record the saved run's λ shots summed over the opponent's lineup, ten skaters at least,
  else ShotPropz's boards: the opponent's shots a game at its venue and the team's shots allowed at its own, the geometric
  mean) × the 97% a starter faces (`STARTER_SHARE`) × his save percentage, the team's this season until he has three
  starts (`spzSavePct` in
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
  season PP% (its PK% only in the Discipline hover), the stored last ten; every source rides on the cell's hover (`title`), nothing else is drawn. The
  game-total read and the verdicts fold under it as "The numbers behind the reads". **Tonight's power plays end the Power
  play and Discipline rows** ("tonight ≈ 3.6", "≈ 2.9 tonight"; `lib/nhl-data/special-teams.js`, `specialTeamsRead`,
  the bullet under Automation) and **the predicted score is the head pill** (`ProjectedScore` in `MatchupProfile.jsx`: "MTL
  2.8 – 3.3 DAL · 6.1 goals · DAL 56%", the final beside the pre-game projection stored before puck drop once the game is
  stored, green when it called the winner; `projected` on every slate game, which `app/api/nhl/data/slate/route.js` takes
  from `buildPicks`; the same line sits beside the time in every game head on Matchups and Best bets). Tests:
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
- The night's games are listed earliest puck drop first on every tab (`byStartTime` in `slate.js`, applied in `gamesFor`,
  which `buildSlate` and the defense API read; a game without a start time after the ones with one, ties by game id;
  Vincent, 2026-11-14: "sort the games on time. the earliest first"; `__tests__/nhl-games-order.test.js`).
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
  games / (games + 40) blends stay on record in sections 3, 13, 15 and 16 and in no number; **since 2026-11-13 the
  opponent is read as a team beside the cell** — `project`'s `oppTeam` (`shotsAllowed` of this season's rows: its shots
  allowed a game over the league's, to the power 0.63, its games shrunk to the league at games / (games + 5), and 0.53
  off the cell's 0.687: `TEAM_SHOTS_FIT`; shots only; Vincent: "no just 2 and 3"; the cell alone had skaters against the
  tightest fifth of cells shooting 1.18× the formula, `docs/audits/2026-11-13-nhl-formula-refit.md`; `picks.js` and the
  scorecard's `studyRead` pass it, without it the formula is as it was) rides on
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
  the picked window rather than the season table); **a top-5 soft spot wears its own badge** beside the flags,
  `TopSpotBadge` in `flags.jsx` ("RW #3", green, the slot badge's shape): the opponent in the top `SOFT_TOP` = 5 at his
  position for the metric on the same PropFinder table (`topSpot` / `topSpotText` in `picks-pure.js`), the read on its
  hover. Vincent, 2026-11-10: "mark the players in the rinks with the same flame as players that are on a hot streak",
  shipped as the flame; 2026-11-12 its own badge ("Sure"), since one flame for a streak and a matchup could not be told
  apart on a phone: the flame is the hot streak alone, on the plays strip per play, and in the all-skaters table's
  L5 S/G and Goals cells; `buildSlate` puts
  `heat` and `oppPos` on every skater and `sidePlays` carries them onto the plays. A stored game grades the rows
  (`withActuals` / `hitOf` in `picks-pure.js`: each skater's box-score SOG and goals ride on his row as `actual`,
  null when he did not play): every probability cell green when he reached that market's floor, red when he fell
  short, the row on its lead market, a "Got" column with the figure and a tally in the game head. The model's math is untouched.
  Study: `docs/shots-goals-predictors.md` (section 13 is the every-angle scan and the replay; `tools/predictors/run.sh <year>`
  rebuilds it, `explain.py` reads one skater-game).
  **Soft spots** (Vincent, 2026-11-10, after Marchment's four shots at NYI off the board: "do 1 but the top 5 worst
  defenses"; `docs/audits/2026-11-10-nhl-soft-spots.md`): a list atop Best bets (`SoftSpotsTable` in `PicksPanel.jsx`,
  `softSpots` on the payload = `softSpotPlays` over every graded candidate of the slate in `picks.js`): the skaters whose
  opponent ranks in the top `SOFT_TOP` = 5 at their position for shots (`topSpot`: the flag's PropFinder table, the tab
  the rink opens on, the study's `oppPos` for a team without one), regulars only (`SOFT_SPOT_MIN_SOG` = 1.5 shots a game
  on `rates.sog`, line ≤ `SOFT_SPOT_MAX_LINE` = 2; no slot read lets him in), the board's 3+ first, with the spot ("#3 ·
  NYI to LW", the hover in words), his rate, the board's 2+ / 3+ / 4+, the book's line and Got; graded on 3+, a tally in
  the head; twelve rows then "Show all". The figures are the board's: a top-five spot is worth +5% shots (+10% for a
  low-volume winger) on three seasons' box scores, which the board's λ already reads, so these are plus-money tries.
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
  likely starter facing the shots his team is expected to allow × the 97% a starter faces × his save percentage = the
  projected saves (`savesRow` / `savesFrom`), the chance of 25 / 30 / 35 saves (`savesChance`: a normal around the
  projection, `SAVES_SD` = 6.8 saves) with the break-even price. **The shots read since 2026-11-08** (Vincent: "yes, fix
  the Saves table", on `docs/audits/2026-11-08-nhl-saves.md`): `teamShotBook(rows, season)` (every team's shots for and
  against a game this season and last from the stored skater rows) and `shotsAgainst(book, team, opp, venue)` = the
  league's shots a team a game + `SAVES_SHOTS_FIT` 0.89 × the opponent's shots-a-game gap to the league + 0.87 × the
  team's shots-allowed gap (each this season blended into last season's gap at games / (games + `SHOTS_BLEND_K` = 10))
  ∓ 0.53 at home / on the road; the slate puts it on each side's `goalie.shotsAgainst`, `shotsAgainstText` words it for the
  hovers. Saves are shots (r 0.97 with the shots faced); both teams' rates rank the night at ρ 0.25 against 0.20 for the
  opponent's alone and 0.12 for his saves a start, and his save % predicts nothing (the shrunk figure stays, harmless).
  Until then the read was the board's λ shots summed × the save %, at a normal of 6 × save % (5.4): it ran about a save
  high (the starter faces 97% of the shots: `STARTER_SHARE`) and too sure (25+ said 55%, landed 47%). The board's λ sum
  rides on the row as `boardShots` for the hover (it carries the opponent's side and, through each skater's matchup
  table and home ice, much of the team's; its level could not be graded without the scorecard). Replayed with the site's
  functions (`tools/predictors/saves-replay.mjs`): 2026-27 projected 23.57 a start, made 23.65, 25+ said 44.9% landed
  44.4%. **25+ the play without a book line** (`SAVES_LEAD`, 30 until 2026-11-08: Vincent, "change the fallback to 25"; 30
  saves is a one-in-five night this season, 25+ lands 44% of starts; replayed, the 25+ calls at 50% were a third of
  2026-27's starts, said 59.8%, landed 54.9%, and 48% of 2025-26's, said 59.7%, landed 57.7%;
  a row under `SAVES_FLOOR` = 50% there is dimmed as under the floor, `pickSaves`); once the game is stored the goalie's
  own line grades the row (`withSavesActuals`: over the line, else 25+, hit or miss, "another goalie played" when the read was on the wrong
  man, `played: false`), and the game head's tally counts the saves plays with the shots and goal plays. **The book's saves lines come from PropFinder's
  pull** (`lib/nhl-data/goalie-props.js`, the ladder reader shared with the skaters' lines in `prop-lines.js` since 2026-10-31; Vincent, 2026-10-31: "pull the goalie saves lines from PropFinder and show the
  edge... I just need over x saves with a %"): the odds-only players call lists the goalies with their props, `goalieSavesProps`
  reads the items whose market names saves (a period's or a window's left out) with the NBA reader's spellings, the main
  line the one priced nearest a coin flip, and the pull stores them at `data/propfinder/goalie-props.json` and, since 2026-11-08, per date at
  `data/propfinder/goalie-props/<date>.json` (`goaliePropsPath`; the slate reads the date's file, else the latest one made for the date) ({ at, date,
  goalies: [{ pfId, name, key, team, line, odds, underOdds, book, books, implied, lines }], withLines, `sample` = the
  first goalie's raw items for the spelling check — no NHL goalie item had been seen when it shipped; the pull meta's
  `goalieProps` counts show under Data sources). The slate puts the line on each side's `goalie.prop` (`savesLineFor`,
  the NHL name against PropFinder's through `normName`, the surname on the team as the fallback; only a pull made for
  the slate's date), `savesRow` reads it (`line`, `mark` = o27.5 → 28+, `pLine` his chance of clearing it, `odds`,
  `implied`, `edge` = pLine − implied, the ladder as `lines`): **the over is the play when the edge is positive**
  (`isSavesPlay`; the 50% floor on the line without a price, the 25-save mark without a line), `pickSaves` orders by the
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
  Read from: last season, this season, L5, L10, L15, L5 home, L5 away, opening on the Matchups tab's default, L10 since 2026-10-31;
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
- **Special teams and the predicted score** (`lib/nhl-data/special-teams.js`, `score.js`, `scores-store.js`; Vincent,
  2026-10-31: "if a team allows a lot of penalties, the other team gets a lot of extra minutes on the ice … I bet it has an
  impact on shots / goals prediction", and "a predicted score based on all the data available, that way I can test whether
  our predictions for goals make sense"; measured first on both seasons' box scores, `tools/audit/nhl_special_teams.py`,
  `docs/audits/2026-10-31-nhl-special-teams-and-score.md`). **The special-teams read** (`specialTeamsRead(spz, team, opp)`,
  from ShotPropz's all-games boards): the power plays a side should get tonight = the league's rate × its drawn rate^0.46
  × the opponent's given rate^0.42 (each ratio shrunk toward 1 at gp / (gp + `ST.K` = 10), the elasticities a Poisson fit on
  2025-26 checked on 2026-27 — the forecast beats the league rate; the rates are weak traits, odd / even games 0.28), the
  same for the kills, the opponent's kill leak (goals allowed per kill, shrunk at 40 kills), and what the difference is
  worth inside a game (`ST.worth`: +0.99 shots a power play, −0.71 a kill, +0.06 goals a power play — power-play goals
  replace even-strength ones). **Measured on top of own volume × the opponent's allowed table it moves a team's shots and
  goals by nothing** (the mechanical factor's coefficient 0.25, z 0.2, for shots; −0.46, z −1.1, for goals: the shots a
  leaky kill gives up are already in the shots-allowed table every read carries), so `ST.teamWeight` = 0 and the read is a
  **redistribution inside the team** (`splitSpecialTeams`, `withSpecialTeams` in `computePicks`, before the calibration):
  the shots and power-play goals the forecast moves go to the skaters by power-play slot (`PP_WEIGHTS`: F1 1.0 · F2 0.65
  · F3 0.3 · F4 0.05; D1 0.8 · D2 0.35 · D3 0.05) and the same comes off everyone evenly, Σ λ unchanged (a first-unit
  forward against the most undisciplined opponent +0.05 shots, a fourth-liner −0.02); `st` on the candidate and the
  shuffle row ({ dS, dG, w, share }), `stTeam` the side's read, `beforeSt` the figures before it; the Best bets and
  shuffle hovers spell it out. **The predicted score** (`gameScore`, `projected` on every picks game and every slate game):
  each team's goals = exp(0.448 + 0.621 · log Σλ + 0.214 · log(own GF / L) + 0.113 · log(opp GA / L)) — Σλ the dressed
  skaters' λ goals added up (`sumSkaters`, a skater without a read at `LEAGUE_POS[pos].g`), the team reads from ShotPropz's
  boards (the stored `teamRates` standing in) shrunk at gp / (gp + 10), home ice and the special-teams terms at 0 (home ice
  is in the skaters' λ, the special teams measured nothing); fitted on 2025-26's team-games, checked on 2026-27 (MAE 1.37 a
  team against the league's 1.38; the skaters' sum rescaled alone read 1.364, within noise, the team reads kept for the
  goaltending they carry) — the total, each side's win chance (`winProbability`: a Poisson race, a tie split in half) with
  the fair price, MoneyPuck's expected goals on the hover as a comparison. **Stored before puck drop** (`stampProjectedScores`
  in `ingest.js` after every lineup read and model run → `stampScores`, `data/scores/<date>.json`: a game still to start
  takes the newest projection, a started or final game keeps its entry) and **graded on the History tab's scorecard**
  (`scoresReport` in `scorecard.js`, `scores` on the report: the stored projections, the run's Σ λ goals over the graded
  skaters of each side and the study's, `MIN_GRADED` = 14 a side, each against the finals — bias and miss per team, the
  total's, the winner called, the Brier of the home chance — and the last thirty graded games; `ScoresTable` in
  `Scorecard.jsx`). Tests: `__tests__/nhl-special-teams.test.js`, `nhl-score.test.js`, `nhl-scores-store.test.js`,
  `nhl-picks-score.test.js` (computePicks end to end on a synthetic slate), the scorecard's "predicted scores graded".
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
  and its own odds stay the run's (the saved run's rows and the scorecard's grading are the run as computed); only the
  printed chance moves — and since 2026-10-31 it moves everywhere the site prints one (the bullet "One number per
  skater" below). `computePicks` reads it with the slate (`loadCalibration`: `data/scorecard/calibration.json`, else
  the seed `lib/nhl-data/seed/calibration.json`, fitted on the scorecard export of Oct 30 by
  `tools/predictors/calibration-seed.mjs`) and runs every candidate through `calibrateProjection` — p2 / p3 / p4 / p1g
  calibrated, the stated ones as `raw`, the floors and the notes on the calibrated figure — when the stored fit was
  learned at the board's weights (`calibrationFits`: another `NHL_PICKS_STUDY_WEIGHT` is another read, printed as stated
  until the next build); the payload's `calibration` { read, at, from, to, games, fits } goes to the panel's head and the
  shuffle, whose rows carry the fits (`row.cal`) so `chanceAt` / `readAt` print the board's read calibrated (every other
  "Read from" as its Poisson tail; `raw` on the read for the hover). Learned again by every season-range `buildScorecard`
  (`saveCalibration` beside `saveBestRead`: the History tab's first grade, the morning refresh), never rewritten
  unchanged. Hover a chance on Best bets or the shuffle for the figure as stated.
- **The edge over the book, graded** (`lib/nhl-data/skater-props.js`, `prop-lines.js`, `edge-pure.js`, `edge.js`; Vincent,
  2026-10-31: "run that edge audit for shots and goals" — no skater price had ever been stored, so nothing could be graded
  against the book; the goalies' saves lines were the only prices read). **The book's lines on the skaters**: the pull reads
  each skater's shots-on-goal ladder and anytime-goal price off the same odds-only players call (`skaterPropsOf`; the ladder
  reader `propLinesOf` in `prop-lines.js` is the goalies' reader factored out: the main line nearest a coin flip, the best
  price a side, a period's or a window's line left out; "Player Shots on Goal" / "SOG" / "Shots" without blocked shots or
  attempts, "Anytime Goal Scorer" / "To Score" / "Goals" at 0.5 without the first scorer, 2+ goals or points) and stores
  them per slate at `data/propfinder/skater-props/<date>.json` ({ at, date, skaters: [{ pfId, name, key, team, pos, sog,
  goal }], withSog, withGoal, `sample` = the first priced skater's items as sent, for the spelling check — no NHL skater
  item had been seen when it shipped; the pull meta's `skaterProps` counts show in the pull's message). The slate puts
  them on each skater as `prop` (`skaterPropFor`: the NHL name against PropFinder's through `normName`, the surname on the
  team as the fallback; only a pull made for the slate's date; `book` on the slate counts them). **The board's edge**
  (`bookRead` in `edge-pure.js`, `book` on every candidate and shuffle row): at the book's main shots line (o2.5 = 3+,
  `markOf`) the board's chance of clearing it (`chanceAtHeight`: the board's own 2+ … 4+, else his λ through the
  calibration's fits, never above the rung below) against what the price implies, and his anytime price against his 1+ G,
  `edge` = the chance minus the implied probability; Best bets' Shots and Goals tables carry a **Book** column when any row
  has a line ("3+ 58% · -140", the edge under it green on an edge, red without; `BookCell` in `PicksPanel.jsx`, ringed
  when the chance clears the market's reliable threshold; once the game is stored, hit or miss at the book's mark). **The
  audit** (`bookRecord` + `edgeReport`): the scorecard reads the slate's stored lines on every graded skater-game (only
  when stored before the game's puck drop, `props.at` against the positions file's start time) and grades the board's chance
  as the board prints it now — the λ at the board's weights (`readsOf`) through the calibration as it stands, the run's own
  stated figure beside it as `raw` — against the price: per market (shots at the book's line, anytime goal) every priced
  play, the board's plays (an edge over 0), by the edge the board saw (`EDGE_BUCKETS`), by what the book asked
  (`IMPLIED_BUCKETS`), and step by step up the board's chance with the **reliable threshold** — the lowest step from which
  `RELIABLE.min` = 25 priced plays landed at least the break-even their prices asked (a flat stake did not lose; `ret` = the
  flat-stake return per unit, `flatReturn`); `edges` on the report, drawn on the History tab ("The edge over the book",
  `EdgeTable` in `Scorecard.jsx`), the book's figures on the `?rows=1` export (`sogLine`, `sogOdds`, `sogImplied`,
  `sogBoard`, `goalOdds`, `goalImplied`, `goalBoard`), the report stored by every season-range `buildScorecard` at
  `data/scorecard/edge.json` (`saveEdge`) and read by the picks board (`loadEdge` → `reliable` on the payload: the Best bets
  head says "reliable from · shots 60% · goals not yet"). `tools/predictors/edge_audit.mjs <export.json>` prints the same
  tables offline. The first priced night is the first pull after this shipped (2026-10-31); the audit fills from there and
  nothing here was graded on real prices when it shipped. `__tests__/nhl-skater-props.test.js`, `nhl-edge.test.js`, the
  board's case in `nhl-picks-score.test.js`.
- **The most accurate read, learned** (`lib/nhl-data/board-weights-pure.js`, pure; Vincent, 2026-10-31: "I need to have the
  most accurate % for both shots and goals"): whose λ the board's chances are read off — the run's, the study's or a blend —
  is **learned per stat from the site's own graded nights**, not set by hand. `learnWeights(rows)` (rows = `fitRow` with the
  night: the run's λ, the study's that morning, what he got) scores every share of the study in `SHARES` (0, ¼, ½, ¾, 1)
  **walked forward**: for each night after the first `LEARN.warmNights` = 6 the calibration is fitted at that share on the
  nights before it (`fitHeight` per height) and the night's skaters are read through it at the bars' floors and the rung
  above (`SCORED`: 3+ and 4+ SOG, 1+ and 2+ goals), the Brier pooled (`walkForward`; a calibration under `CAL_MIN` reads the
  stated chance, as the board would have); the lowest Brier is the board's share once `minNights` = 8 scored nights and
  `minRows` = 1500 chances are behind it, **and only when it beats the share the board is on by `margin` = 0.0005** (a tie
  is called for the board's own share, then the nearest; the board never moves on noise), the incumbent being the stored
  verdict's share, else `DEFAULT_WEIGHTS` { w: 0, wG: 1 } (the run's shots, the study's goals, as since 2026-10-27). Learned
  with the calibration in `saveCalibration` (every season-range `buildScorecard`: the History tab's first grade, the morning
  refresh), stored on `data/scorecard/calibration.json` as `learned` { at, from, to, rows, learn, stats: { sog | g: { share,
  from, best, moved, reason, scores } } } with the fits made at the chosen weights (`weights`); `boardWeightsOf(cal, env)`
  is what `computePicks` reads at — the server env (`NHL_PICKS_STUDY_WEIGHT`, `_GOALS`) over the verdict when set (another
  share than the fits were made at prints as stated until the next build, as before), the verdict over the defaults (the
  seed has none) — and rides on the picks and shuffle payloads as `boardWeights` { w, wG, from, learned, calibrationFits }.
  The Best bets head names it ("shots the run's λ, goals the study's λ (learned on N graded skater-games)", every share's
  score on the hover, `BoardRead` in `PicksPanel.jsx`), the shuffle's note the same (`shareText`, `verdictText`).
  `tools/predictors/calibration-seed.mjs --learn` runs the verdict on a scorecard export and prints the table. No export was
  readable from the container when this shipped, so no verdict is in the seed: the board stays on the defaults until the
  site's next scorecard build judges the reads. `__tests__/nhl-board-weights.test.js` (synthetic seasons where one read is
  the truth), the end-to-end case in `nhl-picks-score.test.js`.
- **One number per skater** (`lib/nhl-data/board-reads.js`, pure; Vincent, 2026-10-31, with the Model tab's dashboard
  saying McDavid 61% for a goal and Draisaitl 56% for 4+ shots while Best bets on the same page said 30% and 36%: "how can I
  trust our website if I see these conflicts" — the dashboard printed the run's own figures as stated, Best bets the board's,
  the study's goal read calibrated): every place the site prints a skater's chance for the slate prints **the board's read**,
  the figure Best bets and the shuffle print, the run's own beside it on the hover. `GET /api/nhl/data/reads?date=` →
  `boardReadsOf(buildPicks(date, { withSkaters: true }))`: per skater, keyed by the model's own key (`modelKey` in
  `lib/nhl-data/model-key.js`, pure, team + normalised name, re-exported by `model-runs.js` and `names.js`; the shuffle
  row carries it as `key` with the board's `chances`), his λ shots / goals and 2+ … 5+ SOG and 1+ / 2+ G — 2+ … 4+ and 1+
  G the board's own, 5+ and 2+ G read off the same λ through the same calibration (what the shuffle prints at those
  heights), `raw` the run's figures where the board is calibrated — with the run, the calibration and the study weights
  behind them (`boardReadsMeta`). **The Model tab** (`NhlApp` reads the route for the run it shows — after a save every
  five seconds until the board names that run, since the runs route and the board hold their own copy of the run index;
  once for a run replayed from history — and hands it to `NhlModel` as `board`): every board and table there draws
  `withBoardRows(results, reads)` — λ, 2+ … 5+ SOG and 1+ / 2+ G the board's, the run's own under `row.run`, the gate,
  the attack score and the tags the run's — while `results` stays the run as computed (what is saved and graded); the
  slate strip's chip says "Chances as Best bets prints them" with how many rows the board read, the goals' and the
  calibration's provenance, or "The run as stated" when the board does not name this run (unsaved, another run newest for
  the date, the board unreadable) and why; the dashboard headlines, the Best by Game figures and the All Players cells
  name the run's figure on the hover. **The rinks and the first-goal board**: `slateWithBoardReads(slate, reads)` in
  `slate.js` (applied by `app/api/nhl/data/slate/route.js` and by `buildFirstGoalBoard`, since the slate is built before
  the picks that read it) puts the board's λ and chances on every skater's `model` (`withBoardModel`, the run's under
  `model.run`), picks each side's plays strip again on the printed figures (the boards' floors unchanged, so a 4+ the run
  stated at 44% that prints 30% is no shots play any more; `runProb` on the play for the hover) and the chip's hover
  reads "board: … · the run as stated: …"; the first-goal candidate's 1+ G and score read the same figure. The Run
  history cards keep the run's figures as saved, named as such on the hover. `__tests__/nhl-board-reads.test.js`, the
  slate overlay in `nhl-slate-memo.test.js`.
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
  **Re-mined 2026-11-12** (Vincent: "ship the re-mined rules"): searched on Sep 30 – Oct 21, checked on Oct 22 – Nov 11,
  `builtThrough` 2026-11-11 (`docs/audits/2026-11-12-nhl-patterns-model.md`), so the record under the head restarts on
  Nov 12. The frozen Oct 29 rules had landed 48% of 447 3+ SOG picks (said 60%) and 33% of 235 goal picks (said 40%).
  The season opened on **Sep 29** (8 games): the Oct 30 study and the first cut of this one fetched from Oct 1.
  **Refitted weekly** (Vincent, 2026-11-12: "set up the weekly refit"): `.github/workflows/nhl-patterns-refit.yml`,
  Mondays 09:37 UTC (and by hand, with `through` and `ship`), runs `tools/predictors/patterns-refit.sh`: the season's
  games from Sep 25 through yesterday (Eastern; the fetched nights cached between runs, the last three fetched again),
  the rows, the split at the first night of the second half of the skater-games (the rules searched before it and
  checked from it; the model's frozen check fitted through the night before it), then a gate (no fewer skater-games
  than the shipped rules were built on; the model's frozen 50%+ calls at least 45% on 50 or more), the patterns tests,
  and a commit of the rules, the model and the parity fixture to main by github-actions[bot]. Each refit restarts the
  record under the head; the run's summary and artifact carry both reports.
- **The 3+ SOG model on the Patterns tab** (Vincent, 2026-11-12: "add the model for 3+ SOG", after the season backtest
  had a model on every figure ahead of the rules on that line): a logistic regression and boosted trees on the same
  figures (plus his position), averaged, fitted offline by `tools/predictors/patterns_model.py` and shipped as
  `lib/nhl-data/patterns-model.json` (medians / means / spreads / coefficients, the trees as node lists); the site only
  scores it (`modelChance` in `lib/nhl-data/patterns-model-pure.js`, matched to scikit-learn by
  `__tests__/fixtures/patterns-model-parity.json`, written by the same command with `--fixture`). Each skater carries
  `model.s3`; the pill "Model 3+" sits after his 3+ pill (dashed when under the bar, filled with a check at the 3+ line's
  bar, 50%, graded green / red like a pick); "Strongest tonight" has a "3+ SOG · model" tab (ranked by the model, his
  3+ rule pill and facts beside); the fold counts its picks apart; the record line carries its calls since its fit
  (`modelRecord`: the rows after `builtThrough`, scored on the full figures in the season walk through
  `patternTable`'s `score` hook, before the `keep` trim, so the table stays small); a line under the how-to says what it
  is and the frozen check the JSON carries (`check`: a second fit through `--check-through`, graded on the games after
  it), and that a night inside the fit is not a test. Not retrained on the site: refit it with the rules
  (`patterns_model.py <csv> --through <last date> --check-through <a date two weeks back> --out
  lib/nhl-data/patterns-model.json --fixture __tests__/fixtures/patterns-model-parity.json`). Frozen fits landed 57–59% of their 50%+ calls on the weeks after them.
- Lineups: `lib/nhl-data/gamedaytweets.js` reads the beat writers' lines from
  gamedaytweets.com/lines?team=XXX (roster-aware name matching: the roster decides a row's group, a pair
  holds a defenseman and two forwards side by side are a short forward line, three pairs at most, and a
  shared surname is the player the tweet did not place elsewhere; `applyPositions` keeps the box score's
  forward / defense group over a lineup slot that contradicts it) for every slate team; a
  game-day tweet beats the NHL.com preview, otherwise the preview, then an older tweet, then
  the roster; **the preview parser reads an 11-forward, 7-defenseman night** (`parseLineupRows(rows, rosters)` in
  `positions.js`; TBL at NSH, 2026-10-31: NHL.com listed "Stamkos -- O'Reilly" on top of Nashville's lines and "Viel --
  Geekie" under Tampa Bay's third, and read as pairs they pushed every real pair down a slot and made Hague a goalie): the
  roster decides a row's group when the snapshot has one (below); without a roster the order does — a two-name row is a
  pair only when it is one of the team's last three two-name rows, an earlier one a short forward line, and of the single
  names after the lines the last two are the goalies, any before them a seventh defenseman on the next pair (placed under
  the rink); the rink head says "11 forwards and 7 defensemen dressed: a forward slot stays empty on the ice" (`dressedText` in
  `Rink.jsx`), since the gap on the ice is the lineup's, not a missing read; and the model's lineup rows carry the short
  line with a placeholder third name (`SHORT_LINE_FILL` in `lineupRowsFromSnapshot`: the model's parser, untouched, takes a
  two-name row as a pair and drops every skater its lineup rows lack, so until then the short line's two forwards were out of
  the auto run); a tweet from the warm-up window (`GDT_FINAL_WORD_MIN`, 90 minutes before puck drop, or after
  it) beats the preview whatever its time; **a tweet from the game's date before that (the morning skate) beats
  the preview unless NHL.com revised that team's lines after the tweet** (Vincent, 2026-11-07: every rink read
  "NHL.com projected" with morning-skate lines tweeted for CAR, CHI, DAL, EDM, PIT: the preview's "updated" stamp
  moves on every refresh while its lineup stands still, so it beat every morning tweet). `withLinesTimes` (in
  `keepPreview`, `ingest.js`) keeps per team `linesAt` (when the lines as they stand were first seen) and
  `revisedAt` (when a re-read found them changed; null until then), comparing the parsed slots, not the prose; a
  tweet from an earlier day goes by timestamp against `linesAt`. The snapshot carries `nhlRevised` and the
  preview pill's hover names the revision. A tweet
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
  **The NHL.com preview's two-name rows ask the roster** (`parseLineupRows(rows, rosters)`, the snapshot's `rosterMap`;
  Vincent, 2026-10-31, of the NSH rink: "Stamkos is never a defender" — "Stamkos -- O'Reilly", the fourth line of an
  11-forward night, sat on pair 1): no roster defenseman among the two and a roster forward known → a short forward
  line (LW, C of the next line), as the tweet parser reads it; else a pair; a lone roster defenseman is the next pair's,
  a lone roster forward the next line's, a goalie or an unknown name a goalie (the order rule above stands in without a
  roster, `__tests__/fixtures/nhl.js` PREVIEW_MD_11_7 is the TBL at NSH preview as published); a stored last lineup lends
  a slot only to a player of the slot's own group (`fillFromLastLineup`), so a pair slot read before the rule never
  carries a forward.
  Without a tweet or preview the snapshot uses PropFinder's depth chart (`propfinder-depth.json`).
  **A lineup read keeps what it cannot re-read** (2026-11-01, Vincent: EDM @ NYI showed Joseph at the RW1 before the
  game and Draisaitl after it): `ingestLineups` always merges into the stored file — a full read (no `due`) used to start
  from nothing, so its own GameDayTweets reads (403 from Cloudflare on Render) wrote errors over the tweets the workflow
  had posted a minute before and the rink fell to PropFinder's depth chart until a later page post put the tweet back;
  a re-read preview without a lineup keeps the stored rows (`keepPreview`, `reread` beside them). `fetchPreview` takes
  the game-preview story naming the most teams' lineups (`previewLineupTeams` in `lineups.js`): the club site's own
  preview ("game-preview-islanders-vs-oilers-…", its lines under a bare "PROJECTED LINEUP") is listed first and gave
  neither team NHL.com's lines. "The same winning lineup" reads as a confirmation (`SAME_LINES`).
  `__tests__/nhl-lineups-keep.test.js`.
  **Lineup graphics are read by OCR** (`lib/nhl-data/lineup-image.js`; SEA vs NYR, 2026-11-07: @sound_hockey's
  "Kraken lineup" card at 4:42 PM ET carried the lines in the picture alone, its text "Is the Catton line now the second
  line? My COLUMN: … Otherwise, nothing changes from last game." read as nothing, and the rink named @Benton_Mike's
  practice tweet of the day before). On every page post (`ingestGdtPages`, `settleGdtPages` → `gdtPictures`), the tweets
  newer than a slate team's newest text lines that carry a link and no lines (`imageCandidates`, three a team at most)
  have their photos found through X's embed endpoint (`cdn.syndication.twimg.com/tweet-result?id=…&token=…`,
  `tweetPhotos`; the page's status id is the writer's own tweet), read by tesseract (`readImageWords`: the cheat sheets'
  `prepareColumn`, auto-inverted, about 2600 px across, `createReader({ psm: '11' })` for sparse tiles; about 3 s a card),
  and laid out against the roster (`parseLineupImage`, pure): surnames matched exactly or within an OCR misread
  (`similarity` ≥ 0.75, 0.7 from seven letters: "KRKKO" Kakko, "SAMOSKEVIGH"), a first name stacked over or before the
  surname settling a shared one and never counting as a player itself ("RYAN" over "WINTERTON"); the card's own heads
  decide who is out (EXTRAS, SCRATCHES, INJURED, GOALIES …: a player sits under the nearest head above him that does not
  start to his right); the roster decides forward or defense; the picture's rows (or its columns, whichever gives more
  full lines and pairs) are the lines, left to right LW, C, RW; three forward lines at least or no read. The words are
  kept per tweet id in `data/lineups/gdt-images.json` (four days) and laid out again on every post, so a picture is
  fetched and read once (six new tweets a post at most, the rest on the next; a failed read retried after 30 min). The
  read then stands in `latestTeamLines` (`images`) where the tweet's text gave nothing, ahead of a "same lineup"
  reading, `meta.image` the photo; the snapshot carries `gdtImage` and the rink pill adds "graphic" (hover: "Read off
  the tweet's lineup graphic (OCR)"). The usual timing rules stand: a 4:42 PM card still loses to a 5:34 PM preview
  update until the warm-up window. The response's `pictures` lists what each candidate gave.
  `__tests__/nhl-lineup-image.test.js` (the 11-07 and 11-04 SEA cards' words as read, `__tests__/fixtures/ocr-sea-lineup-*.json`).
  **Lines written with full stops and jersey nicknames read too** (`splitNames`, `JERSEY` in `gamedaytweets.js`; VAN vs TOR,
  2026-10-31: @BatchHockey's warm-up tweet "DeBrusk. EP40. Boeser." read as nothing and the rink stood on the preview): a
  dash-less line ending in a full stop splits on them (a lone initial joins the next name), and "EP40" is the roster
  player with those initials wearing 40. Still open: a team's two players of one name (VAN's Elias Pettersson, #40 C and
  #25 D) share one key in the roster map, the snapshot and the model's `modelKey`, so the later slot overwrites the other.
  Slots a capture leaves empty (no lineup yet, or a partial one) are filled from the team's last
  known lineup (`data/lineups/last/<ABBR>.json`, written from each team's own capture) with
  players still on the roster, marked `carried`; the slate does the same for a game with no snapshot.
  **Each rink says where its lines came from** (`LineupSource` in `Rink.jsx`, a pill under the team; Vincent,
  2026-10-31: "per rink whether the lineup was updated through GameDayTweets; now it's guessing"): `lineupRead` in
  `lib/nhl-data/lineup-read.js` (pure, client-safe; `lineup` on every slate side from `buildSlate`, the rink reading it
  itself from `startTimeUTC` when the payload lacks it) turns the snapshot's source and meta into a verdict — the
  lineup audit's rule, `lineupVerdict`, which `lineup-audit.js` now imports —: green "GameDayTweets @handle · 6:42 PM
  ET · 18 min before puck drop" for a tweet from the warm-up window (`GDT_FINAL_WORD_MIN` = 90 before puck drop) or the
  game (`TWEET_AFTER_MAX_MIN` = 4 h after it); amber "GameDayTweets @handle · 2:10 PM ET · 4 h 50 before puck drop ·
  projected" for an earlier tweet and "NHL.com projected · updated 5:30 PM ET" for the preview (an older tweet named
  beside it); red "A guess · PropFinder's depth chart / the roster, by projected shots / the last known lineup (date)"
  until a tweet or preview arrives; carried slots appended; the pill links the tweet, the hover spells the read out
  (a "same lineup" confirmation or a line-change tweet named: the snapshot meta carries `gdtConfirmed` / `gdtChanged`).
  `__tests__/nhl-lineup-read.test.js`.
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
  through `SlateDateContext`), the roster position noted when it differs; **the slot the opener passed wins when it carries a
  line** — the rink chip's, the slate's skater — and the snapshot read stands in for an opener that knows no slot: Vincent,
  2026-10-31, the rink had Chinakhov at LW2 and the card said "RW tonight" (the snapshot held him twice, the preview's
  "Egor" without an id and the roster's "Yegor" without a line, and the id lookup landed on the roster's); `mergeLineup`
  in `positions.js` now keys every lineup entry by the roster's spelling (`rosterKeyOf`: the exact key, else the one
  rostered player with the last name and a first name that starts alike, Yegor / Egor read as one, `sameName`), so the
  box score, the last-lineup fill and the card find him, and `slotOnSnapshot` prefers the entry placed in the lineup; a
  player a real lineup leaves out reads "RW · not in the lineup"), market tabs carrying the hit rate for the pressed split, the Over + line block, the
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
  Descriptive only; nothing feeds the model. The board's shots blend through the share the graded nights say predicts best (the bullet "The most
  accurate read, learned" under Automation; `NHL_PICKS_STUDY_WEIGHT` on Render overrides it, `blendProjection` in
  `picks-pure.js`). **The board's goals read the
  study's λ** since 2026-10-27 (`studyWeightGoals`: `NHL_PICKS_STUDY_WEIGHT_GOALS`, 1 unless set, 0 = the run's goal λ
  back; `blendProjection`'s fourth argument; the shuffle's head and note say so; since 2026-10-31 the share is the learned
  verdict's unless the env sets it): Vincent's call on the FLA @ WPG board
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


## Porting model changes to and from the local app (moved from the Rules)

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
  And on 2026-11-07 (port it too): `projectedToiFromLineup` (the `effectiveToi` every minute gate reads) is the line's
  constant + 0.345 · his last 5 + 0.442 · his season (`TOI_FIT`), refitted on the posted lines, in place of max(last 5,
  the line's floor); its call passes `skater.toiL5` and `skater.toiSeason`; a skater with no minutes gets the line's mean
  (Vincent: "yes, refit on the stored lineups and swap it in"; `docs/audits/2026-11-07-nhl-toi.md`,
  `__tests__/nhl-model-toi.test.js`).
  And on 2026-11-12 (port it too): `cheatSheetMajorMultiplier`'s goals branch is a smooth ISCF/G term
  (`iscfGoalMultiplier`, ×exp(0.04 per SD of rank): about +7% at rank 1, -6.5% at rank 32, `ISCF_GOAL_PER_SD`) in place
  of the Goals/G steps (+18% / +9% / -12% and the soft / hard counts), the D ×0.88 kept; the Goals/G rank predicted
  nothing over a skater's rate and the old steps made 1+ goal less accurate (`docs/audits/2026-11-12-nhl-shots-environment.md`,
  Vincent: "replace it with the smooth ISCF term and port it"; `__tests__/nhl-model-goals-env.test.js`). It reaches the
  goal ladder (`ladderP1g` / `P2g`: the attack score and the goal tier), not the published goal odds, which are the
  Poisson tails of λ goals. And the same day (port it too, Vincent: "yes, do defenseGoalMultiplier too and port it"):
  λ's own opponent read, `defenseGoalMultiplier`, is the ISCF ratio alone (the opponent's ISCF/G to the position over the
  league's mean, clamped 0.82–1.22; no ISCF on the table → 1) in place of Goals 50% / ISCF 30% / Shots 20% (D 35 / 35 /
  30). It reaches λ goals through the points step (`pointDefenseMult`'s 0.45 × the tier's `defDamp`, so 0.2–0.45 of the
  ratio, where the study fitted 0.21–0.33) and so moves the points odds too; λ points keeps its assists (0.35) and
  shots (0.20) ratios. Replayed through that pass-through at every tier, the ISCF ratio beat a skater's rate alone and
  the old composite did not (same audit).
  And on 2026-11-13 (port it too, Vincent: "no just 2 and 3"): the line boost on λ shots (and 0.12 / 0.08 of it on λ
  goals / points) is `lineMoveMultiplier` − 1: the projected minutes at tonight's posted line over the same projection at
  his usual line (`usualLineFromToi`: the line whose `TOI_FIT.mean` is nearest his minutes, defensemen on their own),
  to the power `TOI_MOVE_EXP` 0.8, held to 0.88–1.14, 1 without a posted line — in place of +6% a line upward only on
  the forwards' minute cuts, which never lowered a demoted skater and left promoted defensemen unread (7,044 posted-line
  skater-games: up one line shot ×1.04, down one ×0.98, defensemen ×1.05 / ×0.95; worth little overall, −0.9 per 1,000
  with an interval across 0; `docs/audits/2026-11-13-nhl-formula-refit.md`, `__tests__/nhl-model-line-move.test.js`).
  `node tools/port-model-core.mjs [App.jsx]` applies all seven ports on the Mac (the 2026-10-13 shots odds, the
  2026-10-20 goal odds, the 2026-10-27 weights, the 2026-11-07 minutes, the 2026-11-12 goals environment and
  `defenseGoalMultiplier`, the 2026-11-13 line move), each group all-or-nothing by exact-text anchors: a backup beside the
  file, a group already there reported as ported, a group with a differing anchor skipped and named, `--check` to
  look first. On 2026-10-27 App.jsx had neither odds port: the local app had published the ladder's odds since Oct 13.

## Last season means the regular season (the full rule, summarised in CLAUDE.md)

- Last season means the regular season: `loadRows` (`rowsBefore` in `lib/nhl-data/build.js`) drops the previous
  season's playoff rows (`isPlayoffGame` in `util.js`, the game id's type digits) from every base — a skater's rates
  before his fifth game, his last 5 / 10 / 20 across the boundary, the flame / snowflake, the Defense tab's spans and track record, the
  profiles, the first-goal record, the history and home / away workbooks the model is given; this season's rows come
  whole, so the playoffs under way in April–June are the data. The opponent's table in any number is this season's
  (`positionAllowed`, `defenseBlocks`, and the Defense tab's `seasonDefense`). (Vincent's call, 2026-10-27: the final games of a season on record are playoff games and read
  over to nothing; the teams on the ice are this season's.)
