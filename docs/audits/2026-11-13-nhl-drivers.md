# What drives shots, goals and points, and when a goal streak carries (2026-11-13)

Vincent, 2026-11-13: *find out when a goal hot streak predicts the next game of a goal (Eklund was on a 4 goal streak and
scored for the Islanders). Thoroughly analyze the games of the 2026 season and see what the drivers are for shots, points
and goals. Is it the environment. Is it toi? How is toi determined? Based on power plays? What are the l5, l10, l15,
season values that must hold true for 3 shots, 4 shots, per position, per line, home and away? Investigate every angle to
increase the accuracy of our model as I have a feeling that we have not reached the ceiling yet.*

**Scripts.** `tools/predictors/drivers_frame.py` (one row per skater-game, every read built from the games before it) →
`tools/predictors/drivers.py`. Every table quoted is in [2026-11-13-nhl-drivers-tables.md](2026-11-13-nhl-drivers-tables.md).

**Data.** The public box scores and play-by-play (positions as played, `relabel.py`) and the NHL stats API's minutes
split even strength / power play / short-handed: 2026-27 to Nov 12 (309 games, 11,123 skater-games), 2025-26 and 2024-25
whole (1,312 games each) as the check and the priors; 105,577 skater-games. The line is his last-10 even-strength
minutes ranked among the skaters dressed (forwards in threes, defensemen in pairs), since the box score carries no lineup.

**Method.** Cross-validated Poisson (five folds of whole dates), scored as the share of the deviance explained over
the position's average. Groups of reads are graded alone, dropped from the full read, and one read at a time with a
95% interval over dates. "Hindsight" rows hand the fit what tonight turned out to be: they are ceilings, never reads.

## In one paragraph

**The streak does not carry.** After goals in two straight games a skater scored 27.2% of the time and his numbers,
with the streak hidden from them, said 26.4%; after four straight 31.1% against 31.7%. No cut of the streak (shots
during it, shooting %, minutes up, line, power play, venue, rest, opponent) changes that. **The driver is the skater's
own volume**: his shots, attempts and chances explain 16% of the 17% that can be explained for shots; minutes and line
come next; the opponent is worth ±6% on shots and ±7% on points, nothing on goals. **Minutes convert to shots one for
one** (10% more minutes, 10% more shots), but 75% of a skater's minutes are his role, and what moves them on the night
(the line he is moved to, overtime, the power plays called, the score) is mostly not knowable before the puck drops.
**The ceiling**: 72% of the night-to-night variance in shots is chance, 85% in points, 90% in goals. The full pre-game
read already matches a perfect knowledge of the skater's true season rate; what is left sits in the game itself (his
minutes tonight, his team's night). **One gap is ours**: the plain-rate formula reads this season's rate alone from the
fifth game, and blending it into last season's lifts it from 13.2% to 15.8% explained on shots this season.

## A. When does a goal streak predict a goal?

The test: every skater-game with 8+ games this season behind it (86,513 over three seasons). "Said" is P(1+ goal) from
the full read with the heat taken out of it (no streak, no last-3 / 5 / 10 goals or points; his season and last season,
shots, chances, minutes, line, the opponent). If the streak carries, the skaters on one score more than that.

| Goal in N straight going in | skater-games | scored | his numbers said | scored / said (95%) | his raw goals a game said |
|---|---|---|---|---|---|
| none | 73,108 | 14.3% | 14.2% | 1.00 (0.99–1.02) | 13.5% |
| 1 | 10,469 | 20.4% | 20.3% | 1.00 (0.96–1.04) | 22.2% |
| 2 | 2,139 | 26.6% | 25.3% | 1.05 (0.98–1.13) | 28.9% |
| 3 | 569 | 27.8% | 28.5% | 0.98 (0.85–1.10) | 33.7% |
| 4 | 159 | 29.6% | 31.0% | 0.95 (0.73–1.18) | 37.2% |
| 5+ | 69 | 34.8% | 33.2% | 1.05 (0.71–1.38) | 40.8% |
| 2+ | 2,936 | 27.2% | 26.4% | 1.03 (0.97–1.09) | 30.6% |
| 4+ | 228 | 31.1% | 31.7% | 0.98 (0.79–1.17) | 38.3% |

