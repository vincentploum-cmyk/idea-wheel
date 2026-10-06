# What predicts a skater's shots and goals? (2026-27 to date, 2025-26 as the control)

Revision 3: head-to-head re-tested across seasons (section 8); environment window test, L5 / L10 / L15 / season (section 9).

Study date: 2026-10-06. Rerun with `tools/predictors/run.sh 2026` (see `tools/predictors/README.md`).

**Data.** Every finished regular-season game of 2026-27 so far: 43 games, 1,548 skater-games,
617 skaters (Sept 29 to Oct 5; teams have played 2 to 4 games). Each row carries only what was
knowable before puck drop: the player's own games earlier this season, the opponent's earlier
games this season, the schedule, and last season's MoneyPuck summary for the player and both
teams. Because 931 rows have at least one prior game and nobody has more than three, every
finding was re-run on the full 2025-26 season (1,312 games, 47,231 skater-games) as the control;
a finding is reported only when both agree, and the control's numbers are quoted where this
season cannot answer yet (windows longer than 3 games, repeat meetings).

**Method.** Spearman correlation with 95% bootstrap intervals (whole games resampled), then
grouped 5-fold cross-validated Poisson models scored on deviance per row, MAE, and the log loss
of P(2+ SOG), P(3+ SOG) and P(1+ goal). Lower is better; the differences that matter are the
gaps between rows of the same ladder on the same rows.

## The answer in one table

| Question | Finding | Evidence |
|---|---|---|
| Best single read for tonight's SOG | **Last season's SOG per game.** It beats everything this season's games can offer until a player has ~18 games. | rho 0.42 vs 0.25 for the season-to-date average; CV deviance 1.201 vs 1.337 (section 1, 2) |
| How much to trust this season's average | Weight it n / (n + 18): about 10% after 1 to 3 games, 25% at 4 to 10, 50% at ~18, 70% at 40+. Goals shrink harder: n / (n + 40). | Fitted on both seasons: k = 16 (2026-27) and 18 (2025-26) for SOG, 42 and 39 for goals (section 3) |
| Best this-season volume signal | **Shot attempts (iCF / iFF), not SOG.** Attempts are the less noisy count; for defensemen season-to-date iCF already beats last season's SOG. | CV deviance 1.279 (iCF) vs 1.337 (SOG) this season; D: 1.310 vs 1.330 vs 1.400 |
| "L5 average is x" | L5 is a weak stand-alone and adds almost nothing once the season rate is in. Season-to-date > L10 > L5 > L3 > last game, every time. | Control, skaters with 20+ games: deviance L5 1.340, L10 1.302, season 1.263, season + L5 1.262 (section 7) |
| Hot hand (big last game) | None. The next game lands on the player's baseline. | Last game 4 SOG: next game 2.02 vs baseline 2.08 (this season), 2.13 vs 2.14 (control). 5+ SOG: +0.6 on n=31 here, +0.1 on n=1,965 in the control |
| Scored last game | No carry-over. Scorers score again at their own rate, not above it. | Scored 1 last game: P(1+ goal) next 0.22; their last-season rate implies 0.22 (control, n=5,693) |
| "He had 4 goals against this team" | **A small, real effect, not a driver.** Across seasons, a strong record against an opponent is worth about 1 to 2 points of P(1+ goal) on top of the player's full-season rate. Within a season it is worth nothing beyond chance. Most of the raw correlation is "good scorers score everywhere". | 2024-25 record vs 2025-26 rematches (38,539 games): 4+ goals vs the opponent last season scored in 31.0% of rematches vs 32.7% expected from the full-season rate; H2H term z = 4.6 against a rate that excludes those games, z = 1.5 against one that includes them; permutation p = 0.03. Within 2025-26 (24,662 games): the H2H term equals what shuffled opponent labels produce, p = 0.65 (section 8) |
| H2H shots | Nothing beyond the player's own SOG rate: within-season p = 0.20 against the shuffle; cross-season coefficient -0.008 once H2H goals are in. | section 8 |
| Opponent environment for SOG: which window? | **Season-to-date, by position.** Longer is better at every step: L5 < L10 < L15 < L20 < L30 < season, in both seasons, and shots allowed per skater at the position beats the team total at every window. L5 is the weakest read tested. One SD of the position season-to-date read is ~10% of a skater's SOG; the L5 read ~5%. | section 9: deviance 1.2540 (none) / 1.2508 (position L5) / 1.2482 (L10) / 1.2466 (L15) / 1.2425 (season); 2024-25 identical ranking |
| Opponent environment for goals: which window? | **Season-to-date goals allowed to the position**, and only that. L5 / L10 goals allowed (overall or by position) add nothing; one SD of the position season read is 14 to 18% of a skater's goal rate, the L5 read 3 to 6%. | section 9 |
| Home ice, back-to-back, rest | Tie-breakers only: home +4% SOG (control), 0% this season; back-to-back -2% (not significant); rest days nothing. | sections 1, 4h |
| Best goal read tonight | **Last season's xG per game** (or goals per game), then this season's iSCF. Season-to-date goals per game is noise until ~40 games; last season's shooting % is a persistent finishing signal worth keeping. | This season ll1 0.408 (LS xG) vs 0.427 (sTD goals); control full fit z = 7.5 for LS SH% (section 5, 7) |
| Shooting % this season | Useless now (worse than the intercept) and weak all year. | deviance 0.667 vs 0.643 intercept |

