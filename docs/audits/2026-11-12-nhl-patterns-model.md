# Patterns: how the rules did, the re-mine, and the 3+ SOG model (NHL, 2026-10-02 to 2026-11-11)

Vincent, 2026-11-12: "how are the patterns performing for NHL?", then "the season started in the first week of
October … we have way more games already", then "ship the re-mined rules and add the model for 3+ SOG".
Games: the public box scores of every game Oct 1 – Nov 11 (290 games, 9,676 skater-games with a game behind them),
built with `tools/predictors/fetch.mjs` → `faceoffs.mjs` → `relabel.py` → `patterns-rows.mjs`.

## 1. The rules as shipped on Oct 30, on the 13 nights after (Oct 30 – Nov 11, 3,028 skater-games)

`patternRecord` (the site's own record) on the rules built through Oct 29, frozen:

| Line | Base | Filled pills | Said | Landed | Bar |
| --- | --- | --- | --- | --- | --- |
| 3+ SOG | 22% | 447 | 60% | 48% (216) | 50% |
| 4+ SOG | 10% | 212 | 40% | 33% (71) | 33% |
| 5+ SOG | 4.5% | 141 | 22% | 13% (19) | 20% |
| 6+ SOG | 2.2% | 97 | 16% | 20% (19) | 11% |
| 1+ goal | 15% | 235 | 40% | 33% (77) | 35% |
| 2+ goals | 2.0% | 59 | 12% | 17% (10) | 9% |

The pills pick (2–9× the base rate) but say too much: 60% said on 3+ SOG for 48% landed, 40% on goals for 33%. The
goal rules claimed 40–49% and landed 25–37%. The top of the night held for shots: the best 3+ SOG pill landed 8 of 13
nights, the top 3 27 of 39 (69%); the 4+ SOG top 3 44%.

## 2. The whole season, walk-forward (35 nights, Oct 8 – Nov 11, 8,607 skater-games)

`patterns_backtest.py --from 2026-10-08` (rules re-mined weekly, the model retrained every morning); the full tables
in `2026-11-12-nhl-season-backtest.md`.

| Line | Base | Filled pills | Pills top 3 a night | Model top 3 | Volume top 3 | Ceiling top 3 |
| --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 22% | 47% (487/1032), 30 a night | 54% | 57% (top 1: 71%) | 60% | 57% |
| 4+ SOG | 10% | 30% (144/485) | 38% | 34% | 39% | 30% |
| 1+ goal | 15% | 32% (169/524) | 41% | 38% | 35% | 35% |

Same answer as the 13 nights: the filled pills sit at or just under the bar on 3+ / 4+ SOG and 1+ goal. On 3+ SOG the
model on every figure is the better read (its 60%+ calls 62%, 178 of 287); on goals nothing separates.

## 3. The re-mine (shipped)

`patterns.py <csv> 2026-10-22`: searched on Oct 2–21 (4,515 skater-games), checked on Oct 22 – Nov 11 (5,161), written
to `lib/nhl-data/patterns-rules.json` (`builtThrough` 2026-11-11); the tables in `2026-11-12-nhl-patterns.md`. The
check kept 88% / 99% / 100% / 100% of the lift for 3+ / 4+ / 5+ / 6+ SOG (105 / 106 / 67 / 47 rules held) and 82% /
96% for 1+ / 2+ goals (84 of 105 held at 1+ goal, the weakest line). 5+ SOG now has 6 rules over its bar (1 before).

## 4. The 3+ SOG model (shipped)

`tools/predictors/patterns_model.py`: the backtest's model (logistic regression, C 0.05, on the standardised figures +
boosted trees, depth 3, 200 rounds, averaged) on the 239 figures and his position, exported as JSON
(`lib/nhl-data/patterns-model.json`) and scored on the site by `lib/nhl-data/patterns-model-pure.js` (matches
scikit-learn to 3e-6 on 3,028 rows). The site does not retrain: the fit is frozen between refits, so it was graded
frozen:

| Fitted through, graded on | ≥ 50% calls | ≥ 60% | ≥ 70% | Top 1 / 3 / 5 a night |
| --- | --- | --- | --- | --- |
| Oct 21, Oct 22 – Nov 11 (21 nights) | 57% (247/435, said 60%) | 63% (122/193, said 68%) | 69% (41/59, said 75%) | 76% / 63% / 62% |
| Oct 29, Oct 30 – Nov 11 (13 nights) | 59% (149/251, said 60%) | 65% (71/109, said 67%) | 61% (19/31, said 74%) | 62% / 56% / 60% |

Said against landed within 3 points in every band up to 60% (5–6 points high above it). On the same 13 nights the
frozen rules' 3+ SOG pills landed 48%. The regression and the trees alone each did a little worse than the average.
The shipped fit is every skater-game through Nov 11 (9,676); its JSON carries the Oct 29 check.

## The frozen check, as written by patterns_model.py


Fitted on 6648 skater-games (to 2026-10-29), graded on 3028 over 13 nights the fit never saw, the model as it stood (no refit). Base rate 22%.

| Read | ≥ 50% | ≥ 60% | ≥ 70% | Top 1 | Top 3 | Top 5 | Top 10 | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Model (average) | 59% (149/251, said 60%) | 65% (71/109, said 67%) | 61% (19/31, said 74%) | 62% (8/13) | 56% (22/39) | 60% (39/65) | 62% (81/130) | 0.1442 |
| Regression alone | 55% (158/286, said 63%) | 59% (92/157, said 70%) | 66% (44/67, said 77%) | 62% (8/13) | 67% (26/39) | 60% (39/65) | 58% (76/130) | 0.1475 |
| Trees alone | 60% (148/246, said 59%) | 64% (56/88, said 66%) | 40% (6/15, said 75%) | 46% (6/13) | 56% (22/39) | 65% (42/65) | 62% (81/130) | 0.1440 |

**Said against landed** (the average):

| Said | Skater-games | Said (mean) | Landed |
| --- | --- | --- | --- |
| 0%–10% | 715 | 7% | 6% |
| 10%–20% | 915 | 15% | 12% |
| 20%–30% | 520 | 25% | 25% |
| 30%–40% | 391 | 35% | 31% |
| 40%–50% | 236 | 45% | 41% |
| 50%–60% | 142 | 54% | 55% |
| 60%–70% | 78 | 65% | 67% |
| 70%–100% | 31 | 74% | 61% |

The shipped model is fitted on every skater-game through 2026-11-11 (9676).
