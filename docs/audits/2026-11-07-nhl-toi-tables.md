# Projected minutes: the line and the power plays (tables)

56,445 skater-games, 3,136 team-games; graded: 51,780 skater-games with 5+ games before (42,815 in 20252026, 8,965 in 20262027). A power play lasts 1.64 minutes on average; the league's power plays a team-game: 20252026 2.88, 20262027 3.19.

## A. Minutes a game by line

As played (tonight's even-strength rank inside the team: forwards in threes, defencemen in pairs):

| slot | toi | ev | pp | sh |
| --- | --- | --- | --- | --- |
| D1 | 23.22 | 20.13 | 1.33 | 1.77 |
| D2 | 19.97 | 17.28 | 0.87 | 1.82 |
| D3 | 14.92 | 13.26 | 0.42 | 1.24 |
| F1 | 19.44 | 16.23 | 2.49 | 0.71 |
| F2 | 16.71 | 13.96 | 1.86 | 0.88 |
| F3 | 14.09 | 11.95 | 1.28 | 0.87 |
| F4 | 10.46 | 9.09 | 0.64 | 0.72 |

As projected before the game (the rank of his last-10 even-strength minutes among tonight's dressed):

| slot | toi | ev | pp | sh |
| --- | --- | --- | --- | --- |
| D1 | 22.65 | 19.23 | 1.56 | 1.86 |
| D2 | 19.88 | 17.35 | 0.75 | 1.78 |
| D3 | 15.55 | 14.09 | 0.29 | 1.17 |
| F1 | 18.96 | 15.42 | 2.82 | 0.72 |
| F2 | 16.58 | 13.77 | 1.88 | 0.93 |
| F3 | 14.09 | 12.15 | 1.11 | 0.83 |
| F4 | 11.02 | 9.90 | 0.41 | 0.71 |

The projected slot is the played one for 53% of forwards and 61% of defencemen.

By power-play role (his share of the team's power-play minutes over his last 10: PP1 ≥ 45%, PP2 ≥ 15%):

| posK | role | toi | ev | pp | sh |
| --- | --- | --- | --- | --- | --- |
| D | PP1 | 23.24 | 18.97 | 2.97 | 1.30 |
| D | PP2 | 20.72 | 17.89 | 1.41 | 1.42 |
| D | none | 17.99 | 16.09 | 0.14 | 1.76 |
| F | PP1 | 18.39 | 14.72 | 3.09 | 0.58 |
| F | PP2 | 14.95 | 12.83 | 1.44 | 0.68 |
| F | none | 12.40 | 11.09 | 0.20 | 1.11 |

## B. What one more power play or kill does to a skater's minutes (as it happened)

Least squares of tonight's minutes on the team's actual power plays and kills, his last 10 as the base.

| pos | role | total / PP | total / kill | PP min / PP | EV min / PP | EV min / kill | n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D | PP1 | 0.14 | -0.11 | 0.95 | -0.76 | -0.48 | 2973 |
| D | PP2 | -0.13 | -0.06 | 0.45 | -0.55 | -0.47 | 3473 |
| D | none | -0.42 | 0.12 | 0.05 | -0.42 | -0.46 | 10931 |
| F | PP1 | 0.39 | -0.20 | 0.98 | -0.56 | -0.33 | 12212 |
| F | PP2 | 0.09 | -0.20 | 0.48 | -0.38 | -0.37 | 10109 |
| F | none | -0.14 | -0.07 | 0.07 | -0.20 | -0.42 | 12082 |

## C. The matchup's power plays, foreseen

| season | corr(forecast, actual) | MAE forecast | MAE league mean | forecast p5 | forecast p95 |
| --- | --- | --- | --- | --- | --- |
| 20252026 | 0.11 | 1.11 | 1.11 | 2.71 | 3.21 |
| 20262027 | 0.08 | 1.13 | 1.13 | 2.97 | 3.42 |

First-unit forwards by fifth of the forecast (tonight's minutes against his last 10):

| fifth | forecast PP | actual PP | toi − L10 | PP min − L10 | n |
| --- | --- | --- | --- | --- | --- |
| 1 | 2.76 | 2.69 | -0.15 | 0.03 | 2444 |
| 2 | 2.89 | 2.78 | -0.15 | -0.09 | 2441 |
| 3 | 2.98 | 2.87 | -0.01 | -0.08 | 2445 |
| 4 | 3.09 | 3.01 | -0.15 | -0.16 | 2442 |
| 5 | 3.25 | 3.24 | -0.11 | -0.14 | 2440 |

## D. The projections, scored (minutes; the fits on 20252026, scored unchanged on 20262027)

| read | 20252026 MAE | 20252026 bias | 20262027 MAE | 20262027 bias |
| --- | --- | --- | --- | --- |
| his last 10 | 1.90 | -0.01 | 1.97 | 0.04 |
| his last 5 | 1.92 | -0.01 | 1.96 | 0.05 |
| the model now, projected slot (max(L5, floor)) | 2.02 | 0.57 | 2.09 | 0.63 |
| the model now, slot as played (max(L5, floor)) | 1.86 | 0.82 | 1.91 | 0.87 |
| split: EV L10 + PP share × league PP min + kill share × league PK min | 1.90 | -0.01 | 1.97 | 0.02 |
| split: … × the matchup's PP / PK minutes | 1.90 | -0.02 | 1.97 | 0.02 |
| split: … × the actual PP / PK minutes (hindsight) | 1.85 | -0.01 | 1.93 | 0.03 |
| fit: L10 + L5 | 1.88 | -0.00 | 1.94 | 0.06 |
| fit: + projected slot | 1.87 | -0.00 | 1.94 | 0.06 |
| fit: + projected slot + PP role × matchup | 1.87 | 0.00 | 1.93 | 0.06 |
| fit: + slot as played (ceiling) | 1.50 | -0.00 | 1.56 | 0.06 |
| fit: + slot as played + PP role (league PP min) | 1.46 | -0.00 | 1.51 | 0.06 |
| fit: + slot as played + PP role × matchup | 1.46 | -0.00 | 1.51 | 0.04 |
| fit: + slot as played + PP role × actual PP (hindsight) | 1.37 | 0.00 | 1.42 | 0.04 |

- fit: + projected slot + PP role × matchup: Intercept +1.244, toiL10 +0.365, toiL5 +0.403, slotMeanPre +0.160, I(ppShare * ePPmin) +0.151, I(shShare * ePKmin) +0.199, ePPmin -0.010, ePKmin -0.084
- fit: + slot as played (ceiling): Intercept -1.930, toiL10 +0.300, toiL5 +0.241, slotMeanReal +0.575
- fit: + slot as played + PP role (league PP min): Intercept -1.095, toiL10 +0.110, toiL5 +0.239, slotMeanReal +0.635, ppShare +2.697, shShare +2.760

## E. A skater who played a different slot than his recent minutes say (20262027)

| moved | n | toi | L10 | model_now | fit_with_slot |
| --- | --- | --- | --- | --- | --- |
| down | 2051 | 15.72 | 17.60 | 17.59 | 15.82 |
| same | 4866 | 16.69 | 16.71 | 17.33 | 16.71 |
| up | 2048 | 17.28 | 15.50 | 17.69 | 17.42 |

## F. The refit on the posted lines (20262027)

The lines each team-game was posted with, rebuilt from GameDayTweets by the site's reader (`latestTeamLines`, the newest lines tweet from the day before up to 10 minutes past puck drop; tools/audit/nhl-toi-lines.mjs): 443 team-games read from a tweet, 62 carried over from the last game, 7 with none. 92.7% of the 9,169 skater-games (1+ game before) found their skater in the lines.

The posted line is the played one (tonight's even-strength rank) for 50% of forwards and 57% of defencemen; the slot read from his recent minutes managed 53% / 61% (section A).

Minutes by posted line:

| lineKey | n | toi | L5 | season | ev | pp |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | 931 | 22.30 | 22.00 | 21.86 | 18.64 | 1.55 |
| D2 | 948 | 19.84 | 19.78 | 19.78 | 17.19 | 0.65 |
| D3 | 879 | 15.54 | 16.08 | 15.85 | 13.98 | 0.48 |
| F1 | 1475 | 18.36 | 18.14 | 18.20 | 14.84 | 2.92 |
| F2 | 1455 | 16.56 | 16.46 | 16.44 | 13.55 | 2.23 |
| F3 | 1433 | 14.47 | 14.50 | 14.45 | 12.20 | 1.27 |
| F4 | 1380 | 11.32 | 11.76 | 11.53 | 9.97 | 0.33 |

Fitted on the games before 2026-10-24 (5,210 skater-games), scored from it (3,291):

| read | MAE | bias |
| --- | --- | --- |
| his last 5 | 1.89 | 0.10 |
| his season | 1.87 | -0.00 |
| the model now: max(L5, line floor) | 2.08 | 0.84 |
| fit: L5 + season | 1.86 | 0.07 |
| fit: L5 + season + posted line | 1.82 | 0.05 |
| fit: L5 + season + posted line, own slopes F / D | 1.82 | 0.05 |
| fit: + PP / PK share (not in the model's inputs) | 1.81 | 0.04 |

Skaters the posted lines moved off the slot their recent minutes say (scored half):

| moved | n | toi | L5 | model_now | fit |
| --- | --- | --- | --- | --- | --- |
| down | 697 | 17.16 | 17.55 | 17.58 | 16.99 |
| same | 1962 | 16.33 | 16.48 | 17.08 | 16.40 |
| up | 632 | 16.53 | 16.12 | 18.09 | 16.75 |

Refitted on all 8,501 skater-games with a posted line, the read to ship: Intercept +5.039, C(lineKey)[T.D2] -0.778, C(lineKey)[T.D3] -2.059, C(lineKey)[T.F1] -0.994, C(lineKey)[T.F2] -1.435, C(lineKey)[T.F3] -1.966, C(lineKey)[T.F4] -2.878, toiL5 +0.345, toiSeason +0.442 (R² 0.708; residual sd 2.46 min).

As per-line constants (the intercept, D1's, plus the line's term): F1 4.05, F2 3.60, F3 3.07, F4 2.16, D1 5.04, D2 4.26, D3 2.98; toi = that + 0.345 · L5 + 0.442 · season.

The model's minute gates (tags, lanes, floors), by posted line: the share of skaters over each, as played and under each read:

| line | gate (min) | played over | old rule over | refit over |
| --- | --- | --- | --- | --- |
| F1 | 15.50 | 83% | 100% | 89% |
| F1 | 17.00 | 69% | 100% | 76% |
| F1 | 18.50 | 50% | 100% | 52% |
| F2 | 14.00 | 81% | 100% | 90% |
| F2 | 15.00 | 70% | 100% | 79% |
| F2 | 16.00 | 58% | 100% | 63% |
| F3 | 12.00 | 82% | 100% | 93% |
| F3 | 13.50 | 65% | 100% | 72% |
| F4 | 10.50 | 62% | 100% | 67% |
| F4 | 11.50 | 48% | 55% | 46% |
| D1 | 20.50 | 70% | 100% | 80% |
| D1 | 21.00 | 64% | 100% | 73% |
| D1 | 23.00 | 41% | 34% | 35% |
| D2 | 19.00 | 64% | 65% | 69% |
| D2 | 20.00 | 49% | 46% | 49% |

