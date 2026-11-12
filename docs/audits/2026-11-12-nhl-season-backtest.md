# The season backtest, NHL 2026-10-02 to 2026-11-11

Graded: every night from 2026-10-08 to 2026-11-11 (35 nights, 8607 skater-games), each with what was known that morning: the models retrained on every game before it, the Patterns rules re-mined every week on the weeks before it. The season’s first 6 nights (1069 skater-games, every skater 0–3 games in) are graded only for the reads that need no training, the env+streak table. Hindsight = Poisson at his true rate over the whole season, his future games in: the ceiling.

## In short

| Line | Base | Filled pills | Pills: top 1 a night | Model: top 1 | Model: top 3 | Ceiling: top 1 | Ceiling: top 3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3+ SOG | 22% | 47% (487/1032) | 51% (18/35) | 71% (25/35) | 57% (60/105) | 54% (19/35) | 57% (60/105) |
| 4+ SOG | 10% | 30% (144/485) | 40% (14/35) | 31% (11/35) | 34% (36/105) | 34% (12/35) | 30% (32/105) |
| 5+ SOG | 4% | 37% (16/43) | 31% (11/35) | 20% (7/35) | 23% (24/105) | 20% (7/35) | 18% (19/105) |
| 6+ SOG | 2% | 26% (11/43) | 17% (6/35) | 20% (7/35) | 11% (12/105) | 14% (5/35) | 10% (11/105) |
| 1+ goal | 15% | 32% (169/524) | 37% (13/35) | 37% (13/35) | 38% (40/105) | 29% (10/35) | 35% (37/105) |
| 2+ goals | 2% | — | 11% (4/35) | 11% (4/35) | 8% (8/105) | 3% (1/35) | 11% (12/105) |

## 3+ SOG

Base rate on the graded nights 22% (1863 of 8607). The filled pills: 47% (487/1032), 29.5 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 51% (18/35) | 54% (57/105) | 53% (93/175) | 54% (189/350) |
| Model (all figures) | 71% (25/35) | 57% (60/105) | 58% (101/175) | 58% (204/350) |
| Volume alone | 46% (16/35) | 60% (63/105) | 59% (104/175) | 54% (188/350) |
| Hindsight ceiling | 54% (19/35) | 57% (60/105) | 59% (104/175) | 59% (206/350) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | 47% (487/1032), 29.5/night | 53% (179/340), 9.7/night | — |
| Model (all figures) | 56% (357/638), 18.2/night | 62% (178/287), 8.2/night | 63% (44/70), 2.0/night |
| Hindsight ceiling | 54% (418/773), 22.1/night | 58% (226/387), 11.1/night | 67% (116/174), 5.0/night |

## 4+ SOG

Base rate on the graded nights 10% (848 of 8607). The filled pills: 30% (144/485), 13.9 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 40% (14/35) | 38% (40/105) | 37% (64/175) | 30% (104/350) |
| Model (all figures) | 31% (11/35) | 34% (36/105) | 36% (63/175) | 33% (116/350) |
| Volume alone | 23% (8/35) | 39% (41/105) | 39% (69/175) | 32% (113/350) |
| Hindsight ceiling | 34% (12/35) | 30% (32/105) | 34% (60/175) | 36% (125/350) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | 38% (25/66), 1.9/night | 43% (6/14), 0.4/night | 75% (3/4), 0.1/night |
| Hindsight ceiling | 42% (69/166), 4.7/night | 36% (9/25), 0.7/night | — |

## 5+ SOG

Base rate on the graded nights 4% (369 of 8607). The filled pills: 37% (16/43), 1.2 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 31% (11/35) | 22% (23/105) | 19% (33/175) | 17% (60/350) |
| Model (all figures) | 20% (7/35) | 23% (24/105) | 22% (39/175) | 19% (67/350) |
| Volume alone | 17% (6/35) | 26% (27/105) | 24% (42/175) | 19% (66/350) |
| Hindsight ceiling | 20% (7/35) | 18% (19/105) | 20% (35/175) | 20% (70/350) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | 33% (3/9), 0.3/night | 50% (2/4), 0.1/night | — |
| Hindsight ceiling | — | — | — |

## 6+ SOG

