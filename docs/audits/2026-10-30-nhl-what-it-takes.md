# What it takes: 3 to 6 shots and 1 to 3 goals over the last three weeks (NHL, 2026-10-09 to 2026-10-29)

Vincent, 2026-10-30: "start a study to see what a player needs to have in terms of stats / environment (from PropFinder)
to get 3 shots, 4 shots, 5 shots, 6 shots, 1 goal, 2 goals, 3 goals, based on the games played in the last 3 weeks";
then "forget about last season": this season's numbers alone.

5,159 skater-games from 146 games. Each row carries only what was known the morning of the game, all of it this season:
the skater's shots, attempts, chances, ice time and goals a game over his earlier games and his last 5 and last 10
(PropFinder's Season / L5 / L10), how often he reached the mark, and the environment — what tonight's opponent gives up
at his position (PropFinder's defense table, read against the league's at that position), its shots and goals against,
the opposing goalie's save %, his own team's shots, the game's pace, home, back-to-back. Built from the NHL's public box
scores and play-by-play (`tools/predictors/fetch.mjs` → `relabel.py` → `build_rows.py`, the same counts the site
stores); PropFinder's own export needs the server's login and was not read, but its columns are these same counts.
Script: `tools/predictors/thresholds.py`; the rules are fitted on Oct 9–22 and checked on Oct 23–29, games they never saw.

## The short answer

| Mark | Happens | What it took for a real chance | What the typical hitter carried in |
| --- | --- | --- | --- |
| 3+ shots | 21.6% | **3.5+ shots a game: 52%, 56% with 5+ games behind the rate** (3–3.5: 47%, 2.5–3: 43%, 2–2.5: 30%); **4.8+ attempts and 2.1+ shots a game: 51% fitted, 47% checked** | 1.9 shots and 4.0 attempts a game, 18¼ min, line 1 or 2 (75%) |
| 4+ shots | 9.7% | **3.5+ shots a game: 34%, 37% with 5+ games** (3–3.5: 25%); 2.3+ shots and 4.8+ attempts a game: 31% fitted, 26% checked | 2.1 shots, 4.4 attempts, 18¾ min, line 1 half the time |
| 5+ shots | 4.1% | **3.5+ shots a game: 22%, 25% with 5+ games**; under 3.5, 11% or less | 2.3 shots, 4.9 attempts, 19¼ min, line 1 (56%) |
| 6+ shots | 1.7% | **3.5+ shots a game: 11.5%, 13.6% with 5+ games**; under 3.5, 4% or less | 2.6 shots, 5.5 attempts, 20 min, line 1 (63%), centres first (35%) |
| 1+ goal | 15.1% | **3.5+ shots a game: 33%, 35% with 5+ games**; **2.2+ scoring chances a game: 28% fitted, 29% checked** (with 21+ minutes: 44% → 33%) | 1.8 shots, 2.0 chances, 0.20 goals a game |
| 2+ goals | 2.0% | Nobody gets far: 2.4+ chances a game and 19+ minutes 11% fitted, 8% checked (four times the base); the best shot tiers 5–6% | 2.3 shots, 2.7 chances, 0.25 goals a game; defensemen 6% of them |
| 3+ goals | 13 games | Too few for a bar: all wingers, 12 of 13 on lines 1–2, 3.0 chances a game, and 10 of the 13 against an opponent giving up more shots to their position than the league | 2.3 shots, 5.4 attempts, 0.29 goals a game |

What the three weeks say:

1. **Volume is the whole story for shots.** His attempts a game (iCF / iFF) and shots a game, this season and over his
   last 10, separate the 3–6 shot nights best (AUC 0.71 for 3+ rising to 0.82 for 6+); the higher the mark, the more it
   belongs to first-line players with 19–20 minutes. A coin flip on 3+ needs about 3.5 shots a game, or 4.8 attempts and
   2.1 shots with 19½ minutes (58% fitted, 49% checked); 4+ never got past about one in three.
2. **His rate firms up at about five games.** At the same shots a game, a skater with five or more games behind the rate
   hit noticeably more often than one with one to four: 3+ shots at 3.5+ a game 56% against 43%, 4+ 37% against 26%,
   1+ goal at 3–3.5 a game 32% against 16%. Without last season, a rate from one to four games is half a read.
3. **Goals follow chances.** For 1+, 2+ and 3+ goals his scoring chances a game (iSCF) separate best, ahead of his shots
   (AUC 0.68 / 0.78 / 0.88); his goals a game so far sort them less (0.70 for 2+). A player at 2.2+ chances a game scored
   in 28–29% of his games on both the fitted and the check weeks.
4. **The opponent's position table did not sort the nights.** Read against the league's at his position, what tonight's
   opponent gives up to that position separated nothing for shots or one goal (AUC 0.50–0.55): the 3+, 4+, 5+ and 6+ shot
   hitters' median opponent read × 0.99–1.01, everyone's × 1.00; inside a shot tier its thirds swung a few points with no steady
   direction. The raw per-skater figure looks like it matters (AUC 0.57–0.60) only because a defenseman's table runs at
   two thirds of a forward's — it sorts forwards from defensemen, not soft opponents from tough ones; the script reads it
   per position. Three things did lean: **the opponent's goals against a game** for the big shot nights (AUC 0.53 / 0.55 /
   0.58 / 0.60 for 3+ / 4+ / 5+ / 6+; the 6+ shot hitters' opponents gave up 3.38 a game against 3.08 for everyone), his
   **own team's shots for** a little (0.54–0.55), and **the shots the opponent allows at his position for multi-goal
   nights** (2+ goals 0.59, 3+ goals 0.63, the last-five version 0.60 / 0.74 — on 102 and 13 games). The opposing
   goalie's save % this season sorted nothing for shots or one goal (0.48–0.50). Home: 3+ shots 23.4% at home, 19.9% away; 4+ 10.8% / 8.5%;
   goals even. Back-to-back: 3+ shots 19.5% against 21.9%.
5. **The plain rules held on the week they never saw** for the common marks (3+ shots, 1+ goal, above) and fell back
   toward the base rate for the rare ones (5+ shots: 5.2+ attempts a game, 16% fitted, 10% checked; 6+ shots; 2+ goals
   halved): with a few dozen hits a tree finds noise. Read those as profiles, not bars.

Caveats: three weeks is 5,159 skater-games — enough for 3+ / 4+ shots and 1+ goal, thin for 6+ shots (86 hits) and 2+
goals (102), and 13 hat tricks describe 13 games. The opponents' tables are two to three weeks old (a team's first
games set its whole season figure); the season study found the same early on (`docs/shots-goals-predictors.md`,
sections 10 and 13): they sharpen with games, the player's own numbers lead. "Line" is the skater's ice-time rank on his
team over his last five (the box score has no lineup); the site's stored rows carry the lineup slot. A skater's first
game of the season (97 rows) carries no figures and is left out. No book prices: the study says how often, not whether a
price paid. An earlier cut of this report read last season's rates beside this season's (last season's shots a game
was then the best single number for every mark, AUC 0.73–0.84) and compared the raw per-skater opponent figures; both
are out.