- **A skater on a streak scores more often than the league (27–35% against 14%) because of who he is, not because of
  the streak.** His numbers said so already. This season alone: 202 skater-games on 2+ straight, scored 24.3%, said 27.1%.
- **His raw goals a game overstates him by 3 to 7 points**, because the streak is inside it. That is the figure that makes
  a streak look predictive on a props screen.
- **No condition makes it carry.** Cut by shots during the run (under 2 a game to 4+), shots against his season, shooting
  % during the run, chances, minutes up or down, a multi-goal game in it, power-play unit, line, position, venue, rest,
  the opponent's goals allowed (season, last 5), the position's chances allowed, the starter's save %, his team's
  scoring: 62 cells, nearly all between 0.90 and 1.15, four outside their interval (second-line forwards ×1.15,
  fourth-liners ×1.55 on 135 games, the 22–30% band ×1.17 beside ×0.94 for 30%+, third-pair defensemen 0 for 25), where
  chance alone gives three, and they point no single way. As a multiplier on
  top of his numbers: one straight ×0.99, two ×1.03, three or more ×0.95, none different from 1.
- **What the cuts do show is which streaks belong to scorers**: 4+ shots a game during the run scored 33% (said 33%),
  under 2 a game 22%; first power-play unit 31% against 19%; first line 31.5%, third line 18.6%; against the leakiest
  third of defenses 30%, the tightest 25%. Each is in his numbers.
- Goals in his last five whatever the order (0 to 5), the drought (games since his last goal), the point streak and
  the 3+ SOG streak all read the same: scored / said between 0.92 and 1.04.
- **Eklund**: goals on Nov 5, 7, 9 and 12. Going into Nov 12 on three straight his numbers said 31% (23% and 19% the
  two games before: his minutes went 14.3 → 18.1 at San Jose with five scoring chances, and the read moved on that, not
  on the goals). A 31% call that lands is a 31% call.

The site's "Running hot" list is right to call the streak colour; nothing to change.

## B. The drivers: is it the environment, is it the minutes?

Share of the deviance explained (0 = knowing only his position), 2026-27 / 2025-26:

| | shots | goals | points |
|---|---|---|---|
| his production alone (shots, goals, assists: season, L5 / L10 / L20, last season) | 15.8 / 16.3 | 6.6 / 7.0 | 12.4 / 11.7 |
| + his attempts and chances | 16.2 / 16.6 | 6.8 / 7.0 | 12.6 / 11.7 |
| + his minutes and line | 16.5 / 16.9 | 7.1 / 7.2 | 13.1 / 12.1 |
| + his power-play / kill role | 16.5 / 16.9 | 7.1 / 7.2 | 13.3 / 12.2 |
| + the opponent | 16.7 / 17.2 | 7.3 / 7.2 | 13.6 / 12.3 |
| + home, rest, venue split | 16.8 / 17.2 | 7.3 / 7.2 | 13.6 / 12.3 |
| + his team, regulars out, streaks | 16.7 / 17.2 | 7.2 / 7.2 | 13.6 / 12.3 |
| **the full read** | **16.7 / 17.2** | **7.2 / 7.2** | **13.6 / 12.3** |
| the site's plain-rate formula (`picks-pure.js`) | 13.4 / 15.9 | 5.5 / 6.4 | |
| boosted trees on the same reads | 16.5 / 17.0 | 7.0 / 7.0 | 12.9 / 11.9 |

Each group read alone (with nothing else), 2026-27: shots — production 15.8, attempts 16.2, minutes and line 11.5,
power-play role 12.2, the opponent 0.6, venue / rest 0.4, his team 0.7, streaks 7.7. Goals — 6.6, 6.4, 5.6, 5.7, 0.1,
0.0, 0.3, 3.5. Points — 12.4, 10.6, 10.8, 11.5, 0.4, 0.2, 0.6, 6.6.

