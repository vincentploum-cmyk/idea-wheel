# The season backtest: how close to 100% can shots and goals picks get? (NHL, 2026-10-02 to 2026-10-29)

Vincent, 2026-10-30: "did you backtest and improve / combine rules to get as close as possible to 100% for shots /
goals?", then "just backtest it on all games of the 26/27 season", after a slip of four anytime scorers on Oct 29
(Sennecke, Benson, Jack Quinn, Celebrini) picked on the environment and whether the player was on a streak.

Script: `tools/predictors/patterns_backtest.py`. Every night from Oct 8 to Oct 29 (22 nights, 5,579 skater-games) is
graded with what was known that morning:

- **Pills**: the Patterns rules, re-mined every week on the weeks before it, read as the site reads them.
- **Model**: a logistic regression and gradient-boosted trees on all 239 figures, averaged, retrained every morning on
  every game before it. This is the "combine everything" read.
- **Volume alone**: his shots a game (shot lines) or chances a game (goals).
- **Environment + streak**: Vincent's way, in several spellings, graded on every night of the season (it needs no training).
- **Hindsight ceiling**: Poisson at each skater's true rate over the whole season, his future games included. Nothing
  that reads the morning can beat it; it is what is left once only the night's own luck remains.

The season's first six nights are left out of the first four, since every skater had 0–3 games behind his numbers.

## The answer

**100% is not on the table, for any read.** Knowing every skater's true rate (the ceiling), the best three a night land
3+ SOG 61% of the time and 1+ goal 35%. A 4-shot-a-game shooter still finishes under three about a quarter of his
nights. The reads below sit close to that ceiling already.

| Line | Base | Model: its 60%+ calls | Model: top 3 a night | Ceiling: top 3 a night | Pills: filled | Pills: top 3 a night |
| --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 22% | **61%** (106/173, 8 a night); 70%+: **66%** (27/41, 2 a night) | 56% (37/66) | 61% (40/66) | 46% (303/663, 30 a night) | 53% (35/66) |
| 4+ SOG | 10% | — | 33% (22/66) | 38% (25/66) | 34% (51/148) | 33% (22/66) |
| 1+ goal | 15% | 50%+: 39% (14/36, 2 a night) | 39% (26/66) | 35% (23/66) | 33% (86/260) | 41% (27/66) |

1. **Combining every figure beats the rules on shots.** On 3+ SOG the model's calls are calibrated: its 50%+ calls
   landed 55%, its 60%+ 61%, its 70%+ 66%. Its top ten a night landed 58%, against 52% for the pills. Re-mined every
   week on less data, the pills ran high: their 50%+ picks landed 46%, on 30 a night.
2. **On goals nothing separates.** Pills, model, volume and the ceiling all land 33–41% at the top of the night. A goal
   is a coin flip weighted to about one in three for the best scorers, whatever the read.
3. **The rare lines** top out, for the best pick of the night, at about 23% for 5+ SOG, 9–18% for 6+ and 5–14% for
   2+ goals, the ceiling included.

## Environment + streak

Over the season, for **goals**, the environment adds about a point on top of the run:
- a goal last game: 21%;
- a goal last game against a top-10 opponent at his position: 22%;
- a forward with 2+ shots a game on a 2+ point run: 29%, and 30% against a top-10 opponent at his position.

The run carries the read because it marks the better scorers. The soft opponent alone is the base rate, 15%.

For **shots** the environment is worth something:
- 3+ SOG in two straight: 41%;
- the same against an opponent in the top 10 for high-danger chances allowed to his position over its last five: **50%**
  (60/120, about 4 a night; with 2.5+ shots a game, 50% on 3 a night);
- 2+ SOG in three straight against a top-10 shots-against team over its last five: 45%.

## The slip of Oct 29

Sennecke, Benson and Jack Quinn scored in BUF's 7–6 win at ANA; Celebrini had 6 shots and no goal. The first cut of
the study had missed that game (pulled before it was final); the backtest and the rules now carry all 148 games.

Three of the four carried the night's top 1+ goal pill (43% on that week's re-mined rules, a tie at the top):
Sennecke, Quinn and Celebrini. Benson read 36%. The model had them 9th to 33rd of the night. By the pills the four
landing together was about a 3% shot, once in 35 nights, so the night says little about the method; the season
table above is the test. By it the run (and volume
behind it) does the work for goals, and the opponent's chances allowed adds to it for shots.

## The full tables

