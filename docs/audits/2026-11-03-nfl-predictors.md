# What predicts an NFL player's game: form, head to head, matchup or all three (2026-11-03)

Vincent, 2026-11-03: "we'll need to see what predicts receiving yards, rushing yards, tds and passing yards the best. Is it
h2h, is it matchup, is it recent form or a combination of all 3?", then, of reading misses as averages: "We need to look
case by case and the predictions need to be as close as possible to the actuals."

## How it is scored

Case by case, not on an average. Every player-game of 2026's weeks 1–7 (fits made on 2025's weeks 4–18, never on 2026),
each read counted per game:

- **close**: within ±10 yards of what he got (receiving, rushing), ±25 (passing);
- **near**: within ±20 / ±50;
- **way off**: more than 30 / 75 yards from it;
- **touchdowns**: of each week's 15 players a read rates likeliest, how many scored; of the players it puts at 45%+, how
  many scored (26.5% of all players in the population scored).

Population: active players with a 10-yard-a-game history (receivers, tight ends and backs for receiving; backs for
rushing), starts of 10+ attempts for passing, skill players with 3+ touches a game for touchdowns. PropFinder's logs from
the site's stored pulls (zeros in), 2024 behind 2025; the defenses rebuilt from the same logs; ESPN's line.
`tools/audit/nfl_predictors.py` prints every table (`--json` writes them with every check game's read).

**The reads.** Form: his last game, last 3 / 5 / 10 / 17 active games, this season. Head to head: his average in his
last four games against tonight's opponent (1+, 2+, 3+ meetings). Matchup: what the defense gives up a game at his
position against the league's (this season before tonight, last season's before its third game). The line: the total and
his team's half spread. Volume: his targets / carries / attempts over his last 5 and 17. Combinations: least squares on
2025, scored on 2026.

## Receiving yards (1,317 games)

| Read | Close ±10 | Near ±20 | Way off >30 | Median miss |
|---|---|---|---|---|
| His last game | 31.3% | 50.9% | 34.7% | 20.0 |
| Last 5 | 32.3% | 57.1% | 25.9% | 16.6 |
| Last 10 | 30.8% | 57.7% | 24.8% | 16.4 |
| Last 17 | 28.5% | 57.7% | 24.5% | 16.9 |
| Last 17 × the defense | 29.4% | 56.8% | 25.5% | 17.9 |
| The board as shipped | 32.1% | 58.9% | 26.1% | 16.4 |
| Form (all windows, fitted) | 30.2% | 59.8% | 23.2% | 16.4 |
| Form + matchup + h2h + line + volume | 29.5% | 60.0% | 22.2% | 16.3 |

- **Head to head**, on the 709 games with a meeting behind them: the h2h average close 26.2%, way off 35.7%; his last 17 on
  the same games 29.8% / 25.8%. At 2+ and 3+ meetings the same: h2h reads worse than his form.
- **Every combination is within a point of form alone** (close +0.2 to −0.8 points, every 95% interval spanning 0).

## Rushing yards (429 games)

| Read | Close ±10 | Near ±20 | Way off >30 | Median miss |
|---|---|---|---|---|
| Last 3 | 27.5% | 52.2% | 28.9% | 18.7 |
| Last 17 | 26.8% | 54.1% | 28.4% | 18.6 |
| Last 17 × the defense | 29.4% | 53.6% | 29.4% | 18.0 |
| The board as shipped | 25.9% | 56.3% | 26.9% | 17.9 |
| Form + matchup + h2h + line + volume | 21.9% | 49.4% | 26.6% | 20.2 |

- **Head to head** (219 games with a meeting): close 23.7%, way off 40.6%, against his last 17's 25.6% / 29.2%.
- **Combinations**: +0.7 to +1.4 points close for the matchup and h2h terms, every interval spanning 0 (−1.9 to +3.7).

## Passing yards (208 starts)

