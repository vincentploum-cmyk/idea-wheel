# Special teams and the predicted score, measured (2026-10-31)

Team-games with power-play counts: 2025-26: 2624 (1312 games) · 2026-27: 428 (214 games).

## A. Inside a game: what a power play is worth in shots and goals

OLS of a team's shots and goals in the game on the power plays it got (PPO) and the power plays it killed (PKO), home ice in. Both seasons pooled.

| Stat | Constant | Per power play for | Per power play killed | Home ice | R² | n |
| --- | --- | --- | --- | --- | --- | --- |
| shots | 26.51 | 0.99 (z 11.9) | -0.71 (z -8.5) | 0.85 (z 3.7) | 0.061 | 3052 |
| goals | 2.72 | 0.06 (z 2.7) | 0.06 (z 2.5) | 0.15 (z 2.3) | 0.008 | 3052 |

Power-play goals are 19.8% of all goals (1892 of 9565); a team gets 2.92 power plays a game and converts 21.2%.

By the count of power plays a team got, its shots and goals (the raw slope the regression summarises):

| Power plays got | Team-games | Shots | Goals | PP goals | Power plays killed |
| --- | --- | --- | --- | --- | --- |
| 0–1 | 464 | 26.35 | 3.06 | 0.18 | 2.29 |
| 2 | 803 | 26.81 | 3.02 | 0.39 | 2.67 |
| 3 | 831 | 27.83 | 3.08 | 0.66 | 2.97 |
| 4 | 548 | 28.76 | 3.27 | 0.89 | 3.26 |
| 5 | 269 | 29.28 | 3.34 | 1.01 | 3.41 |
| 6+ | 137 | 30.74 | 3.46 | 1.36 | 3.93 |

## B. Can tonight's power plays be foreseen from the two teams' rates?

Poisson regression of a team's power plays tonight on log(its drawn rate / league) and log(the opponent's given rate / league), season to date before the game, both ratios shrunk toward 1 at gp / (gp + K). Fitted on the fit season from each team's 6th game; the check season scored with the fit season's coefficients. Deviance per team-game, lower is better; the constant-only read is the league rate.

| K | Elasticity: own drawn | Elasticity: opponent gives | Home | Deviance fit | league only | Deviance check | league only | n fit | n check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0.33 (z 3.0) | 0.28 (z 2.7) | 0.08 (z 3.3) | 0.7284 | 0.7349 | 0.7139 | 0.7172 | 2452 | 258 |
| 5 | 0.41 (z 3.1) | 0.36 (z 2.8) | 0.08 (z 3.3) | 0.7281 | 0.7349 | 0.7093 | 0.7172 | 2452 | 258 |
| 10 | 0.46 (z 3.0) | 0.42 (z 2.8) | 0.08 (z 3.3) | 0.7282 | 0.7349 | 0.7085 | 0.7172 | 2452 | 258 |
| 20 | 0.55 (z 3.0) | 0.51 (z 2.8) | 0.08 (z 3.3) | 0.7284 | 0.7349 | 0.7087 | 0.7172 | 2452 | 258 |
| 40 | 0.70 (z 2.8) | 0.66 (z 2.7) | 0.08 (z 3.3) | 0.7289 | 0.7349 | 0.7098 | 0.7172 | 2452 | 258 |

Kept: K = 10 (the lowest check-season deviance), elasticities own drawn 0.46, opponent gives 0.42.

How stable the two rates are: each team's odd-numbered games against its even-numbered games over the fit season (a trait correlates; noise does not).

| Rate | Odd / even games correlation | Spread across teams (SD) |
| --- | --- | --- |
| power plays drawn a game | 0.278 | 0.22 |
| power plays given a game | 0.278 | 0.22 |
| shots a game | 0.861 | 2.07 |
| shots allowed a game | 0.844 | 1.89 |
| goals a game | 0.470 | 0.32 |
| goals allowed a game | 0.346 | 0.27 |
| power-play conversion | 0.483 | 0.036 |
| penalty-kill leak (goals allowed per kill) | 0.041 | 0.030 |