## 1. Correlation with tonight's SOG and goals (this season, 95% CI)

| Data point (prior to the game) | n | rho SOG | rho goals |
|---|---|---|---|
| Last season SOG/game | 1,465 | 0.42 (0.39 to 0.45) | 0.19 |
| Last season iFF/game | 1,465 | 0.42 | 0.19 |
| Last season SOG/60 | 1,465 | 0.39 | 0.20 |
| Last season xG/game | 1,465 | 0.38 | **0.21** |
| Last season goals/game | 1,465 | 0.38 | 0.20 |
| Season-to-date iCF avg | 931 | **0.33** (best this-season input) | 0.10 |
| Season-to-date iSCF avg | 931 | 0.31 | 0.13 |
| Season-to-date SOG avg (= L3 = L5 now) | 931 | 0.25 (0.19 to 0.30) | 0.09 |
| Last game SOG | 931 | 0.23 | 0.09 |
| Last season SH% | 1,465 | 0.22 | 0.15 |
| Season-to-date TOI avg | 931 | 0.13 | 0.03 |
| Opp SOG allowed to position (this season) | 972 | 0.11 (0.04 to 0.17) | 0.10 |
| Opp SOG allowed/game (this season) | 972 | 0.11 | 0.06 |
| Last game goals | 931 | 0.08 | 0.06 (CI crosses 0) |
| Season-to-date goals/game | 931 | 0.06 (CI crosses 0) | 0.04 (CI crosses 0) |
| Opp last season SOG allowed/game | 1,548 | 0.05 | 0.04 |
| Home ice | 1,548 | 0.00 | 0.04 |
| Back-to-back | 1,548 | 0.03 | -0.05 |
| H2H goals vs this opp (this season) | 69 | -0.08 | 0.21 (CI -0.01 to 0.35) |

Control (2025-26, full season): season-to-date iFF 0.40, last season iFF 0.40, last season
SOG 0.40, season-to-date SOG 0.40, L10 0.37, L5 0.34, L3 0.30, last game 0.21, H2H SOG 0.22,
opp SOG allowed to position 0.13, opp SOG allowed overall 0.05, home 0.02, back-to-back -0.01.
For goals: last season xG 0.24, season-to-date iSCF 0.24, last season goals 0.24,
season-to-date goals 0.21, opp goals allowed to position 0.13, H2H goals 0.09.

## 2. Shots: cross-validated model ladder (this season, rows with a prior game and a last-season record)

