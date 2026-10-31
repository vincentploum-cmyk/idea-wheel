# The NBA ceiling read: what a player is capable of when the matchup is good (2026-10-31)

Vincent, 2026-10-31, of Dosunmu at SA (the book's o3.5 rebounds, the board's 4.4 against a 4.2 average with two 7-rebound
nights in his last five, the opponent #2 in the league on rebounds given up to shooting guards): "we need to do something
different with NBA. We need to look at what a player is capable and then determine the ceiling … he is capable of
getting more when the matchup is good. Hence, I would expect our projections to be higher for him today."

The board's matchup had been a multiplier on his rate — × 1 + 0.6 × (the opponent's figure at his spot over the league's
− 1), counted at gp / (gp + 40) of itself for the games behind the table (the cocktail's `matchupK`; the cheat sheet's
tile in full) — so the #2 matchup on a five-game table read × 1.025 and moved him a tenth of a rebound. The same factor
on every player, whatever his nights look like.

## The read

**The ceiling read** (`reach` in the cocktail; `lib/picks/board.js` ladderOf, `reachOf` / `reachText` in
`lib/picks/projection.js`): his ceiling is the top quarter of his nights over his long window (his last 82 regular-season
games, the window his spread reads) as a ratio on his mean there — a ratio, so a role that grew carries its upside along —
and in a soft matchup the ladder's centre moves from the stated figure (his rate × the matchup × the side's factor) toward
it:

    centre = stated + reach × where × (up − 1) × stated        where > 0 (a soft spot)
    centre = stated − reachDown × |where| × (1 − down) × stated   where < 0 (a tough one)