## The tables

5159 skater-games over 146 games (97 more were a skater’s first game this season and carry no figures). Every number on a row is what was known that morning: his own figures from his earlier games this season (the way PropFinder’s Season / L5 / L10 read) and the environment from the opponent’s earlier games this season; nothing from last season. Built from the NHL’s public box scores and play-by-play with the same definitions as the site’s stored rows; PropFinder’s own export was not read (its login is the server’s), but its columns are these same counts.

| Mark | Hit | Of | Rate |
| --- | --- | --- | --- |
| 3+ shots | 1116 | 5159 | 21.6% |
| 4+ shots | 498 | 5159 | 9.7% |
| 5+ shots | 209 | 5159 | 4.1% |
| 6+ shots | 86 | 5159 | 1.7% |
| 1+ goal | 777 | 5159 | 15.1% |
| 2+ goals | 102 | 5159 | 2.0% |
| 3+ goals | 13 | 5159 | 0.3% |

## 3+ shots

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
| Opponent: shots allowed at his position, × the league’s | × 1.01 | × 0.89 – × 1.12 | × 1.00 |
| Opponent: shots against a game | 27.33 | 25.40 – 29.33 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 0.96 | × 0.69 – × 1.29 | × 0.96 |
| Opponent: goals against a game | 3.10 | 2.73 – 3.55 | 3.08 |
| Opposing goalie: save % this season | 0.901 | 0.880 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Unblocked attempts a game (iFF), season | 0.709 | 43.7% | 9.0% |
| Shot attempts a game (iCF), season | 0.707 | 43.8% | 9.8% |
| Shots a game, season | 0.705 | 43.6% | 9.0% |
| Shots a game, last 10 | 0.704 | 43.8% | 9.0% |
| Shots a game, last 5 | 0.691 | 42.5% | 9.5% |
| Scoring chances a game (iSCF), season | 0.687 | 41.1% | 8.9% |
| Share of his games at 2+ shots | 0.686 | 41.0% | 9.7% |
| Share of his games at 3+ shots | 0.682 | 40.8% | 12.1% |
| His most shots in a game this season | 0.675 | 39.6% | 11.5% |
| Shots per 60 | 0.661 | 36.5% | 9.2% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| His team: shots for a game | 0.537 | 24.0% | 18.2% |
| Opponent: goals against a game | 0.532 | 24.7% | 18.9% |
| Opponent: shots to his position, last 5, × the league’s | 0.524 | 24.0% | 20.3% |
| Opponent: shots against a game | 0.523 | 23.3% | 18.5% |
| Opponent: shots allowed at his position, × the league’s | 0.514 | 24.1% | 20.1% |
| Opponent: goals allowed at his position, × the league’s | 0.511 | 24.2% | 21.0% |
| Game pace (both teams’ shots) | 0.510 | 21.1% | 19.9% |
| Opposing goalie: save % this season | 0.499 | 20.8% | 21.3% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 9.4% | 10.6% (425) / 8.8% (876) | 10.8% (444) | 10.6% (417) | 6.8% (440) | 11.6% / 7.1% |
| 1 – 1.5 | 1525 | 14.6% | 14.5% (332) / 14.6% (1193) | 15.7% (516) | 15.9% (522) | 11.9% (487) | 14.3% / 14.8% |
| 1.5 – 2 | 956 | 24.0% | 19.9% (176) / 24.9% (780) | 23.5% (315) | 26.8% (325) | 21.5% (316) | 26.6% / 21.3% |
| 2 – 2.5 | 602 | 30.4% | 23.7% (139) / 32.4% (463) | 29.8% (191) | 29.7% (202) | 31.6% (209) | 36.9% / 23.9% |
| 2.5 – 3 | 351 | 43.3% | 40.3% (77) / 44.2% (274) | 50.9% (108) | 40.7% (123) | 39.2% (120) | 44.1% / 42.4% |
| 3 – 3.5 | 259 | 47.1% | 42.2% (64) / 48.7% (195) | 48.3% (87) | 41.7% (84) | 51.1% (88) | 48.1% / 46.2% |
| 3.5 + | 165 | 52.1% | 42.6% (47) / 55.9% (118) | 51.7% (60) | 47.7% (44) | 55.7% (61) | 55.2% / 50.0% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 70 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 21.5% → 22.0%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shot attempts a game (iCF), season over 4.76; Shots a game, season over 2.06; Ice time a game (min), season over 19.59 | 303 | 57.8% | 156 | 48.7% |
| Shot attempts a game (iCF), season over 4.76; Shots a game, season over 2.06; Ice time a game (min), season up to 19.59 | 229 | 42.4% | 71 | 43.7% |
| Shot attempts a game (iCF), season over 4.76; Shots a game, season up to 2.06 | 110 | 29.1% | 31 | 35.5% |
| Shot attempts a game (iCF), season 3.39–4.76; Shots a game, season over 1.24 | 596 | 27.7% | 332 | 28.9% |
| Shot attempts a game (iCF), season up to 3.39; Shots a game, season over 1.24 | 726 | 17.6% | 373 | 19.6% |
| Shot attempts a game (iCF), season up to 4.76; Shots a game, season up to 1.24; Opponent: shots allowed at his position, × the league’s over × 0.78 | 1366 | 11.1% | 630 | 10.8% |
| Shot attempts a game (iCF), season up to 4.76; Shots a game, season up to 1.24; Opponent: shots allowed at his position, × the league’s up to × 0.78 | 191 | 3.7% | 45 | 11.1% |

