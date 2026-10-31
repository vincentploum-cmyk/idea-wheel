# The NBA projections: what else moves them (2026-10-31)

Vincent, 2026-10-31: "increase accuracy where possible." The night before, the board's chances had been calibrated to
what they land (`docs/audits/2026-10-30-nba-calibration.md`), so this pass is about the projections and the rungs
behind them. Replayed with the site's own functions on this season's box scores (`tools/audit/nba-audit.mjs`, the
cocktail as shipped, 71 games, Oct 21–30, graded from Oct 22: 1,023 points projections, 44,254 rungs), the raw feeds
fetched by the new `tools/audit/nba-fetch.mjs`; the minutes read tested apart by `tools/audit/nba_minutes.py`.
**Nothing changed.** Every lever measured either does nothing on this season or trades one read for another.

## Where the projection stands

| Stat | rows | avg miss | his last ten alone | his season alone | the projection, had we known his minutes |
| --- | --- | --- | --- | --- | --- |
| Points | 1,023 | 5.00 | 5.56 | 5.48 | 4.10 |
| Rebounds | 1,028 | 2.08 | 2.25 | 2.23 | 1.83 |
| Assists | 1,018 | 1.55 | 1.64 | 1.63 | 1.43 |
| Threes | 956 | 1.02 | 1.14 | 1.13 | 0.95 |
| PRA | 1,028 | 6.62 | 7.17 | 7.05 | 5.06 |

The projection beats his plain windows by half a point. The ingredients taken out one at a time (points): no matchup
4.998, the matchup undamped 5.459, no team ceiling 5.003, no out-teammate lift 5.018, no minutes cut 5.027 — against
5.005 as shipped. The matchup table, the ceiling and the lift are each worth nothing measurable this season; the
undamped matchup costs half a point, so the damping stays. Big projections run high (20+ points: +2.1), small ones low
(under 10: −0.7); the nights under 15 minutes played carry a +3.1 bias no read can see coming.

## The levers, measured

- **His windows.** Last season's regular season behind this season's (`scope: 'regular'`): points 5.03 (5.00 shipped),
  assists 1.50 (1.55), the rest the same. A last-five window in the blend (season 0.5 · L10 0.3 · L5 0.2): 5.01. With
  five to eight games a player, the last ten and the season are the same games; the weights are moot until November.
- **His minutes.** The board's read runs a minute high (the vacated minutes) and misses by 4.75 a night on the held-out
  slates (Oct 27–30); his season to date alone misses by 4.36, an EWMA at 0.5 by 4.34, his last game by 5.10, last
  season's average behind the season by 4.40–4.71. But re-projecting each stat as his per-minute read × the better
  minutes figure moves nothing: points 5.05 against 5.03 shipped, rebounds 1.93 against 1.93, PRA 6.20 against 6.17.
  The minutes a player gets tonight are mostly the game's own swing (blowouts, fouls, a short night): the ceiling of
  4.10 with his minutes known is not reachable from his history. The minutes read stays.
- **The projection's spread.** actual = a + b · projection fitted on the first slates (b = 0.83 for points) and scored
  on the held-out ones: 5.04 against 5.03, the 20+ bias flipping from +0.7 to −1.3. Overfits a week; out.
- **His distribution's spread in the rungs** (`spreadA`, × 1 + a · 5 / (n + 5) on his sd): at 0.5 the main rung's
  Brier improves (0.2374 → 0.2350) and the 50–80% bands land nearer what they say, but the ceiling rungs (20–35% said)
  land 21% instead of 25%, and every rung together reads the same (0.1405 → 0.1406); at 0.8 and 1.2 the whole ladder
  reads worse (0.1417, 0.1440). A trade between the line and the tail on one week's data; the cocktail audit set 0.2
  on a full season, it stays.
- **The hit-rate half.** Shrunk to ½ at n / (n + 6): the 60–80% bands land where they say (64.7 → 64.4, 74.3 → 74.0)
  and the main rung's Brier reads 0.232, but the ladder as a whole reads 0.152 against 0.1405: the low rungs are
  dragged toward a coin flip. Shrunk toward the model instead: nothing (0.1407). The model half alone: 0.1403. The
  calibration shipped the night before does this job on the printed chance without the cost.

## What is left

The remaining miss is the night's own swing: minutes, foul trouble, the score. With the public inputs the projection
is at its floor; the levers now sit at the selection end, which this replay cannot see: the book's real lines and
prices, which plays make the tables, the edge the board takes. The site's own graded nights (`GET /api/nba/scorecard`)
carry that; an export of them, read against market, edge and price, is the next audit.

## Tools

- `tools/audit/nba-fetch.mjs --from --to --raw [--season] [--no-logs]`: ESPN's scoreboards, box scores and every
  listed player's game log for a season into the replay's raw folder, resumable.
- `tools/audit/nba_minutes.py --rows <replay rows.csv> --raw --test-from`: the minutes predictors against the minutes
  played, each stat re-projected on them, the spread shrink, fit and held-out slates apart.
