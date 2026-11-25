# NHL: home / away splits, and does "allows a lot of shots / goals" hold (2026-11-25)

Vincent, 2026-11-25: "check if there are teams or players that perform significantly different home and away?
Also … the comment 'team allows a lot of shots / team allows a lot of goals': if that comment is listed, are the
players indeed hitting more?"

Data: the NHL API's box scores through `tools/predictors/fetch.mjs`: 2025-26 whole (1,312 games) and 2026-27 to
Nov 24 (377 games). Scripts: `tools/predictors/home_away.py`, `tools/predictors/allows_verdict.py`.

## 1. The rink head's verdict ("allows a lot of / an average number of / few")

Replayed leak-free as the site builds it (`teamAllowsBook` + `zoneTone`): each morning every opponent's shots and
goals allowed a game this season, ranked among teams with 3+ games, cut in thirds. Each skater-game is set against
the skater's own season-to-date rate (10+ games), so "hitting more" means more than he usually does.

### Shots verdict → skater shots

| Verdict | 2025-26 n | actual / own rate | 3+ hit (Poisson exp.) | 2026-27 n | actual / own rate | 3+ hit (exp.) |
|---|---|---|---|---|---|---|
| allows a lot (green) | 13,452 | **1.046** | 24.4% (22.6%) | 2,274 | **1.045** | 25.2% (22.9%) |
| average (amber) | 11,955 | 1.004 | 22.7% (22.5%) | 2,153 | 0.984 | 23.3% (23.4%) |
| few (red) | 13,429 | **0.932** | 20.3% (22.5%) | 2,160 | 0.985 | 21.6% (22.2%) |

Green against red: +11% shots last season (95% CI +9 to +14%), +6% this season (+0.5 to +11%). At team level a
team shot +4.6% over its own average against a green opponent and −7.2% against a red one (2025-26; this season
+4.3% / −1.6%). For a 2.5+ shots-a-game shooter the 3+ rate was 54% against green, 50% against red last season
(about 3 to 4 points, the same size the soft-spots and top-shooters audits found). The verdict reads better as the
opponent's sample grows (last season, opponents with 40+ games: green 1.058, red 0.916).

So yes, players hit more when the comment says "allows a lot of shots", but the effect is modest: about +5% on his
own rate, roughly 2 points of 3+ probability. The red verdict is the stronger signal last season (−7%).

### Goals verdict → skater goals

| Verdict | 2025-26 actual / own | 1+ goal (exp.) | 2026-27 actual / own | 1+ goal (exp.) |
|---|---|---|---|---|
| allows a lot | 1.038 | 16.1% (15.3%) | 1.106 | 17.8% (16.0%) |
| average | 0.996 | 15.6% (15.3%) | 0.937 | 15.6% (16.2%) |
| few | 0.961 | 14.9% (15.3%) | 0.983 | 16.4% (16.1%) |

Green against red: +8% last season (CI +2 to +13%), +12% this season but the CI crosses zero (−2 to +26%). Goals
allowed is a noisier ranking than shots allowed; this season the **shots** verdict sorted goals better than the goals
verdict did (green 1.127, red 0.885). The effect on a 1+ goal bet is about one point.

## 2. Home / away

League: home teams take ~1.1 (2025-26) to 1.6 (this season) more shots a game and score 0.13 (last season) and 0.07 (this season) more goals; a
skater shoots ~4% more at home. The board already carries this (`SHOTS_FIT.home` +3.5%, `GOALS_FIT.home` +7%).

### Teams

- 2025-26, 32 teams × 4 metrics (shots for / against, goals for / against): 8 of 128 splits at p < 0.05 where
  chance alone gives 6.4. After the false-discovery adjustment the survivors are Florida's shots for (30.1 home,
  25.9 away) and Chicago's shots against (27.0 home, 32.9 away); Carolina, Montreal and Detroit's shots against at q 0.06.
- Shuffling the venue within each team: the spread of the teams' shots-for, goals-for and goals-against splits is
  what chance gives (p 0.73 / 0.65 / 0.50); only shots against spreads wider (p 0.02).
- None of it repeats: a team's split in the first half of 2025-26 against the second r −0.25 to +0.10, last season
  against this season r −0.24 to +0.10. Chicago's 27.0 / 32.9 is 30.5 / 30.0 this season. Florida's shots-for
  split is the one that carried (31.1 / 28.2 this season), on 9 home games.
- The rink (both teams' shots at a team's home against in its road games, the scorekeeper's count): sd 2.3 shots,
  but it does not carry half to half (r −0.07) or season to season (r 0.00).

Verdict: no team has a home / away split worth betting on.

### Skaters

- 2025-26, 600 skaters with 20+ games at each venue: 33 shots splits at p < 0.05 where chance gives 30 (shuffled
  venues: 30, 95th percentile 37); 26 goals splits against 30. None survives the false-discovery adjustment.
- Repeat: first half against second half of 2025-26 r 0.00 (shots), 0.00 (goals); last season against this season
  r +0.14 (shots), −0.03 (goals).
- The eleven biggest shots splits last season (p < 0.01) went the same way this season for 9 (McDavid 4.4 / 3.0 →
  3.1 / 2.5, Kaprizov 4.1 / 2.8 → 3.9 / 2.6, McMichael, Ekblad, Carlson, Giroux, Sharangovich, Roy, Greenway); the
  two that flipped were Dvorak and Xhekaj. 9 of 11 is p ≈ 0.03 against coin flips but on 8–14 games a venue.
- **The one real pattern is by volume, not by name**: the home lift grows with the shooter. Skaters at 3+ shots a
  game shoot 11% more at home in both seasons (3.64 / 3.28 last season, 3.71 / 3.33 this season) on 1–2% more ice
  time; 1–3 shot skaters +4%, under 1 shot +0% last season. The board's flat +3.5% understates the home lift for
  the top shooters by about 7% and overstates it for the depth players.

## What it asks for (nothing changed)

- The verdict is honest but small; it should not be read as more than "+5% / −5% on his own rate". The red verdict on
  shots is the stronger read; the goals verdict is the weakest, and the shots verdict could stand in for it.
- A tiered home term for shots (≈ +11% for 3+ shots a game, +4% for 1–3, 0 below), to be fitted in `replay.py`
  before it touches `SHOTS_FIT`.
- Player or team home / away splits by name: do not use.