- **Shots are the skater's own volume.** Attempts and chances are the one group the rest cannot replace (dropping them
  costs 3.4 per 1,000 skater-games, interval −5.6 to −1.2). His minutes and line are second (−2.6).
- **Goals are shots and chances plus minutes**; his goal rate itself adds almost nothing once those are in.
- **Points are the one stat where the role matters by itself**: minutes and line (−5.1, clear of 0), the power-play role
  (−3.1, clear of 0) and his own points history (−3.0).
- **The environment is real and small.** One read at a time on the core (56,911 skater-games, both seasons): for shots
  only the opponent's reads and home clear 0. The best is the opponent's shots allowed a game blended into last season
  (−3.7; bottom fifth ×0.93, top fifth ×1.06), then the position cell (−2.2; ×0.93 / ×1.05), the last ten of either
  (−2.0 / −1.2), home (−0.6). For goals nothing clears 0. For points the opponent's goals allowed (×0.94 / ×1.07) and
  the chances it allows to the position (×0.94 / ×1.08).
- **What added nothing on any stat**: streaks and the last three games (they make goals and points worse), rest and
  back-to-backs, his venue split against his season (ratio 0.98–1.01 across its range), the goalie's save %, the
  opponent's penalties, a tired opponent, the win-rate gap, his team's totals, the spread of his last ten, his best
  recent game, his shooting % against last season's, per-60 × projected minutes.
- **Boosted trees lose to the plain fit**: there is no hidden interaction to mine.

### The ceiling

| | shots | goals | points |
|---|---|---|---|
| the full read, before the game | 16.7 / 17.2 | 7.2 / 7.2 | 13.6 / 12.3 |
| his true rate in hindsight (the rest of his 2025-26 season, this game left out) | 16.5 | 5.7 | 11.4 |
| + the line he played tonight | 17.6 / 18.2 | 7.3 / 7.3 | 13.7 / 12.5 |
| + his minutes tonight | 19.5 / 20.1 | 7.6 / 7.6 | 14.3 / 13.0 |
| + the game (power plays, overtime, margin) | 16.8 / 17.4 | 11.3 / 11.7 | 19.8 / 19.2 |
| + his team's shots and goals tonight | 21.0 / 22.0 | 14.6 / 14.9 | 25.2 / 24.6 |
| + all of tonight | 23.7 / 24.7 | 15.2 / 15.7 | 26.6 / 26.0 |

- **The read of the skater is at its ceiling.** The full pre-game read explains as much as knowing his true rate over
  the whole season would (17.2 against 16.5 on shots; it beats it because it follows his role as it changes).
- **What is left is the game.** His minutes tonight are worth 2.8 points on shots, a third of it the line he ends up on.
  His team's night is worth 4.3 on shots, 7.3 on goals and 11.6 on points, and it can barely be seen coming: a team's
  shots tonight against own rate × the opponent's allowed r² 0.11, its goals r² 0.02.
- **Most of a night is chance.** Variance of the count against its mean: a Poisson count leaves 72% of the variance in
  shots to chance, 85% in points, 90% in goals. The read explains 22% / 15% / 8%; with all of tonight known 31% / 34% / 16%.
