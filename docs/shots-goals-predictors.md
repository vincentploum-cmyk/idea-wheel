# What predicts a skater's shots and goals? (2026-27 to date, 2025-26 as the control)

Revision 9 (2026-10-27, later): the 1st goal tab regraded on the last ten slates of this season and the season to date, game by game (section 11, `tools/predictors/firstgoal_window.py`); what would make the first-goal read better, tested on 2025-26 and out of sample on this season (`firstgoal_extras.mjs`, `firstgoal_model.py`): nothing beyond the matchup λ, and the number should be a probability over the game's skaters, shrunk at the top.
Revision 8 (2026-10-27): section 10's rink and PropFinder tints regraded on 187 games; the windows graded as *filters*, the way a props screen uses them (section 14): L5 / L10 / L15 / L20, L10 at tonight's venue, season to date, last season, the blend and the shipped formula ranked per slate on 2025-26 and on this season through Oct 26; this season's own L5 / L10 / season comparison for the opponent's tables now that teams have 8 to 14 games.
Revision 7 (2026-10-20): the goal odds step replaced the same way as the shots one, on the Oct 13-20 grade (section 12).
Revision 6 (2026-10-15): every angle at once (section 13): venue splits, pace, line slot, the opposing goalie, L5 / L10 / L15, head to head, rest, two-season priors, the opponent's tables per skater at the position and blended across the season boundary; the formulas replayed on this season's 3,852 skater-games and graded; the Best bets plain-rate read refitted (`picks-pure.js`).
Revision 5 (2026-10-13): the model's own published odds graded on the scorecard export; the shots odds step replaced by the Poisson tail of λ (section 12).
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
| Which filter finds the candidates: L5, L10, L10 home, season, last season? | **None of the short windows. Rank by the blended rate (this season into last at n / (n + 18) shots, n / (n + 40) goals), or by the shipped formula; last season alone is the next best.** Top 20 a slate by each filter, 3+ SOG hit rate, 2025-26 / this season: formula .558 / .548, blended average .560 / .543, last season .539 / .536, L20 .542 / .520, L10 .523 / .511, L10 at the venue .516 / .502, L5 .486 / .480, L5 hit rate .479 / .464 (slate base .23). Goals the same order: blend .350 / .311, last season .337 / .307, L10 .302 / .279, L5 .270 / .263 (base .16). The venue split never beats the same window over all games, and an L5 hit rate of 100% was a 54% 3+ SOG player (n = 366) and a 29% scorer. | section 14 |
| Hot hand (big last game) | None. The next game lands on the player's baseline. | Last game 4 SOG: next game 2.02 vs baseline 2.08 (this season), 2.13 vs 2.14 (control). 5+ SOG: +0.6 on n=31 here, +0.1 on n=1,965 in the control |
| Scored last game | No carry-over. Scorers score again at their own rate, not above it. | Scored 1 last game: P(1+ goal) next 0.22; their last-season rate implies 0.22 (control, n=5,693) |
| "He had 4 goals against this team" | **A small, real effect, not a driver.** Across seasons, a strong record against an opponent is worth about 1 to 2 points of P(1+ goal) on top of the player's full-season rate. Within a season it is worth nothing beyond chance. Most of the raw correlation is "good scorers score everywhere". | 2024-25 record vs 2025-26 rematches (38,539 games): 4+ goals vs the opponent last season scored in 31.0% of rematches vs 32.7% expected from the full-season rate; H2H term z = 4.6 against a rate that excludes those games, z = 1.5 against one that includes them; permutation p = 0.03. Within 2025-26 (24,662 games): the H2H term equals what shuffled opponent labels produce, p = 0.65 (section 8) |
| H2H shots | Nothing beyond the player's own SOG rate: within-season p = 0.20 against the shuffle; cross-season coefficient -0.008 once H2H goals are in. | section 8 |
| Opponent environment for SOG: which read? | **Shots allowed per skater at the position, season to date, blended into last season's table at games / (games + 15).** Beats the team total, every short window, the venue split and the slot read, in both control seasons and this one (section 13). | deviance gain over the skater alone 0.0100 (2025-26) / 0.0060 (2024-25) / 0.0119 (this season), z 14 to 18; the team total 0.0043 / 0.0023 / 0.0030 |
| Opponent environment for SOG: which window? | **Season-to-date, by position.** Longer is better at every step: L5 < L10 < L15 < L20 < L30 < season, in both seasons, and shots allowed per skater at the position beats the team total at every window. L5 is the weakest read tested. One SD of the position season-to-date read is ~10% of a skater's SOG; the L5 read ~5%. | section 9: deviance 1.2540 (none) / 1.2508 (position L5) / 1.2482 (L10) / 1.2466 (L15) / 1.2425 (season); 2024-25 identical ranking |
| Opponent environment for goals: which window? | **Season-to-date goals allowed to the position**, and only that. L5 / L10 goals allowed (overall or by position) add nothing; one SD of the position season read is 14 to 18% of a skater's goal rate, the L5 read 3 to 6%. | section 9 |
| Home ice, back-to-back, rest | Tie-breakers only: home +4% SOG (control), 0% this season; back-to-back -2% (not significant); rest days nothing. | sections 1, 4h |
| Opponent environment for goals: which read? | **Goals allowed per skater at the position, last season's table blended with this season's at games / (games + 40).** The only goal environment that holds in all three seasons; this season's table alone is noise until past 15 games (section 13). | gain 0.0010 / 0.0019 / 0.0030, z 6.2 / 8.5 / 2.7; the this-season table alone 0.0002 / 0.0005 / -0.0002 |
| The opposing goalie | A real, small read: last season's save % at z -2 to -3 in every season, 3 to 9% of the goal rate per standard deviation. Not in the site's formula yet (the slate does not carry the confirmed starter). | section 13 |
| Pace, venue split, slot, days off, two-season prior | Nothing beyond the skater's rate and the position read: each under 0.001 of deviance or the wrong sign in one of the seasons. | section 13 |
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

### Refreshed 2026-10-27, on 187 games (6,201 skater-games with a prior; opponents with 1 to 14 games)

The same grade (`env_source.py` on the fresh rows) with three more weeks of box scores. Soft minus tough band, as
the rink tints it, for the skaters sitting in each band:

| Toggle | SOG | P(3+) | P(1+ G) | 2.5-3 SOG/G shooters, P(3+) soft / tough |
|---|---|---|---|---|
| Rink, tonight's venue (the default Home / Away) | +0.16 | **+4.5 pts** | +2.6 | .52 / .40 |
| PropFinder, last season's full tab ("2025") | +0.17 | **+3.9** | +1.9 | .53 / .38 |
| last season, all games, by position (no toggle shows it) | +0.19 | +4.5 | +2.1 | .53 / .37 |
| team total shots allowed, last season / this season (no position) | +0.22 / +0.19 | +4.7 / +4.7 | +1.3 / +1.2 | |
| PropFinder, this season's tab ("2026") | +0.11 | +2.9 | +1.4 | .48 / .40 |
| Rink L10 (last 10 across the two seasons; PropFinder's L10 tab reads the same games) | +0.11 | +2.2 | +2.3 | |
| Rink L5 home / L5 away | +0.08 | +2.4 | +0.9 | |
| this season's L5 by position (PropFinder L5 once the season is older) | +0.04 | +2.0 | -0.3 | |
| Rink L5 | +0.06 | **+0.8** | +1.3 | .48 / .43; 3+ shooters .65 / **.69** |

By the opponent's games played (deviance of the skater's baseline + the read; lower is better): with 0 to 4 games
no read helps (none 1.2481, last season 1.2493, rink venue 1.2490); with 5 to 9 games none 1.2241, this season's
table 1.2243, last season 1.2254; with 10 to 14 games (903 rows) none 1.1839, last season 1.1772, rink venue
1.1758, **this season's table 1.1703**, last + this 1.1700. So the switch to the current-season tab is where the
control put it: at ten-plus games the opponent's own table already leads, and by ~15 it is the read. For goals the
one tint that holds is still **PropFinder, Goals, last season's tab**: +0.0034 of deviance (rebuilt last-season
table +0.0029; the rink default by goals +0.0014; this season's goals table -0.0005; Rink L5 / L10 by goals
-0.0007 / -0.0001), and by tier the .35-.5 scorers scored 36.6% in its soft band against 28.6% in its tough one,
where this season's goals table read the same cut backwards (28.5% soft, 33.8% tough) and so did Rink L5 (24.5%
soft, 32.5% tough). None of the per-game position tints comes near the Defense tab's per-skater blended Season
table (section 13, this season: +0.0116 against +0.0001 for the per-game position table): the rink colours the
environment, the Defense tab and the Best bets Opp column measure it.

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