Base rate on the graded nights 2% (165 of 8607). The filled pills: 26% (11/43), 1.2 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 17% (6/35) | 13% (14/105) | 11% (20/175) | 11% (37/350) |
| Model (all figures) | 20% (7/35) | 11% (12/105) | 11% (20/175) | 10% (35/350) |
| Volume alone | 9% (3/35) | 15% (16/105) | 15% (27/175) | 12% (43/350) |
| Hindsight ceiling | 14% (5/35) | 10% (11/105) | 13% (22/175) | 13% (45/350) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | — | — | — |
| Model (all figures) | — | — | — |
| Hindsight ceiling | — | — | — |

## 1+ goal

Base rate on the graded nights 15% (1314 of 8607). The filled pills: 32% (169/524), 15.0 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 37% (13/35) | 41% (43/105) | 37% (64/175) | 33% (117/350) |
| Model (all figures) | 37% (13/35) | 38% (40/105) | 36% (63/175) | 34% (118/350) |
| Volume alone | 43% (15/35) | 35% (37/105) | 35% (62/175) | 32% (113/350) |
| Hindsight ceiling | 29% (10/35) | 35% (37/105) | 34% (59/175) | 29% (101/350) |

**Every pick it rates at or over a chance:**

| Method | ≥ 50% | ≥ 60% | ≥ 70% |
| --- | --- | --- | --- |
| Pills (the rules) | 38% (20/52), 1.5/night | — | — |
| Model (all figures) | 40% (22/55), 1.6/night | 17% (1/6), 0.2/night | — |
| Hindsight ceiling | 57% (36/63), 1.8/night | 18% (3/17), 0.5/night | — |

## 2+ goals

Base rate on the graded nights 2% (175 of 8607). The filled pills: —, 0.0 a night.

**The top picks a night** (each method’s best 1 / 3 / 5 / 10 skaters every night):

| Method | Top 1 | Top 3 | Top 5 | Top 10 |
| --- | --- | --- | --- | --- |
| Pills (the rules) | 11% (4/35) | 8% (8/105) | 7% (13/175) | 5% (18/350) |
| Model (all figures) | 11% (4/35) | 8% (8/105) | 8% (14/175) | 7% (26/350) |
| Volume alone | 9% (3/35) | 7% (7/105) | 5% (9/175) | 7% (24/350) |
| Hindsight ceiling | 3% (1/35) | 11% (12/105) | 9% (15/175) | 6% (20/350) |

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
| Goal last game · opponent top 10 in goals to his position | 19% (94/492) | 12.0 | 20% (303/1501) | 15% (463/3069) |
| Goal in 2 straight · opponent top 10 in goals to his position | 23% (20/87) | 2.1 | 24% (69/290) | 15% (463/3069) |
| Point in 2+ straight · opponent top 10 in goals to his position | 20% (86/439) | 10.7 | 22% (309/1396) | 15% (463/3069) |
| Point in 3+ straight · opponent top 10 in goals against | 26% (50/193) | 4.7 | 24% (157/644) | 16% (466/2987) |
| Goal or 2+ point run · opponent top 10 in goals against, last 5 | 21% (141/687) | 16.8 | 21% (469/2272) | 16% (465/2957) |
| …and a forward with 2+ shots a game | 27% (80/296) | 7.2 | 28% (266/962) | 16% (465/2957) |
| Point in 2+ straight, forward with 2+ shots a game · goals to his position top 10 | 27% (51/189) | 4.6 | 29% (183/641) | 15% (463/3069) |

### 3+ SOG (base 21%)

| On a run · against | Both | A night | The run alone | The opponent alone |
| --- | --- | --- | --- | --- |
| 3+ SOG in 2 straight · opponent top 10 in shots to his position | 46% (92/202) | 4.9 | 43% (276/645) | 22% (684/3076) |
| 2+ SOG in 3 straight · opponent top 10 in shots against, last 5 | 44% (148/337) | 8.2 | 43% (466/1091) | 23% (706/3131) |
| 3+ SOG in 2 straight · top 10 in high-danger chances to his position, last 5 | 47% (91/193) | 4.7 | 43% (276/645) | 23% (684/3028) |
| …and 2.5+ shots a game | 49% (63/128) | 3.1 | 48% (211/438) | 23% (684/3028) |
