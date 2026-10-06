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
| `calib.py` | Out-of-fold calibration tables for the recommended early-season models and the running hot / cold lists against last season's rates. |

Needs node 18+ and python3 with pandas, scipy, statsmodels and scikit-learn
(`pip install pandas scipy statsmodels scikit-learn`). Rows carry the box-score position
only; the app's stored rows (`data/rows/<season>.json`) add the lineup slot.