- **The top of the night** (best three a night, 2026-27 / 2025-26): 3+ SOG 66% / 66% for the full read, 61% / 64% for
  the plain-rate formula, 78% with all of tonight known. 4+ SOG 47% / 47%. 1+ goal 39% / 42%. **1+ point 75% / 73%**:
  the steadiest call measured (the plain-rate read has no points figure; the model's points λ was not graded here).

## C. Minutes: what they are, what moves them, what they are worth

**What they are made of** (2026-27):

| line | minutes | even | power play | short-handed | shots | goals | points |
|---|---|---|---|---|---|---|---|
| F1 | 18.8 | 15.1 | 3.0 | 0.7 | 2.41 | 0.36 | 0.88 |
| F2 | 16.5 | 13.5 | 2.0 | 1.0 | 1.80 | 0.25 | 0.57 |
| F3 | 14.1 | 12.0 | 1.2 | 0.9 | 1.40 | 0.18 | 0.41 |
| F4 | 11.3 | 10.0 | 0.5 | 0.8 | 1.06 | 0.11 | 0.25 |
| D1 | 22.4 | 18.9 | 1.6 | 2.0 | 1.59 | 0.10 | 0.51 |
| D2 | 19.6 | 16.9 | 0.8 | 1.9 | 1.21 | 0.08 | 0.34 |
| D3 | 15.4 | 13.8 | 0.4 | 1.2 | 0.90 | 0.05 | 0.21 |

- **The role is 75% of it.** Between skaters the minutes spread by 3.95; one skater's own night to night by 2.26.
  Power-play minutes are 62% role, 38% the night.
- **What moves a skater off his last 10** (56,458 skater-games, hindsight, R² 0.39): the place he takes in the
  even-strength order tonight carries 30% on its own (0.64 minutes a place); his last 5 against his last 10 2.5%;
  overtime +0.57; each power play over the average +0.44 to a first-unit skater and −0.17 to the rest; each kill −0.27 to
  a non-killer, +0.12 to a killer; a top-six forward out +0.35 to every forward, a top-four defenseman out +0.73 to every
  defenseman; eleven forwards dressed +0.64, seven defensemen −1.25 each; home and back-to-backs nothing.
- **The score moves the top and the bottom in opposite ways.** First-line forwards play 1.4 minutes under their last 10
  in a win by 3+ and 0.6 over in a one-goal loss; fourth-liners +0.7 in a blowout win, −0.4 in a one-goal loss.
- **Power plays: yes in hindsight, no before the game.** A team's power plays tonight against its own drawn a game:
  r 0.09; against the opponent's penalties: r 0.09; the two multiplied: r 0.12. Who gets the minutes is stable (his
  share tonight against his last-10 share: r 0.85); how many there will be is not knowable.
- **Before the game** the miss is 1.95 minutes for his last 10, 1.93 for his season, 1.87 for a fit of his windows, 1.86
  with the line by his recent minutes, the power-play unit, a regular out, rest and the matchup's penalties all added.
  Only a posted lineup that moves him does better (the 2026-11-07 audit: 1.56 with the played line).

**What a minute is worth.** Per 60 minutes, 2026-27: forwards 12.4 shots on the power play against 5.9 otherwise,
defensemen 8.9 against 3.6. First-unit forwards take 32% of their shots in the 18% of their minutes on the power play.
A straight fit per minute by strength puts a power-play minute at 2.2× an even-strength one for a forward's shots, 2.7×
for his goals, 3.2× for his points (defensemen 3.4× / 4.3× / 7.0×). A short-handed minute is worth nothing.

**The night he plays more than usual** (against what the full read said):

| minutes against his last 10 | shots | goals | points |
|---|---|---|---|
| 3+ fewer | ×0.73 | ×0.80 | ×0.81 |
| 1.5–3 fewer | ×0.89 | ×0.95 | ×0.95 |
| level | ×0.99 | ×0.99 | ×0.99 |
| 1.5–3 more | ×1.14 | ×1.06 | ×1.08 |
| 3+ more | ×1.24 | ×1.14 | ×1.16 |

The elasticity of shots to tonight's minutes is 0.99: shots follow minutes one for one. Goals 0.76, points 0.79.

**A regular out.** With two top-six forwards newly out (three games or fewer) the forwards who dressed played 15.4
minutes against a last 10 of 14.1 and shot ×1.06 what the read said (goals ×1.13, points ×1.08; 1,084 skater-games). One
out: ×1.02. Two of the team's three heaviest shooters out: ×1.05. Cross-validated, the group adds nothing (interval
across 0): his last ten absorb an absence within a few games. Nothing like the NBA's star-out lift.

## D. What the L5 / L10 / L15 / season averages must be

Skater-games with 5+ games this season and 15+ on record, so every window is whole (84,205 over three seasons, 7,230 this
season; L5 / L10 / L15 run across the season boundary, as a props screen shows them). Base rates: 2+ 43.8%, 3+ 22.6%,
4+ 10.6%, 5+ 4.7% (this season 43.7 / 22.7 / 10.4 / 4.5).

