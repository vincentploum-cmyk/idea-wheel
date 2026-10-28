# The game script, tested (2026-10-28)

Vincent, 2026-10-28: *think of how a game will work out from a data-backed script. If the
Hurricanes are great at home and shoot a lot against a visitor with a leaky defense over its last
ten, they will dominate the game, and the shots and goals should be divided by the opponent's
weaknesses. That's how the NHL model was built.*

This note tests that script on the box scores. Every table it quotes is in the generated
appendix, [2026-10-28-game-script-tables.md](2026-10-28-game-script-tables.md). The script that
produced it is `tools/audit/nhl_game_script.py`. Nothing in the model or the board was changed.

## How it was tested

- **Data.** Every regular-season game of 2025-26 (1,312) and of 2026-27 to October 27 (190), from
  the NHL API, centres relabelled from the faceoffs. Every read is built from games before the date.
- **Team layer.** A Poisson model of a team's shots and goals in a game. The reads are the team's
  own volume and the opponent's: season, at tonight's venue, last ten, rest, home. It is fitted on
  2025-26 and applied unchanged to 2026-27.
- **Split.** Each skater's own read against a league-average opponent. The team's projected shots
  tonight over its usual scales it. The opponent's share of shots allowed to his position tilts it.
  The tilt redistributes and adds no volume. Goals work the same way.
- **Graded against.** The board's plain-rate read (`picks-pure.js`: the goals read since 2026-10-27,
  the shots stand-in) on the same 42,457 + 6,505 skater-games.

## What the data says

### 1. The team layer is right, and it is where the opponent belongs

A team's shot volume and the shots its opponent allows are stable traits. Each team's games
split in two halves correlate 0.84 on shots allowed. Together they set the team's shots tonight:

| Read | Effect on the team's shots | Evidence |
| --- | --- | --- |
| The team's own shots a game, season | elasticity 0.99, +5.9% per SD | z 13.7 |
| What the opponent allows, season | elasticity 0.92, +5.0% per SD | z 11.7 |
| Home ice | +2.4% | z 2.4 |
| The team on a back-to-back | −3.8% | z −3.6 |
| The opponent on a back-to-back | +3.4% | z 3.3 |

The projection holds over many games. Teams projected to take 56%+ of a game's shots took 58.9%,
scored 60.4% of the goals and won 68.6%. Teams projected under 44% took 41.1% and won 31.4%. The
slope of the realized share on the projected share is 0.99.

### 2. Two parts of the script add nothing

- **"Great at home."** A team's own home edge is not a trait. Each team's home-minus-away shots
  for correlates −0.23 between the two halves of its season. Every team shoots about 1.1 more at
  home, and that is the league's home ice. Adding the team's venue split made the cross-validated
  fit worse: 1.3452 against 1.3336.
- **"Leaky over its last ten."** The last ten adds nothing beyond the season figure (coefficient
  0.10, z 1.6). The two cuts pick the same games with the same outcome. The predictor study
  found the same at the skater level (`docs/shots-goals-predictors.md` section 9).

The script itself is real. Last season, the top third of home shooters against the leakiest third
of visitors took 54.3% of the shots and 57.4% of the goals, and won 63.2% of 133 games. The
bottom third against the tightest third won 43.4%. Cut by the visitor's season figure instead of
its last ten, the same cell won 63.7%. The full team model projected that cell at 54.4% of the
shots, so it already carries the script.

### 3. The opponent's weakness is how much it allows, not to whom

Which position a defense gives its shots to does not persist from one half of a season to the
other:

| Share of a defense's shots allowed that go to | Half-to-half correlation | Spread between teams |
| --- | --- | --- |
| Centres | −0.03 | 1.8 points around 24.9% |
| Left wings | −0.09 | 1.8 points around 22.9% |
| Right wings | 0.13 | 1.5 points around 24.6% |
| Defensemen | 0.40 | 2.0 points around 27.6% |
| Goals allowed, by position (all four) | −0.19 to 0.20 | |

The per-position table persists (0.36 to 0.59) only because it carries the volume. Tilting each
skater's share by the opponent's position shares adds nothing, even against defenses with 30+
games in: Brier 0.1466 without the tilt, 0.1466 to 0.1470 with it. The tuning on last season chose
the weakest tilt in the grid. So the team's volume should be divided by the skaters' own shares
(their rate, attempts, ice time and line), not by the opponent's position table.

### 4. In one game the script is an average, not a call

Within a game, the share of shots and the share of goals correlate 0.09 last season. Score effects
drive that: the team that leads stops shooting. On October 27, the projected and realized shot
shares correlated 0.00 across the 22 sides. The projected favourite won 7 of 11.

- **CAR vs BOS (your example) was the clearest call.** CAR takes 35.5 shots a game and BOS allows
  28.3. The script projected CAR at 32.9 shots and 58% of the game, with BOS's shooters at × 0.89.
  CAR took 30 of 45 (67%) and won 2–1. The script moved Pastrnak from 61% to 55% for 3+, and he
  had 1 shot.
- **ANA vs VAN is your script exactly, and it went the other way.** VAN allowed 34.4 a game over
  its last ten. The script read ANA at × 1.15 and 56% of the shots. ANA took 41% and lost 6–5.
