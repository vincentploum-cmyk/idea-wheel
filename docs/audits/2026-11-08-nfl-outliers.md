# The NFL's outlier games

Vincent, 2026-11-08: "Build the same outlier functionality for NFL" (the NBA's Big games → Outliers, 2026-11-07:
`docs/audits/2026-11-07-nba-outliers.md`).

**Shipped**: the NFL Big games tab's Outliers view (`NFL_OUTLIERS`, `nflOutlierChance` in `lib/nfl/projections.js`,
`OutlierTable` in `components/nfl/NflBoards.jsx`): per stat (receiving yards, rushing yards, receptions) the week's likeliest
to reach **double his projection**, and at least 40 yards / 3 receptions over it, from 15 yards / 1.5 receptions projected.
Projected · Floor · Ceiling (his 20th and 80th percentile, `RANGE`) · Outlier · Chance · Book · Why · Got, every column
sorting. No passing: double a quarterback's projection (450+ off 225) is not a game anyone throws, and the big games read 300+ /
350+ (+100 over the projection landed 6.7% of 2025's starts, near what the board said, 7.4%).

## The data

The site's board and projections replayed on ESPN's box scores (`nfl-audit.mjs --yards`: 2025's weeks 4–18, 2026's weeks
1–9; 11,273 graded yards rows), `tools/audit/nfl_outliers.py`.

## The board's chance there

By the size of the projection the board's chance at the mark (`chanceAtMark` on his own spread and `RESID`) lands on what
it says: receivers projected 80+ said 3.9%, landed 3.7% (2025); 35–45 said 13.5%, landed 17%. Doubles land most for the
mid-volume players (receivers at 35–45, backs at 35–50: 14–18%) and least for the stars (a 104-yard projection needs 209).

What runs high is each player's own spread: the week's top ten by it (the widest spreads) said 21% and landed 13%
(receiving, 2025, 10% for everyone). A flat fit on the chance (σ(a + b · logit), b 0.07–0.27) cured the top and put a
star's 209+ at 8%: dropped. The chance read half on his own spread and half on the spread usual for his projection
(c · projection^e fitted on 2025: receiving 3.70 · p^0.548, rushing 2.80 · p^0.604, receptions 0.958 · p^0.494):

| The week's top ten, said / landed | 2025 (fit) | 2026 (check) | everyone 2025 / 2026 |
|---|---|---|---|
| Receiving, own spread | 21.3 / 12.7% | 20.4 / 18.0% | 10.2 / 12.1% |
| Receiving, **half and half** | **16.7 / 16.0%** | **16.1 / 21.3%** | |
| Rushing, own spread | 18.6 / 9.3% | 17.2 / 16.5% | 10.4 / 7.5% |
| Rushing, **half and half** | **15.0 / 12.7%** | **14.4 / 20.0%** | |
| Receptions, own spread | 13.4 / 6.7% | 12.6 / 12.4% | 4.9 / 6.5% |
| Receptions, **half and half** | **10.2 / 8.0%** | **9.5 / 7.9%** | |

Log loss (× 10⁻³), own → half and half: receiving 348.1 → 327.3 (2025), 373.6 → 367.3 (2026); rushing 356.7 → 338.8,
266.1 → 263.0; receptions 202.4 → 191.3, 242.7 → 236.6. The usual spread alone scored best on 2025 and worse on the check
(receiving's top ten landed 9.0% in 2026). His position, his projection's size and his spread's ratio beside the chance
added nothing on the check.

## Reading it

In the NFL a double is mostly the game's own luck: the list's top ten land about one in six against one in ten for
everyone. The value is where a book prices the mark long: the Book column shows its price and the edge when its ladder has
the line.