## C. On top of the usual reads: does the opponent's discipline move a team's shots and goals?

Poisson regression of a team's shots (goals) in the game on its own rate, what the opponent allows, home ice, then the special-teams reads: the opponent's power plays given (the team's extra power plays), the opponent's power plays drawn (the team's extra kills), and for goals the opponent's penalty-kill leak (goals allowed per kill, shrunk toward the league at 40 kills). Season-to-date reads shrunk at K = 10, from each team's 6th game. Fitted on the fit season, scored on the check season.

The mechanical factor (`stf`): the power plays the forecast (section B) adds over the team's usual, × a power play's worth inside a game (section A), over the team's usual shots; a coefficient of 1 on its log says the mechanics are the right size, 0 that nothing of it shows. Its spread across team-games: shots SD 0.0038 (min 0.985, max 1.011), goals SD 0.0300.

| Read | Coefficients | Deviance fit | Deviance check |
| --- | --- | --- | --- |
| shots: own × allowed | own_sf 1.016 (z 15.7) · opp_sa 0.997 (z 13.8) · home 0.037 (z 4.8) | 1.3133 | 1.2884 |
| shots: + opponent gives power plays | own_sf 1.016 (z 15.7) · opp_sa 1.001 (z 13.8) · home 0.037 (z 4.8) · opp_given -0.028 (z -0.6) | 1.3132 | 1.2878 |
| shots: + opponent gives and draws | own_sf 1.016 (z 15.7) · opp_sa 0.984 (z 13.2) · home 0.037 (z 4.8) · opp_given -0.012 (z -0.2) · opp_drawn -0.051 (z -1.0) | 1.3128 | 1.2871 |
| shots: + the mechanical factor | own_sf 1.015 (z 15.7) · opp_sa 0.994 (z 13.4) · home 0.037 (z 4.8) · stf_shots 0.248 (z 0.2) | 1.3133 | 1.2885 |
| goals: own × allowed | own_gf 0.634 (z 4.8) · opp_ga 0.368 (z 2.5) · home 0.047 (z 2.1) | 1.0451 | 0.9385 |
| goals: + opponent gives power plays | own_gf 0.633 (z 4.8) · opp_ga 0.368 (z 2.5) · home 0.047 (z 2.1) · opp_given 0.001 (z 0.0) | 1.0451 | 0.9385 |
| goals: + opponent gives, draws, kill leak | own_gf 0.634 (z 4.8) · opp_ga 0.399 (z 2.5) · home 0.047 (z 2.1) · opp_given 0.056 (z 0.4) · opp_drawn -0.232 (z -1.5) · opp_kill_leak -0.083 (z -1.0) | 1.0437 | 0.9455 |
| goals: + the mechanical factor | own_gf 0.633 (z 4.8) · opp_ga 0.434 (z 2.7) · home 0.047 (z 2.1) · stf_goals -0.460 (z -1.1) | 1.0446 | 0.9399 |

Size: with the opponent giving power plays at 1.25× the league (the most undisciplined teams this season sit near 1.3×), a team's shots read ×0.997; at 0.8× (the most disciplined) ×1.003. The opponent drawing 1.25× the league's power plays (so the team kills more): ×0.989.

Goals: the opponent giving 1.25× the power plays ×1.013; a kill leaking goals at 1.25× the league's rate ×0.982.

## D. The predicted score: each team's goals tonight

Skater box scores: 1312 games 2025-26, 162 games 2026-27.

Each team-game's goals against every read, from each team's 6th game. Bias = projected − actual; the Poisson log score is −mean(y log λ − λ), lower is better. The parameters are fitted on the fit season; the check season is scored with them unchanged.

### 2025-26 (fit): per team

| Read | Team-games | Projected | Actual | Bias | MAE | RMSE | Poisson log score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The league's goals a game to date | 2452 | 3.10 | 3.13 | -0.029 | 1.376 | 1.727 | -0.4433 |
| Own goals × opponent's allowed / league, ±3% home ice (the plain read) | 2452 | 3.10 | 3.13 | -0.028 | 1.388 | 1.724 | -0.4447 |
| The team layer fitted: own goals^0.63 × allowed^0.37, home +4.8% | 2452 | 3.13 | 3.13 | +0.000 | 1.377 | 1.714 | -0.4507 |
| The team layer with the special-teams reads | 2452 | 3.13 | 3.13 | +0.000 | 1.377 | 1.713 | -0.4514 |
| Σ of the skaters' study λ goals (the board's goals read, summed over the dressed skaters) | 2452 | 3.06 | 3.13 | -0.070 | 1.373 | 1.710 | -0.4520 |
| Σ study λ rescaled: × exp(0.324) ^0.73 | 2452 | 3.13 | 3.13 | +0.000 | 1.372 | 1.707 | -0.4542 |
| Σ study λ^0.61 × own goals^0.22 × allowed^0.12, home +0.3% | 2452 | 3.13 | 3.13 | +0.000 | 1.371 | 1.706 | -0.4546 |
| The blend with the special-teams reads | 2452 | 3.13 | 3.13 | +0.000 | 1.371 | 1.705 | -0.4555 |
| The blend with the mechanical special-teams factor | 2452 | 3.13 | 3.13 | +0.000 | 1.371 | 1.706 | -0.4550 |
| Σ study λ^0.62 × own goals^0.21 × allowed^0.11 (no home term: the skaters’ λ carry home ice) | 2452 | 3.13 | 3.13 | +0.000 | 1.371 | 1.706 | -0.4546 |

### 2025-26 (fit): per game (the total and the winner)

| Read | Games | Projected total | Actual | Bias | MAE total | Winner called | Brier (home win) | Home win said | Home won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The league's goals a game to date | 1226 | 6.21 | 6.26 | -0.059 | 1.841 | 47.7% | 0.2500 | 50.0% | 52.3% |
| Own goals × opponent's allowed / league, ±3% home ice (the plain read) | 1226 | 6.21 | 6.26 | -0.055 | 1.840 | 52.6% | 0.2480 | 52.8% | 52.3% |
| The team layer fitted: own goals^0.63 × allowed^0.37, home +4.8% | 1226 | 6.26 | 6.26 | +0.000 | 1.834 | 53.9% | 0.2464 | 52.2% | 52.3% |
| The team layer with the special-teams reads | 1226 | 6.26 | 6.26 | +0.000 | 1.835 | 56.1% | 0.2458 | 52.2% | 52.3% |
| Σ of the skaters' study λ goals (the board's goals read, summed over the dressed skaters) | 1226 | 6.12 | 6.26 | -0.140 | 1.819 | 54.7% | 0.2450 | 53.3% | 52.3% |
| Σ study λ rescaled: × exp(0.324) ^0.73 | 1226 | 6.26 | 6.26 | +0.000 | 1.822 | 54.7% | 0.2450 | 52.5% | 52.3% |
| Σ study λ^0.61 × own goals^0.22 × allowed^0.12, home +0.3% | 1226 | 6.26 | 6.26 | +0.000 | 1.823 | 55.0% | 0.2448 | 52.2% | 52.3% |
| The blend with the special-teams reads | 1226 | 6.26 | 6.26 | +0.000 | 1.823 | 55.1% | 0.2443 | 52.2% | 52.3% |
| The blend with the mechanical special-teams factor | 1226 | 6.26 | 6.26 | +0.000 | 1.822 | 54.8% | 0.2450 | 52.2% | 52.3% |
| Σ study λ^0.62 × own goals^0.21 × allowed^0.11 (no home term: the skaters’ λ carry home ice) | 1226 | 6.26 | 6.26 | +0.000 | 1.822 | 54.7% | 0.2448 | 52.1% | 52.3% |

