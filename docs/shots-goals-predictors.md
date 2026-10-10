# What predicts a skater's shots and goals? (2026-27 to date, 2025-26 as the control)

Revision 4 (2026-10-08): the rink's two environment tints, Rink vs PropFinder, graded against the box scores (section 10); the 1st goal tab graded against who scored first (section 11).
Revision 4 (2026-10-08, earlier): the rink's two environment tints, Rink vs PropFinder, graded against the box scores (section 10).
Revision 3: head-to-head re-tested across seasons (section 8); environment window test, L5 / L10 / L15 / season (section 9).

Study date: 2026-10-06; section 10 on 2026-10-08. Rerun with `tools/predictors/run.sh 2026` (see `tools/predictors/README.md`).

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

## 10. Rink or PropFinder? The two tints graded against the box scores

The Matchups rink can be tinted from our stored rows ("Rink": the opponent at tonight's venue by
default, or L5 / L10 / L5 home / L5 away / head to head, over this season and last, by lineup
position) or from PropFinder's opponent table ("PropFinder": last season's full table, this
season's, or its L5 / L10 / L15, by PropFinder's position). Every one of those reads was rebuilt
leak-free for this season's 55 games (Sept 29 to Oct 7; 1,980 skater-games, 1,866 with a
last-season prior) and for the whole of 2025-26 as the control (47,231 skater-games, 2024-25 as
its "last season"), then scored against what the skater did: the cross-validated gain on top of
his own baseline (last season blended with this season at n / (n + 18)), and the hit rate of
2+ / 3+ / 4+ SOG and 1+ goal when the band he sits in shows soft / mid / tough (rank thirds, as
the rink tints). PropFinder's own last-season numbers and ranks (the bundled 2025-26 exports)
were scored as a read of their own; everything else is rebuilt from the NHL box scores.

Two corrections to the data first. The NHL box score lists registered positions (six to eight
"C" a team), while PropFinder and the stored rows use the position played, so every forward was
relabelled from the play-by-play: the four forwards who took the draws are the centres, the rest
wingers on their listed side. Rebuilt this way, the last-season table matches PropFinder's cell
for cell (r = 0.93 on SOG/G by position, 0.94 on goals; the same colour band in 76% of cells, the
rest within a rank or two: PropFinder's "Full Season" tab includes the playoffs). And the earlier
section 9 overstated the position read: pooled across positions, "shots allowed per skater at the
position" carries the attacker's own position level and scores 0.013 of deviance, but within any
one position the per-game total (what both tints show) and the per-skater figure are worth the
same, 0.003 to 0.007 (C 0.0068, LW 0.0032, RW 0.0028, D 0.0029). The environment is a tie-breaker
of a few percent, in every form; the skater's own rate is the signal.

**Scripts.** `tools/predictors/faceoffs.mjs` (draws per game), `relabel.py` (played positions),
`pf_dump.py` (PropFinder's tables to CSV), `env_source.py` (the comparison; `-envsrc.csv` carries
every read per row). `README.md` has the commands.

### Shots: the band colour and what followed (control, 2025-26, skaters with a prior)

| Read (rank thirds by SOG allowed to the position) | soft SOG | tough SOG | P(3+) soft | P(3+) tough | gap SOG / P(3+) | CV gain |
|---|---|---|---|---|---|---|
| PropFinder this-season tab (season to date, all games) | 1.67 | 1.50 | 24.6% | 20.7% | **+0.17 / +3.9 pts** | 0.0006 (z 5.3) |
| Team total shots allowed, season to date (no position) | 1.68 | 1.50 | 25.2% | 20.7% | +0.18 / +4.5 | 0.0031 (z 11.5) |
| Rink default: tonight's venue, two seasons | 1.66 | 1.52 | 24.4% | 21.3% | +0.13 / +3.1 | 0.0000 (z 2.8) |
| Rink L10 (two seasons) / PropFinder L10 | 1.66 | 1.52 | 24.4% | 21.3% | +0.14 / +3.1 | 0.0005 (z 4.7) |
| Rink L5 home / away | 1.65 | 1.54 | 24.1% | 21.4% | +0.11 / +2.8 | 0.0005 |
| PropFinder last-season tab (full) | 1.66 | 1.54 | 24.3% | 21.4% | +0.12 / +3.0 | -0.0001 (z 0.5) |
| Rink L5 (two seasons) / PropFinder L5 | 1.62 | 1.55 | 23.3% | 21.6% | +0.08 / +1.7 | 0.0002 (z 3.2) |
| Last season's L10 | 1.62 | 1.56 | 23.3% | 22.0% | +0.06 / +1.4 | -0.0001 |

The season-to-date table separates soft from tough the most; every short window separates less,
L5 least. By the opponent's games played, no read beats the skater alone until the opponent has
about 15 games (0 to 4 games: baseline 1.2655, last season 1.2654, rink venue 1.2662; 5 to 9:
1.2251 / 1.2273 / this season 1.2256; 10 to 14: 1.2767 / 1.2768 / 1.2788), then this season's
table is the one (15 to 19: 1.2604 / 1.2621 / 1.2601; 20 to 29: 1.2405 / 1.2408 / 1.2394; 50+:
1.2374 / 1.2376 / 1.2360). The venue split and the two-season blend buy nothing over the plain
season table.

### This season so far (55 games, opponents with 1 to 4 games)

| Read | soft SOG | tough SOG | P(3+) soft / tough | P(1+ G) soft / tough |
|---|---|---|---|---|
| PropFinder this-season tab ("2026"), shots | **1.67** | **1.38** | **25.4% / 17.8%** | 18.2% / 13.0% |
| Team total shots allowed, this season | 1.69 | 1.39 | 26.3% / 18.8% | 18.2% / 13.8% |
| Rink default (venue, two seasons) | 1.64 | 1.54 | 23.6% / 22.2% | 18.0% / 15.2% |
| PropFinder last-season tab, shots | 1.58 | 1.51 | 22.2% / 21.6% | 17.4% / 14.0% |
| PropFinder last-season L10, shots | 1.61 | 1.46 | 24.3% / 21.1% | 18.8% / 13.4% |
| Rink L5 (two seasons) | 1.65 | 1.51 | 22.6% / 23.3% | 16.7% / 13.7% |
| Rink L10 (two seasons) | 1.52 | 1.56 | 19.3% / 24.4% | 17.4% / 15.8% |

This season's own table has read well from its first week (CV gain 0.0019 for the position
table, 0.0101 for the team total, z 2.5 and 3.8), where the control's first weeks show nothing;
with 55 games that is a lead to watch, not a rule, and the control's "about 15 games" stands as
the switch point. The Rink's L5 and L10 windows have pointed the wrong way so far (their "last
10" is last season's final games plus this season's first).