**The shots a game he needs on a window, read alone:**

| mark | L5 | L10 | L15 | season | home (season) | away (season) |
|---|---|---|---|---|---|---|
| 2+ at 60% | 2.5 | 2.3 | 2.3 | 2.2 | 2.2 | 2.3 |
| 2+ at 70% | 3.1 | 2.8 | 2.7 | 2.6 | 2.6 | 2.7 |
| 3+ at 50% | 3.4 | 3.0 | 2.9 | 2.85 | 2.8 | 2.9 |
| 3+ at 60% | 3.9 | 3.5 | 3.3 | 3.2 | 3.1 | 3.3 |
| 4+ at 40% | 4.0 | 3.6 | 3.4 | 3.3 | 3.2 | 3.4 |
| 4+ at 50% | out of reach | out of reach | out of reach | 3.7 | 3.6 | 3.8 |

- **The shorter the window, the higher the bar.** A 3.0–3.5 over his last five is a 46% call at 3+; a 3.0–3.5 on the season is
  55%. A hot five games are mostly luck coming back to his season.
- **Position does not matter at the same average.** C, LW, RW and D need the same figure within 0.05 (3+ at 50%: season
  2.87 / 2.90 / 2.85 / 2.80).
- **The line and the power play do.** At the same average the role adds:

| 3+ SOG at an average (L10 and season, halved) of | 1.5–2.0 | 2.0–2.5 | 2.5–3.0 | 3.0–3.5 | 3.5+ |
|---|---|---|---|---|---|
| F1 | 32% | 38% | 47% | 59% | 62% |
| F2 | 26% | 35% | 47% | 49% | 64% |
| F3 | 22% | 31% | 39% | 45% | |
| F4 | 16% | 22% | | | |
| D1 | 25% | 34% | 43% | 54% | 55% |
| D2 | 23% | 33% | 44% | | |
| first power-play unit | 31% | 38% | 48% | 56% | 62% |
| not on it | 22% | 31% | 38% | 49% | |
| home | 26% | 37% | 47% | 58% | 65% |
| away | 24% | 34% | 45% | 54% | 60% |

  A 2.5–3.0 average is 48% on the first power-play unit and 38% off it; 47% on the first two lines and 39% on the third.
  A third- or fourth-liner never becomes a 50% call at 3+ on any window he actually reaches, nor a third-pair
  defenseman (a second-pair one only on a season average of 2.7+). 4+ at 50% is reachable only by first-line forwards (season 4.0, L10 4.5).
- **Home is worth 2 to 4 points** at the same average, or 0.1 to 0.15 shots a game on the bar.
- **Every window over the bar at once** (L5, L10, L15 and season):

| all four at | a night | 2+ | 3+ | 4+ | 5+ | 3+ home / away |
|---|---|---|---|---|---|---|
| 2.0+ | 47 | 71% | 47% | 27% | 14% | 48% / 45% |
| 2.5+ | 19 | 77% | 55% | 34% | 19% | 56% / 53% |
| 3.0+ | 7.7 | 81% | 60% | 39% | 23% | 63% / 57% |
| 3.5+ | 2.2 | 84% | 64% | 45% | 29% | 68% / 59% |
| 4.0+ | 0.6 | 86% | 66% | 47% | 32% | 67% / 65% |

  This season the same: 3.0+ on all four went 3+ 60% of the time (298 skater-games), 3.5+ 63%. **About two in three is
  the top of the scale for 3+ SOG, under one in two for 4+.**
- **A screen's hit rates overstate by 10 to 20 points.** Skaters who went 3+ in 60%+ of every window landed 60% (their
  L10 said 73%); 70%+ of every window landed 61% (said 81%); 80%+ landed 66% (said 87%). At 4+, 50%+ of every window
  landed 42% (said 63%).
- **Which window carries it**: read together, the season average takes 71% of the weight for 3+ SOG, the L15 27%, the L5
  and L10 nothing (4%, −2%). Alone, AUC 0.698 / 0.719 / 0.728 / 0.735 for L5 / L10 / L15 / season.