## 4+ shots

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
| Opponent: shots allowed at his position, × the league’s | × 1.01 | × 0.89 – × 1.13 | × 1.00 |
| Opponent: shots against a game | 27.50 | 25.46 – 29.54 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 0.99 | × 0.74 – × 1.35 | × 0.96 |
| Opponent: goals against a game | 3.17 | 2.75 – 3.64 | 3.08 |
| Opposing goalie: save % this season | 0.901 | 0.881 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Unblocked attempts a game (iFF), season | 0.735 | 23.1% | 3.1% |
| Shot attempts a game (iCF), season | 0.734 | 23.5% | 3.2% |
| Shots a game, season | 0.730 | 23.6% | 3.1% |
| Shots a game, last 10 | 0.729 | 23.6% | 3.2% |
| Shots a game, last 5 | 0.718 | 22.5% | 3.2% |
| Scoring chances a game (iSCF), season | 0.716 | 22.9% | 3.1% |
| Share of his games at 2+ shots | 0.712 | 22.3% | 3.7% |
| Share of his games at 3+ shots | 0.707 | 21.4% | 4.2% |
| His most shots in a game this season | 0.694 | 20.2% | 4.4% |
| Shots per 60 | 0.687 | 19.4% | 3.5% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Opponent: goals against a game | 0.550 | 12.7% | 8.1% |
| His team: shots for a game | 0.548 | 11.5% | 7.6% |
| Opponent: shots against a game | 0.540 | 11.4% | 7.3% |
| Opponent: goals allowed at his position, × the league’s | 0.526 | 11.4% | 8.9% |
| Opponent: shots allowed at his position, × the league’s | 0.520 | 11.8% | 8.5% |
| Opponent: shots to his position, last 5, × the league’s | 0.516 | 10.0% | 8.7% |
| Game pace (both teams’ shots) | 0.508 | 10.1% | 9.0% |
| Opposing goalie: save % this season | 0.501 | 9.7% | 8.9% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 3.2% | 4.2% (425) / 2.7% (876) | 3.6% (444) | 3.6% (417) | 2.5% (440) | 4.3% / 2.2% |
| 1 – 1.5 | 1525 | 5.2% | 5.1% (332) / 5.2% (1193) | 5.8% (516) | 5.4% (522) | 4.3% (487) | 5.4% / 5.0% |
| 1.5 – 2 | 956 | 9.7% | 6.8% (176) / 10.4% (780) | 10.2% (315) | 11.1% (325) | 7.9% (316) | 10.7% / 8.8% |
| 2 – 2.5 | 602 | 14.1% | 12.2% (139) / 14.7% (463) | 13.1% (191) | 12.4% (202) | 16.7% (209) | 18.3% / 10.0% |
| 2.5 – 3 | 351 | 22.2% | 20.8% (77) / 22.6% (274) | 27.8% (108) | 21.1% (123) | 18.3% (120) | 24.0% / 20.3% |
| 3 – 3.5 | 259 | 25.1% | 15.6% (64) / 28.2% (195) | 27.6% (87) | 21.4% (84) | 26.1% (88) | 26.4% / 23.8% |
| 3.5 + | 165 | 33.9% | 25.5% (47) / 37.3% (118) | 38.3% (60) | 22.7% (44) | 37.7% (61) | 37.3% / 31.6% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 70 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 10.0% → 9.0%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shots a game, season over 2.27; Shot attempts a game (iCF), season over 4.79; Opponent: goals allowed at his position, × the league’s over × 0.82 | 302 | 36.8% | 137 | 27.0% |
| Shots a game, season over 2.27; Shot attempts a game (iCF), season over 4.79; Opponent: goals allowed at his position, × the league’s up to × 0.82 | 188 | 20.7% | 71 | 25.4% |
| Shots a game, season up to 2.27; Shot attempts a game (iCF), season over 3.44; Goals a game, season over 0.32 | 133 | 18.8% | 65 | 13.8% |
| Shots a game, season over 2.27; Shot attempts a game (iCF), season up to 4.79; Opponent: goals allowed at his position, × the league’s over × 0.89 | 80 | 16.2% | 48 | 8.3% |
| Shots a game, season up to 2.27; Shot attempts a game (iCF), season up to 3.44; Scoring chances a game (iSCF), season over 1.95 | 206 | 12.1% | 95 | 15.8% |
| Shots a game, season up to 2.27; Shot attempts a game (iCF), season over 3.44; Goals a game, season up to 0.32 | 510 | 10.6% | 243 | 10.7% |
| Shots a game, season over 2.27; Shot attempts a game (iCF), season up to 4.79; Opponent: goals allowed at his position, × the league’s up to × 0.89 | 78 | 7.7% | 33 | 12.1% |
| Shots a game, season up to 2.27; Shot attempts a game (iCF), season up to 3.44; Scoring chances a game (iSCF), season up to 1.95 | 2024 | 3.9% | 946 | 3.6% |

