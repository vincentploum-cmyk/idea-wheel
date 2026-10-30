# What it takes: 3 to 6 shots and 1 to 3 goals over the last three weeks (NHL, 2026-10-09 to 2026-10-29)

Vincent, 2026-10-30: "start a study to see what a player needs to have in terms of stats / environment (from PropFinder)
to get 3 shots, 4 shots, 5 shots, 6 shots, 1 goal, 2 goals, 3 goals, based on the games played in the last 3 weeks."

5,159 skater-games from 146 games. Each row carries only what was known the morning of the game — the skater's shots,
attempts, chances, ice time and goals a game over this season, his last 5 and last 10 (PropFinder's Season / L5 / L10),
how often he reached the mark, last season's rates (PropFinder's '25-'26 tab), and the environment: what tonight's
opponent gives up per skater at his position (PropFinder's defense table), its shots and goals against, the opposing
goalie's save %, home, rest. Built from the NHL's public box scores and play-by-play
(`tools/predictors/fetch.mjs` → `relabel.py` → `build_rows.py`, the same counts the site stores); PropFinder's own export
needs the server's login and was not read, but its columns are these same counts. Script:
`tools/predictors/thresholds.py`; the rules are fitted on Oct 9–22 and checked on Oct 23–29, games they never saw.

## The short answer

| Mark | Happens | What it took for a real chance | What the typical hitter carried in |
| --- | --- | --- | --- |
| 3+ shots | 21.6% | **3.5+ shots a game this season: 52%** (2.5–3: 43%, 2–2.5: 30%); or **3.1+ a game last season: 59%** on the check week | 1.9 shots and 4.0 attempts a game, 18¼ min, line 1 or 2 (75%) |
| 4+ shots | 9.7% | **3.5+ shots a game: 34%** (2.5–3.5: 22–25%); 3+ a game last season: ~30% on the check week | 2.1 shots, 4.4 attempts, 18¾ min, line 1 half the time |
| 5+ shots | 4.1% | **3.5+ shots a game: 22%**; everyone else 11% or less | 2.3 shots, 4.9 attempts, 19¼ min, line 1 (56%) |
| 6+ shots | 1.7% | **3.5+ shots a game: 11.5%**; under 3.5, 4% or less | 2.6 shots, 5.5 attempts, 20 min, line 1 (63%), centres first (35%) |
| 1+ goal | 15.1% | **3.5+ shots a game: 33%** (2.5–3.5: 25–28%); **2.2+ scoring chances a game and 2.85+ shots a game last season: 33%** on the check week | 1.8 shots, 2.0 chances, 0.20 goals a game |
| 2+ goals | 2.0% | Nobody gets far: the best tiers sit at 5–7% (2.5+ shots a game); defensemen were 6% of them | 2.3 shots, 2.7 chances, 0.25 goals a game, 2.4 shots a game last season |
| 3+ goals | 13 games | Too few for a bar: all wingers on lines 1–2, 3.0 chances a game, and 10 of the 13 against an opponent giving up more goals to their position than the median (0.26 per skater against 0.16) | 2.3 shots, 5.4 attempts, 0.29 goals a game |

What the three weeks say:

1. **Volume is the whole story for shots.** His shots a game, his shot attempts (iCF / iFF) and last season's shots a game
   separate the 3–6 shot nights best (AUC 0.70–0.84, rising with the mark); the higher the mark, the more it belongs to
   first-line players with 19–20 minutes. A coin flip on 3+ needs about 3.5 shots a game; 4+ never got past one in three.
2. **Last season's rate was the best single number for every mark** — better than this season's 2 to 14 games so far
   (3+ shots: AUC 0.73 against 0.71; 5+ shots: 0.80 against 0.76; 2+ goals: last season's goals a game 0.80). Early in a
   season PropFinder's '25-'26 tab is worth reading beside the season tab.
3. **Goals follow chances.** For 1+ and 2+ goals his scoring chances a game (iSCF) and last season's goals a game separate
   best, ahead of shots; a player at 2.2+ chances a game scored in about a quarter of his games, one with that and a
   2.85+ shots-a-game history in a third.
4. **The environment moved little over three weeks.** Inside a shot tier, the opponent's third on shots allowed to his
   position swung the hit rate a few points one way or the other with no steady direction (3+ shots at 2.5–3 a game: soft
   51%, tough 39%; at 3–3.5: soft 48%, tough 51%); its third on goals allowed did the same for goals; the opposing goalie's
   save % this season did not sort the goal nights at all. Home ice helped a little (3+ shots at 2–2.5 a game: 37% home,
   24% away). The tables are two to three weeks old — the season study found the same early on
   (`docs/shots-goals-predictors.md`, sections 10 and 13): they sharpen with games, the player's own numbers lead.
5. **The plain rules held on the week they never saw** for the common marks (3+ shots: last season 1.95–3.14 a game with
   4.76+ attempts this season, 45% fitted, 45% checked; 1+ goal: 2.2+ chances, 25–27%), and fell back toward the base rate
   for the rare ones (5+ shots, 2+ goals): with a few dozen hits a tree finds noise. Read those as profiles, not bars.

Caveats: three weeks is 5,159 skater-games — enough for 3+ / 4+ shots and 1+ goal, thin for 6+ shots (86 hits) and 2+
goals (102), and 13 hat tricks describe 13 games. "Line" here is the skater's ice-time rank on his team over his last
five (the box score has no lineup); the site's stored rows carry the lineup slot. A skater's first game of the season
(97 rows) carries no figures and is left out. No book prices: the study says how often, not whether a price paid.

## The tables

5159 skater-games over 146 games (97 more were a skater’s first game this season and carry no figures). Every number on a row is what was known that morning: his own figures from his earlier games this season (the way PropFinder’s Season / L5 / L10 read), last season’s from its box scores, and the environment from the opponent’s earlier games. Built from the NHL’s public box scores and play-by-play with the same definitions as the site’s stored rows; PropFinder’s own export was not read (its login is the server’s), but its columns are these same counts.

| Mark | Hit | Of | Rate |
| --- | --- | --- | --- |
| 3+ shots | 1116 | 5159 | 21.6% |
| 4+ shots | 498 | 5159 | 9.7% |
| 5+ shots | 209 | 5159 | 4.1% |
| 6+ shots | 86 | 5159 | 1.7% |
| 1+ goal | 777 | 5159 | 15.1% |
| 2+ goals | 102 | 5159 | 2.0% |
| 3+ goals | 13 | 5159 | 0.3% |

### 3+ shots

1116 of 5159 skater-games (21.6%).

**What they looked like going in** (median of the 1116 who did it, their middle half, and everyone’s median). By position: LW 26%, C 25%, RW 24%, D 24%; by line (ice-time rank, last 5): 1: 43%, 2: 32%, 3: 19%, 4: 6%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 1.89 | 1.33 – 2.71 | 1.33 |
| Shots a game, last 5 | 2.00 | 1.25 – 2.67 | 1.40 |
| Shot attempts a game (iCF), season | 4.00 | 2.83 – 5.56 | 2.91 |
| Scoring chances a game (iSCF), season | 2.00 | 1.18 – 3.00 | 1.33 |
| Ice time a game (min), season | 18.25 | 15.30 – 20.66 | 16.34 |
| Share of his games at 3+ shots | 30.8% | 14.3% – 50.0% | 16.7% |
| Goals a game, season | 0.20 | 0.00 – 0.40 | 0.12 |
| Shots a game, last season | 2.06 | 1.46 – 2.61 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.57 | 1.30 – 1.82 | 1.48 |
| Opponent: shots against a game | 27.33 | 25.40 – 29.33 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.18 | 0.10 – 0.25 | 0.16 |
| Opposing goalie: save % this season | 0.901 | 0.880 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shots a game, last season | 0.730 | 45.6% | 6.8% |
| Unblocked attempts a game (iFF), season | 0.709 | 43.7% | 9.0% |
| Shot attempts a game (iCF), season | 0.707 | 43.8% | 9.8% |
| Shots a game, season | 0.705 | 43.6% | 9.0% |
| Shots a game, last 10 | 0.704 | 43.8% | 9.0% |
| Goals a game, last season | 0.702 | 43.1% | 9.1% |
| Shots a game, last 5 | 0.691 | 42.5% | 9.5% |
| Scoring chances a game (iSCF), season | 0.687 | 41.1% | 8.9% |
| Share of his games at 2+ shots | 0.686 | 41.0% | 9.7% |
| Share of his games at 3+ shots | 0.682 | 40.8% | 12.1% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 9.4% | 10.8% (444) | 10.6% (417) | 6.8% (440) | 11.6% / 7.1% |
| 1 – 1.5 | 1525 | 14.6% | 15.7% (516) | 15.9% (522) | 11.9% (487) | 14.3% / 14.8% |
| 1.5 – 2 | 956 | 24.0% | 23.5% (315) | 26.8% (325) | 21.5% (316) | 26.6% / 21.3% |
| 2 – 2.5 | 602 | 30.4% | 29.8% (191) | 29.7% (202) | 31.6% (209) | 36.9% / 23.9% |
| 2.5 – 3 | 351 | 43.3% | 50.9% (108) | 40.7% (123) | 39.2% (120) | 44.1% / 42.4% |
| 3 – 3.5 | 259 | 47.1% | 48.3% (87) | 41.7% (84) | 51.1% (88) | 48.1% / 46.2% |
| 3.5 + | 165 | 52.1% | 51.7% (60) | 47.7% (44) | 55.7% (61) | 55.2% / 50.0% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 70 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 21.5% → 22.0%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, last season over 3.14 | 124 | 71.8% | 63 | 58.7% |
| Shots a game, last season 1.95–3.14; Shot attempts a game (iCF), season over 4.76 | 413 | 44.8% | 167 | 45.5% |
| Shots a game, last season 1.95–3.14; Shot attempts a game (iCF), season up to 4.76 | 433 | 30.5% | 213 | 36.2% |
| Shots a game, last season 1.14–1.95; Shots a game, season over 1.21 | 861 | 21.5% | 447 | 20.8% |
| Shots a game, last season up to 1.14; Shots a game, season over 1.44 | 110 | 17.3% | 57 | 14.0% |
| Shots a game, last season 1.14–1.95; Shots a game, season up to 1.21 | 733 | 13.5% | 289 | 11.1% |
| Shots a game, last season up to 1.14; Shots a game, season up to 1.44 | 847 | 5.5% | 402 | 9.2% |

### 4+ shots

498 of 5159 skater-games (9.7%).

**What they looked like going in** (median of the 498 who did it, their middle half, and everyone’s median). By position: C 30%, LW 26%, RW 23%, D 20%; by line (ice-time rank, last 5): 1: 49%, 2: 30%, 3: 16%, 4: 5%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 2.12 | 1.50 – 2.90 | 1.33 |
| Shots a game, last 5 | 2.20 | 1.40 – 2.80 | 1.40 |
| Shot attempts a game (iCF), season | 4.44 | 3.09 – 5.83 | 2.91 |
| Scoring chances a game (iSCF), season | 2.24 | 1.33 – 3.25 | 1.33 |
| Ice time a game (min), season | 18.70 | 15.81 – 20.97 | 16.34 |
| Share of his games at 3+ shots | 33.3% | 16.7% – 57.1% | 16.7% |
| Goals a game, season | 0.25 | 0.09 – 0.44 | 0.12 |
| Shots a game, last season | 2.18 | 1.62 – 2.76 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.57 | 1.34 – 1.86 | 1.48 |
| Opponent: shots against a game | 27.50 | 25.46 – 29.54 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.19 | 0.11 – 0.27 | 0.16 |
| Opposing goalie: save % this season | 0.901 | 0.881 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shots a game, last season | 0.751 | 24.3% | 2.1% |
| Unblocked attempts a game (iFF), season | 0.735 | 23.1% | 3.1% |
| Shot attempts a game (iCF), season | 0.734 | 23.5% | 3.2% |
| Shots a game, season | 0.730 | 23.6% | 3.1% |
| Shots a game, last 10 | 0.729 | 23.6% | 3.2% |
| Goals a game, last season | 0.720 | 22.9% | 3.0% |
| Shots a game, last 5 | 0.718 | 22.5% | 3.2% |
| Scoring chances a game (iSCF), season | 0.716 | 22.9% | 3.1% |
| Share of his games at 2+ shots | 0.712 | 22.3% | 3.7% |
| Share of his games at 3+ shots | 0.707 | 21.4% | 4.2% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 3.2% | 3.6% (444) | 3.6% (417) | 2.5% (440) | 4.3% / 2.2% |
| 1 – 1.5 | 1525 | 5.2% | 5.8% (516) | 5.4% (522) | 4.3% (487) | 5.4% / 5.0% |
| 1.5 – 2 | 956 | 9.7% | 10.2% (315) | 11.1% (325) | 7.9% (316) | 10.7% / 8.8% |
| 2 – 2.5 | 602 | 14.1% | 13.1% (191) | 12.4% (202) | 16.7% (209) | 18.3% / 10.0% |
| 2.5 – 3 | 351 | 22.2% | 27.8% (108) | 21.1% (123) | 18.3% (120) | 24.0% / 20.3% |
| 3 – 3.5 | 259 | 25.1% | 27.6% (87) | 21.4% (84) | 26.1% (88) | 26.4% / 23.8% |
| 3.5 + | 165 | 33.9% | 38.3% (60) | 22.7% (44) | 37.7% (61) | 37.3% / 31.6% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 70 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 10.0% → 9.0%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, last season over 2.99; Opponent: goals allowed per skater at his position over 0.20 | 82 | 56.1% | 40 | 32.5% |
| Shots a game, last season over 2.99; Opponent: goals allowed per skater at his position up to 0.20 | 74 | 29.7% | 42 | 28.6% |
| Shots a game, last season 1.95–2.99; Shots a game, season over 2.27 | 370 | 25.9% | 165 | 19.4% |
| Shots a game, last season 1.95–2.99; Shots a game, season up to 2.27 | 444 | 13.1% | 196 | 16.3% |
| Shots a game, last season up to 1.95; Shots a game, season over 1.21; Scoring chances a game (iSCF), season over 1.95 | 357 | 11.2% | 163 | 11.7% |
| Shots a game, last season up to 1.95; Shots a game, season over 1.21; Scoring chances a game (iSCF), season up to 1.95 | 729 | 6.0% | 390 | 5.4% |
| Shots a game, last season 1.20–1.95; Shots a game, season up to 1.21 | 663 | 5.1% | 255 | 3.5% |
| Shots a game, last season up to 1.20; Shots a game, season up to 1.21 | 802 | 1.4% | 387 | 2.3% |

### 5+ shots

209 of 5159 skater-games (4.1%).

**What they looked like going in** (median of the 209 who did it, their middle half, and everyone’s median). By position: C 33%, LW 28%, RW 22%, D 18%; by line (ice-time rank, last 5): 1: 56%, 2: 30%, 3: 11%, 4: 3%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 2.33 | 1.64 – 3.20 | 1.33 |
| Shots a game, last 5 | 2.25 | 1.60 – 3.20 | 1.40 |
| Shot attempts a game (iCF), season | 4.91 | 3.54 – 6.43 | 2.91 |
| Scoring chances a game (iSCF), season | 2.50 | 1.73 – 3.58 | 1.33 |
| Ice time a game (min), season | 19.19 | 16.61 – 21.16 | 16.34 |
| Share of his games at 3+ shots | 40.0% | 25.0% – 63.6% | 16.7% |
| Goals a game, season | 0.27 | 0.12 – 0.50 | 0.12 |
| Shots a game, last season | 2.41 | 1.94 – 2.95 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.56 | 1.36 – 1.85 | 1.48 |
| Opponent: shots against a game | 27.50 | 25.50 – 29.64 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.21 | 0.12 – 0.29 | 0.16 |
| Opposing goalie: save % this season | 0.900 | 0.880 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shots a game, last season | 0.795 | 12.1% | 0.2% |
| Shot attempts a game (iCF), season | 0.776 | 11.4% | 0.9% |
| Unblocked attempts a game (iFF), season | 0.773 | 11.5% | 1.0% |
| Goals a game, last season | 0.769 | 11.7% | 0.5% |
| Shots a game, season | 0.763 | 11.1% | 1.1% |
| Shots a game, last 10 | 0.763 | 11.2% | 1.1% |
| Share of his games at 3+ shots | 0.756 | 10.4% | 1.4% |
| Scoring chances a game (iSCF), season | 0.750 | 10.6% | 1.2% |
| Shots a game, last 5 | 0.742 | 10.6% | 1.4% |
| Share of his games at 2+ shots | 0.736 | 10.2% | 1.2% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 1.0% | 0.7% (444) | 1.7% (417) | 0.7% (440) | 1.4% / 0.6% |
| 1 – 1.5 | 1525 | 1.6% | 1.6% (516) | 2.1% (522) | 1.0% (487) | 1.8% / 1.3% |
| 1.5 – 2 | 956 | 4.0% | 4.4% (315) | 5.2% (325) | 2.2% (316) | 4.0% / 4.0% |
| 2 – 2.5 | 602 | 6.1% | 5.2% (191) | 6.4% (202) | 6.7% (209) | 9.3% / 3.0% |
| 2.5 – 3 | 351 | 8.8% | 9.3% (108) | 9.8% (123) | 7.5% (120) | 10.6% / 7.0% |
| 3 – 3.5 | 259 | 11.2% | 12.6% (87) | 8.3% (84) | 12.5% (88) | 10.9% / 11.5% |
| 3.5 + | 165 | 22.4% | 23.3% (60) | 20.5% (44) | 23.0% (61) | 25.4% / 20.4% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 105 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 4.2% → 3.8%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, last season over 2.56; Shot attempts a game (iCF), season over 5.31; Opponent: goals allowed per skater at his position over 0.19 | 112 | 35.7% | 56 | 10.7% |
| Shots a game, last season over 2.56; Shot attempts a game (iCF), season over 5.31; Opponent: goals allowed per skater at his position up to 0.19 | 115 | 17.4% | 54 | 14.8% |
| Shots a game, last season 1.92–2.06 | 161 | 11.8% | 76 | 6.6% |
| Shots a game, last season 2.06–2.56 | 479 | 6.1% | 212 | 6.6% |
| Shots a game, last season over 2.56; Shot attempts a game (iCF), season up to 5.31 | 137 | 5.1% | 61 | 9.8% |
| Shots a game, last season up to 1.92; Shot attempts a game (iCF), season over 3.47 | 441 | 3.2% | 199 | 3.0% |
| Shots a game, last season up to 1.92; Shot attempts a game (iCF), season up to 3.47 | 2076 | 0.9% | 980 | 1.7% |

### 6+ shots

86 of 5159 skater-games (1.7%).

**What they looked like going in** (median of the 86 who did it, their middle half, and everyone’s median). By position: C 35%, LW 27%, RW 20%, D 19%; by line (ice-time rank, last 5): 1: 63%, 2: 27%, 3: 8%, 4: 2%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 2.61 | 1.80 – 3.40 | 1.33 |
| Shots a game, last 5 | 2.50 | 1.80 – 3.20 | 1.40 |
| Shot attempts a game (iCF), season | 5.48 | 4.00 – 6.74 | 2.91 |
| Scoring chances a game (iSCF), season | 2.84 | 1.84 – 3.72 | 1.33 |
| Ice time a game (min), season | 20.06 | 17.63 – 21.75 | 16.34 |
| Share of his games at 3+ shots | 45.5% | 28.9% – 65.9% | 16.7% |
| Goals a game, season | 0.29 | 0.14 – 0.45 | 0.12 |
| Shots a game, last season | 2.71 | 2.12 – 3.34 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.61 | 1.34 – 1.93 | 1.48 |
| Opponent: shots against a game | 27.71 | 25.75 – 30.33 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.21 | 0.11 – 0.30 | 0.16 |
| Opposing goalie: save % this season | 0.898 | 0.880 – 0.915 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shots a game, last season | 0.841 | 6.0% | 0.0% |
| Shot attempts a game (iCF), season | 0.821 | 5.5% | 0.2% |
| Unblocked attempts a game (iFF), season | 0.811 | 5.6% | 0.3% |
| Goals a game, last season | 0.808 | 5.5% | 0.1% |
| Shots a game, season | 0.794 | 5.4% | 0.4% |
| Shots a game, last 10 | 0.792 | 5.4% | 0.4% |
| Shots a game, last 5 | 0.780 | 5.0% | 0.4% |
| Share of his games at 3+ shots | 0.778 | 4.6% | 0.5% |
| Scoring chances a game (iSCF), season | 0.776 | 4.7% | 0.4% |
| Share of his games at 2+ shots | 0.762 | 4.7% | 0.3% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.3% | 0.2% (444) | 0.5% (417) | 0.2% (440) | 0.3% / 0.3% |
| 1 – 1.5 | 1525 | 0.4% | 0.4% (516) | 0.4% (522) | 0.4% (487) | 0.7% / 0.1% |
| 1.5 – 2 | 956 | 1.8% | 1.9% (315) | 2.8% (325) | 0.6% (316) | 1.7% / 1.9% |
| 2 – 2.5 | 602 | 2.5% | 3.7% (191) | 2.5% (202) | 1.4% (209) | 3.7% / 1.3% |
| 2.5 – 3 | 351 | 4.3% | 4.6% (108) | 4.1% (123) | 4.2% (120) | 4.5% / 4.1% |
| 3 – 3.5 | 259 | 3.9% | 5.7% (87) | 1.2% (84) | 4.5% (88) | 3.1% / 4.6% |
| 3.5 + | 165 | 11.5% | 8.3% (60) | 15.9% (44) | 11.5% (61) | 13.4% / 10.2% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 105 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 1.8% → 1.4%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, last season over 2.99 | 156 | 16.7% | 82 | 7.3% |
| Shots a game, last season 2.56–2.99 | 208 | 6.2% | 89 | 7.9% |
| Shots a game, last season up to 2.56; Shot attempts a game (iCF), season over 3.47 | 922 | 1.7% | 410 | 1.2% |
| Shots a game, last season up to 2.56; Shot attempts a game (iCF), season up to 3.47 | 2235 | 0.4% | 1057 | 0.5% |

### 1+ goal

777 of 5159 skater-games (15.1%).

**What they looked like going in** (median of the 777 who did it, their middle half, and everyone’s median). By position: C 31%, RW 28%, LW 25%, D 16%; by line (ice-time rank, last 5): 1: 36%, 2: 34%, 3: 24%, 4: 6%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 1.78 | 1.20 – 2.57 | 1.33 |
| Shots a game, last 5 | 1.80 | 1.20 – 2.60 | 1.40 |
| Shot attempts a game (iCF), season | 3.55 | 2.56 – 5.20 | 2.91 |
| Scoring chances a game (iSCF), season | 2.00 | 1.22 – 2.88 | 1.33 |
| Ice time a game (min), season | 17.36 | 14.65 – 20.12 | 16.34 |
| Share of his games at 3+ shots | 25.0% | 11.1% – 50.0% | 16.7% |
| Goals a game, season | 0.20 | 0.00 – 0.40 | 0.12 |
| Shots a game, last season | 1.95 | 1.31 – 2.47 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.59 | 1.35 – 1.86 | 1.48 |
| Opponent: shots against a game | 27.00 | 25.29 – 29.27 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.19 | 0.12 – 0.25 | 0.16 |
| Opposing goalie: save % this season | 0.901 | 0.879 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Goals a game, last season | 0.680 | 28.8% | 6.6% |
| Scoring chances a game (iSCF), season | 0.676 | 28.2% | 5.5% |
| Shots a game, last season | 0.660 | 27.5% | 6.9% |
| Unblocked attempts a game (iFF), season | 0.660 | 27.4% | 6.6% |
| High-danger chances a game, season | 0.657 | 25.5% | 5.8% |
| Shots a game, season | 0.653 | 27.7% | 6.5% |
| Shots a game, last 10 | 0.652 | 27.6% | 6.8% |
| Share of his games at 2+ shots | 0.649 | 26.7% | 7.1% |
| Shots a game, last 5 | 0.644 | 25.8% | 6.8% |
| Shot attempts a game (iCF), season | 0.639 | 26.0% | 8.0% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 7.2% | 7.3% (452) | 6.9% (432) | 7.4% (417) | 7.5% / 7.0% |
| 1 – 1.5 | 1525 | 12.7% | 11.9% (514) | 11.4% (509) | 14.9% (502) | 12.7% / 12.7% |
| 1.5 – 2 | 956 | 15.4% | 15.8% (303) | 15.7% (345) | 14.6% (308) | 17.0% / 13.8% |
| 2 – 2.5 | 602 | 21.4% | 21.8% (174) | 18.0% (205) | 24.2% (223) | 23.3% / 19.6% |
| 2.5 – 3 | 351 | 24.5% | 25.0% (116) | 23.4% (107) | 25.0% (128) | 26.8% / 22.1% |
| 3 – 3.5 | 259 | 28.2% | 30.9% (94) | 30.3% (76) | 23.6% (89) | 22.5% / 33.8% |
| 3.5 + | 165 | 32.7% | 26.5% (68) | 39.5% (43) | 35.2% (54) | 35.8% / 30.6% |

Inside each tier by the opposing goalie’s save % this season (thirds):

| His shots a game | Weak goalie | Mid goalie | Strong goalie |
| --- | --- | --- | --- |
| under 1 | 6.6% (424) | 7.3% (410) | 7.4% (431) |
| 1 – 1.5 | 14.1% (476) | 10.9% (504) | 13.4% (494) |
| 1.5 – 2 | 17.2% (319) | 14.7% (306) | 14.3% (300) |
| 2 – 2.5 | 20.3% (207) | 21.9% (196) | 20.9% (177) |
| 2.5 – 3 | 17.8% (118) | 33.3% (114) | 23.4% (111) |
| 3 – 3.5 | 28.6% (70) | 33.7% (83) | 22.4% (98) |
| 3.5 + | 26.4% (53) | 37.0% (54) | 32.1% (56) |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 70 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 14.9% → 15.4%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season up to 0.936; Shots a game, last season over 2.85 | 134 | 44.0% | 73 | 32.9% |
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season up to 0.936; Shots a game, last season up to 2.85 | 604 | 26.8% | 283 | 25.4% |
| Scoring chances a game (iSCF), season up to 2.18; Shots a game, last season over 1.75; High-danger chances a game, season over 0.41 | 278 | 24.1% | 150 | 16.0% |
| Scoring chances a game (iSCF), season up to 2.18; Shots a game, last season over 1.75; High-danger chances a game, season up to 0.41 | 276 | 13.8% | 121 | 13.2% |
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season over 0.936 | 108 | 12.0% | 12 | 75.0% |
| Scoring chances a game (iSCF), season 0.65–2.18; Shots a game, last season up to 1.75 | 1347 | 11.2% | 701 | 12.8% |
| Scoring chances a game (iSCF), season up to 0.65; Shots a game, last season up to 1.75 | 774 | 4.4% | 298 | 6.0% |

### 2+ goals

102 of 5159 skater-games (2.0%).

**What they looked like going in** (median of the 102 who did it, their middle half, and everyone’s median). By position: RW 39%, LW 28%, C 26%, D 6%; by line (ice-time rank, last 5): 1: 53%, 2: 29%, 3: 15%, 4: 3%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 2.26 | 1.45 – 2.75 | 1.33 |
| Shots a game, last 5 | 2.20 | 1.60 – 2.65 | 1.40 |
| Shot attempts a game (iCF), season | 4.78 | 3.21 – 6.00 | 2.91 |
| Scoring chances a game (iSCF), season | 2.71 | 1.85 – 3.42 | 1.33 |
| Ice time a game (min), season | 18.86 | 15.83 – 20.70 | 16.34 |
| Share of his games at 3+ shots | 40.0% | 22.2% – 55.3% | 16.7% |
| Goals a game, season | 0.25 | 0.15 – 0.45 | 0.12 |
| Shots a game, last season | 2.41 | 1.89 – 2.82 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.76 | 1.48 – 1.97 | 1.48 |
| Opponent: shots against a game | 27.60 | 25.44 – 29.74 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.23 | 0.14 – 0.31 | 0.16 |
| Opposing goalie: save % this season | 0.904 | 0.883 – 0.921 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Goals a game, last season | 0.796 | 6.6% | 0.2% |
| Scoring chances a game (iSCF), season | 0.780 | 6.1% | 0.1% |
| Shots a game, last season | 0.765 | 6.0% | 0.4% |
| Unblocked attempts a game (iFF), season | 0.752 | 5.4% | 0.6% |
| Shot attempts a game (iCF), season | 0.736 | 5.2% | 0.5% |
| High-danger chances a game, season | 0.736 | 4.7% | 0.2% |
| Shots a game, last 10 | 0.733 | 5.3% | 0.3% |
| Shots a game, season | 0.732 | 5.3% | 0.3% |
| Share of his games at 3+ shots | 0.726 | 4.7% | 0.6% |
| Shots a game, last 5 | 0.719 | 4.8% | 0.2% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.2% | 0.7% (452) | 0.0% (432) | 0.0% (417) | 0.2% / 0.3% |
| 1 – 1.5 | 1525 | 1.5% | 2.3% (514) | 0.4% (509) | 1.8% (502) | 1.2% / 1.8% |
| 1.5 – 2 | 956 | 1.5% | 2.6% (303) | 0.9% (345) | 1.0% (308) | 1.7% / 1.3% |
| 2 – 2.5 | 602 | 3.7% | 2.3% (174) | 3.4% (205) | 4.9% (223) | 4.3% / 3.0% |
| 2.5 – 3 | 351 | 5.7% | 6.0% (116) | 5.6% (107) | 5.5% (128) | 4.5% / 7.0% |
| 3 – 3.5 | 259 | 4.6% | 5.3% (94) | 5.3% (76) | 3.4% (89) | 5.4% / 3.8% |
| 3.5 + | 165 | 4.8% | 5.9% (68) | 7.0% (43) | 1.9% (54) | 6.0% / 4.1% |

Inside each tier by the opposing goalie’s save % this season (thirds):

| His shots a game | Weak goalie | Mid goalie | Strong goalie |
| --- | --- | --- | --- |
| under 1 | 0.0% (424) | 0.2% (410) | 0.5% (431) |
| 1 – 1.5 | 1.3% (476) | 2.0% (504) | 1.4% (494) |
| 1.5 – 2 | 0.6% (319) | 2.3% (306) | 1.3% (300) |
| 2 – 2.5 | 3.9% (207) | 4.1% (196) | 2.8% (177) |
| 2.5 – 3 | 4.2% (118) | 7.0% (114) | 6.3% (111) |
| 3 – 3.5 | 4.3% (70) | 3.6% (83) | 5.1% (98) |
| 3.5 + | 3.8% (53) | 3.7% (54) | 7.1% (56) |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 105 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 2.0% → 2.0%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, last season over 2.32; High-danger chances a game, season over 0.73; Ice time a game (min), season over 20.18 | 141 | 14.9% | 67 | 6.0% |
| Shots a game, last season up to 2.32; Scoring chances a game (iSCF), season over 3.21 | 106 | 6.6% | 34 | 0.0% |
| Shots a game, last season over 2.32; High-danger chances a game, season over 0.73; Ice time a game (min), season up to 20.18 | 247 | 6.5% | 104 | 7.7% |
| Shots a game, last season over 2.32; High-danger chances a game, season up to 0.73 | 164 | 1.8% | 81 | 4.9% |
| Shots a game, last season up to 2.32; Scoring chances a game (iSCF), season up to 3.21; Opponent: shots allowed per skater at his position over 1.61 | 940 | 1.7% | 530 | 2.1% |
| Shots a game, last season up to 2.32; Scoring chances a game (iSCF), season up to 3.21; Opponent: shots allowed per skater at his position up to 1.61 | 1923 | 0.4% | 822 | 0.6% |

### 3+ goals

13 of 5159 skater-games (0.3%).

**What they looked like going in** (median of the 13 who did it, their middle half, and everyone’s median). By position: RW 54%, LW 46%; by line (ice-time rank, last 5): 1: 62%, 2: 31%, 3: 8%.

| Number | Hitters’ median | Hitters’ middle half | Everyone’s median |
| --- | --- | --- | --- |
| Shots a game, season | 2.27 | 2.00 – 2.80 | 1.33 |
| Shots a game, last 5 | 2.25 | 2.00 – 2.80 | 1.40 |
| Shot attempts a game (iCF), season | 5.43 | 4.55 – 5.75 | 2.91 |
| Scoring chances a game (iSCF), season | 3.00 | 2.73 – 3.43 | 1.33 |
| Ice time a game (min), season | 18.98 | 18.27 – 20.72 | 16.34 |
| Share of his games at 3+ shots | 42.9% | 37.5% – 66.7% | 16.7% |
| Goals a game, season | 0.29 | 0.25 – 0.42 | 0.12 |
| Shots a game, last season | 2.64 | 2.17 – 3.34 | 1.46 |
| Opponent: shots allowed per skater at his position | 1.82 | 1.76 – 1.90 | 1.48 |
| Opponent: shots against a game | 28.00 | 26.50 – 29.64 | 27.00 |
| Opponent: goals allowed per skater at his position | 0.26 | 0.20 – 0.30 | 0.16 |
| Opposing goalie: save % this season | 0.913 | 0.898 – 0.921 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Goals a game, last season | 0.919 | 1.4% | 0.0% |
| Shots a game, last season | 0.883 | 1.0% | 0.0% |
| Scoring chances a game (iSCF), season | 0.879 | 1.1% | 0.0% |
| Unblocked attempts a game (iFF), season | 0.868 | 1.0% | 0.0% |
| High-danger chances a game, season | 0.864 | 1.0% | 0.0% |
| Shot attempts a game (iCF), season | 0.854 | 1.0% | 0.0% |
| Share of his games at 3+ shots | 0.849 | 0.8% | 0.0% |
| Shots a game, last 10 | 0.809 | 0.8% | 0.0% |
| Shots a game, season | 0.798 | 0.8% | 0.0% |
| Shots a game, last 5 | 0.795 | 0.7% | 0.0% |

**By his shots a game this season** (the ladder), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.0% | 0.0% (452) | 0.0% (432) | 0.0% (417) | 0.0% / 0.0% |
| 1 – 1.5 | 1525 | 0.1% | 0.2% (514) | 0.0% (509) | 0.2% (502) | 0.1% / 0.1% |
| 1.5 – 2 | 956 | 0.1% | 0.0% (303) | 0.0% (345) | 0.3% (308) | 0.2% / 0.0% |
| 2 – 2.5 | 602 | 0.8% | 1.1% (174) | 1.0% (205) | 0.4% (223) | 1.3% / 0.3% |
| 2.5 – 3 | 351 | 0.6% | 1.7% (116) | 0.0% (107) | 0.0% (128) | 0.6% / 0.6% |
| 3 – 3.5 | 259 | 0.4% | 1.1% (94) | 0.0% (76) | 0.0% (89) | 0.8% / 0.0% |
| 3.5 + | 165 | 1.2% | 1.5% (68) | 2.3% (43) | 0.0% (54) | 1.5% / 1.0% |

Inside each tier by the opposing goalie’s save % this season (thirds):

| His shots a game | Weak goalie | Mid goalie | Strong goalie |
| --- | --- | --- | --- |
| under 1 | 0.0% (424) | 0.0% (410) | 0.0% (431) |
| 1 – 1.5 | 0.2% (476) | 0.0% (504) | 0.2% (494) |
| 1.5 – 2 | 0.0% (319) | 0.0% (306) | 0.3% (300) |
| 2 – 2.5 | 1.0% (207) | 0.5% (196) | 1.1% (177) |
| 2.5 – 3 | 0.0% (118) | 1.8% (114) | 0.0% (111) |
| 3 – 3.5 | 0.0% (70) | 0.0% (83) | 1.0% (98) |
| 3.5 + | 0.0% (53) | 0.0% (54) | 3.6% (56) |

**Every one of them**, with what he carried in:

| Date | Skater | Team | vs | Shots | His shots a game | His goals a game | Chances a game | Ice time | Opp. goals allowed to his position (per skater) | Goalie sv % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-10 | Kirill Kaprizov | MIN | FLA | 4 | 2.25 | 0.75 | 2.75 | 21.95 | 0.30 | 0.900 |
| 2026-10-10 | Brandon Hagel | TBL | NYI | 6 | 5.00 | 0.25 | 4.75 | 22.22 | 0.30 | 0.983 |
| 2026-10-13 | Brady Tkachuk | FLA | CBJ | 4 | 2.80 | 0.00 | 2.80 | 17.39 | 0.24 | 0.909 |
| 2026-10-15 | Kirill Marchenko | TOR | BUF | 3 | 2.00 | 0.20 | 3.00 | 18.98 | 0.26 | 0.850 |
| 2026-10-15 | Brady Tkachuk | FLA | VAN | 6 | 3.00 | 0.50 | 3.00 | 17.21 | 0.32 | 0.926 |
| 2026-10-15 | Matt Boldy | MIN | STL | 8 | 3.86 | 0.29 | 3.86 | 21.14 | 0.21 | 0.921 |
| 2026-10-15 | Mark Stone | VGK | CGY | 3 | 2.14 | 0.29 | 3.43 | 19.39 | 0.33 | 0.839 |
| 2026-10-17 | Sam Bennett | FLA | SEA | 4 | 2.29 | 0.00 | 2.71 | 19.18 | 0.12 | 0.913 |
| 2026-10-17 | Carter Verhaeghe | FLA | SEA | 5 | 1.43 | 0.43 | 3.00 | 18.61 | 0.12 | 0.913 |
| 2026-10-20 | Mikko Rantanen | DAL | BOS | 6 | 1.88 | 0.25 | 2.00 | 20.72 | 0.17 | 0.925 |
| 2026-10-24 | Drake Batherson | OTT | NYR | 3 | 2.27 | 0.36 | 2.73 | 17.94 | 0.20 | 0.915 |
| 2026-10-29 | Viktor Arvidsson | DET | CHI | 6 | 2.58 | 0.42 | 4.08 | 18.87 | 0.30 | 0.898 |
| 2026-10-29 | Logan Cooley | UTA | PIT | 5 | 1.23 | 0.31 | 2.08 | 18.27 | 0.39 | 0.879 |
