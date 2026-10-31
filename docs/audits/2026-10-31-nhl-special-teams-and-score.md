# Special teams in the numbers, and the predicted score (2026-10-31)

Vincent, 2026-10-31: *We are capturing now the powerplay data from shotpropz. How can we use this in our
advantage. For example if a team allows a lot of penalties, the other team gets a lot of extra minutes on
the ice. I don't want to overcomplicate it but I bet it has an impact on shots / goals prediction. Also,
can we make sure we have a predicted score based on all the data available (that way I can test whether
our predictions for goals make sense or not).*

Both were measured on the box scores before anything shipped: every regular-season game of 2025-26 and of
2026-27 to October 30, the team power-play counts from the NHL API's right-rail (one request a game,
`tools/audit/nhl-pp-fetch.mjs`), the skater rows from `tools/predictors/fetch.mjs`. Every read is built
from the games before the date. The parameters are fitted on 2025-26 and scored unchanged on 2026-27. The
script is `tools/audit/nhl_special_teams.py`; every table it quotes is in the appendix,
[2026-10-31-nhl-special-teams-tables.md](2026-10-31-nhl-special-teams-tables.md).

## In one paragraph

Inside a game a power play is worth about one shot and a kill costs seven tenths of one; in goals the count
barely moves, because power-play goals replace even-strength ones and the trailing team draws the penalties.
Tonight's power plays can be foreseen a little from the two teams' rates (own drawn^0.46 × opponent gives^0.42,
both shrunk early; the forecast beats the league rate on this season's games), but the rates themselves are
weak traits (a team's odd games against its even games correlate 0.28). And on top of what the board already
reads — a team's own volume and what the opponent allows — the opponent's discipline moves the team's shots
and goals by **nothing measurable**: the shots a leaky kill gives up are already inside the opponent's
shots-allowed table, which every read on the board carries. So the special-teams read ships as a forecast
(how many power plays each side should get and kill tonight, on the matchup profile) and as a redistribution
inside the team (the extra power-play shots and goals go to the power-play units by slot, the same amount
comes off everyone evenly, the side's total untouched), not as a lift on the team. The predicted score ships
as the fitted blend of the skaters' λ goals added up, the team's goals a game and the opponent's goals
allowed: on this season's games it misses a team's goals by 1.37 on average (the league's figure 1.38, the
plain own × allowed read 1.40) and calls the winner 58% of the time; it is stored before every puck drop and
graded on the History tab.

## What ships

- **The special-teams read** (`lib/nhl-data/special-teams.js`, `specialTeamsRead`): per side, from ShotPropz's
  all-games boards, the power plays it should get tonight (the league's rate × its drawn rate^0.46 × the
  opponent's given rate^0.42, each ratio shrunk toward 1 at gp / (gp + 10)) and the ones it should have to kill,
  the opponent's kill leak (goals allowed per kill against the league's, shrunk at 40 kills), and what the
  difference is worth inside a game (+0.99 shots a power play, −0.71 a kill, 0.212 power-play goals a power
  play through the opponent's leak). The matchup profile's Power play and Penalty kill rows end with "tonight ≈
  3.6" and "kills ≈ 2.9 tonight" (green when the side gets a third of a power play more than usual, red when it
  kills a third more), the whole read on the hover.
- **The skaters' λ, redistributed** (`splitSpecialTeams`, `withSpecialTeams`, in `computePicks` before the
  calibration): the shots and power-play goals the forecast moves are handed to the skaters by power-play slot
  (`PP_WEIGHTS`: first-line forwards 1.0, second 0.65, third 0.3, fourth 0.05; first pair 0.8, second 0.35,
  third 0.05; a skater without a slot the middle of his group) and the same amount is taken off everyone
  evenly, so the side's Σ λ is unchanged. Against the most undisciplined opponent this season a first-unit
  forward gains about +0.05 shots on his λ and a fourth-liner loses about −0.02; extra kills shift the other way.
  The team's total takes `teamWeight` = 0 of the mechanical change (the measured answer; 1 would add it all).
  Every Best bets row and shuffle row names the change on its hover (`st` on the candidate, `stTeam` the side's read).
- **The predicted score** (`lib/nhl-data/score.js`, `gameScore`; `projected` on every picks game and, through
  the slate route, on every Matchups game): each team's goals = exp(0.448 + 0.621 · log Σλ + 0.214 · log(own GF /
  L) + 0.113 · log(opp GA / L)), Σλ the dressed skaters' λ goals added up (a skater without a read at the league's
  figure for his position), the team reads from ShotPropz's boards (the stored box scores standing in) shrunk at
  gp / (gp + 10); from the two λ the total, each side's chance to win (a Poisson race, a tie split in half) with the
  fair price, and MoneyPuck's expected goals beside it on the hover as a comparison. It is the matchup profile's
  head pill ("MTL 2.8 – 3.3 DAL · 6.1 goals · DAL 56%"), sits beside the time in every game head on Matchups and
  Best bets, and once a game is final the pill shows the projection stored before puck drop with the final
  beside it, green when it called the winner.
- **Stored and graded** (`lib/nhl-data/scores-store.js`, `data/scores/<date>.json`): every lineup read and model
  run stores the projection of each game still to start (the last one before puck drop stays; a game under way
  keeps its entry), so the live rebuild after the game, which would read the game's own rows, never grades. The
  History tab's scorecard gains **Projected scores**: the stored projections, the run's Σ λ goals per side and the
  study's Σ λ, each against the finals — bias and miss per team, the total's, the winner called, the Brier of
  the home chance — and the last thirty graded games with every read beside the final.

## The data, section by section

### A. Inside a game: what a power play is worth