## 5+ shots

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
| Opponent: shots allowed at his position, × the league’s | × 0.99 | × 0.89 – × 1.13 | × 1.00 |
| Opponent: shots against a game | 27.50 | 25.50 – 29.64 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 1.01 | × 0.77 – × 1.37 | × 0.96 |
| Opponent: goals against a game | 3.33 | 2.80 – 3.67 | 3.08 |
| Opposing goalie: save % this season | 0.900 | 0.880 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shot attempts a game (iCF), season | 0.776 | 11.4% | 0.9% |
| Unblocked attempts a game (iFF), season | 0.773 | 11.5% | 1.0% |
| Shots a game, season | 0.763 | 11.1% | 1.1% |
| Shots a game, last 10 | 0.763 | 11.2% | 1.1% |
| Share of his games at 3+ shots | 0.756 | 10.4% | 1.4% |
| Scoring chances a game (iSCF), season | 0.750 | 10.6% | 1.2% |
| Shots a game, last 5 | 0.742 | 10.6% | 1.4% |
| Share of his games at 2+ shots | 0.736 | 10.2% | 1.2% |
| His most shots in a game this season | 0.730 | 9.8% | 1.4% |
| Shots per 60 | 0.713 | 9.3% | 1.1% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Opponent: goals against a game | 0.579 | 6.2% | 2.6% |
| His team: shots for a game | 0.552 | 4.6% | 2.5% |
| Opponent: goals allowed at his position, × the league’s | 0.549 | 5.2% | 3.4% |
| Opponent: shots against a game | 0.539 | 5.2% | 3.3% |
| Game pace (both teams’ shots) | 0.516 | 3.7% | 3.5% |
| Opponent: shots allowed at his position, × the league’s | 0.507 | 4.7% | 3.3% |
| Opposing goalie: save % this season | 0.493 | 4.2% | 4.0% |
| Opponent: shots to his position, last 5, × the league’s | 0.497 | 4.2% | 4.0% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 1.0% | 2.1% (425) / 0.5% (876) | 0.7% (444) | 1.7% (417) | 0.7% (440) | 1.4% / 0.6% |
| 1 – 1.5 | 1525 | 1.6% | 1.8% (332) / 1.5% (1193) | 1.6% (516) | 2.1% (522) | 1.0% (487) | 1.8% / 1.3% |
| 1.5 – 2 | 956 | 4.0% | 2.3% (176) / 4.4% (780) | 4.4% (315) | 5.2% (325) | 2.2% (316) | 4.0% / 4.0% |
| 2 – 2.5 | 602 | 6.1% | 5.0% (139) / 6.5% (463) | 5.2% (191) | 6.4% (202) | 6.7% (209) | 9.3% / 3.0% |
| 2.5 – 3 | 351 | 8.8% | 9.1% (77) / 8.8% (274) | 9.3% (108) | 9.8% (123) | 7.5% (120) | 10.6% / 7.0% |
| 3 – 3.5 | 259 | 11.2% | 6.2% (64) / 12.8% (195) | 12.6% (87) | 8.3% (84) | 12.5% (88) | 10.9% / 11.5% |
| 3.5 + | 165 | 22.4% | 14.9% (47) / 25.4% (118) | 23.3% (60) | 20.5% (44) | 23.0% (61) | 25.4% / 20.4% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 105 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 4.2% → 3.8%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shot attempts a game (iCF), season over 5.18; Opponent: goals allowed at his position, × the league’s over × 0.90; Shots a game, last 5 over 3.10 | 107 | 32.7% | 60 | 10.0% |
| Shot attempts a game (iCF), season over 5.18; Opponent: goals allowed at his position, × the league’s over × 0.90; Shots a game, last 5 up to 3.10 | 151 | 13.9% | 46 | 6.5% |
| Shot attempts a game (iCF), season over 5.18; Opponent: goals allowed at his position, × the league’s up to × 0.58 | 108 | 13.0% | 25 | 8.0% |
| Shot attempts a game (iCF), season 3.47–5.18; at home | 378 | 7.9% | 193 | 5.7% |
| Shot attempts a game (iCF), season over 5.18; Opponent: goals allowed at his position, × the league’s × 0.58–× 0.90 | 132 | 7.6% | 58 | 13.8% |
| Shot attempts a game (iCF), season 3.47–5.18; away | 391 | 3.3% | 191 | 4.7% |
| Shot attempts a game (iCF), season up to 3.47; Share of his games at 3+ shots over 23.6% | 375 | 2.4% | 163 | 5.5% |
| Shot attempts a game (iCF), season up to 3.47; Share of his games at 3+ shots up to 23.6% | 1879 | 0.8% | 902 | 1.6% |