### The last ten slates (Oct 17 to 26, 2026), replayed 2026-10-27

The same replay on the season in progress, game by game (`tools/predictors/firstgoal_window.py`: the
tab's four parts rebuilt leak-free from the public box scores for every skater who dressed, from the
games before each date only, with positions by the faceoffs taken; the model's 1+ goal odds stood in
for by the player's goal rate, this season blended into last at n / (n + 40), and as a second read by
the shipped formula's goal λ with the matchup in it; ties broken at random where the tab breaks them
by lineup order, which can move a game or two). 67 games on 10 slates, 2,412 skater-games, 36 skaters
a game, 58 of the 67 first goals in the first period; the season to date (178 games since Oct 1)
under it. Full output: `firstgoal-window-rows.csv` / `-games.csv` next to the games dirs.

| Per game, 36 skaters | #1 scores first | first scorer in top 3 | in top 5 | in top 6 (the By game table) | #1 scores at all | first scorer's median rank |
|---|---|---|---|---|---|---|
| chance | 2.8% | 8.3% | 13.9% | 16.7% | 15.7% | 18.5 |
| **last 10 slates, 67 games** | | | | | | |
| tab score (goal rate for the model term) | 6.0% (4) | 17.9% | 35.8% | 35.8% | 20.9% | 10 |
| tab score (shipped λG for the model term) | 7.5% (5) | 22.4% | 31.3% | 35.8% | 20.9% | 10 |
| tab without the model term (own + leak + h2h) | 9.0% (6) | 19.4% | 32.8% | 35.8% | 20.9% | 10 |
| goal rate alone | 9.0% (6) | 25.4% | 32.8% | 34.3% | 31.3% | 10 |
| shipped λG alone | 7.5% (5) | 20.9% | 34.3% | 35.8% | 32.8% | 9 |
| own first-goal rate alone | 9.0% (6) | 20.9% | 31.3% | 35.8% | 23.9% | 10 |
| opponent first-goal leak alone | 4.5% (3) | 10.4% | 17.9% | 20.9% | 16.4% | 17 |
| head to head alone | 4.5% (3) | 16.4% | 20.9% | 25.4% | 14.9% | 13 |
| **season to date, 178 games** | | | | | | |
| tab score (goal rate for the model term) | 6.2% (11) | 16.3% | 30.9% | 33.1% | 29.8% | 10.5 |
| tab score (shipped λG for the model term) | 7.9% (14) | 18.0% | 29.8% | 34.3% | 31.5% | 11 |
| goal rate alone | 7.9% (14) | 21.9% | 27.0% | 30.9% | 33.1% | 11 |
| shipped λG alone | 6.7% (12) | 19.1% | 29.2% | 31.5% | 36.5% | 10.5 |
| opponent first-goal leak alone | 3.4% (6) | 10.1% | 17.4% | 19.1% | 16.9% | 17 |

**Against chance the shortlist holds.** The first scorer sat in his game's top 5 in 24 of the 67 games
(36% against 14% by chance) and in the top 10 in 39 (58% against 28%); the slate-wide top 10 scored
first in 8.0% of player-games against 2.6% for the rest of the slate and scored at all in 35% against
15%; the score reads monotonically (0 to 19: 0.7% scored first, 40 to 49: 4.5%, 60 and up: 9%; scored at
all 7.5% to 37%), so the number on the tab is worth about an eighth of itself as a first-goal chance at
the top and about half of itself as an anytime-goal chance. The four #1 hits: McDavid (Oct 17 at UTA),
Hagel (Oct 20 at VGK), Stamkos and Batherson (Oct 24).

**Against the goal rate it adds nothing, as 2025-26 said.** The first scorer ranked higher on the tab
than on the goal rate alone in 26 games and lower in 22 (season: 78 and 62); the joint fit on the
season's 6,370 rows puts the goal-rate term at z = 4.5 for the first goal and 11.4 for any goal, the own
first-goal record at 0.8, the leak at 1.6 and head to head at 0.9; the leak alone ranks at chance (4.5%
on the window, 3.4% on the season, every bucket of its ratio between 2% and 4%). **The extra parts cost
the #1 pick**: the tab's top candidate scored at all in 21% of the window's games against 31% for the
goal rate's top candidate and 33% for the λG's (season 30% against 33% and 37%), because the own-record
and leak terms lift a player with a lucky first-goal history over the game's best scorer: Boldy over
Kaprizov as #1 five times (no goal in the five; Kaprizov scored first on Oct 24 as the tab's #2),
Svechnikov over Aho four times (none), Gauthier four times (none). Defensemen scored 10 of the 67
first goals and the tab had them at a mean rank of 21.

**Price.** The #1's 6 to 8% first-goal rate is break-even at +1,150 to +1,575, and on 67 games the
interval runs 2% to 16%; each of the top three sits at the same 6 to 8%. Books price a game's top
first-goal candidates at roughly +600 to +1,000 (the usual market range, not measured here), so the
tab's #1 is not a first-goal bet at the usual price. The tab earns its place as the shortlist for *a*
goal: its slate top 10 scores in 35% of player-games (break-even about +190) against 15% for the rest.

**Rule, unchanged.** Rank by the model's 1+ goal odds and keep the first-goal record, the leak and the
head-to-head columns as colour; the replay says that lifts the #1's any-goal rate from about 30% to
33 to 37% and leaves the first-goal hit rate where it is. Rerun after each stretch with
`python3 -I tools/predictors/firstgoal_window.py .nhl-data/predictors/2026/games-pos .nhl-data/predictors/2025/games-pos --last 10`.

### What would make it better (tested 2026-10-27)