| Model | n | deviance | MAE | log loss P(2+) | log loss P(3+) |
|---|---|---|---|---|---|
| League mean | 931 | 1.440 | 1.137 | 0.682 | 0.523 |
| Last game SOG | 931 | 1.344 | 1.073 | 0.656 | 0.504 |
| Season-to-date SOG avg | 931 | 1.337 | 1.064 | 0.652 | 0.503 |
| Season-to-date iCF avg | 931 | 1.279 | 1.026 | 0.629 | 0.484 |
| Last season SOG/game | 888 | 1.201 | 0.984 | 0.608 | 0.465 |
| Last season SOG + season-to-date SOG | 888 | 1.197 | 0.984 | 0.606 | 0.466 |
| **Last season SOG + season-to-date iCF** | 888 | **1.185** | **0.977** | **0.601** | **0.462** |
| + season-to-date TOI | 888 | 1.188 | 0.981 | 0.601 | 0.463 |
| Player core + home | 888 | 1.200 | 0.985 | 0.606 | 0.468 |
| Player core + opp last-season SOG allowed | 888 | 1.195 | 0.985 | 0.606 | 0.467 |
| Player core + opp this-season SOG allowed (same 722 rows: 1.201 without it) | 722 | 1.187 | 0.983 | 0.599 | 0.466 |

Full fit, SOG ~ last-season SOG/game + season-to-date SOG + TOI + home + opp last-season
SOG allowed: last-season SOG z = 11.2, opp SOG allowed z = 2.1 (coefficient 0.036 per shot
allowed per game), season-to-date SOG z = 2.2, home and TOI not significant.

Out-of-fold calibration of the recommended early model (last-season SOG + season-to-date iCF +
opp last-season SOG allowed) is clean through the bands that carry volume: P(2+) predicted
0.26 / 0.34 / 0.45 / 0.54 / 0.65 / 0.76 / 0.89 against actual 0.24 / 0.30 / 0.46 / 0.60 / 0.65 /
0.76 / 0.92; P(3+) predicted 0.08 / 0.14 / 0.24 / 0.35 against actual 0.08 / 0.15 / 0.32 / 0.39
(`calibration.txt`).

## 3. How fast this season earns weight

E[SOG] = w x (season-to-date SOG avg) + (1 - w) x (last-season SOG/game), w fitted by games played:

| Prior games this season | w (this season) | 95% CI | source |
|---|---|---|---|
| 1 | 0.05 to 0.10 | 0.00 to 0.15 | both seasons |
| 2 | 0.10 | 0.00 to 0.20 | both seasons |
| 3 | 0.10 | 0.00 to 0.20 (control) | both seasons |
| 4 to 5 | 0.25 | 0.10 to 0.35 | control |
| 6 to 10 | 0.25 | 0.15 to 0.30 | control |
| 11 to 20 | 0.50 | 0.40 to 0.55 | control |
| 21+ | 0.70 | 0.65 to 0.75 | control |

The curve is w = n / (n + 18) for shots (k = 16 fitted on this season, 18 on the control) and
w = n / (n + 40) for goals (42 and 39). Using this season's average alone today costs deviance
3.05 vs 1.19 for the blend: it is not a small error.

## 4. Buckets (this season, with the control in brackets)

Last season's SOG/game bucket -> SOG tonight:

| LS SOG/game | n | SOG avg | P(2+) | P(3+) | P(1+ goal) |
|---|---|---|---|---|---|
| under 1 | 197 | 0.88 [0.88] | 0.22 | 0.06 | 0.07 |
| 1 to 1.5 | 290 | 1.23 [1.20] | 0.33 | 0.17 | 0.12 |
| 1.5 to 2 | 169 | 1.59 [1.72] | 0.44 | 0.21 | 0.15 |
| 2 to 2.5 | 130 | 2.02 [2.13] | 0.62 | 0.33 | 0.22 |
| 2.5 to 3 | 69 | 2.58 [2.67] | 0.75 | 0.48 | 0.29 |
| 3 to 3.5 | 20 | 3.90 [2.99] | 0.90 | 0.75 | 0.35 |
| 3.5+ | 13 | 3.23 [3.61] | 0.85 | 0.69 | 0.38 |

