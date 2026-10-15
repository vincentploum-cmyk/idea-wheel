# Predictor study: which data points forecast a skater's SOG and goals

A reproducible, leak-free study of what predicts a skater's shots on goal and goals in
his next game, built from the public NHL API (box score + play-by-play through
`lib/nhl-data/game.js`, so iCF / iFF / iSCF / iHDCF match the stored rows) and
MoneyPuck's previous-season summaries. The findings are written up in
`docs/shots-goals-predictors.md`; rerun the study as the season grows:

```
tools/predictors/run.sh 2026                       # 2026-27 to date, with 2025-26 as the prior and the control
tools/predictors/run.sh 2025 2025-10-07 2026-04-16 # a finished season (its own previous season is fetched as the prior)
```

`run.sh <year>` fetches the season and the previous one (the skater's and the opponent's
last-season reads come from box scores, not only MoneyPuck), pulls the faceoffs and relabels the
forwards to the position played, builds the rows, and runs `analyze.py`, `calib.py`, `angles.py`
and, when the previous season's rows exist, `replay.py`. Output goes to
`.nhl-data/predictors/<year>/` (gitignored): `games/<date>.json`, `games-pos/` (relabelled),
`rows.csv` (one row per skater-game, 200+ leak-free features), `analysis.txt`,
`calibration.txt`, `angles.txt`, `replay.txt`, `rows-replay.csv`, plus the tables as CSV.

## Pieces

