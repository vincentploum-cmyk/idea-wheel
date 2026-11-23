# Should the projection lean on a player's own games without tonight's out teammate? (2026-11-23)

Vincent, 2026-11-23, of Grimes with Reaves out (26 → 37 minutes, 8.0 → 25.5 points over 4 games): "Test it yes", after the
with / without glance shipped and the question was whether the board's projection should follow the split.

**Data.** ESPN box scores (`tools/audit/nba-box-fetch.mjs`), 2024-25 and 2025-26 whole, 2026-27 to Nov 22: every rotation
player-game (last ten at 15+ minutes, 3+ games this season for the team) with a regular teammate out (20+ minutes a game
this season over 3+ games, still on the team, not in the box): 14,354 / 15,657 / 1,715.

**Method.** The board's read rebuilt: his rate a minute decayed (half-life 15-20 games) × his minutes decayed (3), lifted by
the shipped overlap rule (`STAR_OUT` exponents). Candidate: that read moved toward his own average over his earlier games
this season for this team that every one of tonight's out players sat (n of them), at n / (n + k). k chosen on 2024-25 by
Poisson likelihood, scored unchanged on 2025-26 and this season. Scripts: `tools/audit/nba_wo_own.py` (tables:
[2026-11-23-nba-own-without-tables.md](2026-11-23-nba-own-without-tables.md)), `tools/audit/nba_wo_own_buckets.py`.

## The answer: no

- **Best k is 32 on points, rebounds and minutes, the board alone on assists and threes.** At k = 32 four games without
  the star move the read 11% of the way to the split; MAE on points 5.032 → 5.025 (2025-26), 5.074 → 5.067 (this season).
  That is noise-level. Leaning on the split hurts: at k = 2 (four games = two thirds of the way) points MAE goes to 5.128 /
  5.096, at k = 0.5 to 5.288 / 5.236. The same holds on the big splits alone (2+ games without, 4+ minutes or points):
  board 4.946, k = 2 5.190, k = 0.5 5.383 (2025-26).
- **Big splits regress almost all the way.** By the size of his own points split (without − with), every season pooled:

| His split (points, without − with) | games without | player-games | board read | his without avg | with avg | actual | actual − board |
|---|---|---:|---:|---:|---:|---:|---:|
| +8 or more | 2 | 420 | 16.0 | 21.8 | 10.4 | 14.5 | -1.5 |
| +8 or more | 3–5 | 482 | 16.2 | 20.1 | 9.1 | 15.9 | -0.3 |
| +8 or more | 6+ | 445 | 16.3 | 18.0 | 7.6 | 14.4 | -1.9 |
| +4 to +8 | 2 | 560 | 13.9 | 16.2 | 10.4 | 12.6 | -1.3 |
| +4 to +8 | 3–5 | 1025 | 13.9 | 15.7 | 10.0 | 13.1 | -0.8 |
| +4 to +8 | 6+ | 1550 | 14.6 | 15.6 | 10.1 | 13.3 | -1.3 |
| within 4 | 2 | 1468 | 12.9 | 11.4 | 11.2 | 12.2 | -0.7 |
| within 4 | 3–5 | 3025 | 13.2 | 12.2 | 11.7 | 12.2 | -1.0 |
| within 4 | 6+ | 6951 | 13.2 | 12.8 | 12.2 | 12.2 | -1.1 |
| −4 or less | 2 | 307 | 16.0 | 9.8 | 16.3 | 14.1 | -1.9 |
| −4 or less | 3–5 | 344 | 15.6 | 11.0 | 17.1 | 14.6 | -1.0 |
| −4 or less | 6+ | 379 | 16.4 | 13.9 | 20.0 | 16.0 | -0.4 |

| His split (minutes) | player-games | board minutes | without avg | with avg | actual |
|---|---:|---:|---:|---:|---:|
| +8 or more | 2517 | 23.9 | 27.3 | 14.3 | 23.9 |
| +4 to +8 | 3380 | 25.9 | 27.7 | 22.1 | 25.5 |
| within 4 | 10122 | 27.5 | 27.9 | 27.1 | 27.0 |
| −4 or less | 937 | 24.2 | 21.7 | 28.3 | 23.6 |

  The split said 18-22 points where the box scores gave 14.5-15.9; the board said about 16, off by its usual margin on
  every row (the rebuilt board runs about a point high everywhere, the rows with no split too, so compare across rows). The
  minutes the same: +8 or more without said 27.3 minutes, they played 23.9, the board said 23.9.
- Why: a few games without a teammate are a small sample picked for being extreme, and the board's decayed minutes and
  the overlap lift already catch the part that lasts (the role grows in the newest games, which the decay weights most).

## What changed

Nothing in the projection. The chip's badge and the card's line stay (they say who is out and what happened), and the
line now ends "Splits this big have landed near the board's projection, not this average." when the split is big.