Graded: every night from 2026-10-08 to 2026-10-29 (22 nights, 5579 skater-games), each with what was known that morning: the models retrained on every game before it, the Patterns rules re-mined every week on the weeks before it. The season’s first 6 nights (1069 skater-games, every skater 0–3 games in) are graded only for the reads that need no training, the env+streak table. Hindsight = Poisson at his true rate over the whole season, his future games in: the ceiling.

## In short

| Line | Base | Filled pills | Pills: top 1 a night | Model: top 1 | Model: top 3 | Ceiling: top 1 | Ceiling: top 3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 22% | 46% (303/663) | 55% (12/22) | 77% (17/22) | 56% (37/66) | 50% (11/22) | 61% (40/66) |
| 4+ SOG | 10% | 34% (51/148) | 45% (10/22) | 27% (6/22) | 33% (22/66) | 32% (7/22) | 38% (25/66) |
| 5+ SOG | 4% | — | 23% (5/22) | 23% (5/22) | 23% (15/66) | 23% (5/22) | 24% (16/66) |
| 6+ SOG | 2% | — | 9% (2/22) | 18% (4/22) | 11% (7/66) | 14% (3/22) | 12% (8/66) |
| 1+ goal | 15% | 33% (86/260) | 41% (9/22) | 36% (8/22) | 39% (26/66) | 41% (9/22) | 35% (23/66) |
| 2+ goals | 2% | — | 5% (1/22) | 14% (3/22) | 11% (7/66) | 0% (0/22) | 8% (5/66) |

## 3+ SOG

