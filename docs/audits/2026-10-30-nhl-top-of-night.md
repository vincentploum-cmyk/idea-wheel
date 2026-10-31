# The top of the night: how high a shots or goals pick can land (NHL 2025-26, every night from Nov 1)

Vincent, 2026-10-30, on the backtests landing at 40–50%: "it's always 46%. I don't buy this … even with firsthalfscore.com,
you always come back with 40-50%." Script: `tools/predictors/precision_curve.py`, on last season's 40,524 skater-games
(November on, so every rate has a month or more behind it), each night graded with what was known that morning.

## The answer

- **The 46% was a wide group, not the top.** The earlier reports graded every pick over a bar (30 a night) or the top
  ten a night, and those land near the bar they were picked at. The best picks of the night land higher: the top 1 to 3
  a night at **3+ SOG hit 64–67%**, whatever the read (his rate alone, the model on every figure, or his true rate in
  hindsight).
- **Above that is the sport, not the method.** Last season the league's best shooter, MacKinnon (4.41 shots a game),
  went 3+ SOG in **76%** of his games; DeBrincat 75%, Eichel 71%, McDavid 69%. No read can make a skater go over more
  often than he does, and the reads that pick the night's top three already pick from that group.
- **Goals top out lower.** MacKinnon scored in **49%** of his games, Kaprizov 48%, Caufield 46%: nobody scored in half
  his games. The top pick of the night for 1+ goal lands 40–48%. A four-leg anytime-goal slip at those prices lands
  about 2–5% of the time.
- **What the reads are worth is in the order and the honesty of the figure.** The model's 60–70% calls landed 65%,
  its 50–60% 56%; his plain rate's 80%+ calls landed 70%. Higher hit rates come from lower lines (2+ SOG), not from a
  better read of 3+.

## The tables

40524 skater-games over 143 nights, each graded with what was known that morning (the model retrained every 7 days on every game before).

## 3+ SOG (base 22%)

**The best picks of the night**, the top 1 / 2 / 3 / 5 a night:

| Read | Top 1 | Top 2 | Top 3 | Top 5 |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 65% (93/143) | 67% (193/286) | 64% (276/429) | 62% (441/715) |
| Model (all figures) | 66% (95/143) | 65% (187/286) | 65% (280/429) | 63% (448/715) |
| Truth (his true rate) | 66% (94/143) | 64% (183/286) | 64% (274/429) | 64% (458/715) |

**Said against landed**, by the chance each read gave:

| Read | 50–60% | 60–70% | 70–80% | 80–100% |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 50% of 1845 (12.9/night) | 60% of 1080 (7.6/night) | 65% of 417 (2.9/night) | 70% of 86 (0.6/night) |
| Model (all figures) | 56% of 1805 (12.6/night) | 65% of 820 (5.7/night) | 65% of 98 (0.7/night) | — |
| Truth (his true rate) | 48% of 1777 (12.4/night) | 64% of 991 (6.9/night) | 69% of 286 (2.0/night) | 75% of 68 (0.5/night) |

## 4+ SOG (base 10%)

**The best picks of the night**, the top 1 / 2 / 3 / 5 a night:

| Read | Top 1 | Top 2 | Top 3 | Top 5 |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 46% (66/143) | 45% (130/286) | 44% (187/429) | 41% (291/715) |
| Model (all figures) | 45% (65/143) | 46% (132/286) | 45% (192/429) | 43% (309/715) |
| Truth (his true rate) | 52% (74/143) | 46% (131/286) | 44% (189/429) | 43% (304/715) |

**Said against landed**, by the chance each read gave:

| Read | 25–35% | 35–45% | 45–55% | 55–100% |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 26% of 2407 (16.8/night) | 37% of 1172 (8.2/night) | 41% of 590 (4.1/night) | 51% of 215 (1.5/night) |
| Model (all figures) | 28% of 2560 (17.9/night) | 40% of 1137 (8.0/night) | 45% of 448 (3.1/night) | 47% of 55 (0.4/night) |
| Truth (his true rate) | 27% of 2686 (18.8/night) | 38% of 797 (5.6/night) | 43% of 727 (5.1/night) | 65% of 68 (0.5/night) |

## 1+ goal (base 15%)

**The best picks of the night**, the top 1 / 2 / 3 / 5 a night:

| Read | Top 1 | Top 2 | Top 3 | Top 5 |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 41% (59/143) | 37% (107/286) | 37% (157/429) | 36% (259/715) |
| Model (all figures) | 40% (57/143) | 37% (106/286) | 38% (164/429) | 39% (277/715) |
| Truth (his true rate) | 48% (68/143) | 40% (115/286) | 39% (167/429) | 36% (256/715) |

**Said against landed**, by the chance each read gave:

| Read | 25–35% | 35–45% | 45–55% | 55–100% |
| --- | --- | --- | --- | --- |
| Volume (his rate) | 26% of 4925 (34.4/night) | 34% of 2189 (15.3/night) | 35% of 513 (3.6/night) | 42% of 45 (0.3/night) |
| Model (all figures) | 29% of 5454 (38.1/night) | 37% of 1648 (11.5/night) | 39% of 150 (1.0/night) | 75% of 4 (0.0/night) |
| Truth (his true rate) | 27% of 4825 (33.7/night) | 38% of 2091 (14.6/night) | 37% of 176 (1.2/night) | — |

## The league’s best, as they actually did (60+ games)

| Shooter | Games | Shots a game | 3+ SOG | 4+ SOG |
| --- | --- | --- | --- | --- |
| Nathan MacKinnon | 79 | 4.41 | 76% | 66% |
| Alex DeBrincat | 81 | 3.48 | 75% | 43% |
| Jack Eichel | 73 | 3.49 | 71% | 45% |
| Connor McDavid | 81 | 3.72 | 69% | 47% |
| Jack Hughes | 60 | 3.78 | 68% | 50% |
| Macklin Celebrini | 81 | 3.53 | 68% | 47% |
| Connor Bedard | 68 | 3.29 | 68% | 43% |
| Cutter Gauthier | 75 | 3.73 | 67% | 49% |
| Cole Caufield | 80 | 3.17 | 65% | 44% |
| Kirill Kaprizov | 77 | 3.49 | 65% | 42% |
| Zach Werenski | 74 | 3.45 | 65% | 46% |
| Timo Meier | 76 | 3.47 | 64% | 41% |

| Scorer | Games | Goals a game | Games with a goal |
| --- | --- | --- | --- |
| Nathan MacKinnon | 79 | 0.67 | 49% |
| Kirill Kaprizov | 77 | 0.58 | 48% |
| Cole Caufield | 80 | 0.64 | 46% |
| Nikita Kucherov | 76 | 0.55 | 45% |
| Jason Robertson | 81 | 0.54 | 44% |
| Wyatt Johnston | 81 | 0.54 | 44% |
| Cutter Gauthier | 75 | 0.55 | 44% |
| Matt Boldy | 75 | 0.55 | 44% |
| Tage Thompson | 80 | 0.50 | 44% |
| Macklin Celebrini | 81 | 0.56 | 43% |
| Brandon Hagel | 70 | 0.51 | 43% |
| Leon Draisaitl | 64 | 0.53 | 42% |
