# NHL predicted score: the level (2026-11-27)

Vincent: "can you check the score prediction per game over the last 40 games and see if we need to adjust our prediction?"

Source: the site's scorecard (`GET /api/nhl/data/scorecard?from=2026-10-01`, `scores`), the stored pre-game projections
(`data/scores/<date>.json`) against the finals; the per-game list from two windows (to 2026-11-19 and to today).

## The season (173 graded games, 2026-10 → 2026-11-25)

| read | team bias | team MAE | total projected / scored | winner called | Brier |
| --- | --- | --- | --- | --- | --- |
| stored projection (the site's) | −0.37 | 1.388 | 5.67 / 6.40 | 60.1% | 0.238 |
| the study's Σλ goals (graded skaters) | −0.28 | 1.355 | 5.82 / 6.37 | 62.3% | 0.233 |
| the run's Σλ goals | −1.10 | 1.601 | 4.19 / 6.39 | 57.7% | 0.239 |

## The last 40 (2026-11-19 → 2026-11-25)

Stored: 5.61 projected against 6.03 scored (−0.42 a game, −0.21 a team), team MAE 1.36, total MAE 1.72, winner called
55%. The projections barely move between teams (SD 0.30 goals a team, correlation with the goals scored 0.04 to 0.05);
not one game was projected at 6.5 or more while 17 of the 40 had 7+ goals. A flat 3.0 a team scores a team MAE of 1.32.

Scaling every team's λ over the last 40: ×1.05 total MAE 1.663, ×1.10 1.641, ×1.15 1.664 (×1.00 1.723); the team MAE
moves the other way by 0.02 (goals are skewed, MAE favours the median); the winner called does not move.

## What changed

`SCORE.level` = 1.10 in `lib/nhl-data/score.js`: the level is the one finding the sample supports (about four standard
errors on the season; 1.13 measured on the season, 1.07 on the last 40). The flat spread and the study's sum reading a
little better than the blend are within the noise of 40 to 173 games: left for a refit once the season has ~400 graded
games. Projections already stored keep their values; the scorecard grades the new level from tonight.