Every signal specific to the *first* goal, pulled from the play-by-play and the shift charts
(`tools/predictors/firstgoal_extras.mjs`: first-period goals and shots per skater, whether he was on
the ice for the opening faceoff, his seconds in the first 5 and 10 minutes and in the first period,
power-play goals, the first goal's time and strength) and tested leak-free as a conditional logit over
each game's 36 dressed skaters (`firstgoal_model.py`: P(he scores first | game) = exp(x·β) / Σ over the
game; 2025-26's 1,311 games with 2024-25 as the prior, five-fold cross-validated by game; then the
fitted coefficients applied as they stand to this season's 178 games). Beside the candidates, two
hindsight reads give the ceiling: the skater ranked by his *actual* goals a game over the whole
season, and by his actual first-period goals a game.

**The first goal itself (2025-26).** 82% in the first period, 35% inside five minutes, 59% inside ten,
median 8.0 minutes; 77% at even strength, 21% on the power play; the home side scores it 51.1% of the
time and the side with the higher summed goal rate 52.4%, so which *team* scores first is close to a
coin toss; the scorer was on the ice for the opening draw in 34% of games (28% of skaters are);
defensemen score 14% of first goals and are 34% of the skaters.

| 2025-26, per game | log loss | #1 scores first | first scorer in top 3 | in top 5 | #1 scores at all |
|---|---|---|---|---|---|
| random | 3.583 | 3.0% | 8.2% | 15.1% | 15.9% |
| goal rate / Σ game, no fit | 3.580 | 6.0% | 18.1% | 30.2% | 35.5% |
| shipped λG / Σ game, no fit | 3.386 | 6.6% | 19.9% | 30.4% | 38.7% |
| the tab's score, normalised | 3.414 | 6.3% | 19.6% | 29.8% | 36.5% |
| fitted: goal rate | 3.407 | 6.0% | 18.1% | 30.2% | 35.5% |
| + shipped λG (the matchup) | 3.391 | 6.3% | 19.7% | 30.1% | 38.4% |
| + first-period goals and shots | 3.393 | 6.2% | 19.5% | 29.6% | 38.2% |
| + opening shift, first-10-minute ice | 3.393 | 5.8% | 19.3% | 29.8% | 36.8% |
| + power-play goals | 3.392 | 5.7% | 18.8% | 30.6% | 36.0% |
| + home, team share, opposing goalie | 3.394 | 5.8% | 19.1% | 30.2% | 35.9% |
| + the tab's own record, leak, h2h | 3.396 | 6.1% | 19.2% | 29.8% | 35.5% |
| **hindsight: his season goal rate** | 3.292 | 7.7% | 22.8% | 34.7% | 40.7% |
| **hindsight: his season first-period goal rate** | 3.339 | 8.9% | 22.2% | 35.5% | 35.8% |

**The ceiling is close.** Knowing every skater's true goal rate for the season would lift the #1 from
6% to 7.7% and the top 5 from 30% to 35%: the pre-game read already has four fifths of what a rate can
give, and the rest is the night's luck. Knowing who scores *early* is worth a little more (8.9%) but
the pre-game first-period rate is too noisy to carry any of it.

**Only the matchup survives.** In the full fit the shipped λG (the skater's blended goals, chances and
shots with the opponent's goals allowed per skater at his position) is z = +5.4 and every other term is
inside ±2: first-period goals +0.7 and shots -0.8, the opening shift +0.8, first-10-minute ice -0.1,
power-play goals +1.8 (and nothing out of sample), home -0.3, the team's share of the two sides' goal
rates -0.9, the opposing starter's save % +0.8, and the tab's own first-goal record 0.0, leak -0.2 and
head to head +1.2. The log-loss gain over the goal rate is 0.016 for the λG and nothing after it. Out
of sample on this season (178 games) the same: goal rate 7.9% / top 5 27%, with the λG 6.7% / 29%, the
full model 6.7% / 29%, log loss 3.397 → 3.389 → 3.394; the hindsight ceiling 12.4%.

**The number, not the ranking, is where the accuracy is.** The plain read λ / Σ over the game's skaters
is on the line up to 8% (stated 6.9%, hit 6.9% on 3,385 rows) and overstates above it: the 8 to 10%
bucket hit 5.0% (884 rows), the 10%+ bucket 5.7% (105); the fitted models put a coefficient of 0.75 to
0.85 on the log rate, which flattens the top, and read on the line to 8%. No skater is a 10% first-goal
shot before puck drop: the best candidate in a game is 6 to 8%, break-even +1,150 to +1,570. The tab's
0 to 100 score reads like a confidence and is not one: a 75 is a 6% shot.

**What the tab should do.** Rank by the model's 1+ goal odds alone (the rule above); show each
candidate's first-goal chance as his λG^0.8 over the sum of λG^0.8 across both lineups (the game's
36 skaters add to one), with the fair price, in place of the 0 to 100 score; keep the own record, leak
and head-to-head columns as colour; and read the slate list by that probability, which makes a
candidate in a low-scoring game comparable with one in a shootout (this season the slate top 10 by
λ / Σ scored first 7.7% against 5.8% by raw λ; last season 6.0% both). What would move it beyond that
is not in the stored data: the book's own first-goal prices as a reference, and the lineup and goalie
as confirmed at puck drop (the tab already reads the beat writers' lines). A 2-point difference in
hit rate at 6% needs about 500 games to show, so the tab's first-goal number should be judged over a
season, never a week.

## 12. The model's own odds, graded (Oct 1-12, 2026)

The scorecard export for Oct 1 to 12 (81 games with a run saved before puck drop, 12 slates,
2,748 player-games; 67 player-games had no run row) grades the saved runs' published odds against
the box scores. The Oct 10 change above (the season workbook's blended rates) splits it:
2,071 rows before, 677 from Oct 10.

**Goals.** Before Oct 10 the goal λ averaged 0.49 against 0.17 actual and P(1+ goal) averaged
0.42 against a 0.15 hit rate (the anytime-goal best-bet rows: stated 0.51, hit 0.15, n = 605).
From Oct 10 the λ is 0.12 against 0.155 and P(1+ goal) 0.16 against 0.14: the blend fixed it, and
the remaining ~20% shortfall is 2.5 standard errors on 677 rows. Nothing to touch until the
post-change sample reaches ~2,000 rows (early November).

**Shots.** The λ shots (`lambdaS`, the row's expected shots) is the sound part: from Oct 10 its
Poisson tail scores the same Brier on P(3+ SOG) as the best plain window, own L15 (0.144 both).
The ladder that turned it into the published P(3+ / 4+ / 5+) was not: Brier 0.169 against 0.159
for the Poisson tail of the same λ over all rows, worse in every bucket from 40% up, with a fixed
shape, the same before and after Oct 10:

| 3+ SOG, both periods | n | published | Poisson(λ) | hit |
|---|---|---|---|---|
| Published P(3+) at 50% and up | 257 | 0.72 | 0.58 | 0.49 |
| Board "3+ shots" best bets at 60% and up | 151 | 0.85 | 0.60 | 0.50 |
| RW1 + RW2 | 313 | 0.27 | 0.30 | 0.38 |
| Forwards on lines 3 and 4 | 865 | 0.08 | 0.09 | 0.16 |
| D1 + D2 | 597 | 0.22 | 0.12 | 0.17 |
| Gate closed | 1,337 | 0.11 | 0.10 | 0.17 |

*Applied 2026-10-13 (`components/nhl/model-core.js`): the published `p3s` / `p4s` / `p5s` (and a new
`p2s`) are the Poisson tails of the row's λ shots; the ladder's figures stay on the row as
`ladderP3s` / `ladderP4s` / `ladderP5s` and still drive the attack score and the shot tiers. The
goal and point odds are untouched.*

*Applied 2026-10-20 to the goals, on the week that followed (Oct 13-20, 7 slates, 51 games, 1,728
player-games). The goal odds step was worse than the shots one had been: in aggregate it was
calibrated (P(1+ goal) 0.159 against 0.154), but it did not follow the λ. Skaters on a λ near 0.25
were published at 60-67% (Geekie, Poitras, Kantserov, Crouse, Rakell), the top λ were capped near
0.37 (MacKinnon 0.54, Celebrini 0.57), and the 38 rows published at 50%+ on a Poisson read under
25% hit 0.32, about what the λ said. The Poisson tail of the same λ scored 0.124 Brier against
0.130 over all rows and, on the rows over the boards' floor, read 0.41 against a 0.41 hit:*

| 1+ goal, Oct 13-20 | n | published | Poisson(λ) | hit |
|---|---|---|---|---|
| Published P(1+) at 50% and up | 93 | 0.58 | 0.27 | 0.30 |
| Board anytime-goal plays | 35 | 0.58 | | 0.29 |
| Published P(1+) at the 35% floor and up | 272 | 0.48 | 0.25 | 0.32 |
| Poisson(λ) at the 35% floor and up (λ ≥ 0.43) | 34 | 0.43 | 0.41 | 0.41 |
| Top 272 by λ instead of by the ladder | 272 | 0.43 | 0.28 | 0.33 |

*So the gain is the number, not the ranking: the same count ranked by λ hits 0.33 against 0.32.
`p1g` / `p2g` / `p3g` are now the Poisson tails of the row's `lambdaG`; the ladder's figures stay
on the row as `ladderP1g` / `ladderP2g` / `ladderP3g` and still drive the attack score and the goal
tier. The board thins: 34 goal rows over the floor in the week against 272, one or two on a thin
night, and the λ itself still runs low (0.12 against 0.18 scored), so the Poisson read understates
the 0.2-0.4 band (stated 0.33, hit 0.43, n = 75) until the goals fit at ~2,000 rows. The floor is
not lowered to compensate on one week. The point odds are untouched. Guard:
`__tests__/nhl-model-odds.test.js`.*

**What the Poisson read does not fix.** The λ itself is compressed the wrong way: too low under
one shot (λ 0.6 → 1.07 actual) and too high above 3.5 (λ 3.7 → 3.0, λ 4.8 → 3.4 before Oct 10;
3.8 → 3.3 after, n = 12). Every reference rate regresses the same way (own L15 3.7 → 3.4; PropFinder
season 3.7 → 2.1), so the top of the λ needs shrinkage toward the mean, roughly actual ≈ 0.4 + 0.8 λ
on the post-change rows. That is a change to the λ, not to the odds step, and the post-change top
bins hold 12 to 28 rows: fit it when they hold ~100 (late November). Until then the boards' shots
calls, now Poisson, still overstate at the top: replayed on the export, the boards' rule (gate open,
P(4+) ≥ 40% or P(3+) ≥ 60%) made 109 calls stated 0.59 that hit 0.39 (31 calls from Oct 10, stated
0.55, hit 0.45), against 135 calls stated 0.64 that hit 0.44 under the ladder. Honest odds also mean
fewer calls: P(3+) ≥ 60% is now λ ≥ 3.1 and P(4+) ≥ 40% is λ ≥ 3.7.

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


## 13. Every angle at once, and the formulas replayed (2026-10-15)

**Question.** With two weeks of box scores, which of the reads the site shows (venue splits, L5 / L10 /
L15, pace, line slot, the opposing goalie, head to head, rest, the opponent's tables this season and
last) actually move a skater's shots and goals, by how much, and would a formula built from them have
had tonight's shooters and scorers before puck drop?

**Data.** 2026-27 through Oct 14: 107 games, 3,852 skater-games, 679 skaters, teams with 5 to 8 games.
Controls: the whole of 2025-26 (1,312 games, 47,231 skater-games, with 2024-25 as its "last season")
and the whole of 2024-25 (47,225 skater-games, with 2023-24 as its last season). Forwards relabelled
to the position played (the faceoff takers are the centres, section 10). Every row carries only what
was knowable before puck drop; the one exception is the opposing goalie, who is the starter who played
(standing in for the confirmed goalie the slate carries at puck drop). 204 columns per row,
`tools/predictors/build_rows.py`; scored by `angles.py` (cross-validated Poisson, grouped by game),
replayed by `replay.py`, read per row by `explain.py`.

### Shots: the skater's own rate (the control; this season agrees on every line)

| Own read (rows with a prior game and a last-season record, n = 40,811) | deviance | Brier P(3+) |
|---|---|---|
| last game | 1.4451 | 0.1705 |
| L3 / L5 / L10 | 1.3766 / 1.3468 / 1.3163 | 0.1643 / 0.1615 / 0.1582 |
| season to date | 1.2932 | 0.1557 |
| last season alone | 1.2830 | 0.1550 |
| two-season prior (last season 2:1 over the one before) | 1.2828 | 0.1550 |
| **blend n / (n + 18) of season to date into last season** | **1.2430** | **0.1515** |
| blend with the two-season prior instead | 1.2564 | 0.1527 |
| blend + blended attempts (iCF) | 1.2424 | 0.1515 |
| blend + iCF + TOI, last five games | 1.2414 | 0.1514 |
| blend + iCF + L5 SOG on top (recent form) | 1.2418 | 0.1515 |
| blend + iCF + last game's SOG (hot hand) | 1.2423 | 0.1515 |
| blend + iCF + line slot last game (TOI rank) | 1.2405 | 0.1514 |

The blend is the read; nothing recent adds to it. Recent form, the hot hand, the venue split (own SOG
at this venue: z +1.0 in the control, +1.5 this season, gain -0.0003 / +0.0015) and days since his last
game are all inside the blend's noise. Ice time over the last five games is the one role read worth a
term (z +14 in the full fit): it catches a promotion or a demotion before the shot rate does. The
two-season prior loses to last season alone in both seasons where it can be tested.

### Shots: the environment, every read on the same rows

Player core = blended SOG + blended iCF + L5 TOI. Skaters with 10+ games and opponents with 15+
games (every window defined), 2025-26; the 2024-25 figure in brackets; "% per SD" = how much one
standard deviation of the read moves the rate.

| Environment read added to the core | gain in deviance | z | % SOG per SD |
|---|---|---|---|
| **shots allowed per skater at the position, this season blended into last at games / (games + 15)** | **+0.0100 [+0.0060]** | **+14.0 [+10.6]** | **+12.3 [+9.1]** |
| shots allowed per skater at the position, season to date | +0.0093 [+0.0056] | +13.5 [+10.4] | +11.4 [+8.3] |
| same, last season's full table | +0.0060 [+0.0041] | +10.8 [+8.8] | +9.1 [+7.9] |
| team shots allowed, season to date | +0.0043 [+0.0023] | +9.5 | +5.5 |
| team shots allowed, L15 / L10 / L5 | +0.0040 / +0.0029 / +0.0031 | +9.2 / +8.0 / +8.0 | +5.4 / +4.6 / +4.6 |
| team shots allowed at tonight's venue | +0.0035 | +8.6 | +5.0 |
| shots allowed to the position AND his line slot (TOI rank), blended | +0.0024 [+0.0011] | +7.0 | +6.3 |
| shots allowed to the position per game (PropFinder's figure), season | +0.0009 | +4.8 | +3.2 |
| shots allowed to the position at tonight's venue | +0.0009 | +4.6 | +2.9 |
| shots allowed to the position, L15 / L10 / L5 | +0.0010 / +0.0005 / -0.0004 | +4.9 / +4.1 / +2.6 | +3.1 / +2.5 / +1.5 |
| opponent's games' pace (shots both ways), this season | +0.0006 | +3.7 | +2.2 |
| home ice | +0.0003 [+0.0002] | +3.2 [+2.9] | +1.8 |
| game pace this season / last season (MoneyPuck) | +0.0002 / -0.0001 | +2.6 / -0.4 | +1.5 / -0.2 |
| opponent on a back-to-back / own back-to-back | +0.0002 / -0.0002 | +2.8 / -1.2 | +1.6 / -0.7 |
| opposing starter, save % last season | -0.0004 [+0.0007] | -0.6 [-3.8] | -0.3 [-2.1] |
| own venue split, this season / last season's ratio | -0.0003 / -0.0001 | +1.0 / +0.4 | |
| H2H SOG this season / last season | -0.0001 / -0.0002 | +0.8 / +0.7 | |

Three things fall out. First, **per skater beats per game**: PropFinder's "shots allowed to LWs per
game" carries how many wingers the opponent happened to face (the relabel puts 3 to 5 a side) and
scores 0.0009; the same table per skater scores 0.0093. Within each position the ranking holds (D
+0.0030, LW +0.0031, RW +0.0008, C +0.0005 for per skater; per game 0.0030 / 0.0023 / 0.0005 / 0.0005).
Second, **the blend across the season boundary is the best read at every stage**: in the early rows of
both controls (skater with 1 to 10 games) last season's table is worth 0.0112 [0.0084] against 0.0036
[0.0029] for this season's, and the blend 0.0102 [0.0085]; in the deep rows this season's table has
caught up and the blend still edges it. This season to date (Oct 14): blend +0.0119 (z 5.3), this
season's table alone +0.0045 (z 3.4), the team total +0.0027. Third, **everything else is a tie-breaker
or nothing**: pace, the venue split, head to head, rest, the slot (which adds +0.07 of log-rate on top
of the position read and nothing to the cross-validated score), and the goalie for shots.

Forward selection from the core over the whole pool picks the blended position read first in all three
seasons and then stops, or adds a TOI-trend term worth 0.0015.

### Goals

| Own read (control, n = 40,811) | deviance | Brier P(1+) |
|---|---|---|
| season-to-date goals / L5 goals / L10 goals | 0.6404 / 0.6562 / 0.6468 | 0.1284 / 0.1305 / 0.1292 |
| last season goals / xG | 0.6182 / 0.6172 | 0.1259 / 0.1260 |
| blend n / (n + 40) | 0.6029 | 0.1241 |
| **blend goals + blend SOG + blend iSCF** | **0.6002** | **0.1238** |
| + last season xG, + last season SH%, + scored last game, + L5 goals (hot streak) | 0.6002 / 0.6003 / 0.6002 / 0.6002 | 0.1238 |

| Environment read added to the goal core | 2025-26: all rows / deep rows | 2024-25: all / deep | z (all rows) |
|---|---|---|---|
| **goals allowed per skater at the position, last season blended with this at games / (games + 40)** | **+0.0010 / +0.0007** | **+0.0019 / +0.0009** | **+6.2 [+8.5]** |
| goals to the position and his slot, blended | +0.0012 / +0.0013 | +0.0019 / +0.0018 | +6.8 [+8.7] |
| last season's goals to the position (not blended) | +0.0008 / +0.0005 | +0.0018 / +0.0006 | +5.5 [+8.2] |
| this season's goals to the position | +0.0002 / +0.0005 | | +2.7 / +3.7 |
| this season's goals to the position, L5 / L10 | / +0.0001 / +0.0001 | | +1.9 / +1.8 |
| team goals allowed, this season (any window) | 0.0000 | | +0.7 to +1.7 |
| team goals allowed blended across the seasons | 0.0000 | +0.0009 | +2.0 [+5.9] |
| MoneyPuck last-season GA / xGA | 0.0000 / +0.0001 | | +1.6 / +2.0 |
| opposing starter: save % last season | +0.0001 / +0.0001 | 0.0000 | -2.9 [-2.1] |
| opposing starter: GSAx / 60 last season | +0.0001 / +0.0001 | -0.0001 | -2.8 [-1.8] |
| back-to-back | +0.0002 | +0.0001 | -2.8 [-3.1]: -3.5% of the goal rate |
| home ice | +0.0001 / 0.0000 | +0.0004 / +0.0008 | +1.7 [+4.2]: +2% [+5%] |
| pace, this season / last season | -0.0001 / 0.0000 | | -0.1 / +1.6 |
| own venue split (goals at this venue last season) | 0.0000 | | -1.3 |
| H2H goals this season / last season | -0.0001 / 0.0000 | | -1.0 / +0.5 |

This season (3,852 rows, opponents with 1 to 8 games): the blended per-skater goals read gains 0.0030
(z 2.7), last season's table 0.0035 (z 2.9), the slot blend 0.0039 (z 3.2), MoneyPuck's last-season GA
0.0032, the goalie's last-season save % 0.0008 (z -2.0), and this season's own goals-to-position table
-0.0002. So "the Capitals are allowing goals to RWs" is right when it means last season's table: this
season's six games are goaltending noise, as section 9 said, and the cheat-sheet cut confirms it in
both controls (opponent's this-season goals-allowed-to-position third, within the slate day, by the
skater's goal tier: no third beats the skater's own rate by more than a point or two, in either
direction). The goalie is a real read with a stable sign in every season, worth 3 to 9% of the goal
rate per standard deviation of his save %; it is not in the site's formula because the slate does not
yet carry the confirmed starter.

### Replayed on this season: could we have called it?

Every formula fitted on 2025-26 (and again on 2024-25 to check the coefficients) and applied,
leak-free, to this season's rows. The site's own plain-rate read (`picks-pure.js` as of Oct 14:
blended SOG + iCF + home + the opponent's team shots allowed this season) replayed with its fixed
coefficients on its own inputs, on the 3,625 rows it rates.

| Shots formula | deviance | Brier P(3+) | log loss P(3+) |
|---|---|---|---|
| site, Oct 14 | 1.2320 | 0.1472 | 0.4590 |
| same shape refitted | 1.2830 (on 3,225 rows) | 0.1460 | 0.4656 |
| core + home + team shots allowed blended across seasons | 1.2698 | 0.1456 | 0.4638 |
| **core + home + per-skater position read blended + back-to-back (shipped)** | **1.2213** | **0.1464** | **0.4555** |
| + the slot read / + last game's SOG / + L5 SOG | 1.2570 / 1.2546 / 1.2523 (3,173 rows) | | |

| Goals formula | deviance | Brier P(1+) | log loss P(1+) |
|---|---|---|---|
| site, Oct 14 | 0.6064 | 0.1217 | 0.3964 |
| **core + home + per-skater goals-to-position blended + back-to-back (shipped)** | **0.6044** | **0.1213** | **0.3952** |
| + the opposing starter's save % | 0.6056 → 0.6053 on the MoneyPuck-prior rows | | |
| + last season xG and SH% / + L5 goals / + H2H goals last season | no gain / no gain / worse | | |

Coefficients of the shipped formulas, fitted on 2025-26 [2024-25] and pooled (the pooled fit is what
`picks-pure.js` carries; the two seasons agree to the second decimal on every term but the goal
formula's home ice, +0.04 vs +0.10):

- shots: log λ = -1.44 + 0.39 log(blend SOG) + 0.45 log(blend iCF) + 0.30 log(TOI L5) + 0.034 home
  + 0.69 log(opp shots allowed per skater at the position, blended) - 0.026 back-to-back
  [2025-26: 0.39 / 0.46 / 0.31 / 0.036 / 0.78 / -0.027; 2024-25: 0.40 / 0.44 / 0.29 / 0.032 / 0.62 / -0.027]
- goals: log λ = -1.05 + 0.37 log(blend goals + .05) + 0.44 log(blend iSCF) + 0.40 log(blend SOG)
  + 0.068 home + 0.44 log(opp goals allowed per skater at the position, blended + .1) - 0.068 back-to-back
  [2025-26: 0.39 / 0.39 / 0.44 / 0.040 / 0.45 / -0.059; 2024-25: 0.35 / 0.46 / 0.39 / 0.096 / 0.47 / -0.078]

**Calibration this season** (the shipped shots formula; site in brackets): P(3+) stated 0.06 → hit
0.064 [0.071], 0.145 → 0.163 [0.162], 0.25 → 0.255 [0.249], 0.35 → 0.336 [0.325], 0.45 → 0.438
[0.468], 0.55 → 0.589 [0.517], 0.65 → 0.689 [0.640]; 11 rows over 0.70 hit 0.455 [20 rows, 0.650].
By λ band the λ reads straight through 3.5 (λ 3.23 → 3.42 actual, n = 115); the 15 rows over 3.5
shot 2.9 against 3.65 stated, the same top-end regression section 12 found in the model's λ, still on
too few rows to fit. Goals: P(1+) 0.06 → 0.057, 0.12 → 0.14, 0.17 → 0.18, 0.22 → 0.21, 0.27 → 0.25,
0.32 → 0.29, 0.37 → 0.34, 0.43 → 0.45 (the site's bands 0.25 to 0.45 ran 3 to 6 points hot).

**The Best bets board, replayed** (every skater over the floor per game, three to four a table):

| Rule | calls | stated | hit | break-even at the stated price |
|---|---|---|---|---|
| 3+ SOG over 50%, site | 217 | 0.603 | 0.576 | -152 |
| **3+ SOG over 50%, shipped** | **220** | **0.597** | **0.632** | **-148** |
| 3+ SOG fill-ins under the floor, site / shipped | 120 / 117 | 0.452 / 0.446 | 0.483 / 0.410 | |
| 1+ goal over 35%, site | 163 | 0.400 | 0.356 | +150 |
| **1+ goal over 35%, shipped** | **135** | **0.394** | **0.378** | **+154** |
| the #1 goal row in each game, site / shipped | 107 | 0.394 / 0.381 | 0.374 / 0.402 | |

The slate's top 10 by P(3+) hit 62.5% (stated 59.3%; site 59.4%) and 40.6% for 4+ (stated 37.5%); the
top 10 by P(1+ goal) scored 35.0% of the time (stated 37.2%; site 36.2%) against a slate rate of 15.2%.

**The literal question.** Of the 131 nights a skater had 5+ shots this season, the formula had him in
the slate's top 20 shooters 37% of the time, in the top quarter of the slate 75% of the time and in
the bottom half 8%; their stated P(3+) averaged 0.42 against the slate's 0.22, their P(5+) 0.11
against 0.04. The share in the top 20 falls with games played (61% for skaters with no prior game this
season, 53% at 1 to 2, 27% at 3 to 4, 11% at 5 to 6): the early blend is last season's rate, and the
stars' 5-shot nights are the ones the formula sees coming; by week two the 5-shot nights come from
further down the slate. Of the 81 multi-goal nights, 31% came from the slate's top 20 scorers and 49%
from the top 40 (18% of a slate); of all 552 goal-scorer nights, 34% came from the top 40.

Two nights, read with `explain.py`:

- *Jack Hughes, NJD C1 at DET, Oct 13: 8 shots.* Before the game: 3.40 a game this season, 3.74 last,
  blend 3.66; 21 minutes; Detroit allows 1.30 shots per centre this season (5 games) and 1.56 last
  season, blend 1.50 (league 1.73: a tough spot); Devils on a back-to-back. λ 3.01, P(3+) 58%, P(5+)
  19%, P(8+) 1%; #21 of 548 on the slate. A 3+ call, yes; the 8 nobody calls.
- *Josh Anderson, MTL RW3 at WSH, Oct 14: 3 shots, 2 goals.* 2.00 a game this season, 1.24 last, blend
  1.43; 13.7 minutes; Washington allows 2.40 shots per RW this season (6 games) against 1.65 last season,
  blend 1.87 (soft), and 0.30 goals per RW this season against 0.16 last, blend 0.18; Lindgren's .88 last
  season. λ 1.37 shots (P(3+) 16%), λ 0.15 goals (P(1+) 14%), #32 of 71 scorers on a two-game slate. The
  soft RW read lifted him about 10%; the formula still had him at one chance in seven, and that is the
  honest number: a 2.4-shots-per-RW read on six games is half noise (section 9), and the this-season
  goals-allowed table carries no signal at all. The slate's RWs it did like that night: Tuch (#6 scorer,
  2 goals), Caufield (#2, blanked).

### What the site should keep and drop

Ordered by the evidence above; "gain" is deviance against the skater's own rate.

- **Keep, and lead with**: the skater's blended rate (section 3) and the opponent's **per-skater**
  shots and goals allowed **by position**, season to date **blended into last season's table**
  (gain 0.010 shots, 0.001 to 0.003 goals). The Defense tab's cheat sheets should rank per skater
  at the position, not per game, and carry last season in the blend until the opponent has ~15
  games; the Matchups rink bands likewise.
- **Keep as colour, size as a tie-breaker**: home ice (+2 to 3% shots, +2 to 7% goals), back-to-back
  (-3% shots, -4 to 7% goals), the line slot (it is in the rate through TOI; the slot-level defense
  tables add 0.002 at most and nothing on top of the position read).
- **Drop from the verdicts, show at most as a note**: L5 / L10 / L15 defense windows (0.0005 or less on
  top of the season table, negative for L5 by position), the venue-split defense tables (strictly
  weaker than the all-games table they halve), the L5 home / L5 away rink windows, the skater's own
  venue split, pace (every version: 0.0002 or less), head to head in either season (0.000), the hot
  hand and scored-last-game chips (0.000), the first-goal record and leak columns (section 11).
- **Add when the data is there**: the confirmed starter's save % (3 to 9% of the goal rate per SD,
  the same sign in every season) once the slate carries him.

**Applied 2026-10-16: the proof for a model + study blend, built into the site.** The question is whether
the Best bets board gets more players right when the model's λ is blended with the study's λ. The saved
runs live in the site's store, so the proof is the History tab's scorecard (`lib/nhl-data/scorecard.js`):
beside the model's λ and the windows, every graded skater-game now carries the study's λ as it stood that
morning (`studyRead`: `blendRates` + `positionAllowed` + `isBackToBack` + `project` over the stored rows
strictly before the date; nothing leaks) and a half-and-half blend of the two, scored on identical rows
(MAE, bias, Poisson 3+ SOG / 1+ goal Brier). The board's numbers are blended only through
`NHL_PICKS_STUDY_WEIGHT` on Render (the study's share, `blendProjection` in `picks-pure.js`; the odds are
the Poisson tails of the blended λ, both sides kept on the row); it is unset until that table shows the
blend's Brier and MAE under the model's. Offline the same comparison runs from the scorecard export
(`?rows=1`) with `tools/predictors/grade_blend.py`: blends at study shares 0 / ¼ / ½ / ¾ / 1, the top 10 /
20 a slate, the board rule, and a paired bootstrap on the Brier gain. Why a gain is plausible: the two
reads carry different information (the model its ladder, line and PropFinder inputs; the study the
per-skater position read and the two-season blend) and averaging two calibrated rates with imperfectly
correlated errors cannot do worse than the better one by much and usually beats both; why it is not
assumed: on the replay the study alone and the site's own formula sit within 0.0001 Brier of each other,
so the blend has to earn its place on the model's own rows.

**Applied 2026-10-15** (`lib/nhl-data/picks-pure.js`, `picks.js`, `PicksPanel.jsx`; the model's math
untouched): the Best bets plain-rate read is the shipped formula above; `positionAllowed` builds the
blended per-skater position tables from the stored rows; `blendRates` carries TOI; the board's Opp
column shows the position read and its rank (1 = allows the most to the position) and marks a
back-to-back. *Also applied 2026-10-15*: the Defense tab's tables are per skater at the position, its Season span the
blend above (`blendedDefense` in `lib/nhl-data/defense.js`), so tonight's matchup reads and the "Running hot" Tonight
cell read the same figure the formula uses; the tab's "Track record" block grades every stored skater-game of the season
against each span's table as it stood that morning (`defense-grade.js`, `/api/nhl/data/defense/grade`; ranks on the
three-decimal per-skater figure, so goals tables no longer tie in bulk). Through Oct 14 (3,625 skater-games): in the
blended Season table skaters in the soft third shot 0.7% above their own rate and the tough third 7.4% under it, a spread
of 8.1 points, and scored 0.5% above against 7.4% under, a spread of 7.9; the Last 10 table spread 1.9 points for shots
and -6.1 for goals, the Last 5 1.7 and -10.5. The softest-spot shooters ran 2.4% under their rates for shots (the spot is
relative to the side, not a soft third). The λ-shrinkage at the top (section 12) is
still waiting on rows.

**Rerun** as the season grows (needs the three seasons' games under `.nhl-data/predictors/<year>/games`):
`tools/predictors/run.sh 2026` fetches, relabels, builds the rows with the previous season as the
prior, and runs `angles.py` and `replay.py`; `explain.py <rows-replay.csv> <date> <team> <name>` reads
one night.


## 14. The windows as filters: L5, L10, L10 home, season, last season (2026-10-27)

**Question.** A props screen offers the same reads for every skater: his hit rate or average over the last 5 / 10 /
15 / 20 games, the last 10 at tonight's venue ("L10 home"), this season, last season. Which one finds tonight's
shooters and scorers? Sections 1, 7 and 13 scored the windows as *rates* (deviance of a Poisson fit); this section
scores them as *filters*, the way they are used: every skater on the slate ranked by the filter, the top 10 / 20
taken, and the share that hit 3+ SOG (2+ / 4+) and 1+ goal; the precision of the thresholds a screen applies
("hit in 8 of L10"); and what a stated hit rate was actually worth. Script: `tools/predictors/filters.py` (every
read from games strictly before the row's game; "last N" counts across the season boundary, as a screen does in
October; the venue windows are the last N at tonight's venue; ties inside a hit rate are broken by the same
window's average, then at random, so no filter borrows from another).

**Data.** 2025-26 as the control: 40,233 skater-games with 20+ prior games across the two seasons and every read
defined, 167 slates (2024-25 is its "last season"). This season through Oct 26: 5,983 skater-games, 28 slates,
187 games, teams with 1 to 14 games. The yardsticks are the blend of section 3 (this season's average into last
season's at n / (n + 18) for shots, n / (n + 40) for goals; the same blend of the hit rates beside it) and the
shipped Best bets formula (section 13: blend + attempts + TOI + the opponent's per-skater position read).

### 3+ SOG: the top 20 a slate by each filter (hit rate; the slate's base rate .231 / .222)

| Filter (ranked by it, top 20 a night) | 2025-26 | this season | AUC 25-26 | stated 25-26 (top 20) |
|---|---|---|---|---|
| **shipped formula** | **.558** | **.548** | .752 | .549 |
| **average, blend of season into last** | **.560** | **.543** | .747 | .582 |
| hit rate, blend of season into last | .554 | .530 | .744 | .575 |
| average L20 | .542 | .520 | .737 | .600 |
| average L15 | .541 | .500 | .733 | .608 |
| average, last season | .539 | .536 | .734 | .580 |
| average, last season at the venue | .537 | .534 | .729 | .590 |
| hit rate L20 | .534 | .509 | .728 | .608 |
| hit rate, last season | .530 | .520 | .730 | .575 |
| average L10 | .523 | .511 | .723 | .623 |
| average L10 at the venue | .519 | .496 | .722 | .624 |
| hit rate L10 at the venue ("L10 home / away") | .516 | .502 | .705 | .649 |
| hit rate L10 | .514 | .502 | .707 | .650 |
| average L5 | .486 | .480 | .703 | .660 |
| hit rate L5 | .479 | .464 | .679 | .719 |
| hit rate L5 at the venue | .469 | .443 | .675 | .720 |

Paired bootstrap over slates, the formula's top 20 against each filter's (difference in hit rate, 95% interval),
2025-26 [this season]: vs hit rate L5 +.079 [+.064, +.095] (this season +.084 [+.048, +.123]); vs hit rate L10
+.045 [+.031, +.057] (+.046 [+.014, +.080]); vs L10 at the venue +.042 [+.027, +.056] (+.046 [+.002, +.089]);
vs season to date +.026 [+.015, +.036] (+.057 [+.017, +.094]); vs last season +.029 [+.017, +.040] (+.029
[+.002, +.055]); vs average L10 +.036 [+.022, +.049] (+.038 [+.005, +.068]); vs the blended average -.001
[-.010, +.006] (+.005 [-.027, +.032]). Every short window loses to the blend by a margin the interval excludes, in
both seasons; the formula and the plain blended average are the same filter to within noise (the opponent read is a
tie-breaker, section 13). The same order holds for 2+ SOG (top 20: blend .778, formula .773, L20 .765, last season
.757, L10 .748, L10 venue .726 hit rate, L5 .695 hit rate; base .443) and for 4+ SOG (formula .349, blend .345,
L15 .330, last season .327, L10 .316, L10 venue .312, L5 .289, L5 hit rate .285; base .110).

**Mid-season, this season's own windows against each other** (2025-26, skaters with 10+ games this season,
34,049 rows; top 20 a slate, 3+ SOG): formula .557, blended average .557, blended hit rate .553, season-to-date
average .545, season-to-date hit rate .537, last season .534, season to date at the venue .522, L10 this season
.519 (hit rate .512), L10 at the venue .517 (hit rate .512), L5 .485 (hit rate .476). Once a skater has ten games
the season-to-date read is the best single window, and the blend still beats it; L10 and L5 are below last
season's full figure all year.

**What a stated hit rate was worth** (2025-26, same rows; actual 3+ SOG rate, n):

| the window's hit rate | L5 | L10 | L10 at the venue | L20 | last season | blend |
|---|---|---|---|---|---|---|
| 40-60% | .42 (4,092) | .44 (4,826) | .44 (4,684) | .45 (5,343) | .46 (5,906) | .46 (5,424) |
| 60-80% | .50 (1,704) | .55 (1,706) | .55 (1,652) | .60 (1,582) | .62 (1,342) | .62 (1,607) |
| 80-99% | — | .61 (139) | .54 (149) | .63 (60) | — | — |
| 100% | **.54 (366)** | — | .73 (33) | — | — | — |

A skater who hit 3+ in all five of his last five hit 3+ in 54% of the next games (this season .51, n = 47): an
L5 of 100% is a 54% player, an L10 of 80 to 90% a 61% player, and the regression is the whole gap between the
stated and the hit columns above. The blend's 60-80% band hit .62, the same as it said. For goals the same cut:
an L5 goal rate of 100% scored next game 29% of the time (n = 31); L10 at 60-80% scored 29% (n = 155); L20
at 60-80% 40% (n = 63); last season's rate at 40-60% 38%; the blend's 40-60% band .37.

**The threshold a screen applies** (2025-26; rows passing a night out of ~241 rated skaters, and their hit rate):

| 3+ SOG filter | a night | hit | | 1+ goal filter | a night | hit |
|---|---|---|---|---|---|---|
| L5 hit rate ≥ 70% (= 4 of 5) | 12.4 | .504 | | L5 ≥ 50% | 14.6 | .277 |
| L10 ≥ 70% | 11.1 | .554 | | L10 ≥ 50% | 12.6 | .316 |
| L10 ≥ 80% | 4.3 | .576 | | L10 ≥ 60% | 4.3 | .304 |
| L10 at the venue ≥ 80% | 4.3 | .587 | | L10 at the venue ≥ 60% | 4.0 | .345 |
| L20 ≥ 70% | 5.7 | .609 | | L20 ≥ 50% | 5.1 | .355 |
| last season ≥ 60% | 8.0 | .615 | | last season ≥ 40% | 5.8 | .373 |
| blend ≥ 60% | 9.7 | **.622** | | blend ≥ 40% | 5.7 | .367 |
| formula P(3+) ≥ 50% (the board's floor) | 17.5 | .597 | | formula P(1+) ≥ 30% | 8.8 | **.388** |
| formula P(3+) ≥ 60% | 6.6 | **.646** | | formula P(1+) ≥ 35% (the board's floor) | 1.9 | .430 |

This season the same cuts: L5 ≥ 70% 10 a night at .527, L10 ≥ 70% 9 at .571, L10 at the venue ≥ 70% 10 at .574,
last season ≥ 60% 9 at .619, blend ≥ 60% 9 at .647, formula P(3+) ≥ 50% 14 at .629 and ≥ 60% 7 at .683; goals:
L10 ≥ 50% 10 at .311, last season ≥ 40% 9 at .382, blend ≥ 40% 8 at .373, formula ≥ 30% 2 at .415. At every
volume the blend or the formula gives the same count of players at a higher hit rate than any L5 / L10 cut.

### 1+ goal: the top 20 a slate (base .159 / .157)

| Filter | 2025-26 | this season | AUC 25-26 |
|---|---|---|---|
| **average, blend of season into last** | **.350** | .311 | .699 |
| **shipped formula** | **.350** | **.316** | .702 |
| hit rate, blend | .348 | .307 | .699 |
| average, last season | .337 | .307 | .690 |
| hit rate, last season | .336 | .316 | .689 |
| hit rate L20 | .326 | .314 | .671 |
| average L15 | .311 | .311 | .666 |
| average L10 | .302 | .279 | .649 |
| hit rate L10 | .298 | .279 | .645 |
| hit rate L10 at the venue | .292 | .282 | .642 |
| average L5 | .270 | .263 | .609 |
| hit rate L5 | .262 | .250 | .606 |

Bootstrap, formula vs each (2025-26): L5 +.088 [+.069, +.106], L10 +.052 [+.036, +.068], L10 at the venue
+.058 [+.042, +.075], season to date +.027 [+.013, +.041], last season +.014 [+.001, +.025], the blend .000.
Goals are rarer than shots, so the short windows are mostly luck: the L5 goal filter's top 20 scored 26%, barely
above the slate's best 20 by any read of volume, and an L10 of 50%+ (five goals in ten) scored next game 32% of the
time. Mid-season (10+ games this season) the order is the same: blend .349, season to date .337, last season .334,
L10 .305, L10 at the venue .291, L5 .270.

### The opponent's window as the filter

The blended average multiplied by each read of the opponent (the read over the league's average, at the formula's
elasticity), ranked the same way, 2025-26, 35,156 rows where every window is defined (opponents with 10+ games):
blend alone .558, × the team's season total .555, × last season's position table .552, × the team's L10 .552, × the
team's L5 .549, × the position table season to date .547, × the position blend .546, × the position at tonight's
venue .540, × the position L10 .533, × the position L5 .519. As a *multiplier* on the ranking no opponent read
beats the skater's own blend, and the short position windows hurt it: a 5-game read of a defense is half noise
(section 9), so scaling a skater up or down by it moves the wrong players in. The environment belongs inside the
fitted formula at its fitted size (+.001 of Brier, section 13), never as a filter of its own; this season (871 rows,
opponents with 10+ games) the same rows read .418 to .438 for every version, within noise of each other.

**This season's own windows, now testable** (teams with 8 to 14 games through Oct 26; `env_windows.py` on the
2026 rows, skaters with 5+ games and opponents with 8+, 1,764 rows; gain in deviance over the player core): the
per-skater position read blended into last season +.0119, last season's per-skater table +.0100, the team total L3
/ L5 / L10 / season +.0123 / +.0082 / +.0053 / +.0053, the position table L3 / L5 / L10 / season +.0082 / +.0068 /
+.0066 / +.0061, the team at tonight's venue L5 +.0064, the position at the venue L5 +.0049. Reliability of the
read itself (55 team-games with 5+ prior games, against the opponent's next five): L3 r .30, L5 .35, L10 .39, season
.39 for shots allowed; .08 to .14 for goals allowed. On this season's own games the short windows are all within noise
of each other and of the season total, and the two reads that carry last season lead, as the control said they would
(section 9: "carry last season's figure until the opponent has ~15 games"). On the larger 4,529 rows of `angles.py`
(skaters with a prior game): the blended per-skater read +.0116 (z 7.6), last season's +.0116 (z 7.5), the team blend
+.0062, the team season total +.0040, the position table per game +.0001, any venue read +.0012 or less. For goals
no window of this season's tables helps yet (every one .000 or negative on 1,764 rows); last season's per-skater
goals table +.0030 (z 3.8) and the blend +.0024 on the 4,529 rows, the this-season table -.0002.

### Rule

- **To find candidates, rank by the blended rate** (this season into last at n / (n + 18) for shots, n / (n + 40)
  for goals) **or by the Best bets formula**; they pick the same players, and the board's floor (P(3+) ≥ 50%, P(1+
  goal) ≥ 35%) is the threshold. Until a skater has ~10 games, last season's full figure alone is the next best
  filter and beats every window of this season; after ten, season to date is the best single window, still behind
  the blend.
- **L5 is the worst filter tested, in both seasons and for every market**, and "L5 home / away" is worse than L5.
  L10 and L10 at the venue sit between L5 and the season figures and never beat last season's full rate. A venue
  split never beats the same window over all games: it halves the sample for a home / away difference the study
  measures at 2 to 4%.
- **Read a short hit rate as what it was worth**: 5 of 5 = a 54% player for 3+ SOG, 8 or 9 of 10 = 61%, and a hot
  L5 for goals scores next game 29% of the time. The blend's stated rate is what happens.
- **Never filter on the opponent's L5 / L10**; the opponent's read is a few percent inside the formula, by position
  per skater, season to date blended into last season, and this season's own tables are not yet worth more than
  last season's.

Rerun: `tools/predictors/run.sh 2026`, then `python3 -I tools/predictors/filters.py .nhl-data/predictors/2026/games-pos
.nhl-data/predictors/2025/games-pos .nhl-data/predictors/2026/rows.csv "2026-27"` (and the same on the 2025 rows with
2024 as the previous season for the control).
