# The NFL projections, backtested and tuned (2026-11-01)

Vincent, 2026-11-01: "Did you backtest and optimize it based on the last 7 week's matches?", then "yes do the backtest and
optimize it". The read under test is the Matchups / TDs / Receiving / Rushing tabs' (`lib/nfl/projections.js` on the board
of `lib/nfl/picks.js`): each player's projected yards and receptions with a floor and a ceiling, and his touchdown chance.

## How

- **Data**: ESPN's box scores, every finished regular-season game of 2025 (272) and of 2026 through week 8's Thursday
  game (108), with each game's line (the summary's pickcenter, else ESPN's core odds: every game has one) and the scoring
  plays' quarters (the first-half touchdowns). Positions from the rosters. `tools/audit/nfl-fetch.mjs`.
- **Replay** (`tools/audit/nfl-audit.mjs`): every week rebuilt with what was known that morning — each player's logs from
  the games before it (both seasons), each defense's per-game table by position from this season's games before it
  (last season's in week 1), the game's line — and run through the site's own `buildBoard` and `nflProjections`, then
  graded against the week's box scores. A player is graded when he has a line in that game's box score.
- **Tune and check**: every constant searched on **2025's weeks 4–18** (weeks 1–3 have no log behind them), then checked
  unchanged on **2026's weeks 1–7**, the seven weeks asked about. Those weeks never shaped a number.
- **Graded populations**: receiving yards for receivers, tight ends and backs projected 10+; rushing yards for backs and
  quarterbacks projected 10+; passing yards for quarterbacks projected 100+; receptions projected 1+; touchdowns for every
  skill player with a read.

## What moved

| | before | after |
|---|---|---|
| The defense table on the yards | at full weight from week 1 | counted at gp / (gp + 8) of itself (`COCKTAIL.matchupK`) |
| The game script on the yards (total, spread) | volume 0.5 · run 1.2% · pass 0.8% a point | none (measured: no gain) |
| Floor / ceiling (in his spreads) | 0.84 / 0.84 | per market, fitted to a fifth each side (`RANGE`) |
| Touchdowns: the line's share of the team read | 0.5 | 0.25 (`LINE_WEIGHT`) |
| Touchdowns: his rate's pull toward his volume | n / (n + 4) | n / (n + 16) (`RATE_K`) |
| Touchdowns: where the defense gives them up | ×0.7–1.4 | off (`POS_CLAMP` [1, 1]) |
| Touchdowns: calibration | none | σ(−0.167 + 0.857 · logit p) (`TD_CAL`) |
| First-half share of his touchdowns | 0.5 | 0.48 (`H1_SHARE`) |

## Results on the check weeks (2026 weeks 1–7, unseen)

| Market | Graded | Miss before | Miss after | Under floor before → after | Over ceiling before → after |
|---|---|---|---|---|---|
| Receiving yards | 1,298 | 23.2 | 22.5 | 26.6% → 21.0% | 20.5% → 19.3% |
| Rushing yards | 563 | 22.6 | 21.7 | 28.2% → 23.4% | 18.2% → 17.4% |
| Passing yards | 215 | 71.7 | 67.5 | 23.8% → 20.5% | 26.2% → 22.3% |
| Receptions | 1,411 | 1.6 | 1.6 | 25.6% → 17.8% | 21.1% → 19.1% |

Touchdowns (2,214 player-games): Brier 0.1472 → 0.1419, log loss 0.4667 → 0.4481. By band, said → landed:

| Band | before | after |
|---|---|---|
| 0–10% | 4.4% → 8.8% | 5.2% → 6.9% |
| 10–20% | 14.6% → 16.7% | 15.0% → 14.6% |
| 20–30% | 24.6% → 23.2% | 24.7% → 22.0% |
| 30–45% | 36.2% → 31.1% | 36.4% → 35.6% |
| 45%+ | 55.6% → 40.6% | 52.1% → 47.3% |

First-half touchdowns: Brier 0.0865 → 0.0852.

Week by week the tuned read missed receiving yards by less in six of the seven weeks and touchdowns in all seven.

## What the search found

- **The defense table is noise early.** A table of two or three games swings a projection hard; counting it at
  gp / (gp + 8) cut the pooled miss 0.9% on 2025 and 2.6% on 2026's first seven weeks (k = 4 and 16 read the same;
  weighting the last five games or reading this season alone did not help).
- **The game script adds nothing to the yards.** On top of his own rate and the matchup, the book's total and spread
  moved no projection for the better on either season: the first cut's weights cost 1.5% on 2025, every weight within a
  tenth of a percent of none was noise. The line stays where it helps — a quarter of the team's touchdown read.
- **Yards run long above the projection.** As shipped, a quarter of games landed under the floor and a fifth over the
  ceiling; the fitted floor sits a little further down than the ceiling sits up.
- **Touchdowns: volume over history, no position shift.** His touchdown rate counts half only from his 16th game (his
  carries and targets say more earlier), the defense's position split read nothing beyond the team's total, and the
  stated chance ran high at the top: the calibration pulls 55% down to about 50% and lifts 4% to about 6%.

## What this cannot say

- **Zero-stat games are missing.** ESPN's box score has no line for a player who played and recorded nothing, so neither
  his logs nor the grading carry those games (the site's PropFinder logs do). Floors are graded on games he showed up in.
- **No PropFinder tables, no cheat sheets.** The replay's defense tables are rebuilt from box scores; the site blends
  PropFinder's with the cheat sheet's snapshot, which the replay cannot. No injury report: a player who sat is simply not
  graded.
- **Two seasons.** 2025 tuned, seven weeks checked; read again at mid-season.

```bash
node tools/audit/nfl-fetch.mjs --season 2025 --weeks 1-18 --raw .nhl-data/audit/nfl
node tools/audit/nfl-fetch.mjs --season 2026 --weeks 1-9 --raw .nhl-data/audit/nfl
node --max-old-space-size=6144 --import ./tools/audit/register.mjs tools/audit/nfl-audit.mjs --out .nhl-data/audit/out
```