- **STL took 70% of the shots against MTL and lost 2–0.**

### 5. The model's own team layer reads the opponent in steps

`model-core.js` Stage 1 multiplies the players' anchors by steps on the opponent's shots allowed
and its unblocked attempts allowed (+6 / +2 / −3% each). It never takes more than 6% off for a
tight defense. The fitted elasticity takes 13% off for a defense allowing 24 a game.

| Team shots | Stage 1 steps: deviance / MAE | Fitted: deviance / MAE |
| --- | --- | --- |
| 2025-26 | 1.3851 / 4.96 | 1.3022 / 4.83 |
| 2025-26, both teams 20+ games in | 1.3655 / 4.92 | 1.2978 / 4.80 |
| 2026-27 to date | 1.4713 / 4.95 | 1.2670 / 4.66 |

Its team goals read is 0.52 × the players' goal rates + 0.48 × the opponent's goals allowed, in
steps. Early on it is worse than giving every team the league's average: 1.1525 against 1.0406
this season. A team's goals are best read as its projected shots × the league's shooting %
(1.0118). Goals allowed is mostly goaltending noise: it correlates 0.36 half to half, against 0.84
for shots allowed.

### 6. At the skater level, the script fixes the top of the board

| Read | 3+ SOG Brier, 2025-26 / 2026-27 | 1+ goal Brier, 2025-26 / 2026-27 | Best bets shots rows, 2026-27: said → hit | Best bets goals rows, 2026-27: said → hit |
| --- | --- | --- | --- | --- |
| Shipped: his rate × the opponent's per-skater table at his position | 0.1483 / 0.1501 | 0.1222 / 0.1222 | 62.1% → 54.6% | 39.8% → 35.4% |
| His rate alone | 0.1484 / 0.1477 | 0.1222 / 0.1214 | 60.5% → 58.0% | 39.4% → 38.0% |
| Game script: his rate × the team's projected volume over its usual | 0.1481 / 0.1475 | 0.1221 / 0.1215 | 60.2% → 58.4% | 39.2% → 39.3% |
| The study as fitted (rates blended into last season) | — / 0.1459 | — / 0.1212 | 60.0% → 61.8% | 39.5% → 38.0% |
| Game script on the study's blended rates | — / 0.1461 | — / 0.1213 | 59.5% → 62.4% | 39.1% → 38.5% |

The script's multiplier carries one-for-one to the skaters. Last season, skaters whose team the
script read at × 0.89 took 0.93 of their rate, and at × 1.11 they took 1.12. The calibration
tuning chose full strength, power 1.0. The gain in Brier is small because a team's night moves
±5% per SD while one skater's 3+ is a coin with a long tail. The gain at the top of the board is
large: the shots rows go from 7.5 points over-confident to 1.8, the goals rows from 4.4 to 0.

What is left after that is the skater's own rate. Blending this season's rate into last season's
(the study's fit) is worth more than any matchup read: 0.1459 against 0.1475.

## What it would mean (proposals; nothing changed)

1. **The run's Stage 1 (`model-core.js`), through `App.jsx` first, since it is the model's math.**
   - Team expected shots = Σ anchors × (opponent's shots allowed, shrunk at 10 games / league)^0.92
     × 1.024 at home (0.976 away) × 0.96 on its back-to-back × 1.03 on the opponent's.
   - Drop the iFF step: unblocked attempts allowed reads the same trait as shots allowed.
   - Team expected goals = team expected shots × the league's shooting % × (team finishing,
     shrunk at 400 shots)^0.56 × (opponent's goals per shot against, shrunk)^0.30.
2. **The lane budgets.** Drop the forward-position tilt (`laneModifier`,
   `laneOpportunityMultiplier`, the position lane budgets for C / LW / RW). The opponent's position
   shares are not a trait. Keep defensemen at most, lightly. Divide the volume by the skaters' own
   shares and lines, as Stage 2 already does.
3. **The board's goals read (`picks-pure.js` `project`).** Read the opponent at the team level (the
   script multiplier) in place of the per-skater table at his position. This supersedes the earlier
   audit's first item, which was to shrink the per-position table. Pair it with the study's rate
   blend, since that is where the remaining skill is.
4. **Not to add.** A team's own home or away split, and the last ten as a matchup read.

Limits: the run's own λ is not graded here, since that needs the store's export. The pace
workbook is not public, so Stage 1 is rebuilt without its ±6% pace ceiling. The lineup is who
dressed.

## Rerun

```bash
npm run audit:nhl -- --date 2026-10-27
node --import ./tools/audit/register.mjs tools/audit/nhl-audit.mjs --date 2026-04-16 --cur .nhl-data/predictors/2025/games-pos --prev .nhl-data/predictors/empty --out .nhl-data/audit/out25
python3 -I tools/audit/nhl_game_script.py --fit-games .nhl-data/predictors/2025/games-pos --fit-rows .nhl-data/audit/out25/nhl-2026-04-16-rows.csv --test-games .nhl-data/predictors/2026/games-pos --test-rows .nhl-data/audit/out/nhl-2026-10-27-rows.csv --date 2026-10-27 --out .nhl-data/audit/out/nhl-game-script-2026-10-27.md
```