Season-to-date SOG bucket (prior games this season) -> SOG tonight: under 1: 1.11, 1 to 2:
1.42, 2 to 3: 1.55, 3 to 4: 1.97, 4+: 2.54. A 4+ average after two games is worth 2.5 tonight,
the same as a 2.5 last-season rate; the early average is mostly noise around the true rate.

Opponent, last season's SOG allowed per game -> SOG per skater-game (control):
under 26: 1.43, 26 to 27: 1.49, 27 to 28: 1.52, 28 to 29: 1.57, 29 to 30: 1.61, 30+: 1.60.
Opponent, this season's SOG allowed per game (prior games) -> control: under 25: 1.39, 25 to 28:
1.50, 28 to 31: 1.59, 31+: 1.69. The whole span of defenses is worth about 0.3 SOG a game to an
average skater, roughly one shot for a 3-shot player.

## 5. Goals: cross-validated ladder (this season)

| Model | n | deviance | log loss P(1+) |
|---|---|---|---|
| Intercept | 931 | 0.643 | 0.428 |
| Season-to-date goals/game | 931 | 0.640 | 0.427 |
| Season-to-date SOG avg | 931 | 0.629 | 0.423 |
| Season-to-date iSCF avg | 931 | 0.623 | 0.420 |
| Last season goals/game | 888 | 0.594 | 0.409 |
| **Last season xG/game** | 888 | 0.596 | **0.408** |
| Last season xG + season-to-date iSCF | 888 | 0.601 | 0.410 |
| Goal core + home | 888 | 0.594 | 0.406 |

Control, skaters with 20+ games: season-to-date iSCF (0.625) beats season-to-date goals
(0.631), season-to-date SOG (0.636), last season xG (0.633). The best combination is
season-to-date SOG + iSCF + last season xG + season-to-date goals + last season SH% (0.620),
with goals allowed to the position by the opponent the only environment term that helps.
Home ice: +4% in the control, not significant; this season's +42% (p = 0.01) does not replicate
and is treated as noise.

## 8. Head-to-head, done properly

The first version of this study tested only meetings earlier in the same season and put those
games inside the season-to-date rate, which biases the test against H2H. Three corrected tests:

**a) Within-season, 2025-26 (24,662 games with 10+ prior games and an earlier meeting; the
player's rate excludes the games against tonight's opponent).** The H2H goals term fits at
0.098 (z = 3.0). Shuffling which opponent each prior game was against (which keeps every
player's rate and removes any matchup effect) gives 0.107 +/- 0.036 (z = 3.3). The real value
is what chance produces: permutation p = 0.65 for goals, 0.20 for shots.

| Earlier goals vs the opponent this season | n | meetings | P(1+ goal) actual | expected from his rate | diff |
|---|---|---|---|---|---|
| 0 | 19,394 | 1.4 | 0.143 | 0.141 | +0.003 |
| 1 | 4,319 | 1.6 | 0.214 | 0.206 | +0.008 |
| 2 | 770 | 1.9 | 0.243 | 0.254 | -0.011 |
| 3 | 144 | 2.1 | 0.243 | 0.283 | -0.040 |
| 4+ | 35 | 2.4 | 0.400 | 0.303 | +0.097 |

**b) Cross-season, 2024-25 record vs 2025-26 rematches (38,539 games, 20+ GP last season).**

| Goals vs the opponent last season | n | P(1+ goal) actual | expected from his rate (ex those games) | diff |
|---|---|---|---|---|
| 0 | 25,687 | 0.133 | 0.133 | -0.001 |
| 1 | 9,206 | 0.200 | 0.196 | +0.004 |
| 2 | 2,623 | 0.258 | 0.244 | +0.014 |
| 3 | 791 | 0.273 | 0.265 | +0.008 |
| 4+ | 232 | 0.310 | 0.299 | +0.011 |

