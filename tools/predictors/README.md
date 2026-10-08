# Predictor study: which data points forecast a skater's SOG and goals

A reproducible, leak-free study of what predicts a skater's shots on goal and goals in
his next game, built from the public NHL API (box score + play-by-play through
`lib/nhl-data/game.js`, so iCF / iFF / iSCF / iHDCF match the stored rows) and
MoneyPuck's previous-season summaries. The findings are written up in
`docs/shots-goals-predictors.md`; rerun the study as the season grows:

```
tools/predictors/run.sh 2026                       # 2026-27 to date
tools/predictors/run.sh 2025 2025-10-07 2026-04-16 # a finished season, as the control
```

Output goes to `.nhl-data/predictors/<year>/` (gitignored): `games/<date>.json`,
`rows.csv` (one row per skater-game, 100+ leak-free features), `analysis.txt`,
`calibration.txt`, plus the ladder tables as CSV.

## Pieces

| File | What |
|---|---|
| `fetch.mjs` | Pulls every final regular-season game between two dates, one JSON per date (resumable: existing dates are skipped). |
| `build_rows.py` | Flattens the games into rows. Every feature on a row comes from games dated strictly before it (`p_*` = the player's season-to-date / L1 / L3 / L5 / L10 figures, `opp_*` = the opponent's shots and goals allowed overall and to the position, `team_*`, `h2h_*` = earlier meetings this season, `rest_days`, `b2b`) or from the previous season's MoneyPuck summary (`ls_*` for the skater, `opp_ls_*` / `team_ls_*` for the teams; skaters under 10 games last season carry no prior). |
| `analyze.py` | Univariate Spearman correlations with bootstrap CIs (games resampled), grouped 5-fold cross-validated Poisson ladders for SOG and goals (deviance, MAE, log loss and Brier of P(2+ / 3+ SOG) and P(1+ goal)), the this-season-vs-last-season shrinkage weight by games played, bucket reads (hot hand, scored-last-game, opponent buckets), window comparison for skaters with 20+ games, and the head-to-head deep dive. |
| `h2h_cross.py` | Previous season's record vs each opponent -> this season's games vs that opponent: buckets, Poisson with the player's rate excluding those games, the "3+ goals vs the opponent" list. `python3 -I tools/predictors/h2h_cross.py <prev rows.csv> <cur rows.csv> <label>` |
| `h2h_perm.py` | Permutation null for the cross-season test: shuffles which opponent each of the player's previous-season games was against, so his rate stays and any matchup effect is removed. `… h2h_perm.py <prev rows.csv> <cur rows.csv> <permutations>` |
| `h2h_within_fixed.py` | Within-season H2H with the H2H games excluded from the season-to-date rate, plus the same permutation null. `… h2h_within_fixed.py <rows.csv> <permutations>` |
| `env_windows.py` | Which window of the opponent's shots / goals allowed (overall and per skater at the position; L3 to L30 and season to date, venue-matched L5 / L10) predicts the skater's SOG and goals: reliability of each read against the opponent's next 10 games, cross-validated gain on top of the player baseline, effect sizes, and the early-season comparison with last season's figure. `python3 -I tools/predictors/env_windows.py <rows.csv> <label>` |
| `faceoffs.mjs` | Draws taken per skater per game from the play-by-play, for the games fetch.mjs pulled. `node tools/predictors/faceoffs.mjs <games dir> <out json>` |
| `relabel.py` | Rewrites each game's forwards with the position played (the four who took the draws are the centres, the rest wingers on their listed side) instead of the box score's registered position, which lists six to eight "C" a team. `python3 -I tools/predictors/relabel.py <games dir> <faceoffs json> <out games dir> [PropFinder skater csv]` |
| `pf_dump.py` | PropFinder's opponent exports (the bundled seed, written out with the one-liner in its header, or fresh exports) to one CSV with its numbers and ranks. |
| `env_source.py` | Section 10: the rink's two tints (Rink: venue / L5 / L10 over two seasons; PropFinder: last season, this season, L5 / L10) rebuilt leak-free and graded against the box scores — correlation, cross-validated gain over the skater's baseline, and hit rates of 2+ / 3+ / 4+ SOG and 1+ goal by band colour, overall and by last-season tier. `python3 -I tools/predictors/env_source.py <rows.csv> <games dir> <previous season's games dir> <label> [pf opponents csv]`; run it on the relabelled games (build_rows on the `relabel.py` output) for positions that match the tables. |
| `calib.py` | Out-of-fold calibration tables for the recommended early-season models and the running hot / cold lists against last season's rates. |

Needs node 18+ and python3 with pandas, scipy, statsmodels and scikit-learn
(`pip install pandas scipy statsmodels scikit-learn`). Rows carry the box-score position
only; the app's stored rows (`data/rows/<season>.json`) add the lineup slot.