| File | What |
|---|---|
| `fetch.mjs` | Pulls every final regular-season game between two dates, one JSON per date (resumable: existing dates are skipped). |
| `build_rows.py` | Flattens the games into rows. Every feature on a row comes from games dated strictly before it (`p_*` = the player's season-to-date / L1 / L3 / L5 / L10 / L15 / L20 figures, venue split, line slot by TOI rank, TOI trend, days off; `opp_*` = the opponent's shots and goals allowed overall and to the position, per game and per skater, by window (L5 / L10 / L15 / season), at tonight's venue, and to the position AND slot; `team_*`, `pace_*`, `h2h_*` = earlier meetings this season, `rest_days`, `b2b`, `games_in_4`; `gk_*` = the opposing starter's save % this season), from the previous season's box scores when `--prev-games <dir>` is given (`pls_*` = the skater's venue split, iCF / iSCF and head-to-head record; `opp_pls_*` = the opponent's table by position, per skater, venue and slot), or from MoneyPuck's summaries (`ls_*` last season, `ls2_*` two seasons ago, `opp_ls_*` / `team_ls_*` for the teams, `gk_ls_*` for the goalie, from `--mp-root <dir>`; skaters under 10 games last season carry no prior). |
| `features.py` | The derived reads shared by `angles.py`, `replay.py` and `explain.py`: the blends of this season into last (`bl_*`), the opponent's tables blended across the season boundary (`opp_*_blend`, per skater at the position at games / (games + 15) for shots and games / (games + 40) for goals), the site's own construction (`site_*`: last season from the stored box scores, the way `picks-pure.js` blends), the goalie blend, logs. |
| `angles.py` | Section 13: every angle scored on the same rows, cross-validated Poisson grouped by game: the skater's own windows and priors, then the player core + one environment or situation read at a time (team / position / slot tables by window and venue, this season / last season / blended, pace, goalie, home, rest, venue split, head to head), on all rows, deep rows (10+ games, opponents 15+) and early rows (1 to 10 games), with forward selection; the same for goals; the cheat-sheet cut (opponent's rank third x skater tier). `python3 -I tools/predictors/angles.py <rows.csv> <label>` |
| `replay.py` | Section 13: candidate formulas fitted on a control season (and checked on a second) and replayed leak-free on the season under test, against the site's own fixed coefficients: deviance / Brier / log loss, calibration by band, λ by band, Brier by games played and position, the Best bets board rule replayed (calls, stated, hit, break-even), the slate's top 10 / 20 / 40, every 5+ SOG and 2+ goal night and where the formula had him, the cheat-sheet cut on the blended read; prints the site-shape coefficients for `picks-pure.js`. `python3 -I tools/predictors/replay.py <control rows.csv> <target rows.csv> <label> [second control rows.csv]` → `<target>-replay.csv` |
| `tonight.py` | Tonight's shots and goals plays from the shipped formula, built from the public box scores (lineup = who dressed in each team's last game): per game everyone over the floor (3+ SOG at 50%, 1+ goal at 35%) with the break-even price, the opponent's per-skater position read and its rank, then the slate's top 12 shooters and scorers. `python3 -I tools/predictors/tonight.py <this season games-pos> <previous season games-pos> <date> [--all]` |
| `explain.py` | One skater-game, every angle, the formulas' λ and odds, his rank on the slate and the verdict. `python3 -I tools/predictors/explain.py <rows-replay.csv> <date> <team> [name part]`, `… <date> <team> --slot C1`, `… --big [n]` (the biggest nights), `… --date <date>` (the slate's top 10 graded). |
| `analyze.py` | Univariate Spearman correlations with bootstrap CIs (games resampled), grouped 5-fold cross-validated Poisson ladders for SOG and goals (deviance, MAE, log loss and Brier of P(2+ / 3+ SOG) and P(1+ goal)), the this-season-vs-last-season shrinkage weight by games played, bucket reads (hot hand, scored-last-game, opponent buckets), window comparison for skaters with 20+ games, and the head-to-head deep dive. |
| `h2h_cross.py` | Previous season's record vs each opponent -> this season's games vs that opponent: buckets, Poisson with the player's rate excluding those games, the "3+ goals vs the opponent" list. `python3 -I tools/predictors/h2h_cross.py <prev rows.csv> <cur rows.csv> <label>` |
| `h2h_perm.py` | Permutation null for the cross-season test: shuffles which opponent each of the player's previous-season games was against, so his rate stays and any matchup effect is removed. `… h2h_perm.py <prev rows.csv> <cur rows.csv> <permutations>` |
| `h2h_within_fixed.py` | Within-season H2H with the H2H games excluded from the season-to-date rate, plus the same permutation null. `… h2h_within_fixed.py <rows.csv> <permutations>` |
| `env_windows.py` | Which window of the opponent's shots / goals allowed (overall and per skater at the position; L3 to L30 and season to date, venue-matched L5 / L10) predicts the skater's SOG and goals: reliability of each read against the opponent's next 10 games, cross-validated gain on top of the player baseline, effect sizes, and the early-season comparison with last season's figure. `python3 -I tools/predictors/env_windows.py <rows.csv> <label>` |
| `faceoffs.mjs` | Draws taken per skater per game from the play-by-play, for the games fetch.mjs pulled. `node tools/predictors/faceoffs.mjs <games dir> <out json>` |
| `relabel.py` | Rewrites each game's forwards with the position played (the four who took the draws are the centres, the rest wingers on their listed side) instead of the box score's registered position, which lists six to eight "C" a team. `python3 -I tools/predictors/relabel.py <games dir> <faceoffs json> <out games dir> [PropFinder skater csv]` |
| `pf_dump.py` | PropFinder's opponent exports (the bundled seed, written out with the one-liner in its header, or fresh exports) to one CSV with its numbers and ranks. |
| `env_source.py` | Section 10: the rink's two tints (Rink: venue / L5 / L10 over two seasons; PropFinder: last season, this season, L5 / L10) rebuilt leak-free and graded against the box scores — correlation, cross-validated gain over the skater's baseline, and hit rates of 2+ / 3+ / 4+ SOG and 1+ goal by band colour, overall and by last-season tier. `python3 -I tools/predictors/env_source.py <rows.csv> <games dir> <previous season's games dir> <label> [pf opponents csv]`; run it on the relabelled games (build_rows on the `relabel.py` output) for positions that match the tables. |
| `firstgoal_grade.py` | Section 11: the 1st goal tab's score replayed leak-free for every skater-game and its per-game ranking graded against who scored first (top-1 / top-3 / top-5 hit rates, score buckets, which part of the score carries it). `python3 -I tools/predictors/firstgoal_grade.py <rows.csv> <games dir> <previous season's games dir> <label>` |
| `picks.py` | The earlier (section 2 / 9) CLI version of tonight's picks: blended own rate, attempts, home, the opponent's team shots allowed this season, fitted on an `-envsrc.csv` control. Superseded by the site's Best bets board (`lib/nhl-data/picks-pure.js`, whose coefficients come from `replay.py`'s site-shape fit); kept for the record. `python3 -I tools/predictors/picks.py <control rows -envsrc.csv> <this season's games dir> <moneypuck skaters csv> <schedule json> <date>` |
| `calib.py` | Out-of-fold calibration tables for the recommended early-season models and the running hot / cold lists against last season's rates. |

Needs node 18+ and python3 with pandas, scipy, statsmodels and scikit-learn
(`pip install pandas scipy statsmodels scikit-learn`). Rows built from `games-pos/` carry the
position played (centres = the faceoff takers) and a line slot by TOI rank; the app's stored rows
(`data/rows/<season>.json`) carry the lineup slot itself.