### 2026-27 (check): per team

| Read | Team-games | Projected | Actual | Bias | MAE | RMSE | Poisson log score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The league's goals a game to date | 256 | 3.12 | 3.25 | -0.129 | 1.379 | 1.673 | -0.5816 |
| Own goals × opponent's allowed / league, ±3% home ice (the plain read) | 256 | 3.10 | 3.25 | -0.151 | 1.398 | 1.692 | -0.5694 |
| The team layer fitted: own goals^0.63 × allowed^0.37, home +4.8% | 256 | 3.12 | 3.25 | -0.136 | 1.379 | 1.663 | -0.5864 |
| The team layer with the special-teams reads | 256 | 3.12 | 3.25 | -0.133 | 1.386 | 1.670 | -0.5827 |
| Σ of the skaters' study λ goals (the board's goals read, summed over the dressed skaters) | 256 | 3.06 | 3.25 | -0.198 | 1.370 | 1.664 | -0.5841 |
| Σ study λ rescaled: × exp(0.324) ^0.73 | 256 | 3.13 | 3.25 | -0.129 | 1.364 | 1.650 | -0.5926 |
| Σ study λ^0.61 × own goals^0.22 × allowed^0.12, home +0.3% | 256 | 3.12 | 3.25 | -0.133 | 1.367 | 1.651 | -0.5924 |
| The blend with the special-teams reads | 256 | 3.12 | 3.25 | -0.129 | 1.373 | 1.658 | -0.5884 |
| The blend with the mechanical special-teams factor | 256 | 3.12 | 3.25 | -0.133 | 1.367 | 1.652 | -0.5921 |
| Σ study λ^0.62 × own goals^0.21 × allowed^0.11 (no home term: the skaters’ λ carry home ice) | 256 | 3.12 | 3.25 | -0.133 | 1.367 | 1.651 | -0.5922 |

