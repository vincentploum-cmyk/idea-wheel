# NFL board (`/nfl`)

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
  `defenseAllowed` per position with ranks 1 = most allowed). **Injuries come from ESPN's league feed, not PropFinder**
  (`injuryReport: 'espn'` on `makePropfinder` in `propfinder-nfl.js`; Vincent, 2026-10-31: "fix the NFL injury report so
  it reads injuries"): PropFinder's NFL report sits behind a route only its signed-in pages reach — its bundle, read that
  day, builds the NFL games from an `injuryReports` JSON string, while `/NFL/v2` and `/injuries/nfl/<teamId>` answered 404
  to the API on every pull from 2026-10-28 — so the pull asks it nothing (`fetchInjuries` returns `source: 'espn'`, Data
  sources says so) and ESPN's feed (`fetchInjuries` in `lib/nfl/espn.js`, `ensureInjuries`, `applyEspnInjuries`) sets
  every pulled player's status. **"Pull injuries"** in the week head (`NflApp.jsx`; Vincent, 2026-11-01: "a button for NFL to pull the latest injury news and adjust the predictions") forces that read now — `POST /api/nfl/refresh?only=injuries` (admin or token) builds the board before and after `ensureInjuries(…, { force: true })` and returns `changes` (`injuryChanges` in `lib/picks/injury-diff.js`: who moved between In / DTD / Out, the projections that moved 0.5 or a TD point), shown under the head with "What changed"; the head names when the feed was last read. The pull lists every rostered player (3,776 for 28 teams), so a player out is in it with
  his logs and reaches the out lists, the without splits and the vacated lifts with no one-by-one read.
  **The slots come from the players** (`depthFromPlayers` on `makePropfinder`, `depthFromRoster`; 2026-11-01): the NFL team
  objects carry no depth chart (`depthCharts: 0` on the pull of 2026-10-31), every player object carries `fullPosition`
  ("WR1", "RB2", "TE1"), so the pull builds `data.depth` from it (`depthFrom: 'players'` on the meta) and `envPosFor` reads
  slot + depth ("WR1") on the opponent's slot rows, the position where the table has none; until then every receiver read
  the WR table. `firstTouchdownScorer` on the game rows is `firstTd` (the First TD hit rates read 0 off the logs before).
  **Everything PropFinder sends is loaded** (2026-11-01, Vincent: "We need to load all Propfinder data"; the pull's markets
  printed in full by `nfl-data.yml` that night): every market on the pull is filed where it settles — PropFinder's own
  category first (`CATEGORY_MARKETS` in `propfinder-nfl.js`, `categoryMarkets` on `makePropfinder`; until then "Kicking Points",
  "Extra Points Made" and "Defensive Interceptions" read as a quarterback's interceptions, "points" holding the alias "ints",
  and "Longest Passing Completion" as completions), the NBA's skip rule per sport (`notAMarket`: the NFL's skips the fantasy
  score alone, which no game row carries, so rushing and passing attempts and field goals are read), the "Player Touchdowns"
  ladder by its line (`lineMarket`: 0.5 the anytime TD, 1.5 2+ TD); **new markets** (`lib/nfl/markets.js`, three groups):
  Defense (tackles = solo, tackle assists, tackles + assists, sacks, defensive INTs), Kicking (kicking points, field goals,
  extra points) and Halves & quarters (`PERIODS`: the 1st half's and the 1st quarter's passing / rushing / receiving yards,
  receptions, rush attempts, pass TDs and touchdowns, the 2nd half's touchdowns; `<period>_<market>`, the full game's
  matchup table; `periodOf` reads "1st Half …" / "H1…"). The game rows' new fields are sparse (`sparse: true`: kept when not
  0, null when the row lacks the key; `statOf` reads a null field as no figure, so a game without it is no game in a hit
  rate and a box score without it grades nothing): the defense, the kicker (`kickPts` = 3 × FG + XP), the periods, his
  opportunity (`tgtShare`, `rushShare`, `rzTgt`, `rzAtt`, `passRzAtt`, `airYds`, `passAirYds`, `yac`, `sacked`, `fumLost`:
  loaded, not yet in any projection). ESPN's box score grades them (`parseSummary`: the defensive, interceptions and kicking
  blocks; each period's rushing, receiving and passing touchdowns from the scoring plays, the passer after "pass from";
  the period yards and the longest completion null, ungraded). The defense tables read the last 3 too (`windows`). **The
  rest is kept as sent** (`keepExtra`, `extraOf`): per player his own fields, every game row's figures the board does not
  read (the other quarters, the shares, the defense's details …; 0s left out) and the lines of the markets the board does
  not settle (`otherProps`: the fantasy score, the other quarters, 3+ TD), per team every stats row as published (each
  window, position and slot, PropFinder's ranks in), stored a team a file beside the pull
  (`nfl/<season>/<wk>/propfinder-extra/<ABBR>.json` + `index.json`, gzipped; whole it was 16 MB gzipped and 400 MB of heap
  on a synthetic pull of the size) and read by `GET /api/nfl/propfinder?…&player=<id | name>|team=ABBR` (`extraFor`), never
  by the board; Data sources counts it, `fieldsSeen.stored` lists the keys kept that way. `__tests__/nfl-propfinder-all.test.js`
  (every market name of that pull, `fixtures/espn-nfl-summary-dal-phi.json` the box score of DAL at PHI, 2026-10-26),
  `nfl-propfinder-extra-store.test.js`.
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
- **The week's projections** (`lib/nfl/projections.js` `nflProjections`, attached by `buildBoard` in `lib/nfl/picks.js` as
  `board.projections`; drawn by `components/nfl/NflBoards.jsx`, printed by `tools/nfl-projections.mjs`; Vincent, 2026-11-01:
  first "the following structure based on the cheat sheet and propfinder data", then "I don't care about edge … the
  projected yards / TD candidates per game", then "Why am I not seeing a simple list of players and their projected yards
  / receptions per game … Player - yards (strong) yards (lean) yards (thin) … In case of touch down: Player - chance% of
  td"; the EV-ranked boards and the six-board tab of that day are gone): no price and no edge anywhere. **The tabs**:
  `#matchups` (`NflMatchups`: the games, each opening on the cheat sheet's defense weak spots in a line and four pill tabs
  TDs · Pass Yards · Receiving Yards · Rushing Yards, both teams in one list) and `#tds`, `#passing`, `#receiving`,
  `#rushing` (`NflList`: the same list across every game, 40 rows then "Show all"; passing = quarterbacks projected
  `LIST_PASS_MIN` = 100 yards and up). **Yards are ladders** (Vincent, the
  next day: "per game, players listed with their ladders: strong - 50+ yards (60%), lean - 60+ yards, thin 70+ yards …
  I asked you this already"): per player the highest round mark he reaches tonight at 60% (strong), 45% (lean) and 30%
  (thin) with its chance (`ladderTiers`, `LADDER_TIERS`; marks by 10 yards, 5 under `SMALL_YDS` = 40 projected, 25 passing,
  1 reception; a mark two tiers share listed once, at the stronger), receptions under the receiving yards, **his projection
  first** (a Proj column on every yards table — the yards, the receptions under them — and on the touchdown tables his
  expected touchdowns, λ; Vincent, 2026-11-01: "add the projected on TD, rushing, passing and receiving tabs"); once stored
  each rung green / red on what he got (`hits`). The chance at a mark (`chanceAtMark`) is read around tonight's
  projection — his skill and the matchup (the board's `ranges[market].exp`: his rate from PropFinder's logs × the defense
  at his slot, PropFinder's table with the cheat sheet's snapshot, the table counted at gp / (gp + 8) of itself,
  `COCKTAIL.matchupK` in `lib/nfl/picks.js`) — on his spread with **the market's real residuals** (`RESID`: (got −
  projection) / spread at 5% steps, fitted on 2025's games with PropFinder's logs, zeros in): a game's yards run skewed,
  the middle game a third of a spread under the projection, so a symmetric curve said 67% where the strong rungs landed
  59%; with `RESID` on 2026's weeks 1–7 strong said 69% / landed 63%, lean 51 / 50%, thin 35 / 35%
  (`docs/audits/2026-11-01-nfl-propfinder-backtest.md`). The floor and the ceiling (his 20th and 80th percentile, `RANGE`)
  stay on the row for the script and the audit, off the page. **The game script** (`scriptOf`, `scriptFactor`) is in the
  code at zero weight (`SCRIPT` volume / rush / pass 0): backtested, the book's total and spread moved no yards figure for
  the better; nothing of the line is on the page. The book's main line and the cheat sheet's line ride on the row, off the
  page. **Touchdowns: anytime, 1st half, first TD, 2+ TDs** (Vincent: "For touchdowns, I need first touch down, first half
  touch and 2 touch downs"): 2+ = 1 − e^(−λ)(1 + λ) on his calibrated λ (`p2`); the first touchdown = his λ over the game's
  expected touchdowns (the book's total × `TD_PER_POINT`, ÷ (1 − `FIRST_OTHER` = 0.06) for the defenses' and the returns';
  the listed players' sum without a total — it runs high, counting every backup with a log) × the chance the game has one
  (`pFirst`); graded on `first_td` / `h1_anytime_td` / the count. On 2026's weeks 1–7: first TD said 4.1% landed 3.8%, 2+
  said 2.8% landed 3.3%. **Big games** (`#big`, `NflBigGames`; Vincent, 2026-11-01: "how can I find the super matchups that
  result in the big wins … 150 rushing yards", then "find out what the best cocktail is … by looking for patterns in the box
  scores of players that reached these"; `docs/audits/2026-11-01-nfl-big-games.md`, `tools/audit/nfl_big.py`): per stat the
  week's likeliest 100+ / 150+ rushing and receiving and 300+ / 350+ passing games (`BIG`, `bigChance`: σ(a + b · logit of
  the board's chance at the mark + one context) — rushing his team's implied points, receiving his share of the targets
  over his last five (`tgtShareOf`: each game's targets by side, keyed by the game and the opponent faced, a side under
  `SIDE_TGT_MIN` = 20 targets in the pull left out), passing the game total; the only contexts that beat the board on both
  checks, 2024 → 2025 and 2024–25 → 2026; the opponent's defense table and his own past big games added nothing, the
  mined rules did not survive), `big` on every row, `lists.big` by market from `BIG_LIST_MIN` = 5%, the reason beside each
  name; the week's top five at 100+ landed about one in three. A list carries receivers, tight ends and backs (receiving) or backs and quarterbacks (rushing)
  projected `LIST_YDS_MIN` = 10 yards and up, the highest
  projection first. **Touchdowns from the team down**: the team's touchdowns tonight (`teamTd`) = its own touchdowns a game
  through the opponent's touchdowns allowed (`envFactor` on PropFinder's `totals.for/against.td`, `leagueFor.td`) at 0.75
  and the book's implied points (ESPN's total and spread, `impliedPoints`) × `TD_PER_POINT` = 0.105 at 0.25
  (`LINE_WEIGHT`), its factor on his read clamped 0.6–1.6 — **inert on the live board**: PropFinder's NFL team objects
  carry no Team row, so `totals[ABBR].for` is null on every pull and the factor is 1 (measured on PropFinder's own logs,
  `docs/audits/2026-11-01-nfl-propfinder-backtest.md`: Brier 0.1237 with the team read, 0.1236 without); his own rate = touchdowns a game (season 0.6 · last five 0.4)
  pulled toward his projected carries + targets × his position's touchdowns per touch across the pull (`perTouch`) at
  n / (n + `RATE_K` = 16); `posShift` (the opponent's touchdowns allowed at his spot over what it allows in all) off,
  `POS_CLAMP` [1, 1]; P = 1 − e^(−λ) through the calibration `TD_CAL` (σ(−0.167 + 0.857 · logit p), `raw` the stated
  chance), first half 1 − e^(−0.48 λ) (`H1_SHARE`); every constant in `PARAMS`, overridable per call (`params`, the
  audit's grid; `reproject` in `lib/nfl/picks.js`, `nflBoard(cocktail)` / `makeBuild` for the board); its word strong from 45%, lean from 30%, thin under (`tdTier`, `TD_TIERS`); listed from
  `LIST_TD_MIN` = 5%, the likeliest first. Skill positions only, the out left off, "if active" (DTD) and "if role
  confirmed" (a without split or a vacated lift **from a teammate at his own position group** — QB, RB, WR / TE,
  `ROLE_GROUP`, the side's players and out list naming the positions; until 2026-11-01 one inactive rookie receiver put
  the word on every Raven; `roleOf`, the hover names who) beside a name; **one quarterback a team** (Vincent, 2026-11-01:
  "Lamar Jackson is the QB, why am I seeing Tyler Huntley?" — the backup's three starts projected him 197 yards):
  ESPN's depth chart is read with the injury feed (`fetchDepthCharts` / `parseDepthChart` in `lib/nfl/espn.js`: every
  team's `/teams/<id>/depthcharts`, the offense formation's `qb` slot starter first, stored on the feed as `depth`, put
  on the pull as `espnDepth` by `pfFor`; PropFinder's `fullPosition` numbers no quarterback), `markQuarterbacks` puts
  `slot: 'QB'` / `depth` on each QB row (the lists read "QB1" / "QB2") and makes the highest on the chart among the
  quarterbacks not out the starter, every other `backup: true` — off every list (`listsOf`), the first-TD sum and the
  snapshot's attack, still found by the search; no chart, the rows as before; every height and chance
  graded once the game is stored. `games[].lists` and `lists` = { td, receiving, rushing } of row ids (`listsOf`).
  **The script**: `node tools/nfl-projections.mjs [--season --week | --file picks.json] [--games | --week-lists] [--top N]`
  prints the same lists as text, one line a player ("Puka Nacua (LAR @ SEA) — floor 98 · proj 125 · ceiling 151 yds ·
  rec 6 / 7.5 / 9"; "Kyren Williams (LAR) — 58% (strong) · 1st half 35%"; each side's script above its game), fetching `/api/nfl/picks` with
  `NHL_ACTIONS_TOKEN`. **Backtested** (`docs/audits/2026-11-01-nfl-backtest.md`, `tools/audit/nfl-audit.mjs`): every
  constant above searched on 2025's weeks 4–18 and checked on 2026's weeks 1–7. The first-half chance is
  his own (1 − e^(−0.48 λ)), graded on `h1_anytime_td` (the period fields `h1RushTd` + `h1RecTd` off ESPN's scoring plays);
  the book's first-half line is that market's play like any other. The side players' plays carry `ev`, `implied` and the
  without names. `__tests__/nfl-boards.test.jsx` (the read, the panel, the script; `MOCK_OUT`
  writes `boards-nfl-<theme>.html`).
- **The passing read** (`PASS`, `passRead` in `lib/nfl/projections.js`; Vincent, 2026-11-02: "we need to work on the passing
  yards … our predictions are not even close to the actual"; `docs/audits/2026-11-02-nfl-passing.md`, `tools/audit/nfl_passing.py`):
  a starting quarterback's passing yards are his last 17 starts (10+ attempts) pulled toward 225 at n / (n + 6), plus the
  book's total and his team's half spread, plus PropFinder's QB passing yards allowed over the league at gp / (gp + 8), fitted
  on 2025's starts (the board had averaged every logged game, the weeks he sat as a backup in, and read starters 15 yards
  low: 64.6 → 55.8 a start on 2026's weeks 1–8); a flat 70-yard spread, `RESID.pass_yds` / `RANGE.pass_yds` refitted, 300+ /
  350+ read the ladder's chance (`BIG.pass_yds` a 0, b 1); a backup on ESPN's chart (no chart: all but the latest starter)
  keeps the board's read; `y.pass` on the row, `passText` on the hovers.
- **PropFinder's roster status and the quarterback's rushing** (Vincent, 2026-11-02: "Same for rushing yards. They are also
  far off"; `docs/audits/2026-11-02-nfl-rushing.md`, `tools/audit/nfl_rushing.py`): every NFL player's `status` (ACT, PRA,
  OFF_ROSTER, IR, IRD, PRA_IR, PUP, NON, SUS, EXE) is read by `applyRosterStatus` (`lib/nfl/roster-status.js`, first in
  `makeBuild`): anyone but ACT (or no status) leaves the board — no row, no list — unless the injury feed already has him out
  (week 8: 25 of the 28 listed rushers who never played, 69 of 79 receivers, 149 of 176 touchdown names were off the
  roster or on IR); left off, not marked out, so the vacated lifts read what they read before. A starting quarterback's
  rushing yards are his last 17 starts' pulled toward 8 at n / (n + 3) (`QB_RUSH`, `qbRushRead`, `y.qbRush`). The backs'
  rushing read is unchanged: nothing tried beat it out of sample.
- **No injury hand-over on the NFL** (Vincent, 2026-11-03: "yes run the volume study"; `docs/audits/2026-11-03-nfl-volume.md`,
  `tools/audit/nfl_volume.py`; the predictors study the day before, `docs/audits/2026-11-03-nfl-predictors.md`,
  `tools/audit/nfl_predictors.py`: recent form leads every market, head to head and the matchup add nothing case by case):
  the NFL's `COCKTAIL` is `{ matchupK: 8, vacatedShare: 0, withoutSplit: false }` — a teammate out moves no read (the vacated lift
  at 0.6 put targets within one 29.0% of the games with a teammate missing against 35.7% without it, carries 16.9% / 33.8%;
  the without split cost 5.5 points of targets' close calls); the split is `board.js`'s `withoutSplit` cocktail key; `roleOf`'s `regularsOut` keeps "if role confirmed" beside a name when a regular at his group is out.
- **The two-engine spec, tested** (Vincent, 2026-11-03, a spec: yards = volume × matchup × efficiency × script with a
  max-ladder gate and a card of 2 + 2 ladders; touchdowns = red-zone opportunity × implied total, six a card, an outlier
  rule; `docs/audits/2026-11-03-nfl-engines.md`, `tools/audit/nfl_engines.py`): the yards formula, the receivers' gate and the
  card did not beat the board case by case and are not built; two pieces shipped in `lib/nfl/projections.js` — **the shrink**
  (`YARDS_SHRINK`: receiving 2.07 + 0.772 × the board's, a back's rushing 1.29 + 0.887 ×, LAD on 2025; `RESID` / `RANGE`
  refitted on it, `y.unshrunk`, the big games on `RESID_UNSHRUNK`): the board's top 5% over-read by 11–18 yards; 2026
  receiving within ±10 27.5% → 32.2%, rushing 23.0% → 27.2% — and **the touchdown engine** (`TD_ENGINE`, `tdEngine`,
  `rzLooksOf`: the board's chance after `TD_CAL` with his red-zone looks a game over his last five, PropFinder's `rzAtt` +
  `rzTgt`, and the team's implied points; `td.board`, `td.rz`, `td.points`; quarterbacks as before): Brier 0.1237 → 0.1222,
  the week's six likeliest scored 66.7% (54.8% before), the outlier rule met by the engine itself.
- **The cheat sheet's defense snapshot** (`lib/nfl/snapshot.js`; Vincent, 2026-11-01: "the cheat sheet should be used to
  identify weaknesses in defenses"): each column of the detailed sheet opens with the opponent's defense — coverage shells
  (Man% / Zone%, Cover 0 / 1 / 2 / 3 / 4 / 6, 2-Man) and ranked tiles (Pass Yds/G, Rush Yds/G, Rush Y/Play, the passing
  field's Short L / M / R and Long L / M / R, "#N" of 32). `parseSnapshot` reads them off the column's OCR words (labels
  as OCR spells them, `shellOf` / `tileOf`; the field's zones by place when a label misreads; a coverage share whose
  decimal OCR dropped put back, and one read a digit long repaired by the shells' 100% sum, `repaired`);
  `parseDetailedPages` stores them as `meta.defense[offense] = { of: defense, coverage, ranks, tiles }` (a column whose
  tiles did not read is warned about: page 1's left column, DEN's, read its coverage and no tile). **Which way the sheet
  ranks is not printed**: #1 = the defense allowing the fewest by default (`SHEET_RANK_DEFAULT`, the usual NFL reading),
  checked against PropFinder's QB pass-yards and RB rush-yards ranks across the slate (`rankDirection`, Spearman, 6
  ranks and |ρ| ≥ 0.2 to decide, else the default). `sheetDefense` (run by `buildBoard` in `lib/nfl/picks.js` before the
  shared builder) converts the tiles to the site's convention (1 = gives up the most, `convertRanks`) and places them on
  the offense's positions and slots as `meta.oppRanks` (`oppRanksOf`: QB pass and run, backs the run with their catches
  on the short zones, WR the pass, WR1 / WR2 the outside zones, WR3 and the TE the middle, a zone blended half and half
  with the pass rank; `meta.oppCount` = 32, `defenseFromSheets` reads it): the existing path puts them beside
  PropFinder's cells (`sheet`, `sheetValue`, `rankBlend`) and `matchupOf` blends them into every yards projection and the
  profile's Soft spots. The defenses in words ride as `board.sheetDefense` ({ direction, teams: { DEF: { weak, strong,
  style } } }, `spotsOf`: the weakest and strongest thirds, man- / zone-heavy, the main shell) and on each projected side
  as `defense` with `attack` (the top `ATTACK_MAX` = 4 weak spots and the players each opens up: the pass → the QB, the
  run → the lead back, the outside → WR1 / WR2, the middle → the TE and the slot). The Matchups tab's game card names each defense's three weakest spots, and the script prints the same. A sheet stored before
  2026-11-01 gains its snapshot with "Read again" (the stored OCR words, no new read). Touchdowns do not read the
  snapshot (it prints no touchdown tile). `__tests__/nfl-snapshot.test.js` (page 1's real words).
- **Without the cheat sheet, PropFinder's weak spots** (`pfSpots` / `PF_SPOTS` in `lib/nfl/projections.js`; Vincent, 2026-11-04:
  "I will not get the cheat sheet anymore"): a game whose defense has no snapshot reads its weak and strong spots off the side's
  `allowed` (the opponent's PropFinder season table, rank 1 = the most of `count`): the pass (QB passing yards), the run (RB
  rushing), receiving yards to the WR1, the WR2, the slot receiver (WR3), the tight end (TE1, else TE) and the backs — "the
  receivers" as one when the table has no slot rows; weak = the third that gives up the most, strong = the third that gives up
  the least, in the snapshot's `{ key, word, rank }` shape, so the Matchups card ("SEA defense gives up the most to the WR1 (#2),
  …", its hover naming PropFinder's table), the attack lists (a slot's spot → the player in that slot, the TE's → the tight
  end, the backs' → the receiving backs) and `tools/nfl-projections.mjs` read it unchanged; `defense.from` = 'sheet' |
  'propfinder', no coverage words without the sheet. The snapshot still leads on a week that stored one.
  `__tests__/nfl-boards.test.jsx` ("the weak spots without a cheat sheet").
- Routes (`authorize()`, admin session or sync token): `GET /api/nfl/picks?season&week&type|date`,
  `GET /api/nfl/shuffle?season&week&type&market`, `GET /api/nfl/scorecard?season&from&to`,
  `GET|POST|DELETE /api/nfl/sheets`, `POST /api/nfl/refresh?only=schedule|propfinder`
  (anonymous calls refresh ESPN only, throttled), `GET /api/nfl/status`, `GET /api/site/status`.
  `.github/workflows/nfl-data.yml` calls the refresh daily and after the Sunday / Monday /
  Thursday games. UI: `components/nfl/NflApp.jsx` (week picker), `NflBoard.jsx`, `NflSources.jsx`.
- Tests: `__tests__/nfl-*.test.js` (`fixtures/espn-nfl-summary.json` is a trimmed real summary).