## E. The shape of the count

A Poisson at the read's λ is close: variance over mean 1.10 to 1.15 in every band. It overstates only at the top: at
λ 3.5+ it says 72% for 3+ and 68% land, 51% for 4+ and 47% land. 1+ goal lands as said up to 40% (said 43%, landed 40%
above it); 1+ point lands as said across the range (66.5% said, 65.1% landed at the top). At the same λ, steady and
streaky shooters (the spread of the last ten) land the same.

## F. The plain-rate formula: this season alone against blended

`picks-pure.js` reads this season's rate alone from the fifth game (Vincent's call, 2026-10-27: "this season's rate, no
blend"). Same coefficients, only the rates going in changed to `this season × n / (n + k) + last season × k / (n + k)`,
on the 6,984 skater-games of 2026-27 where both exist:

| 3+ SOG | explained | best 10 a night | calls at 50%+ | said | landed |
|---|---|---|---|---|---|
| this season alone (shipped) | 13.2% | 59.4% | 565 | 61.4% | 58.2% |
| k = 10 | 15.7% | 62.0% | 503 | 60.5% | 61.6% |
| k = 15 | 15.8% | 61.1% | 494 | 60.3% | 62.3% |
| k = 30 | 15.7% | 60.3% | 494 | 60.0% | 60.7% |

Goals: 5.2% explained as shipped, 5.9% with the volume at k = 15 and the goal rate into last season's at k = 40. By
games played this season: shots 10.4 → 14.7 at 5–9 games, 14.3 → 16.0 at 10–14, 15.6 → 16.5 at 15+. On 2025-26 the gain
runs out as the season fills (11.8 → 16.6 at 5–9 games, 17.1 → 18.3 at 10–19, 16.0 → 16.4 at 20–39, level from 40).

## What this means for the model

Ranked by what was measured. Nothing was changed; each is a call.

1. **Blend the plain-rate read into last season** (section F): the largest gain found, +2.6 points of deviance on shots
   today, calls that land where they say, fading to nothing by game 40. It reverses the 2026-10-27 call.
2. **Let the shots follow the minutes when the posted line moves him.** Shots follow minutes one for one, the line he
   plays is the single biggest mover of his minutes, and the model's shots λ does not scale with its projected minutes
   (2026-11-07 audit). The ceiling is 0.8–1.0 points of deviance; what the posted lines earn of it needs the stored
   lineups (the scorecard export), which this study could not read.
3. **Read the opponent as a team first.** Its shots allowed a game, blended into last season, is the best single
   environment read for shots (−3.7 against −2.2 for the position cell); the plain-rate formula carries the position
   cell only. Worth ±6%. For goals leave the environment out; for points use the opponent's goals allowed and the
   chances it allows to the position (±7%).
4. **A points read.** 1+ point is the steadiest top-of-the-night call measured (75% / 73% for the best three), driven
   by production, minutes and the power-play role, and it lands as said.
5. **Trim the top of the ladder.** Poisson runs 4 points high at 3+ and 4+ for the heaviest shooters; the board's
   calibration covers the printed figure, the raw ladder does not.
6. **On the screens**: the season average and the L15 are the windows to read; a hit rate of 70–80% on every window is
   a 61–66% call; a third-liner's average is worth 8–10 points less than a first-liner's.
7. **Stop looking at**: streaks of any kind, venue splits, rest, the goalie for shots or goals, forecast power plays,
   regulars out (unless two went out this week: +6%), steadiness, boosted models. Each was measured at nothing.

The accuracy that remains is in the game, not the skater: his minutes tonight and his team's night. The only part of
that visible before puck drop is the posted lineup.

## Limits

- The line is read from recent minutes, not the posted lineup; section C's "line he played" is from the result.
- The model proper (`model-core.js`) is not replayed here: that needs the scorecard export. The plain-rate formula is.
- 2026-27 is 309 games: every figure given for this season alone moves by a point or two; the three-season figures
  are the ones to lean on, and the two seasons agree throughout.
- The 62 streak cuts and the 55 single reads are many looks: a lone cell outside its interval is expected.