### 2026-27 (check): per game (the total and the winner)

| Read | Games | Projected total | Actual | Bias | MAE total | Winner called | Brier (home win) | Home win said | Home won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The league's goals a game to date | 128 | 6.25 | 6.51 | -0.259 | 1.765 | 39.8% | 0.2500 | 50.0% | 60.2% |
| Own goals × opponent's allowed / league, ±3% home ice (the plain read) | 128 | 6.20 | 6.51 | -0.303 | 1.736 | 56.2% | 0.2514 | 52.2% | 60.2% |
| The team layer fitted: own goals^0.63 × allowed^0.37, home +4.8% | 128 | 6.24 | 6.51 | -0.272 | 1.725 | 57.0% | 0.2471 | 52.0% | 60.2% |
| The team layer with the special-teams reads | 128 | 6.24 | 6.51 | -0.265 | 1.735 | 57.8% | 0.2479 | 51.8% | 60.2% |
| Σ of the skaters' study λ goals (the board's goals read, summed over the dressed skaters) | 128 | 6.11 | 6.51 | -0.396 | 1.749 | 60.9% | 0.2346 | 52.9% | 60.2% |
| Σ study λ rescaled: × exp(0.324) ^0.73 | 128 | 6.25 | 6.51 | -0.258 | 1.735 | 60.9% | 0.2363 | 52.2% | 60.2% |
| Σ study λ^0.61 × own goals^0.22 × allowed^0.12, home +0.3% | 128 | 6.24 | 6.51 | -0.267 | 1.725 | 57.8% | 0.2382 | 51.9% | 60.2% |
| The blend with the special-teams reads | 128 | 6.25 | 6.51 | -0.259 | 1.736 | 62.5% | 0.2388 | 51.7% | 60.2% |
| The blend with the mechanical special-teams factor | 128 | 6.24 | 6.51 | -0.267 | 1.722 | 59.4% | 0.2378 | 51.8% | 60.2% |
| Σ study λ^0.62 × own goals^0.21 × allowed^0.11 (no home term: the skaters’ λ carry home ice) | 128 | 6.24 | 6.51 | -0.266 | 1.725 | 57.8% | 0.2384 | 51.8% | 60.2% |