## 6+ shots

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
| Opponent: shots allowed at his position, × the league’s | × 1.01 | × 0.90 – × 1.16 | × 1.00 |
| Opponent: shots against a game | 27.71 | 25.75 – 30.33 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 1.01 | × 0.71 – × 1.41 | × 0.96 |
| Opponent: goals against a game | 3.38 | 2.88 – 3.80 | 3.08 |
| Opposing goalie: save % this season | 0.898 | 0.880 – 0.915 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Shot attempts a game (iCF), season | 0.821 | 5.5% | 0.2% |
| Unblocked attempts a game (iFF), season | 0.811 | 5.6% | 0.3% |
| Shots a game, season | 0.794 | 5.4% | 0.4% |
| Shots a game, last 10 | 0.792 | 5.4% | 0.4% |
| Shots a game, last 5 | 0.780 | 5.0% | 0.4% |
| Share of his games at 3+ shots | 0.778 | 4.6% | 0.5% |
| Scoring chances a game (iSCF), season | 0.776 | 4.7% | 0.4% |
| Share of his games at 2+ shots | 0.762 | 4.7% | 0.3% |
| His most shots in a game this season | 0.747 | 4.0% | 0.4% |
| Ice time a game (min), season | 0.738 | 4.2% | 0.3% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Opponent: goals against a game | 0.603 | 2.8% | 0.9% |
| Opponent: shots against a game | 0.574 | 2.6% | 1.1% |
| Opponent: goals allowed at his position, × the league’s | 0.544 | 2.3% | 1.6% |
| His team: shots for a game | 0.539 | 1.8% | 1.2% |
| Opponent: shots allowed at his position, × the league’s | 0.536 | 2.3% | 1.3% |
| Opponent: shots to his position, last 5, × the league’s | 0.527 | 2.1% | 1.3% |
| Opposing goalie: save % this season | 0.476 | 1.8% | 1.7% |
| Game pace (both teams’ shots) | 0.517 | 1.6% | 1.3% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on shots allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.3% | 0.9% (425) / 0.0% (876) | 0.2% (444) | 0.5% (417) | 0.2% (440) | 0.3% / 0.3% |
| 1 – 1.5 | 1525 | 0.4% | 0.3% (332) / 0.4% (1193) | 0.4% (516) | 0.4% (522) | 0.4% (487) | 0.7% / 0.1% |
| 1.5 – 2 | 956 | 1.8% | 0.6% (176) / 2.1% (780) | 1.9% (315) | 2.8% (325) | 0.6% (316) | 1.7% / 1.9% |
| 2 – 2.5 | 602 | 2.5% | 2.2% (139) / 2.6% (463) | 3.7% (191) | 2.5% (202) | 1.4% (209) | 3.7% / 1.3% |
| 2.5 – 3 | 351 | 4.3% | 3.9% (77) / 4.4% (274) | 4.6% (108) | 4.1% (123) | 4.2% (120) | 4.5% / 4.1% |
| 3 – 3.5 | 259 | 3.9% | 3.1% (64) / 4.1% (195) | 5.7% (87) | 1.2% (84) | 4.5% (88) | 3.1% / 4.6% |
| 3.5 + | 165 | 11.5% | 6.4% (47) / 13.6% (118) | 8.3% (60) | 15.9% (44) | 11.5% (61) | 13.4% / 10.2% |

**Plain rules** (a three-question tree fitted on 2026-10-09 to the day before 2026-10-23, 3521 skater-games, at least 105 a rule; checked on 2026-10-23 to 2026-10-29, 1638 skater-games it never saw; base rate 1.8% → 1.4%):

| When | Fitted: games | Fitted: hit | Check: games | Check: hit |
| --- | --- | --- | --- | --- |
| Shot attempts a game (iCF), season over 5.18; Opponent: shots against a game over 29.31 | 110 | 15.5% | 60 | 6.7% |
| Shot attempts a game (iCF), season over 5.18; Opponent: shots against a game up to 29.31; Ice time a game (min), season over 18.97 | 257 | 8.2% | 101 | 5.0% |
| Shot attempts a game (iCF), season 3.47–5.18; Opponent: shots against a game over 28.59 | 247 | 4.0% | 115 | 2.6% |
| Shot attempts a game (iCF), season over 5.18; Opponent: shots against a game up to 29.31; Ice time a game (min), season up to 18.97 | 131 | 1.5% | 28 | 0.0% |
| Shot attempts a game (iCF), season up to 3.47; Scoring chances a game (iSCF), season over 1.56 | 478 | 1.0% | 236 | 1.7% |
| Shot attempts a game (iCF), season 3.47–5.18; Opponent: shots against a game up to 28.59 | 522 | 1.0% | 269 | 2.2% |
| Shot attempts a game (iCF), season up to 3.47; Scoring chances a game (iSCF), season up to 1.56 | 1776 | 0.2% | 829 | 0.1% |