### Goals

Goals allowed is mostly goaltending noise (section 9), and the band tables agree: no read moves
P(1+ goal) by more than about a point in the control. The one goal read that holds up in both
seasons is **last season's goals allowed to the position**: CV gain 0.0024 in the control
(0.0027 for the rink's two-season venue table by goals), 0.0063 this season for PropFinder's
last-season tab (0.0052 for its last-season L10; soft 17.4 to 18.8% vs tough 13.4 to 14.0%
P(1+ goal)). This season's goals-allowed table is harmful so far (-0.0097; its "tough" band
scored at 48.5% in the .35 to .5 tier, n = 33). Shots allowed to the position does nothing for
goals.

### The pre-game filter: tier first, band second

Last-season SOG/G tier x band colour of the season-to-date table (control; n per cell 570 to
7,100):

| LS SOG/G | soft: SOG, P(3+), P(4+) | mid | tough |
|---|---|---|---|
| under 1.5 | 1.13, 12%, 4% | 1.10, 11%, 4% | 1.00, 9%, 3% |
| 1.5 to 2 | 1.82, 27%, 12% | 1.73, 26%, 11% | 1.62, 23%, 9% |
| 2 to 2.5 | 2.17, 37%, 18% | 2.18, 37%, 19% | 2.02, 33%, 16% |
| 2.5 to 3 | 2.75, **52%**, 30% | 2.67, 48%, 29% | 2.51, 46%, 26% |
| 3+ | 3.25, **63%**, 39% | 3.33, 61%, 41% | 3.02, 57%, 35% |

This season, same cut, PropFinder's "2026" tab (n per cell 15 to 290): 2 to 2.5 soft 2.58 SOG and
47% 3+ vs tough 1.69 and 24%; 2.5 to 3 soft 2.76 and 56% vs tough 2.03 and 41%; 3+ soft 3.54 and
68% vs tough 3.67 and 60%. The Rink default on the same rows: 2 to 2.5 soft 2.40 / 42% vs tough
2.20 / 40%; 2.5 to 3 soft 2.83 / 52% vs tough 2.20 / 39%.

