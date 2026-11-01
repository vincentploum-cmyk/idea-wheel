# The NFL's big games: what predicts them (2026-11-01)

Vincent, 2026-11-01:
- "how can I find the super matchups that result in the big wins? Like for example, based on the skill and history, today's
  matchup can lead up to 150 rushing yards for player x?"
- then "find out what the best cocktail is to predict super match ups by looking for patterns in the box scores of
  players that reached these".

## Data

- **PropFinder's logs:** every player-game the site's stored pulls carry, zero-stat games in (the export of
  `2026-11-01-nfl-propfinder-backtest.md`):
  - 2024 weeks 6–18
  - 2025 weeks 4–18
  - 2026 weeks 1–7
  - 11,824 player-games with a board read.
- **Built per player-game:** what was known that morning (`tools/audit/nfl_big.py`, `nfl-big-rows.csv`).
  - **His volume:** carries, targets, receptions, attempts, red-zone touches, air yards, his share of the team's carries
    and targets.
  - **His production:** last 3 / 5 / 17 and the season.
  - **His explosiveness:** best game of his last 10, 90th percentile, spread, long run and catch, his own 100- and
    150-yard games.
  - **The game:** home, the spread, the total, his team's implied points, his team's own offense.
  - **The opponent:** what it allowed to his position (season, last 3 / 5), yards a carry, long plays, the big games it
    has allowed.
  - **The board's own read:** projection, spread, matchup factor, its chance of the mark.
- **Marks:** 100+ / 150+ rushing (backs and quarterbacks projected 15+), 100+ / 150+ receiving (receivers, tight ends,
  backs projected 15+), 300+ / 350+ passing (quarterbacks projected 100+).
- **Two checks, each fitted on the seasons before it:** 2024 → 2025, and 2024–25 → 2026.

## What was tried

- the board's chance as it is;
- the board recalibrated;
- the board plus each feature group (logistic);
- everything (logistic at three strengths, gradient-boosted trees);
- one- to three-condition rules mined on 2024 by beam search;
- small models: the board plus one context, each.

## What held up on both checks

| Mark | The board's chance plus | Brier: board → recalibrated → cocktail, 2025 | Same, 2026 |
|---|---|---|---|
| 100+ rushing | his team's implied points | 0.0677 → 0.0684 → 0.0680 | 0.0674 → 0.0659 → 0.0657 |
| 150+ rushing | his team's implied points | 0.0127 → 0.0124 → 0.0122 | 0.0174 → 0.0171 → 0.0170 |
| 100+ receiving | his share of the targets, last 5 | 0.0465 → 0.0463 → 0.0454 | 0.0519 → 0.0514 → 0.0506 |
| 150+ receiving | his share of the targets, last 5 | 0.0070 → 0.0068 → 0.0067 | 0.0112 → 0.0108 → 0.0107 |
| 300+ passing | the game's total | 0.1113 → 0.1095 → 0.1076 | 0.1389 → 0.1266 → 0.1213 |
| 350+ passing | the game's total | 0.0453 → 0.0443 → 0.0438 | 0.0573 → 0.0511 → 0.0503 |

- **Top five a week:** the week's five likeliest landed 27% (2025) and 34% (2026) at 100+ rushing, 33% and 43% at 100+
  receiving, 24% and 23% at 300+ passing. The board's own chance said 36–46% on the same picks.

## What did not

- **The opponent's defense table:** what it allows to the position, the big games it has allowed, yards a carry, long
  plays. It never helped on both checks, and cost on 2026 for rushing (0.0684 against 0.0659 recalibrated). A big game
  follows the player's volume and the game, not the defense.
- **His own past big games:** his share of 100-yard games over his last 17. Nothing over his projection.
- **Everything at once:** overfit (100+ rushing 0.0727 on 2025 against the board's 0.0677), and so did the trees.
- **The mined rules:** they did not survive. Rules hitting 70% on 2024 hit 22–30% on 2025 and 27–35% on 2026, under the
  board's own chance on the same players. The one passing rule that held (33+ attempts lately, two 300-yard games in his
  last 17, a total of 45.5+: 49% → 30% / 34%) is the board's chance with the total in it.

## Shipped

- **The models:** `BIG` in `lib/nfl/projections.js`: σ(a + b · logit(board) + w · context), fitted on all three seasons'
  rows.
- **The tab:** "Big games" on `/nfl`, per stat the week's likeliest, the context shown as the reason.
- **Target share:** the site reads it off the pull: each game's targets by the side, grouped by the opponent faced.
  - A traded player's games count with his former team's.
  - A game whose side the pull covers for fewer than 20 targets is left out.
- **The site's own read, replayed:**

  | Mark | 2025: said → landed | 2026: said → landed | Top 5, 2026 |
  |---|---|---|---|
  | 100+ rushing | 7.8% → 7.7% | 8.6% → 7.8% | 40% / 34% |
  | 100+ receiving | 5.7% → 5.3% | 5.6% → 6.1% | 39% / 34% |
  | 300+ passing | 14.0% → 13.0% | 14.6% → 15.0% | 30% / 31% |

```bash
node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --dump   # the board's reads, 2024–26
python3 tools/audit/nfl_big.py                                                                         # the study
node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --big    # the site's read, graded
```