By how far the H2H rate beat the player's rate elsewhere (2+ meetings): 0.3 to 0.6 goals a game
above it, +1.7 points (n = 3,163); more than 0.6 above, +1.4 points (n = 1,260); 0.3 or more
below it, -2.0 points (n = 2,537). The H2H term fits at 0.171 (z = 5.0); the shuffle null gives
0.116 +/- 0.036, permutation p = 0.03. So there is a matchup-specific residual, and it is small:
against the full-season rate (which already contains those games) the excess is 0.055 per goal
a game (z = 1.5), which for a 0.45-goal-a-game scorer with 1.3 goals a game against tonight's
opponent moves P(1+ goal) from 0.362 to 0.376. H2H SOG adds nothing once H2H goals are in
(coefficient -0.008).

**c) This season so far (2025-26 record vs 2026-27 games, 1,354 games).** Same direction:
coefficient 0.365 against the ex-opponent rate (z = 2.2), shuffle null 0.112 +/- 0.195,
p = 0.08. The 45 skater-games by players with 3+ goals against the opponent last season: 11
scored (24.4%), expected 29.1% from their rates. Hagel (4 in 3 vs PHI) and Stützle (5 in 4 vs
BOS) are two of the 11; Crosby (4 vs PHI), Stamkos (4 vs MIN), Tuch (4 vs TBL), Batherson (4
vs TOR), Necas (4 vs LAK), Thomas (4 vs COL), Bertuzzi (4 vs VGK), Foerster, Zegras and
Michkov (vs NJD) were blanked.

**Reading.** Use the H2H goal record as a modifier of a few percent on the goal rate, in both
directions, from the previous season or longer; never from this season's meetings, and never as
a tier change. The scripts: `tools/predictors/h2h_cross.py`, `h2h_perm.py`,
`h2h_within_fixed.py`.

## 9. Environment: which window?

Opponent shots and goals allowed, overall and per skater at the position, over the opponent's
last 3 / 5 / 10 / 15 / 20 / 30 games and the season to date, all from games before the row.
Two scores. First, reliability: how well each window predicts the opponent's own shots allowed
over its next 10 games. Second, value: the cross-validated gain each window adds to a skater's
projection on top of his own baseline (season-to-date SOG, last season, iCF, L5 TOI, home),
skaters with 20+ games and opponents with 30+ games, same rows throughout.