Read it as: the tier sets the market (under 2.0 SOG/G last season, no band makes a 3+ shooter:
27% at best), the band moves it by 4 to 6 points of P(3+) and about 0.15 to 0.25 SOG at the top
tiers, roughly one line of odds. For goals, the last-season goals/G tier does the work (.35 to
.5: 31 to 33% to score; .5+: 34 to 39%) and the band is worth 1 to 5 points.

### Rule

- Tint by **PropFinder, Shots**: the current season's tab once the opponent has ~15 games, last
  season's full tab before that (now). Never L5; L10 only when it agrees with the season table.
- For goals, **PropFinder, Goals, last season's tab** all season; this season's goals table is
  noise until well past 20 games and should not colour a goal call.
- The Rink tint's default window (tonight's venue, two seasons) is a fair read but strictly
  weaker than the season table it halves; its L5 / L10 are the weakest reads tested and have
  pointed the wrong way this season. If the Rink tint stays, its default should be the all-games
  season table, not the venue split.
- The band's figure can stay a per-game total: within a position it reads the same as per skater.

## 11. The 1st goal tab, graded

The tab's score (`lib/nhl-data/firstgoal.js`: 45% the model's 1+ goal odds, 30% the player's own
first-goal rate over his last 100 games, 15% the opponent's first-goal leak to his position at
tonight's venue, 10% head to head) was replayed leak-free for every skater-game of this season
(55 games) and of 2025-26 (1,311 games), with the player's blended goal rate standing in for the
model's odds, and the per-game ranking graded against who scored first.
`tools/predictors/firstgoal_grade.py`.

| Ranking (about 36 skaters a game) | #1 scores first | first scorer in top 3 | in top 5 | #1 scores at all |
|---|---|---|---|---|
| chance | 2.8% | 8.3% | 14% | 16% |
| tab score, this season | 7.3% | 14.5% | 25.5% | 29% |
| tab score, 2025-26 | 6.6% | 19.6% | 29.9% | 36.5% |
| goal rate alone, 2025-26 | 6.4% | 18.1% | 31.2% | 36.2% |
| own first-goal rate alone, 2025-26 | 4.6% | 17.8% | 27.1% | 30.4% |
| opponent first-goal leak alone, 2025-26 | 2.4% | 7.7% | 12.9% | 15.5% |

The tab's top pick scores first about 2.4 times as often as a random skater and scores at all
more than twice as often, and the score reads monotonically (2025-26: 0 to 19 scores first 1.0%,
40 to 49 4.7%, 60 to 69 6.7%, 70+ 5.7%; scores at all 7% to 39%). But all of it is the goal
rate: in a joint fit of "scored first" on the four parts, the goal-rate term is z = 13.0 and the
own first-goal rate (z = -0.7), the leak (z = 0.0) and head to head (z = 0.7) add nothing, this
season the same (1.8 / 0.0 / 0.3 / 1.0). A player's own first-goal record tracks his goal rate
and no more (20+ flagged games, 2025-26: 0% record scores first 1.4%, 3 to 6% 3.9%, 6 to 10%
5.7%, 10%+ 4.0%), and the opponent's first-goal leak has no shape at all (ratio under 0.5: 2.3%;
0.8 to 1.2: 3.1%; 1.6+: 1.9%). First goals are rare enough (one skater in 36) that nothing
beyond "who scores goals" survives.

**Rule.** The tab is a fair shortlist for *a* goal (its daily top 10 scored in 35% of
player-games against 14.5% for the rest of the slate) and a weak one for the *first* goal (6%
vs 2.7%). Rank it by the model's 1+ goal odds and treat the first-goal record, the leak and the
head-to-head columns as colour, not as inputs; a first-goal price has to clear roughly 15 to 1
on the tab's best candidate before it is a bet.

## 6. What this means for the model and the site

*Applied 2026-10-10 (items 1 and 4, input side, model math untouched): the PropFinder API builder
(`lib/nhl-data/propfinder-api.js`) now writes the season matchup workbook with each skater's rates
blended with last season's at n / (n + 18) for shots, attempts and chances and n / (n + 40) for
goals, assists and points (`blendedSeasonRates`), and the defense blocks as the team's season to date
blended with last season's at n / (n + 15) for shots and n / (n + 40) for goals (`defenseBlocks`;
the L10 window is gone). The L5 workbook and the stored tables stay PropFinder's own numbers.*

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
