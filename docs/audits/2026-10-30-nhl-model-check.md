# Does the model still work? NHL Model 3.0 on this season's games (2026-10-08 to 2026-10-29)

Vincent, 2026-10-30: "I have a model in place already. I want you to test it whether the model still works on this
season's games." Source: the site's scorecard export of Oct 30 (`/api/nhl/data/scorecard?from=2026-10-01&rows=1`):
158 games, 5,371 skater-games, each graded against the newest run saved before its puck drop. The runs projected 100
other skaters who did not play; those are not graded. Script: `tools/predictors/model_check.py`.

## The answer

**It still ranks the night right. Its percentages run too high, by 10–25 points at the top for shots and by half or
more for goals.**

| Line | When the model says | It lands | Calls | Verdict |
| --- | --- | --- | --- | --- |
| 3+ SOG | 60%+ (says 73% on average) | **57%** | 327, 15 a night | ranks well, overstates by ~15 pts |
| 3+ SOG | 70%+ (says 80%) | **64%** | 188, 8.5 a night | |
| 3+ SOG | 80%+ (says 86%) | **61%** | 83, 3.8 a night | no better than its 70% calls |
| 3+ SOG | its top pick a night (says 87%) | **73%** | 16 of 22 | the best single read it has |
| 4+ SOG | 50%+ (says 61%) | **43%** | 151, 7 a night | overstates by ~18 pts |
| 5+ SOG | 30%+ (says 40%) | **27%** | 136, 6 a night | overstates by ~13 pts |
| 1+ goal | 35%+ (says 50%) | **25%** | 738, 33 a night | **does not hold**: half what it says |
| 1+ goal | 55%+ (says 61%) | **26%** | 250, 11 a night | its highest goal calls land like its 35% ones |

- **The order is right.** For 3+ SOG the higher it rates a skater, the more often he gets there, up to about 70%. Its
  top pick a night landed 73%, its top three 61%. Below 50% its figures are honest, a little low at the bottom: its
  under-10% calls landed 11%.
- **The top end is too confident.** Calls it rates 60–70% land 47%, calls at 80%+ land 61%. 4+ and 5+ SOG overstate
  the same way. This is the λ's spread: the Poisson tail of a projection says more than a shooter's real nights do.
- **The goal figure is broken this season.** Its 50–60% goal calls landed 18%, and its 35%+ calls 25%. The first week
  was worst: 54% said and 19% landed on 388 calls. Later weeks improved (47% → 32%, 44% → 36%) but never reached what
  it says. Best bets has not shown this figure since Oct 27: it reads 1+ goal off the study (`studyWeightGoals`).
- **The study's read is the honest one** on the same skater-games: 1+ goal at 35%+ said 40% and landed 37%; 3+ SOG at
  60%+ said 68% and landed 60%; at 70%+ it said 76% and landed 63%. Its shots land like the model's but say it straight.
- **The model's own "best market" per skater**: 3+ shots at 50%+ said 72% and landed 52%; anytime goal at 50%+ said
  57% and landed 18%; 1+ point at 50%+ said 67% and landed 56%.

What would make its percentages honest without touching the math: a calibration step on its published figure, learned
from this season's graded runs and renewed as games come in (its 80% mapped to the ~62% it lands). The run's goal
figure should stay off the board; the study's carries the goals.

## The tables

- This season: 2026-10-08 to 2026-10-29, 158 games, 5371 graded skater-games (the newest run saved before each puck drop).

## 3+ SOG

|  | Calls | Said on average | Landed | Brier |
| --- | --- | --- | --- | --- |
| This season | 5371 | 19% | 22% | 0.1583 |

**Said against landed, by the chance it gave:**

| Its chance | This season |
| --- | --- |
| 0–10% | said 4% · landed 11% (281/2544) |
| 10–20% | said 15% · landed 21% (208/971) |
| 20–30% | said 24% · landed 27% (169/615) |
| 30–40% | said 34% · landed 32% (152/482) |
| 40–50% | said 44% · landed 38% (84/220) |
| 50–60% | said 55% · landed 47% (99/212) |
| 60–70% | said 65% · landed 47% (65/139) |
| 70–80% | said 75% · landed 66% (69/105) |
| 80–100% | said 86% · landed 61% (51/83) |

**Its confident calls:**