`where` is the opponent's rank at his spot placed in the league (1 at rank 1, 0 at the middle, −1 at the last), the cheat
sheet's tile in full and PropFinder's rank at gp / (gp + reachK), blended as the matchup factor is. A steady player (every
night his average) has no ceiling over his rate and does not move; a streaky one moves most. The stated centre rides on
every rung as `base`, the read as `reach` (ranges, the shuffle row, the best list's `proj`), the hovers spell it out ("+0.6
toward his ceiling of 6.6 (the top quarter of his nights runs 1.5× his rate) for the #2 of 30 matchup at SG"), and the
scorecard carries "Before the ceiling read" as a sparse predictor, scored on the nights the read moved against the
projection, so the site's own graded nights say whether it helps at real lines.

## Measured

The board replayed with the site's functions on ESPN's box scores (`tools/audit/nba-audit.mjs`, the new "The ceiling read"
section; `tools/audit/nba-fetch.mjs` for the feeds): 2025-26 whole (1,235 games, 125,045 projections with a table at his
spot, PropFinder's per-position table rebuilt game by game, so by November it has the games behind it) and this season
through Oct 30 (81 games, 7,580 projections, tables of one to eight games).

### The question itself: does a player beat his stated centre in a soft matchup, more so when his nights run high?

2025-26, actual − the stated centre, by the matchup third at his spot and his upside (the top quarter of his nights over his
mean):

| Matchup third | His upside | n | actual − centre | MAE | nights over his ceiling |
| --- | --- | --- | --- | --- | --- |
| soft | big (q75 ≥ 1.5× his mean) | 12,879 | +0.34 | 1.32 | 26.7% |
| middle | big | 12,601 | +0.35 | 1.33 | 27.5% |
| tough | big | 12,514 | +0.33 | 1.28 | 27.6% |
| soft | some (1.25–1.5×) | 18,229 | +0.88 | 3.14 | 33.6% |
| middle | some | 17,934 | +0.90 | 3.14 | 33.8% |
| tough | some | 18,024 | +0.85 | 3.09 | 34.7% |
| soft | steady (under 1.25×) | 11,043 | +0.92 | 2.91 | 36.3% |
| middle | steady | 10,999 | +0.88 | 2.82 | 36.4% |
| tough | steady | 10,822 | +1.08 | 2.98 | 37.8% |

**No.** A player with upside clears his ceiling as often against the softest third as against the stingiest (26.7% / 27.5%
/ 27.6%), and his nights run over the stated centre by the same third of a unit everywhere. By stat the soft third reads
the same share over the centre as the rest (points 16.5% against 17.6% in the middle and 18.1% in the tough third;
rebounds 13.0 / 15.3 / 15.1; assists 24.2 / 24.5 / 23.6; threes 16.3 / 17.5 / 17.4). The matchup, as PropFinder's table
states it, says how much a defense gives up on average; it does not say on which night a player's big game comes — that is
the night's own swing (minutes, foul trouble, the score: `docs/audits/2026-10-31-nba-accuracy.md`). The board's centre runs
low across the board (bias −0.74 over 2025-26, the team ceiling's doing, as the cocktail audit found), and that is what any
upward move of the centre repairs.

### The reach, measured

MAE over every stat in its own units, 2025-26 (125,045) then this season (7,580); `down` = the same pull toward his floor
in a tough spot.

| reach | K | down | 2025-26 MAE | bias | soft-third MAE | this season MAE | soft-third MAE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 (the board as it was) | — | — | 2.513 | −0.735 | 2.524 | 2.704 | 2.600 |
| 0.2 | 0 | 0 | 2.506 | −0.642 | 2.506 | 2.721 | 2.647 |
| **0.3** | **0** | 0 | **2.505** | −0.595 | **2.504** | 2.732 | 2.677 |
| 0.5 | 0 | 0 | 2.508 | −0.502 | 2.514 | 2.759 | 2.749 |
| 1 | 0 | 0 | 2.542 | −0.269 | 2.616 | 2.846 | 2.991 |
| 0.3 | 0 | 0.3 | 2.531 | −0.752 | 2.504 | 2.733 | 2.677 |
| **0.3** | **10** | 0 | 2.506 | −0.629 | 2.505 | 2.708 | 2.611 |
| 0.5 | 10 | 0 | 2.506 | −0.559 | 2.506 | 2.711 | 2.619 |
| 0.3 | 40 | 0 | 2.508 | −0.668 | 2.509 | 2.705 | 2.603 |
| 0.75 | 40 | 0 | 2.506 | −0.569 | 2.506 | 2.707 | 2.608 |

Per stat at reach 0.3 (2025-26): points 4.98 → 4.96, rebounds 1.99 → 1.99, assists 1.47 → 1.47, threes 1.03 → 1.03, PRA
6.56 → 6.51. The pull toward his floor in a tough spot cost at every weight (2.531 at 0.3, 2.693 at 1) and is off. This
season's tables are one to eight games: undamped, every reach costs (2.704 → 2.732 at 0.3, 2.846 at 1; the soft third's bias
+0.12 → +0.48 → +1.31); at K 10 a five-game table counts a third of the way and the cost is four thousandths.

At the rungs (2025-26, 792,782; the model half recentred, the cleared-it half as it was):

| reach | K | every rung Brier | main rung Brier | main 60–70%: said → hit | 70–80% | soft-third main Brier |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | — | 0.1393 | 0.2342 | 63.9% → 59.0% | 73.5% → 63.8% | 0.2381 |
| 0.3 | 0 | 0.1391 | 0.2346 | 64.0% → 57.5% | 73.6% → 61.7% | 0.2393 |
| 0.3 | 10 | 0.1391 | 0.2344 | 64.0% → 58.0% | 73.5% → 62.0% | 0.2387 |
| 0.3 | 40 | 0.1391 | 0.2342 | 64.0% → 58.4% | 73.5% → 62.6% | 0.2382 |
| 0.5 | 0 | 0.1394 | 0.2354 | 64.1% → 56.6% | 73.7% → 60.3% | 0.2416 |

The ladder as a whole reads two ten-thousandths better (the low rungs lifted off a centre that ran low); the main rung and
the 60–80% bands read a little worse at 0.3 and clearly worse at 0.5 — the moved centre prints more 70%+ chances in soft
spots, and they land where the old ones did. The calibration (`docs/audits/2026-10-30-nba-calibration.md`) prints the
chance through what the same stated chance has landed this season and will take the shift up as it learns.

## Shipped

`reach: 0.3, reachDown: 0, reachK: 10` in `lib/nba/picks.js` COCKTAIL — the weight the data supports, not the weight the
ask implies. What it does for Dosunmu tonight, on the screenshot's numbers (stated 4.4; the top quarter of his nights, say,
1.5× his mean; SA #2 of 30 to shooting guards on five games):

| | where | the move | centre |
| --- | --- | --- | --- |
| PropFinder's table alone, five games (K 10: a third of the way) | 0.931 × 5 / 15 = 0.31 | 0.3 × 0.31 × 0.5 × 4.4 = +0.2 | 4.6 |
| the cheat sheet's tile at #2 beside it (in full) | 0.93 | 0.3 × 0.93 × 0.5 × 4.4 = +0.6 | 5.0 |
| the same at reach 1 | 0.93 | +2.0 | 6.4 |

The third line is what the ask reads as and what the data says costs: over 2025-26 reach 1 misses by 2.542 against 2.505
(the soft third 2.616 against 2.504) and the 60–70% rungs land 55%. One number raises it (`reach` in the cocktail); the
scorecard's "Before the ceiling read" row says what it does on the site's own nights at the book's lines.

## Blind spots and the next layer

- **Which soft matchup.** PropFinder's table is what a defense gives up to a position on average. A rebounding mismatch
  is who he shares the floor with: the opponent's bigs out, a small lineup, the pace. The injury splits and the vacated
  lifts carry the first; the pace is on the profile and in no number. A read of the opponent's own rebounding rate
  (`totals.against` is there) by lineup is the lever that could make "a great matchup" mean something per night.
- **His ceiling as a distribution, not a point.** The rungs already carry his spread; a skewed spread (his upper tail
  wider than his lower) would move the 25–35% rungs — the ceilings where Vincent plays — without moving the centre. Worth a
  replay: the empirical quantiles of his nights in place of the normal above the centre.
- **The cheat sheet's tile** counts in full, as everywhere since 2026-10-29, and the replay has no sheets: its read of a
  matchup is ungraded. The scorecard's matchup report (by source) is where it will show.

## Tools

- `tools/audit/nba-audit.mjs`: the rows carry `base`, `up`, `down`, `rank`, `count`, `reachAdd`; the rungs `base`, `up`,
  `down`, `where`, `gp`, `wModel`; "The ceiling read" section (the question, the grid, the rungs). Both replays:

```bash
node tools/audit/nba-fetch.mjs --from 2026-10-20 --to 2026-10-30 --raw .nhl-data/audit/nba --season 2026
node tools/audit/nba-fetch.mjs --from 2025-10-21 --to 2026-04-12 --raw .nhl-data/audit/nba/prior --season 2025
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-30 --from 2026-10-22 --raw .nhl-data/audit/nba --out .nhl-data/audit/reach --prior .nhl-data/audit/nba/prior/games --cocktail site --tag -site
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-28 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/reach --cocktail site --tag -site
```