## 1+ goal

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
| Opponent: shots allowed at his position, × the league’s | × 1.00 | × 0.88 – × 1.13 | × 1.00 |
| Opponent: shots against a game | 27.00 | 25.29 – 29.27 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 0.94 | × 0.69 – × 1.26 | × 0.96 |
| Opponent: goals against a game | 3.00 | 2.67 – 3.44 | 3.08 |
| Opposing goalie: save % this season | 0.901 | 0.879 – 0.917 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Scoring chances a game (iSCF), season | 0.676 | 28.2% | 5.5% |
| Unblocked attempts a game (iFF), season | 0.660 | 27.4% | 6.6% |
| High-danger chances a game, season | 0.657 | 25.5% | 5.8% |
| Shots a game, season | 0.653 | 27.7% | 6.5% |
| Shots a game, last 10 | 0.652 | 27.6% | 6.8% |
| Share of his games at 2+ shots | 0.649 | 26.7% | 7.1% |
| Shots a game, last 5 | 0.644 | 25.8% | 6.8% |
| Shot attempts a game (iCF), season | 0.639 | 26.0% | 8.0% |
| His most shots in a game this season | 0.637 | 24.6% | 7.7% |
| Shots per 60 | 0.635 | 24.1% | 6.5% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| His team: shots for a game | 0.524 | 17.5% | 13.1% |
| Opponent: shots to his position, last 5, × the league’s | 0.515 | 16.1% | 13.9% |
| Opponent: goals against a game | 0.486 | 13.4% | 15.4% |
| Opponent: shots against a game | 0.510 | 16.0% | 14.3% |
| Opponent: shots allowed at his position, × the league’s | 0.508 | 17.9% | 16.0% |
| Opponent: goals allowed at his position, × the league’s | 0.495 | 14.3% | 14.2% |
| Game pace (both teams’ shots) | 0.505 | 15.5% | 14.7% |
| Opposing goalie: save % this season | 0.497 | 14.2% | 14.8% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 7.2% | 5.6% (425) / 8.0% (876) | 7.3% (452) | 6.9% (432) | 7.4% (417) | 7.5% / 7.0% |
| 1 – 1.5 | 1525 | 12.7% | 10.5% (332) / 13.3% (1193) | 11.9% (514) | 11.4% (509) | 14.9% (502) | 12.7% / 12.7% |
| 1.5 – 2 | 956 | 15.4% | 8.0% (176) / 17.1% (780) | 15.8% (303) | 15.7% (345) | 14.6% (308) | 17.0% / 13.8% |
| 2 – 2.5 | 602 | 21.4% | 13.7% (139) / 23.8% (463) | 21.8% (174) | 18.0% (205) | 24.2% (223) | 23.3% / 19.6% |
| 2.5 – 3 | 351 | 24.5% | 22.1% (77) / 25.2% (274) | 25.0% (116) | 23.4% (107) | 25.0% (128) | 26.8% / 22.1% |
| 3 – 3.5 | 259 | 28.2% | 15.6% (64) / 32.3% (195) | 30.9% (94) | 30.3% (76) | 23.6% (89) | 22.5% / 33.8% |
| 3.5 + | 165 | 32.7% | 27.7% (47) / 34.7% (118) | 26.5% (68) | 39.5% (43) | 35.2% (54) | 35.8% / 30.6% |

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
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season up to 0.936; Ice time a game (min), season over 21.03 | 117 | 44.4% | 40 | 32.5% |
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season up to 0.936; Ice time a game (min), season up to 21.03 | 621 | 27.2% | 316 | 26.3% |
| Scoring chances a game (iSCF), season 0.88–2.18; High-danger chances a game, season over 0.41 | 956 | 16.4% | 547 | 13.9% |
| Scoring chances a game (iSCF), season over 2.18; Opposing goalie: save % this season over 0.936 | 108 | 12.0% | 12 | 75.0% |
| Scoring chances a game (iSCF), season 0.88–2.18; High-danger chances a game, season up to 0.41 | 554 | 11.0% | 241 | 14.1% |
| Scoring chances a game (iSCF), season up to 0.88; Opponent: goals allowed at his position, × the league’s up to × 0.89 | 549 | 8.9% | 178 | 5.1% |
| Scoring chances a game (iSCF), season up to 0.88; Opponent: goals allowed at his position, × the league’s over × 0.89 | 616 | 3.7% | 304 | 9.5% |

