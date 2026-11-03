# Audits

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
- The NBA ceiling read (`docs/audits/2026-10-31-nba-ceiling.md`, `nba-audit.mjs`'s "The ceiling read" section on both seasons;
  Vincent, 2026-10-31: "look at what a player is capable of and then determine the ceiling … I would expect our projections
  to be higher for him today"): on 2025-26's 125,045 projections a player beats his stated centre by the same third of a unit
  in the soft, middle and tough third of the matchup table and clears his ceiling (the top quarter of his nights) as often
  in each (26.7 / 27.5 / 27.6%); the centre moved toward his ceiling by 0.3 × where × his upside shaves the miss
  (2.513 → 2.505, the board's −0.74 bias behind it) and leaves the ladder as it was, by 1 × costs (2.542, the main rung's
  60–70% band 59% → 55%), toward his floor in a tough spot costs at every weight; this season's 1–8-game tables are noise
  undamped (2.704 → 2.732 at 0.3). Shipped at 0.3 with PropFinder's rank at gp / (gp + 10), the sheet's tile in full.
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

- The by-line read, checked (`docs/audits/2026-10-31-nhl-lines.md`, `tools/audit/nhl_lines.py` on the predictors' relabelled
  box scores, the slot = the ice-time rank inside the position that night; Vincent, 2026-10-31: "was it indeed true that the
  LW1 had the most shots in that game tonight?"): no. The skater at the opponent's softest slot was his team's top shooter in
  9.4% of 2,390 team-games last season, the slot's own base rate (9.6%; the softest slots named are mostly third- and
  fourth-line cells, where a handful of skater-games swings the rank); the highest own rate was the top shooter 32.5%. The
  slot table's soft third reads +2.8% shots over his own rate and its tough third −4.9%, the position table's +3.7% / −7.3%
  on the same rows; on top of his own rate and the position cell the slot cell carries −0.01 (z −0.3) for shots, 0.03 (z
  0.8) for goals; the slot cells persist at 0.21 odd / even last season (0.01 this season) against the position cells' 0.48.
  The rink's slot badges and the "softest line" head are colour, not a read; nothing changed.
- Special teams and the predicted score (`docs/audits/2026-10-31-nhl-special-teams-and-score.md`, `tools/audit/nhl_special_teams.py`
  on the NHL API's right-rail team stats, `tools/audit/nhl-pp-fetch.mjs`, and the predictors' box scores; Vincent, 2026-10-31):
  3,052 team-games of both seasons. Inside a game a power play is worth +0.99 shots and a kill −0.71, in goals +0.06 (power-play
  goals replace even-strength ones). Tonight's count is foreseeable a little (own drawn^0.46 × opponent gives^0.42, K = 10; the
  rates persist at 0.28 odd / even). On top of own volume × the opponent's allowed table the opponent's discipline moves a team's
  shots and goals by nothing (the mechanical factor 0.25, z 0.2; −0.46, z −1.1): the shots a leaky kill gives up are in the
  shots-allowed table already. The predicted score: the skaters' λ goals added up read 2% low and too wide; rescaled with the
  team's goals a game and the opponent's allowed (0.621 · log Σλ + 0.214 + 0.113) they miss a team's goals by 1.37 on 2026-27
  (the league's 1.38, own × allowed 1.40) and call the winner 58% (the bare sum 61%, ±4 points of noise on 128 games). Shipped
  as above (the special-teams bullet under Automation).

- The NFL projections, backtested (`docs/audits/2026-11-01-nfl-backtest.md`, `tools/audit/nfl-fetch.mjs` → `nfl-audit.mjs`;
  Vincent, 2026-11-01: "Did you backtest and optimize it based on the last 7 week's matches?" — no — then "yes do the
  backtest and optimize it"): every week of 2025 and 2026 rebuilt from ESPN's box scores and lines with what was known that
  morning, through the site's own board and projections; tuned on 2025's weeks 4–18, checked unchanged on 2026's weeks 1–7.
  On the check weeks: receiving yards missed by 22.5 (23.2 before), rushing 21.7 (22.6), passing 67.5 (71.7); the floor /
  ceiling from a quarter under the floor to a fifth each side; touchdowns Brier 0.1472 → 0.1419 (said 56% landed 41% at
  the top before, 52% / 47% after). The defense table damped at gp / (gp + 8), the game script off the yards (the book's
  total and spread moved no projection for the better), the touchdown read on volume more than history with no position
  shift, a fitted calibration. Zero-stat games are not in ESPN's box score, so neither the replay's logs nor its grading
  carry them.
- The NFL projections on PropFinder's own data (`docs/audits/2026-11-01-nfl-propfinder-backtest.md`,
  `tools/audit/nfl-pf-audit.mjs`; Vincent, 2026-11-01: "Backtest it with the real PropFinder data"): the site's stored pulls
  exported read-only (`GET /api/nfl/propfinder?export=1` — the pull, the sheets, the schedule, the teams' published rows,
  gzipped; `?weeks=1` the stored weeks; `exportWeek` in `lib/nfl/store.js`; the `nfl-pf-export` workflow puts every week in
  a two-day artifact). Each pull carries every rostered player's PropFinder logs back to 2024, zeros in, so every week of
  2025 and 2026 replays on them with the defense tables rebuilt from the same logs (they match PropFinder's published
  season table at 0.99+). On 2026's weeks 1–7: receiving 22.9, rushing 21.6, passing 70.2, receptions 1.6, the floor /
  ceiling at a fifth each side, touchdowns Brier 0.1237; no re-searched constant beat the shipped ones. Week 7 on
  PropFinder's tables as published that Wednesday read the same as the rebuilt ones; the books' main lines that day landed
  a little nearer than the projections (receiving 23.7 against 24.3, rushing 25.1 / 26.8, passing 55 / 66.7) and their TD
  prices beat the TD read (Brier 0.1175 / 0.1214). Only that week could be graded on pre-game PropFinder files: each
  week's file is overwritten by the next day's pull.
- The NFL's big games (`docs/audits/2026-11-01-nfl-big-games.md`, `tools/audit/nfl_big.py` on `nfl-pf-audit.mjs --dump`;
  Vincent, 2026-11-01): 11,824 player-games of 2024–26 with everything known that morning; the board's chance plus one
  context per stat (implied points, target share, game total) beat the board and its recalibration on both checks, the
  defense table and the player's past big games did not, everything at once and the trees overfit, the rules mined on 2024
  fell from 70% to 22–35%. Shipped as the Big games tab.
- The NBA's big games (`docs/audits/2026-11-01-nba-big-games.md`, `tools/audit/nba_big.py` on `nba-audit.mjs`'s rows, `--big`
  grades the site's read): 31,014 player-game-stat rows of 2025-26 and 2026-27; unlike the NFL the player's own record over
  his last 20 games beats the board's chance on both checks (points, 12+ rebounds, 10+ assists, PRA), threes attempted for
  5+ threes; the matchup, pace, the line, home and back-to-backs did not; the rarest marks keep the board's chance. The
  site's read on Feb–Apr 2025-26: 30+ points said 10.0% landed 9.9%, the night's top five 35% / 34%; this season's first
  ten nights ran under it (30+ said 12.3%, landed 8.4%).