Base rate on the graded nights 22% (1209 of 5579). The filled pills: 46% (303/663), 30.1 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 55% (12/22) | 53% (35/66) | 50% (55/110) | 52% (115/220) |
| Model (all figures) | 77% (17/22) | 56% (37/66) | 56% (62/110) | 58% (127/220) |
| Volume alone | 55% (12/22) | 59% (39/66) | 55% (61/110) | 50% (110/220) |
| Hindsight ceiling | 50% (11/22) | 61% (40/66) | 56% (62/110) | 55% (122/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | 46% (303/663), 30.1/night | 52% (67/128), 5.8/night | — |
| Model (all figures) | 55% (222/405), 18.4/night | 61% (106/173), 7.9/night | 66% (27/41), 1.9/night |
| Hindsight ceiling | 53% (278/522), 23.7/night | 55% (127/233), 10.6/night | 60% (58/96), 4.4/night |

## 4+ SOG

Base rate on the graded nights 10% (551 of 5579). The filled pills: 34% (51/148), 6.7 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 45% (10/22) | 33% (22/66) | 31% (34/110) | 27% (60/220) |
| Model (all figures) | 27% (6/22) | 33% (22/66) | 34% (37/110) | 31% (68/220) |
| Volume alone | 32% (7/22) | 38% (25/66) | 36% (40/110) | 29% (64/220) |
| Hindsight ceiling | 32% (7/22) | 38% (25/66) | 32% (35/110) | 33% (72/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | 42% (19/45), 2.0/night | 46% (6/13), 0.6/night | 75% (3/4), 0.2/night |
| Hindsight ceiling | 46% (40/87), 4.0/night | 32% (10/31), 1.4/night | 0% (0/4), 0.2/night |

## 5+ SOG

Base rate on the graded nights 4% (234 of 5579). The filled pills: —, 0.0 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 23% (5/22) | 12% (8/66) | 11% (12/110) | 14% (30/220) |
| Model (all figures) | 23% (5/22) | 23% (15/66) | 18% (20/110) | 18% (39/220) |
| Volume alone | 23% (5/22) | 24% (16/66) | 20% (22/110) | 15% (34/220) |
| Hindsight ceiling | 23% (5/22) | 24% (16/66) | 18% (20/110) | 17% (37/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | 43% (3/7), 0.3/night | 50% (2/4), 0.2/night | — |
| Hindsight ceiling | 33% (2/6), 0.3/night | — | — |

## 6+ SOG

Base rate on the graded nights 2% (99 of 5579). The filled pills: —, 0.0 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 9% (2/22) | 6% (4/66) | 6% (7/110) | 6% (14/220) |
| Model (all figures) | 18% (4/22) | 11% (7/66) | 11% (12/110) | 9% (19/220) |
| Volume alone | 9% (2/22) | 12% (8/66) | 11% (12/110) | 9% (20/220) |
| Hindsight ceiling | 14% (3/22) | 12% (8/66) | 10% (11/110) | 10% (21/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | — | — | — |
| Hindsight ceiling | — | — | — |

## 1+ goal

Base rate on the graded nights 15% (847 of 5579). The filled pills: 33% (86/260), 11.8 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 41% (9/22) | 41% (27/66) | 35% (38/110) | 32% (71/220) |
| Model (all figures) | 36% (8/22) | 39% (26/66) | 37% (41/110) | 33% (73/220) |
| Volume alone | 41% (9/22) | 30% (20/66) | 33% (36/110) | 32% (71/220) |
| Hindsight ceiling | 41% (9/22) | 35% (23/66) | 35% (39/110) | 31% (68/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | 38% (20/52), 2.4/night | — | — |
| Model (all figures) | 39% (14/36), 1.6/night | 17% (1/6), 0.3/night | — |
| Hindsight ceiling | 34% (40/118), 5.4/night | 46% (6/13), 0.6/night | — |

## 2+ goals

Base rate on the graded nights 2% (115 of 5579). The filled pills: —, 0.0 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 5% (1/22) | 5% (3/66) | 5% (5/110) | 3% (7/220) |
| Model (all figures) | 14% (3/22) | 11% (7/66) | 8% (9/110) | 7% (16/220) |
| Volume alone | 5% (1/22) | 3% (2/66) | 3% (3/110) | 7% (15/220) |
| Hindsight ceiling | 0% (0/22) | 8% (5/66) | 7% (8/110) | 5% (10/220) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | — | — | — |
| Hindsight ceiling | — | — | — |

## Environment + streak (every night of the season)

Each spelling of "on a run against a soft opponent", the run alone and the soft opponent alone beside it, every skater-game of the season (ranks: 1 = gives up the most, of the teams with games; soft = top 10). Hit rate (hits / picks) and picks a night.

### 1+ goal (base 15%)

| On a run · against | Both | A night | The run alone | The opponent alone |
| --- | --- | --- | --- | --- |
| Goal last game · opponent top 10 in goals to his position | 22% (69/317) | 11.3 | 21% (210/1015) | 15% (318/2096) |
| Goal in 2 straight · opponent top 10 in goals to his position | 22% (11/51) | 1.8 | 24% (45/191) | 15% (318/2096) |
| Point in 2+ straight · opponent top 10 in goals to his position | 20% (55/270) | 9.6 | 22% (197/893) | 15% (318/2096) |
| Point in 3+ straight · opponent top 10 in goals against | 22% (24/111) | 4.0 | 24% (90/380) | 15% (304/2078) |
| Goal or 2+ point run · opponent top 10 in goals against, last 5 | 20% (89/438) | 15.6 | 21% (318/1499) | 16% (317/2044) |
| …and a forward with 2+ shots a game | 27% (56/206) | 7.4 | 28% (190/671) | 16% (317/2044) |
| Point in 2+ straight, forward with 2+ shots a game · goals to his position top 10 | 30% (37/124) | 4.4 | 29% (124/424) | 15% (318/2096) |

### 3+ SOG (base 21%)

| On a run · against | Both | A night | The run alone | The opponent alone |
| --- | --- | --- | --- | --- |
| 3+ SOG in 2 straight · opponent top 10 in shots to his position | 46% (63/137) | 4.9 | 41% (172/419) | 23% (484/2139) |
| 2+ SOG in 3 straight · opponent top 10 in shots against, last 5 | 45% (95/210) | 7.5 | 41% (287/696) | 23% (486/2140) |
| 3+ SOG in 2 straight · top 10 in high-danger chances to his position, last 5 | 50% (60/120) | 4.3 | 41% (172/419) | 23% (470/2066) |
| …and 2.5+ shots a game | 50% (44/88) | 3.1 | 45% (135/302) | 23% (470/2066) |

## Vincent’s slip of 2026-10-29: 1+ goal

| Skater | Game | Got | Runs in (goal · point) | Opp. goals to his position | Opp. GA last 5 | Chances · shots a game | Pill 1+ G (rank on the night) | Model (rank) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Beckett Sennecke | ANA vs BUF | goal | goal 2 · point 2 | #4 | #17 | 2.8 · 2.4 | 43% (#1) | 43% (#10) |
| Zach Benson | BUF at ANA | goal | goal 1 · point 2 | #27 | #4 | 3.3 · 2.2 | 36% (#26) | 33% (#33) |
| Jack Quinn | BUF at ANA | goal | goal 0 · point 0 | #1 | #4 | 3.1 · 2.8 | 43% (#1) | 44% (#9) |
| Macklin Celebrini | SJS vs VAN | no goal (6 SOG) | goal 0 · point 0 | #8 | #1 | 4.6 · 4.0 | 43% (#1) | 40% (#16) |