## 2+ goals

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
| Opponent: shots allowed at his position, × the league’s | × 1.06 | × 0.93 – × 1.17 | × 1.00 |
| Opponent: shots against a game | 27.60 | 25.44 – 29.74 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 1.03 | × 0.71 – × 1.43 | × 0.96 |
| Opponent: goals against a game | 3.05 | 2.67 – 3.70 | 3.08 |
| Opposing goalie: save % this season | 0.904 | 0.883 – 0.921 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Scoring chances a game (iSCF), season | 0.780 | 6.1% | 0.1% |
| Unblocked attempts a game (iFF), season | 0.752 | 5.4% | 0.6% |
| Shot attempts a game (iCF), season | 0.736 | 5.2% | 0.5% |
| High-danger chances a game, season | 0.736 | 4.7% | 0.2% |
| Shots a game, last 10 | 0.733 | 5.3% | 0.3% |
| Shots a game, season | 0.732 | 5.3% | 0.3% |
| Share of his games at 3+ shots | 0.726 | 4.7% | 0.6% |
| Shots a game, last 5 | 0.719 | 4.8% | 0.2% |
| Share of his games at 2+ shots | 0.704 | 4.7% | 0.6% |
| Goals a game, season | 0.697 | 4.3% | 0.9% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Opponent: shots to his position, last 5, × the league’s | 0.601 | 3.0% | 0.8% |
| Opponent: shots allowed at his position, × the league’s | 0.590 | 3.6% | 1.5% |
| Opponent: shots against a game | 0.550 | 2.9% | 1.6% |
| Opponent: goals allowed at his position, × the league’s | 0.549 | 2.9% | 1.7% |
| His team: shots for a game | 0.541 | 2.0% | 1.7% |
| Opposing goalie: save % this season | 0.532 | 2.6% | 1.6% |
| Opponent: goals against a game | 0.532 | 2.9% | 2.1% |
| Game pace (both teams’ shots) | 0.476 | 1.5% | 2.1% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.2% | 0.5% (425) / 0.1% (876) | 0.7% (452) | 0.0% (432) | 0.0% (417) | 0.2% / 0.3% |
| 1 – 1.5 | 1525 | 1.5% | 1.2% (332) / 1.6% (1193) | 2.3% (514) | 0.4% (509) | 1.8% (502) | 1.2% / 1.8% |
| 1.5 – 2 | 956 | 1.5% | 0.6% (176) / 1.7% (780) | 2.6% (303) | 0.9% (345) | 1.0% (308) | 1.7% / 1.3% |
| 2 – 2.5 | 602 | 3.7% | 2.2% (139) / 4.1% (463) | 2.3% (174) | 3.4% (205) | 4.9% (223) | 4.3% / 3.0% |
| 2.5 – 3 | 351 | 5.7% | 6.5% (77) / 5.5% (274) | 6.0% (116) | 5.6% (107) | 5.5% (128) | 4.5% / 7.0% |
| 3 – 3.5 | 259 | 4.6% | 0.0% (64) / 6.2% (195) | 5.3% (94) | 5.3% (76) | 3.4% (89) | 5.4% / 3.8% |
| 3.5 + | 165 | 4.8% | 4.3% (47) / 5.1% (118) | 5.9% (68) | 7.0% (43) | 1.9% (54) | 6.0% / 4.1% |

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
| Scoring chances a game (iSCF), season over 2.39; Ice time a game (min), season over 18.87; Shots a game, last 5 up to 2.90 | 167 | 15.6% | 73 | 8.2% |
| Scoring chances a game (iSCF), season up to 2.39; Opponent: shots allowed at his position, × the league’s over × 1.16; Shots a game, last 5 over 1.63 | 109 | 6.4% | 55 | 1.8% |
| Scoring chances a game (iSCF), season over 2.39; Ice time a game (min), season over 18.87; Shots a game, last 5 over 2.90 | 148 | 5.4% | 72 | 6.9% |
| Scoring chances a game (iSCF), season over 2.39; Ice time a game (min), season up to 18.87; Opponent: shots against a game over 26.46 | 226 | 4.9% | 104 | 3.8% |
| Scoring chances a game (iSCF), season up to 2.39; Opponent: shots allowed at his position, × the league’s over × 1.16; Shots a game, last 5 up to 1.63 | 372 | 1.3% | 149 | 2.7% |
| Scoring chances a game (iSCF), season 0.95–2.39; Opponent: shots allowed at his position, × the league’s up to × 1.16 | 1323 | 1.0% | 680 | 1.0% |
| Scoring chances a game (iSCF), season up to 0.95; Opponent: shots allowed at his position, × the league’s up to × 1.16 | 1004 | 0.0% | 448 | 0.4% |
| Scoring chances a game (iSCF), season over 2.39; Ice time a game (min), season up to 18.87; Opponent: shots against a game up to 26.46 | 172 | 0.0% | 57 | 5.3% |

## 3+ goals

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
| Opponent: shots allowed at his position, × the league’s | × 1.09 | × 1.06 – × 1.16 | × 1.00 |
| Opponent: shots against a game | 28.00 | 26.50 – 29.64 | 27.00 |
| Opponent: goals allowed at his position, × the league’s | × 1.11 | × 0.87 – × 1.41 | × 0.96 |
| Opponent: goals against a game | 3.00 | 2.67 – 3.64 | 3.08 |
| Opposing goalie: save % this season | 0.913 | 0.898 – 0.921 | 0.900 |

**Which numbers separate them** (AUC: 0.5 is a coin flip, 1 is perfect; under 0.5 the lower number is the better sign; the hit rate in the top and bottom fifth of the number):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Scoring chances a game (iSCF), season | 0.879 | 1.1% | 0.0% |
| Unblocked attempts a game (iFF), season | 0.868 | 1.0% | 0.0% |
| High-danger chances a game, season | 0.864 | 1.0% | 0.0% |
| Shot attempts a game (iCF), season | 0.854 | 1.0% | 0.0% |
| Share of his games at 3+ shots | 0.849 | 0.8% | 0.0% |
| Shots a game, last 10 | 0.809 | 0.8% | 0.0% |
| Shots a game, season | 0.798 | 0.8% | 0.0% |
| Shots a game, last 5 | 0.795 | 0.7% | 0.0% |
| Share of his games at 2+ shots | 0.777 | 0.8% | 0.0% |
| Ice time a game (min), season | 0.737 | 0.4% | 0.0% |