| Read | Close ±25 | Near ±50 | Way off >75 | Median miss |
|---|---|---|---|---|
| His last start | 20.7% | 39.9% | 42.8% | 68.0 |
| Last 10 starts | 28.4% | 52.4% | 32.2% | 49.2 |
| Last 17 starts | 27.9% | 51.4% | 31.7% | 45.8 |
| Last 17 × the defense | 22.6% | 48.1% | 29.8% | 51.3 |
| The board as shipped (the passing read of 2026-11-02) | 25.5% | 49.0% | 32.2% | 50.9 |
| Form + matchup | 26.0% | 56.2% | 32.2% | 44.1 |
| Form + h2h | 26.9% | 52.9% | 30.8% | 46.4 |

- **The passing read against his last 17 starts, case by case:** close 25.5% / 27.9% (the gap +2.4 points, 95% interval
  −3.4 to +8.2), way off 32.2% / 31.7% (−0.5, −5.3 to +4.3). A tie. Yesterday's gain on the average (64.6 → 55.8) came from
  counting his starts alone, which both share; the line and the defense terms are not visible game by game.
- **Head to head** at 2+ meetings (58 starts) read a little closer than his last 17 (25.9% / 20.7%), at 1+ (113) and 3+ (30)
  worse: no pattern on samples this small.

## Touchdowns (1,273 player-games, 26.5% scored)

| Read | Each week's top 15: scored | Called 45%+: players, scored |
|---|---|---|
| His TD rate, last 5 | 39.0% | 86, 43.0% |
| Last 17 | 53.3% | 44, 68.2% |
| Touches, last 17 | 52.4% | 95, 52.6% |
| Matchup alone (TDs allowed at his position) | 33.3% | 0 |
| Line alone (team implied points) | 38.1% | 0 |
| Head to head (2+ meetings) | 50.5% | 25, 80.0% |
| Form (rates + touches) | 47.6% | 95, 50.5% |
| Form + line | 53.3% | 103, 53.4% |
| Form + matchup + h2h + line | 53.3% | 105, 54.3% |

- **The head to head's 25 calls at 45%+**: the last-17 rate had already put 17 of them there; the 8 only h2h named went 3 of
  8. It adds nothing past the long form.
- **The long form leads**: a player's touchdown rate over his last 17 games and his touches. The last 5 is noise (39%).

## Why the misses happen, case by case

The form read's way-off games, split by the volume he got against his usual (his last 17):

| | Share of games | Close | Way off |
|---|---|---|---|
| Receiving, usual targets (60–140%) | 50% | 37.9% | 18.6% |
| Receiving, targets collapsed (<60%) | 28% | 19.9% | 18.6% |
| Receiving, targets spiked (>140%) | 22% | 26.0% | 39.4% |
| Rushing, usual carries | 52% | 26.2% | 19.0% |
| Rushing, carries collapsed | 25% | 10.3% | 29.9% |
| Rushing, carries spiked | 24% | 20.8% | 39.6% |
| Passing, usual attempts | 87% | 24.9% | 28.2% |

- **Receivers and backs**: in half their games the volume moved 40% or more off his usual, and 60% of the way-off games
  came from those (37% spikes, 23% collapses for receiving; 35% / 28% for rushing). The worst misses are big games on big
  volume: Davante Adams 195 yards on 10 targets (said 44), McMillan 192 on 16 (usual 6.9), Bijan Robinson 194 on 29
  carries (usual 17), Monangai 146 on 30 (usual 10.9).
- **Quarterbacks**: 76% of the way-off starts came at his usual attempts: the yards a throw swung (Stafford 390 on 55,
  Burrow 428 on 54, Brissett 95 on 28).
- **None of the inputs above foresees the volume swings**: head to head, the matchup and the line were each in the fits and
  moved nothing.

## Answer

- **Recent form is the read** for every market: receiving his last 5–10, rushing his last 17 (or the last 3), passing his
  last 10–17 starts, touchdowns his long rate and his touches.
- **Head to head is worse than form on its own** for receiving and rushing (way off 36–41% against 26–29%) and adds nothing
  combined; for touchdowns it names the players the long form names.
- **The matchup adds nothing measurable** in any market, alone or combined.
- **The line** helps touchdowns' top of the week a little (53.3% against 47.6% for form alone), nothing for yards.
- **The ceiling of this data**: a receiver's figure within ±10 yards about 30% of games, way off about 23%. The lever left
  is his volume tonight (targets, carries), which none of these reads see: a teammate out, a role change, the game's flow.

Nothing on the board changed with this study.