| Calls at | This season |
| --- | --- |
| 50%+ | said 66% · landed 53% (284/539), 24.5 a night |
| 60%+ | said 73% · landed 57% (185/327), 14.9 a night |
| 70%+ | said 80% · landed 64% (120/188), 8.5 a night |
| 80%+ | said 86% · landed 61% (51/83), 3.8 a night |

| Its best picks | This season |
| --- | --- |
| Top 1 a night | said 87% · landed 73% (16/22) |
| Top 3 a night | said 83% · landed 61% (40/66) |
| Top 5 a night | said 79% · landed 55% (60/110) |

**This season, week by week** (every call, and the calls at 50%+):

| Week of | Calls | Said | Landed | At 50%+ |
| --- | --- | --- | --- | --- |
| Oct 05 | 1048 | 20% | 21% | said 70% · landed 44% (46/104) |
| Oct 12 | 1701 | 18% | 22% | said 65% · landed 54% (89/166) |
| Oct 19 | 1624 | 19% | 23% | said 65% · landed 59% (97/165) |
| Oct 26 | 998 | 19% | 22% | said 66% · landed 50% (52/104) |

## 4+ SOG

|  | Calls | Said on average | Landed | Brier |
| --- | --- | --- | --- | --- |
| This season | 5371 | 9% | 10% | 0.0853 |

**Said against landed, by the chance it gave:**

| Its chance | This season |
| --- | --- |
| 0–10% | said 2% · landed 6% (241/3968) |
| 10–20% | said 14% · landed 13% (84/654) |
| 20–30% | said 25% · landed 20% (57/280) |
| 30–40% | said 35% · landed 28% (60/213) |
| 40–50% | said 44% · landed 30% (31/105) |
| 50–60% | said 55% · landed 41% (34/82) |
| 60–70% | said 64% · landed 44% (21/48) |
| 70–80% | said 73% · landed 45% (9/20) |
| 80–100% | said 82% · landed 100% (1/1) |

**Its confident calls:**

| Calls at | This season |
| --- | --- |
| 30%+ | said 45% · landed 33% (156/469), 21.3 a night |
| 40%+ | said 54% · landed 38% (96/256), 11.6 a night |
| 50%+ | said 61% · landed 43% (65/151), 6.9 a night |

| Its best picks | This season |
| --- | --- |
| Top 1 a night | said 69% · landed 41% (9/22) |
| Top 3 a night | said 63% · landed 38% (25/66) |
| Top 5 a night | said 58% · landed 33% (36/110) |

**This season, week by week** (every call, and the calls at 30%+):

| Week of | Calls | Said | Landed | At 30%+ |
| --- | --- | --- | --- | --- |
| Oct 05 | 1048 | 8% | 10% | said 46% · landed 34% (24/70) |
| Oct 12 | 1701 | 9% | 10% | said 44% · landed 32% (49/153) |
| Oct 19 | 1624 | 9% | 10% | said 46% · landed 36% (53/147) |
| Oct 26 | 998 | 9% | 10% | said 46% · landed 30% (30/99) |

## 5+ SOG

|  | Calls | Said on average | Landed | Brier |
| --- | --- | --- | --- | --- |
| This season | 5371 | 4% | 4% | 0.0391 |

**Said against landed, by the chance it gave:**

| Its chance | This season |
| --- | --- |
| 0–10% | said 1% · landed 3% (134/4789) |
| 10–20% | said 15% · landed 11% (35/310) |
| 20–30% | said 24% · landed 17% (23/136) |
| 30–40% | said 35% · landed 29% (22/75) |
| 40–50% | said 44% · landed 20% (10/50) |
| 50–60% | said 53% · landed 25% (2/8) |
| 60–70% | said 63% · landed 100% (3/3) |

**Its confident calls:**

| Calls at | This season |
| --- | --- |
| 20%+ | said 32% · landed 22% (60/272), 12.4 a night |
| 30%+ | said 40% · landed 27% (37/136), 6.2 a night |

| Its best picks | This season |
| --- | --- |
| Top 1 a night | said 47% · landed 32% (7/22) |
| Top 3 a night | said 41% · landed 23% (15/66) |
| Top 5 a night | said 36% · landed 19% (21/110) |

**This season, week by week** (every call, and the calls at 20%+):