**The environment alone** (the same read for tonight’s opponent, goalie, game and venue):

| Number | AUC | Top fifth | Bottom fifth |
| --- | --- | --- | --- |
| Opponent: shots to his position, last 5, × the league’s | 0.737 | 0.7% | 0.0% |
| His team: shots for a game | 0.638 | 0.1% | 0.0% |
| Opponent: shots allowed at his position, × the league’s | 0.630 | 0.6% | 0.2% |
| Opponent: goals allowed at his position, × the league’s | 0.601 | 0.6% | 0.2% |
| Opposing goalie: save % this season | 0.579 | 0.4% | 0.2% |
| Opponent: shots against a game | 0.573 | 0.4% | 0.2% |
| Game pace (both teams’ shots) | 0.451 | 0.2% | 0.2% |
| Opponent: goals against a game | 0.527 | 0.4% | 0.3% |

**By his shots a game this season** (the ladder), split by the games behind that rate (1–4 / 5+), and inside each tier by the opponent’s third on goals allowed per skater at his position (soft = gives up the most), and home / away:

| His shots a game | Games | Hit | 1–4 games / 5+ games | Soft opp. | Mid opp. | Tough opp. | Home / away |
| --- | --- | --- | --- | --- | --- | --- | --- |
| under 1 | 1301 | 0.0% | 0.0% (425) / 0.0% (876) | 0.0% (452) | 0.0% (432) | 0.0% (417) | 0.0% / 0.0% |
| 1 – 1.5 | 1525 | 0.1% | 0.0% (332) / 0.2% (1193) | 0.2% (514) | 0.0% (509) | 0.2% (502) | 0.1% / 0.1% |
| 1.5 – 2 | 956 | 0.1% | 0.0% (176) / 0.1% (780) | 0.0% (303) | 0.0% (345) | 0.3% (308) | 0.2% / 0.0% |
| 2 – 2.5 | 602 | 0.8% | 0.7% (139) / 0.9% (463) | 1.1% (174) | 1.0% (205) | 0.4% (223) | 1.3% / 0.3% |
| 2.5 – 3 | 351 | 0.6% | 0.0% (77) / 0.7% (274) | 1.7% (116) | 0.0% (107) | 0.0% (128) | 0.6% / 0.6% |
| 3 – 3.5 | 259 | 0.4% | 0.0% (64) / 0.5% (195) | 1.1% (94) | 0.0% (76) | 0.0% (89) | 0.8% / 0.0% |
| 3.5 + | 165 | 1.2% | 2.1% (47) / 0.8% (118) | 1.5% (68) | 2.3% (43) | 0.0% (54) | 1.5% / 1.0% |

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

| Date | Skater | Team | vs | Shots | His shots a game | His goals a game | Chances a game | Ice time | Opp. shots allowed at his position | Opp. goals allowed at his position | Goalie sv % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-10 | Kirill Kaprizov | MIN | FLA | 4 | 2.25 | 0.75 | 2.75 | 21.95 | × 1.16 | × 1.41 | 0.900 |
| 2026-10-10 | Brandon Hagel | TBL | NYI | 6 | 5.00 | 0.25 | 4.75 | 22.22 | × 1.16 | × 1.41 | 0.983 |
| 2026-10-13 | Brady Tkachuk | FLA | CBJ | 4 | 2.80 | 0.00 | 2.80 | 17.39 | × 0.87 | × 1.11 | 0.909 |
| 2026-10-15 | Kirill Marchenko | TOR | BUF | 3 | 2.00 | 0.20 | 3.00 | 18.98 | × 0.76 | × 1.10 | 0.850 |
| 2026-10-15 | Brady Tkachuk | FLA | VAN | 6 | 3.00 | 0.50 | 3.00 | 17.21 | × 1.16 | × 1.51 | 0.926 |
| 2026-10-15 | Matt Boldy | MIN | STL | 8 | 3.86 | 0.29 | 3.86 | 21.14 | × 0.82 | × 0.98 | 0.921 |
| 2026-10-15 | Mark Stone | VGK | CGY | 3 | 2.14 | 0.29 | 3.43 | 19.39 | × 1.30 | × 1.41 | 0.839 |
| 2026-10-17 | Sam Bennett | FLA | SEA | 4 | 2.29 | 0.00 | 2.71 | 19.18 | × 1.06 | × 0.51 | 0.913 |
| 2026-10-17 | Carter Verhaeghe | FLA | SEA | 5 | 1.43 | 0.43 | 3.00 | 18.61 | × 1.06 | × 0.51 | 0.913 |
| 2026-10-20 | Mikko Rantanen | DAL | BOS | 6 | 1.88 | 0.25 | 2.00 | 20.72 | × 1.06 | × 0.71 | 0.925 |
| 2026-10-24 | Drake Batherson | OTT | NYR | 3 | 2.27 | 0.36 | 2.73 | 17.94 | × 1.09 | × 0.87 | 0.915 |
| 2026-10-29 | Viktor Arvidsson | DET | CHI | 6 | 2.58 | 0.42 | 4.08 | 18.87 | × 1.16 | × 1.43 | 0.898 |
| 2026-10-29 | Logan Cooley | UTA | PIT | 5 | 1.23 | 0.31 | 2.08 | 18.27 | × 1.15 | × 1.64 | 0.879 |