OLS of a team's shots and goals in the game on the power plays it got and killed, 3,052 team-games of both
seasons. A power play for is worth **+0.99 shots** (z 11.9), a kill **−0.71** (z −8.5), home ice +0.85; the
R² is 0.06. In goals: **+0.06 a power play** (z 2.7) and, oddly, +0.06 a kill — the raw table says why: teams
with six or more power plays scored 1.36 of them but 3.46 in all against 3.06 for teams with one or none.
Power-play goals replace even-strength goals, and the team drawing the penalties is often the one trailing.
Power-play goals are 19.8% of all goals; a team gets 2.92 power plays a game and converts 21.2%.

### B. Can tonight's power plays be foreseen?

A Poisson fit of a team's power plays on log(its drawn rate / league) and log(the opponent's given rate /
league), season to date, both shrunk toward 1 at gp / (gp + K), from each team's sixth game, fitted on 2025-26
and scored on 2026-27. Every K beats the league rate on the check season; K = 10 is the lowest (deviance 0.7085
against 0.7172 for the league rate alone), with elasticities **0.46 own drawn, 0.42 opponent gives** (z 3.0 and
2.8) and +8% at home. The rates are weak traits: a team's odd-numbered games against its even-numbered games
correlate 0.28 for power plays drawn and 0.28 for power plays given, against 0.86 for shots a game and 0.84
for shots allowed; the penalty-kill leak (goals allowed per kill) correlates 0.04, noise.

### C. On top of the usual reads: nothing

A Poisson fit of a team's shots (goals) on its own rate, what the opponent allows and home ice, then the
special-teams reads added. For shots the opponent's power plays given carry −0.01 (z −0.2) and its power plays
drawn −0.05 (z −1.0); the **mechanical factor** (the forecast's extra power plays × a power play's worth, over
the team's usual shots) carries 0.25 (z 0.2) — its spread across team-games is a standard deviation of 0.4%,
so even at full size it would move a λ by a per cent. For goals the opponent's power plays given carry 0.00,
its kill leak −0.08 (z −1.0), the mechanical factor −0.46 (z −1.1). The check-season deviance moves in the
fourth decimal either way. The reason is in the inputs: a team's shots-allowed figure counts the shots it gave
up short-handed, so an undisciplined team already reads as leaky, and the skaters' environment (the opponent's
row per skater at his position) carries it the same way. What the forecast adds beyond that — the interaction
of this team's drawing with that team's giving — is a tenth of a shot a game, under the noise.

### D. The predicted score

Each team-game's goals against every read, from each team's sixth game, fitted on 2025-26 (2,452 team-games)
and scored unchanged on 2026-27 (256).

| Read | Fit: MAE a team | Fit: winner called | Check: MAE a team | Check: total MAE | Check: winner called | Check: Brier (home win) |
| --- | --- | --- | --- | --- | --- | --- |
| The league's goals a game to date | 1.376 | 47.7% | 1.379 | 1.765 | 39.8% | 0.2500 |
| Own goals × allowed / league, ±3% home ice | 1.388 | 52.6% | 1.398 | 1.736 | 56.2% | 0.2514 |
| The team layer fitted (own^0.63 × allowed^0.37, home +4.8%) | 1.377 | 53.9% | 1.379 | 1.725 | 57.0% | 0.2471 |
| Σ of the skaters' study λ goals, as it stands | 1.373 | 54.7% | 1.370 | 1.749 | 60.9% | 0.2346 |
| Σ study λ rescaled (× e^0.324, ^0.73) | 1.372 | 54.7% | 1.364 | 1.735 | 60.9% | 0.2363 |
| **Σ study λ^0.62 × own goals^0.21 × allowed^0.11 — ships** | 1.371 | 54.7% | 1.367 | 1.725 | 57.8% | 0.2384 |
| … with the special-teams reads | 1.371 | 55.1% | 1.373 | 1.736 | 62.5% | 0.2388 |

The skaters' sum as it stands reads 2% low (3.06 against 3.13) and too wide; rescaled it is the best single
read on the check season. The team reads add a little on the fit season (own goals z 1.4, the opponent's allowed
z 0.7) and cost nothing measurable on the check (1.367 against 1.364, within noise on 256 team-games); the
blend ships with them because a team's goals allowed carries its goaltending, which the skaters' λ cannot. The
special-teams terms add nothing here either (section C) and are left at 0. Home ice fitted at +0.3% on top of
the skaters' λ, which already carry it: left at 0. The winner-called rates on 128 check games differ by one or
two games between the reads (±4 points of noise); the Brier of the home chance says the same, 0.236–0.239 for
every read with the skaters in it against 0.247 for the team layer alone and 0.250 for the league.

## Blind spots

- **No power-play ice time per skater.** The split by slot is the mechanics (the first line and pair carry the
  units), not a measurement: the NHL API's box score carries no power-play TOI, and the stored rows carry none.
  The stats API (`api.nhle.com/stats/rest`, `powerPlayTimeOnIce` per skater-game) could replace `PP_WEIGHTS`
  with each skater's own share; until then the weights are the usual deployment.
- **The within-team redistribution is unmeasured at the skater level.** Section C measures the team's total.
  Whether the first unit's shots really rise by the mechanical amount on a night with an extra power play, and
  the fourth line's fall, needs the per-skater power-play minutes above.
- **MoneyPuck's expected goals are not in the score's blend**: the replay has no leak-free history of them. They
  ride on the hover as a comparison; the scorecard can say whether they predict better once the stored
  projections carry a few weeks of nights.
- **The forecast of power plays uses the all-games boards**: the venue boards would halve the games behind each
  rate for a trait that is already weak. The game-script audit found a team's own home edge is not a trait
  either.
- **Goalies.** The team's goals allowed carries its goaltending as a season average; the starting goalie
  tonight is not read anywhere on the board.