| Week of | Calls | Said | Landed | At 20%+ |
| --- | --- | --- | --- | --- |
| Oct 05 | 1048 | 2% | 4% | said 30% · landed 19% (3/16) |
| Oct 12 | 1701 | 4% | 4% | said 32% · landed 27% (24/88) |
| Oct 19 | 1624 | 4% | 4% | said 34% · landed 24% (23/96) |
| Oct 26 | 998 | 4% | 4% | said 31% · landed 14% (10/72) |

## 1+ goal

|  | Calls | Said on average | Landed | Brier |
| --- | --- | --- | --- | --- |
| This season | 5371 | 16% | 15% | 0.1369 |

**Said against landed, by the chance it gave:**

| Its chance | This season |
| --- | --- |
| 0–10% | said 5% · landed 9% (251/2659) |
| 10–20% | said 14% · landed 18% (216/1230) |
| 20–30% | said 24% · landed 22% (132/597) |
| 30–40% | said 35% · landed 30% (83/279) |
| 40–50% | said 45% · landed 29% (63/217) |
| 50–60% | said 54% · landed 18% (48/264) |
| 60–70% | said 64% · landed 30% (37/125) |

**Its confident calls:**

| Calls at | This season |
| --- | --- |
| 35%+ | said 50% · landed 25% (185/738), 33.5 a night |
| 45%+ | said 55% · landed 24% (119/497), 22.6 a night |
| 55%+ | said 61% · landed 26% (65/250), 11.4 a night |

| Its best picks | This season |
| --- | --- |
| Top 1 a night | said 58% · landed 27% (6/22) |
| Top 3 a night | said 54% · landed 35% (23/66) |
| Top 5 a night | said 52% · landed 38% (42/110) |

**This season, week by week** (every call, and the calls at 35%+):

| Week of | Calls | Said | Landed | At 35%+ |
| --- | --- | --- | --- | --- |
| Oct 05 | 1048 | 28% | 14% | said 54% · landed 19% (72/388) |
| Oct 12 | 1701 | 16% | 15% | said 47% · landed 32% (86/268) |
| Oct 19 | 1624 | 12% | 16% | said 44% · landed 36% (21/58) |
| Oct 26 | 998 | 11% | 16% | said 41% · landed 25% (6/24) |

## The model’s best market per skater

Every row carries the market the model rates best for that skater (`best`, with its own chance): graded on that market, by the chance it gave.

|  | Market | Skaters | Said | Landed | Rated 50%+ |
| --- | --- | --- | --- | --- | --- |
| This season | 1+ point | 3923 | 34% | 35% (1384/3923) | said 67% · landed 56% (464/831) |
| This season | 3+ shots | 1033 | 40% | 30% (310/1033) | said 72% · landed 52% (178/344) |
| This season | 4+ shots | 65 | 8% | 2% (1/65) | — |
| This season | Anytime goal | 350 | 41% | 15% (51/350) | said 57% · landed 18% (28/158) |

## Beside it: the study’s read on the same skater-games

Best bets has read 1+ goal off the study (`studyG`) since 2026-10-27; its shots stay on the run’s λ unless NHL_PICKS_STUDY_WEIGHT is set. Poisson tails of the study’s λ, graded the same way.

| Line | Calls at | The study | The model (same rows) |
| --- | --- | --- | --- |
| 3+ SOG | 50%+ | said 61% · landed 55% (233/423) | said 66% · landed 53% (284/536) |
| 3+ SOG | 60%+ | said 68% · landed 60% (109/182) | said 73% · landed 57% (185/327) |
| 3+ SOG | 70%+ | said 76% · landed 63% (44/70) | said 80% · landed 64% (120/188) |
| 4+ SOG | 30%+ | said 40% · landed 34% (126/366) | said 45% · landed 33% (156/468) |
| 4+ SOG | 40%+ | said 50% · landed 40% (56/139) | said 54% · landed 38% (96/256) |
| 4+ SOG | 50%+ | said 58% · landed 45% (26/58) | said 61% · landed 43% (65/151) |
| 1+ goal | 35%+ | said 40% · landed 37% (82/222) | said 50% · landed 25% (182/724) |
| 1+ goal | 45%+ | said 48% · landed 38% (10/26) | said 55% · landed 24% (118/487) |