**Reliability of the read itself** (correlation with the opponent's next 10 games):

| Window | shots allowed, 2025-26 | shots allowed, 2024-25 | goals allowed, 2025-26 | goals allowed, 2024-25 |
|---|---|---|---|---|
| L3 | 0.33 | | 0.09 | |
| L5 | 0.40 | 0.32 | 0.09 | 0.19 |
| L10 | 0.50 | 0.35 | 0.10 | 0.27 |
| L15 | 0.53 | 0.39 | 0.10 | 0.34 |
| L20 | 0.54 | | 0.07 | |
| L30 | 0.57 | | 0.10 | |
| Season to date | **0.59** | **0.45** | **0.14** | **0.42** |

Shots allowed is a stable team trait that a longer window measures better; goals allowed is
mostly goaltending noise and is barely predictable from any window shorter than a season.

**Value in the SOG projection** (deviance, lower is better; 24,707 skater-games in 2025-26,
25,679 in 2024-25):

| Environment read | 2025-26 | 2024-25 | % SOG per SD of the read (2025-26 / 2024-25) |
|---|---|---|---|
| none (player only) | 1.2540 | 1.2481 | |
| team shots allowed, L5 | 1.2514 | 1.2457 | 4.3 / 3.9 |
| team shots allowed, L10 | 1.2508 | 1.2449 | 4.7 / 4.5 |
| team shots allowed, L15 | 1.2498 | 1.2454 | 5.3 / 4.2 |
| team shots allowed, season | 1.2490 | 1.2453 | 5.8 / 4.3 |
| shots allowed to the position, L5 | 1.2508 | 1.2444 | 4.8 / 5.3 |
| shots allowed to the position, L10 | 1.2482 | 1.2424 | 6.8 / 6.8 |
| shots allowed to the position, L15 | 1.2466 | 1.2417 | 7.9 / 7.5 |
| shots allowed to the position, L20 | 1.2452 | | |
| shots allowed to the position, L30 | 1.2444 | | |
| shots allowed to the position, season | **1.2425** | **1.2395** | **11.2 / 9.6** |
| position L10 + position season | 1.2426 | 1.2393 | |
| position, at tonight's venue, L10 | 1.2475 | 1.2432 | |

Every step longer is better, in both seasons; the position split is worth more than any
window choice; venue-matched windows lose to the all-games window of the same length because
they halve the sample. Adding L10 on top of season-to-date gains nothing, so recent form of the
defense carries no information the season total lacks.

**Value in the goal projection** (goal core: season-to-date SOG, iSCF, goals, last season xG
and SH%, home):

| Environment read | 2025-26 | 2024-25 | % goals per SD (2025-26 / 2024-25) |
|---|---|---|---|
| none | 0.6203 | 0.5970 | |
| team goals allowed, L5 / L10 / L15 / season | 0.6201 / 0.6202 / 0.6201 / 0.6202 | 0.5965 / 0.5967 / 0.5963 / 0.5959 | 3.8 / 2.9 / 3.3 / 2.9 and 5.9 / 4.6 / 6.6 / 8.1 |
| goals allowed to the position, L5 / L10 / L15 | 0.6204 / 0.6202 / 0.6199 | 0.5965 / 0.5962 / 0.5959 | |
| goals allowed to the position, season | **0.6188** | **0.5948** | **13.7 / 17.5** |
| shots allowed to the position, season | 0.6187 | 0.5949 | |

For goals the only environment read that moves the projection is the season-to-date figure by
position (goals or shots allowed to the position, equally). Short windows of goals allowed are
goalie variance.

**Early season** (opponent with 5 to 15 games, skater 5+): last season's team shots allowed
beats every this-season window, and the best read is last season's number plus this season's
position figure (deviance 1.2458 none, 1.2424 last season, 1.2457 L5, 1.2442 L10, 1.2406 last
season + position season-to-date; 2024-25 the same order). So: carry last season's shots
allowed until the opponent has ~15 games, then season-to-date by position.

**This season only.** Through Oct 5 no team has more than 4 games, so L5, L10, L15 and season
to date are the same number and the window comparison above cannot be run on 2026-27 yet. What
this season does measure is the noise in a short defensive read. From the 86 team-games, a
team's shots allowed swings by 4.8 a game from night to night, goals allowed by 2.0, and
shots allowed per skater at a position by 0.77. That makes the standard error of a team's
shots-allowed average +/- 2.2 at 5 games, +/- 1.5 at 10, +/- 1.2 at 15, +/- 0.9 at 30 and
+/- 0.5 over a season, against a spread between teams that is a few shots a game; goals
allowed is +/- 0.9 at 5 games and +/- 0.6 at 10, which is most of the spread between any two
defenses. So a 5-game read of a defense is roughly half noise, a 15-game read mostly signal,
and this is the mechanism behind the ranking above. The windows become testable on this
season's own games in sequence: L5 against season to date once teams pass 6 games (about
Oct 18), L10 at 11+ (about Nov 1), L15 at 16+ (mid-November); `tools/predictors/run.sh 2026`
then `env_windows.py` reruns the comparison on 2026-27 alone.