### The blend's coefficients

- study alone: const 0.3245 (z 2.8), study 0.7314 (z 7.1)
- study + home: const 0.3178 (z 2.7), study 0.7401 (z 6.8), home -0.0060 (z -0.3)
- study + team reads: const 0.4481 (z 3.1), study 0.6210 (z 4.8), own_gf 0.2138 (z 1.4), opp_ga 0.1132 (z 0.7)
- blend: const 0.4546 (z 3.0), study 0.6138 (z 4.4), own_gf 0.2189 (z 1.4), opp_ga 0.1161 (z 0.7), home 0.0032 (z 0.1)
- blend + special teams: const 0.4394 (z 2.9), study 0.6265 (z 4.5), own_gf 0.2110 (z 1.3), opp_ga 0.1501 (z 0.9), home 0.0022 (z 0.1), opp_given 0.0636 (z 0.4), opp_drawn -0.2503 (z -1.7), opp_kill_leak -0.0967 (z -1.1)
- blend + mechanical factor: const 0.4466 (z 2.9), study 0.6211 (z 4.4), own_gf 0.2133 (z 1.3), opp_ga 0.1910 (z 1.1), home 0.0025 (z 0.1), stf_goals -0.5343 (z -1.3)

### For the site (JSON)

```json
{
 "K": 10,
 "ppElasticity": {
  "drawn": 0.4596,
  "opponentGives": 0.4211
 },
 "worth": {
  "shotsPerPP": 0.99,
  "shotsPerPK": -0.7078,
  "goalsPerPP": 0.0616,
  "goalsPerPK": 0.0562
 },
 "ppGoalShare": 0.1978,
 "teamCoef": {
  "shots": {
   "const": 3.3064,
   "own_sf": 1.0157,
   "opp_sa": 0.9842,
   "home": 0.037,
   "opp_given": -0.0122,
   "opp_drawn": -0.0513
  },
  "goals": {
   "const": 1.1177,
   "own_gf": 0.6341,
   "opp_ga": 0.3988,
   "home": 0.0472,
   "opp_given": 0.0557,
   "opp_drawn": -0.2318,
   "opp_kill_leak": -0.0826
  }
 },
 "blend": {
  "const": 0.4546,
  "study": 0.6138,
  "own_gf": 0.2189,
  "opp_ga": 0.1161,
  "home": 0.0032
 },
 "blendSt": {
  "const": 0.4394,
  "study": 0.6265,
  "own_gf": 0.211,
  "opp_ga": 0.1501,
  "home": 0.0022,
  "opp_given": 0.0636,
  "opp_drawn": -0.2503,
  "opp_kill_leak": -0.0967
 },
 "blendMech": {
  "const": 0.4466,
  "study": 0.6211,
  "own_gf": 0.2133,
  "opp_ga": 0.191,
  "home": 0.0025,
  "stf_goals": -0.5343
 },
 "studyTeam": {
  "const": 0.4481,
  "study": 0.621,
  "own_gf": 0.2138,
  "opp_ga": 0.1132
 },
 "mechCoef": {
  "shots": 0.2478,
  "goals": -0.4602
 },
 "teamSt": {
  "const": 1.1177,
  "own_gf": 0.6341,
  "opp_ga": 0.3988,
  "home": 0.0472,
  "opp_given": 0.0557,
  "opp_drawn": -0.2318,
  "opp_kill_leak": -0.0826
 },
 "team": {
  "const": 1.119,
  "own_gf": 0.6335,
  "opp_ga": 0.3676,
  "home": 0.0473
 }
}
```
