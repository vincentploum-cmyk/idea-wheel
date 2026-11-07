# The NBA's outlier nights: rebounds and threes over the projection

Vincent, 2026-11-07: "we need to start calibrating the nba model. I just checked the rebounds and the 3s, we need to be able
to predict outliers better. For example, yesterday a few players were projected by us to get 4 or 5 rebounds but they
actually got 10+. These are the things I need to be able to predict because that is where the money is for nba. The big
players are nuked in odds anyways."

**Shipped** (`OUTLIERS` in `lib/nba/picks.js`, on the site's `COCKTAIL`; the board before it is `COCKTAIL_BEFORE_OUTLIERS`):

1. **A count's tail on the counts' ladders** (`countTail: ['reb', 'ast', 'tpm', 'stl', 'blk']`, `countTail` / `countQuantile`
   in `lib/picks/projection.js`). The rung's model half is the negative binomial with the ladder's own centre and spread
   (Poisson where the spread is narrower than a Poisson's), in place of the normal over the same two numbers. A 4.5-rebound
   projection at a spread of 2.5 now reads 10+ at 3.8% (the normal said 2.3%). Points and PRA keep the normal.
2. **Tonight's starting five** (`lineup: { up: 0.1, down: 0.1, games: 10, min: 5 }`): a player who started under half of
   his last ten (PropFinder's `starter` flag on his game rows) and is in RotoWire's five tonight × 1.1 on every market; a
   player who started half or more and is not in it × 0.9. It rides in the environment beside the teammates-out factor
   (`ranges[market].lineup`, `lineup` { factor, role, share, n, status } on the side player, `lineupText` on the hovers).

The calibration on top (`nba/meta/calibration.json`) was fitted on the old tails: relearn it after the deploy
(`POST /api/nba/refresh?only=calibration`, the data workflow's `what: calibration`), or it relearns with the next night's grading.

## The data

The site's board replayed (`nba-audit.mjs --cocktail site`) on 2025-26 (the fit, 18,858–18,984 player-games a market)
and this season through 2026-11-06 (the check, 17 nights, 2,167–2,365 a market), joined to ESPN's box scores of 2023-24
through this season (`nba-box-fetch.mjs`) for what each player did before the night (`tools/audit/nba_spikes.py`; the
tables in `2026-11-07-nba-outliers-tables.md`). A mark "+d" is his centre rounded up plus d (a 4.4 projection: +3 = 8+);
a **spike** is double his projection and at least 4 rebounds / 2 threes / 4 assists / 10 points over it.

## 1. The normal put too little on the big nights

Over 2025-26 the board's tail (the normal over his last 82's spread) said less than landed at every mark past + 3, for
every stat; the count with the same centre and spread lands on it:

| 2025-26 | landed | normal said | count said |
|---|---|---|---|
| Rebounds + 5 | 4.4% | 3.6% | 4.9% |
| Rebounds + 6 | 2.5% | 1.9% | 3.1% |
| Rebounds + 8 | 0.8% | 0.5% | 1.2% |
| Rebounds spike | 4.6% | 3.6% | 5.0% |
| Threes + 3 | 3.5% | 2.2% | 3.8% |
| Threes + 4 | 1.2% | 0.6% | 1.6% |
| Assists + 4 | 4.1% | 2.8% | 4.1% |
| Assists + 6 | 1.2% | 0.5% | 1.3% |
| Points + 15 | 2.5% | 1.5% | 3.0% |

On the rungs around the centre (centre − 3 to + 8, log loss × 1000, lower is better), the count wins for every count stat
on both seasons; points and PRA lose with it near the line on 2025-26 (a count's skew lowers its median, and the board ran
0.7 points under there), so they keep the normal:

| | 2025-26 normal → count | this season normal → count |
|---|---|---|
| Rebounds | 358.3 → 353.4 | 349.0 → 337.2 |
| Assists | 269.1 → 260.7 | 271.6 → 257.1 |
| Threes | 197.2 → 184.5 | 194.2 → 180.7 |
| Steals | 145.7 → 133.8 | 144.2 → 130.1 |
| Blocks | 104.5 → 92.9 | 103.3 → 90.4 |
| Points | 578.3 → 584.1 | 564.4 → 546.9 |
| PRA | 627.8 → 637.2 | 602.8 → 589.8 |

The variance factor on the board's spread that fit 2025-26 best was 1.0 for rebounds, assists and threes: the spread was
right, the shape was not. This season's 17 nights land under both reads (rebounds + 5: said 4.5% normal, 5.6% count, landed
3.7%): the board runs high this season (points + 0.5 a game), which the market calibration takes out.

## 2. What sees a spike coming

Each read on top of the board's chance, σ(a + b · logit(board) + w · read), fitted on 2025-26 and scored on this season:

- **Starting tonight** is the strongest read for every stat (rebounds: Δ log loss −1.7 × 10⁻³ this season, −1.1 on
  2025-26; the night's top 2% by the board's spike chance 4.4% landed, with the start 13.3%). A player who usually comes off
  the bench and starts tonight played 28.2 minutes over 2025-26 against the board's 24.4.
- **Teammates out** next (the vacated rebounds and minutes: −1.4 and −1.3 this season).
- **Nothing else**: the opponent's misses, its offensive rebounds allowed, its rebounds allowed (season or last ten), pace,
  his own past spikes, his best night in his last 20, his rate a minute at his long minutes, his threes attempted lately,
  his 3P%. His own spike record even counts against him (a past big night was a high-variance night, already in his spread).

So the start is the lever, and it is a lever on the mean, not only the tail: over 2025-26 the board's projection against
what landed, by tonight's start and his last ten,

| 2025-26 | n | rebounds | threes | points | assists |
|---|---|---|---|---|---|
| off the bench, bench tonight | 6,390 | 0.99 | 0.99 | 1.01 | 1.01 |
| off the bench, **starts tonight** | 1,350 | **1.21** | **1.26** | **1.28** | **1.30** |
| starter, starts tonight | 9,852 | 1.05 | 1.04 | 1.07 | 1.08 |
| starter, **bench tonight** | 1,266 | **0.92** | **0.91** | **0.91** | **0.89** |

This season (17 nights): promoted 1.08 / 1.12 / 1.05 / 1.00 (134 player-games), demoted 0.85 / 0.86 / 0.79 / 0.82 (320).
The factor on the ladder's centre (log loss over centre − 3 to + 6): promoted × 1.1 takes most of 2025-26's gain (rebounds
461.7 → 446.1, points 677.1 → 649.4; × 1.2 is 442.0 / 640.1) and costs little this season (rebounds 398.3 → 397.4, points
615.2 → 620.3); demoted × 0.9 helps both (rebounds 371.0 → 367.4 and 329.0 → 322.3, points 586.2 → 570.1 and 568.2 →
532.2). Shipped at × 1.1 and × 0.9, below the fit, for the expected lineups RotoWire posts before the confirmed ones.

## 3. The board with both, replayed

The site's board with `OUTLIERS` against the board before it, the same player-games (`nba_ab_rows.py`; the replay reads the
starters off each box score as the confirmed five, and the start flag on this season's box-score rows; last season's game
logs carry none, so the lineup read needs five flagged games this season):

| Average miss | points | rebounds | assists | threes | PRA |
|---|---|---|---|---|---|
| 2025-26 before → after | 4.903 → 4.883 | 1.953 → 1.948 | 1.444 → 1.441 | 1.010 → 1.008 | 6.352 → 6.315 |
| this season | 4.888 → 4.880 | 1.914 → 1.914 | 1.422 → 1.422 | 1.000 → 0.999 | 6.330 → 6.317 |

| Rung Brier | points | rebounds | assists | threes | PRA |
|---|---|---|---|---|---|
| 2025-26 before → after | 0.1828 → 0.1821 | 0.1619 → 0.1618 | 0.1391 → 0.1392 | 0.1115 → 0.1111 | 0.1708 → 0.1698 |
| this season | 0.1759 → 0.1757 | 0.1584 → 0.1572 | 0.1363 → 0.1345 | 0.1113 → 0.1102 | 0.1660 → 0.1658 |

The Brier is the whole ladder, mostly the rungs near the line; the tail's gain is in the table of section 1.

## 4. How far a spike can be called

A spike is mostly the night's own luck. Ranking each night's players by the board's chance of the spike (the count tail,
with the lineup read), over 2025-26 the night's five likeliest landed:

| 2025-26 | every player | the night's top five | the top five said |
|---|---|---|---|
| Rebounds (double, + 4) | 4.6% | 9.7% | 11.5% |
| Threes (double, + 2) | 7.9% | 16.6% | 15.8% |
| Assists (double, + 4) | 3.0% | 6.2% | 9.6% |

Twice the base rate: real, and the value is in the price. A book that prices a 4.5-rebound player's 10+ at +2500 (3.8%)
was never a play at the old 2.3%, and is fair now. The top of the list still runs high for rebounds and assists (said
10–20%, landed 9% and 6%), the calibration's job.

Last night (2026-11-06), from 3.6–6.4 projected rebounds to 10+: Ayton 4.6 → 11 (started, 23 minutes against 16
projected; the board said 9.8% for 10+), Lyles 3.6 → 13 (off the bench, 29 minutes against 21; 4.4% for 8+, 5.7% as a
count), Hezonja 6.4 → 10 (off the bench), Poeltl 6.4 → 11. Each was minutes the board did not project; the lineup read
covers the ones a start announces, not a bench player's minutes in a game that runs his way.

## Next

- An outlier list (the night's likeliest to double the line, by stat) on the Big games tab, off the same chances.
- The top of the spike list runs high: a fit on the spike marks alone once the season has enough nights.
- The minutes of a bench big in a close game (Lyles) are not in any pre-game read measured here.