**Rule.** Environment = the opponent's shots allowed per skater at the position, season to
date (last season's team figure blended in until ~15 games), applied as roughly +10% SOG per
standard deviation, or ~3% per extra shot allowed per game. L5 / L10 defense reads are the
noisiest version of a real signal and should not replace the season figure. For goals, the
same season-to-date position read, ~15% per standard deviation. Script:
`tools/predictors/env_windows.py <rows.csv> <label>`.

## 6. What this means for the model and the site

1. **Early-season baseline.** Until a skater has ~18 games, the SOG baseline should be last
   season's rate blended with this season's at n / (n + 18); goals at n / (n + 40). The app's
   `playerBaselines` already spans both seasons (`loadRows` returns this season and last, the
   window is the last 20 games), which gives roughly w = n / 20 for the first ten games, close
   to the fitted curve. It drifts afterwards: at 20 games the window drops last season entirely,
   where the study says last season still deserves ~50% at 18 games and ~30% at 40. The `l5`
   and hit-rate reads in the same block are the windows this study scores lowest. The fix is a
   growing blend (season-to-date and last season, weighted n / (n + 18)) rather than a fixed
   window, and attempts rather than SOG for the this-season half.
2. **Use attempts as the this-season volume signal.** Season-to-date iCF / iFF, not SOG, and
   not L5; for defensemen iCF is already the better read after two games.
3. **H2H marks.** `h2hHot` and `h2hShotsHot` on the chips and the H2H columns on the 1st-goal
   tab should read the previous season's (or a multi-season) record, not this season's
   meetings, and enter a verdict as a modifier of a few percent on the goal rate (section 8).
   H2H shots carry nothing. "Scored last game" carries nothing.
4. **Environment.** Opponent shots allowed to the position, season to date, is the right
   defense read (section 9); the L5 / L10 variants in the slate (`recent`, `recent5` in
   `buildSlate`, the L5 / L10 / L15 tabs) are strictly worse than the season figure and add
   nothing on top of it. Before the opponent has ~15 games, blend in last season's team shots
   allowed. Size: ~10% of a skater's SOG per standard deviation of the position read, ~3% per
   shot allowed per game. The Matchups rink bands (SOG-allowed rank by position) are the
   right shape; their weight in a verdict should be a modifier of that size, not a tier change.
5. **Goals.** Last season's xG per game plus this season's iSCF, with last season's SH% as the
   finishing term. Season-to-date goals per game and shooting % should carry no weight before
   December.

## Running hot / cold vs last season (through Oct 5)

Hot (season-to-date SOG far above last season's rate; the blend is tonight's number):
Kyle Connor 6.67 vs 3.34 (blend 3.67), Brandon Hagel 5.67 vs 3.01 (3.28), Vasily Podkolzin
4.33 vs 1.70 (1.96), Leon Draisaitl 5.33 vs 2.86 (3.11), Jack Quinn 4.50 vs 2.33 (2.55),
Quinn Hughes 4.50 vs 2.53 (2.72), Dougie Hamilton 4.50 vs 2.64 (2.82), Jesper Bratt 4.00 vs
2.17 (2.35), Nick Schmaltz 4.33 vs 2.51 (2.69), Nathan MacKinnon 6.00 vs 4.40 (4.56).

Cold: Alex Ovechkin 0.50 vs 2.98 (13 min TOI, check role), Leo Carlsson 0.50 vs 2.76, Ryan
Hartman 0.00 vs 2.20 (12 min), Conor Garland 0.00 vs 1.93 (12 min), Gabriel Landeskog 0.50 vs
2.20, Robert Thomas 0.00 vs 1.59, Trevor Zegras 0.50 vs 2.06 (4 games), Logan Cooley 0.33 vs
1.89, Jack Eichel 2.00 vs 3.51, Filip Forsberg 1.50 vs 3.00. Where TOI matches last season the
study says the rate comes back; where TOI is down 4+ minutes the role changed and the prior
needs a TOI adjustment (last season's SOG/60 x tonight's expected TOI).

## Caveats

- 43 games. Every this-season interval is wide; the control carries the conclusions that need
  depth (windows, H2H, shrinkage past 3 games). Rerun after each week.
- Rows carry the box-score position; the app's stored rows add the lineup slot (LW1, D2) and
  power-play role, which this study did not test. Slot-level shots allowed is the obvious next
  cut once the stored rows have ~10 games per opponent.
- The previous-season prior is MoneyPuck's all-situations summary. Skaters under 10 games
  last season (rookies, call-ups) have no prior; 5% of rows this season.
- Everything is per skater-game, not per prop line: a 2.5 vs 3.5 SOG line is a different bet
  and the calibration tables (section 2) are the place to read the model's P(k+).
