# NHL: do the skaters' shots add up to the team's? (2026-11-27)

Vincent: "I assume that in case we say a team will get a lot of shots on goal, the share of shots is reflected in the
players, correct?" The model has no team shot total split among its skaters: each skater's λ is his own rates × the
opponent's allowed at his position (`defMult` in `model-core.js`) × his line's share, and the team is their sum. So the
check is whether that sum tracks the shots the team takes.

Source: the scorecard's graded skater-games (`GET /api/nhl/data/scorecard?from=2026-10-01&rows=1`, 5,843 rows), per
team-game with 14+ graded skaters; "actual" is the shots of the same graded skaters. The board prints the run's λ for
shots (`DEFAULT_WEIGHTS` w = 0), so the run is the read that matters.

| read (Σ over the skaters) | season: projected / actual | corr | last 40 games: projected / actual | corr |
| --- | --- | --- | --- | --- |
| the run's λ (the board) | 23.2 / 26.1 (−2.9) | 0.29 | 22.9 / 26.0 (−3.1) | 0.22 |
| the study's λ | 25.4 / 26.2 | 0.42 | 25.2 / 25.9 | 0.36 |
| the skaters' season averages | 26.4 / 26.1 | 0.36 | 26.2 / 25.9 | 0.30 |
| the skaters' last-10 averages | 26.4 / 26.1 | 0.37 | 26.1 / 25.8 | 0.36 |

By the run's sum, in quarters of the season's team-games: 18.7 projected / 24.3 actual, 21.9 / 25.3, 24.0 / 26.6,
28.3 / 28.2. **When the run reads a team high its skaters are right (top six +4%); when it reads a team low it cuts
every skater too far** (top six −20%, depth −29%). The last 40 games: top six −6%, depth −23%.

The share inside a team is about right (season, predicted / actual share of the team's shots per skater): C1 9.9% / 9.2%,
W1 10.0% / 9.1%, C2 7.5% / 6.9%, W2 7.4% / 7.2%, D1 6.4% / 6.1%, D2 4.4% / 4.7%, depth forwards ~4.1% / 4.6%, D3 3.2% / 3.6%:
the first line a touch heavy, the depth a touch light.

## The cut, replayed (Vincent: "yes soften the cut and port it to the local app")

The scorecard export carries each graded skater's `defMult` and shot tier since this audit, so the cut can be replayed:
the raw ratio recovered from the old cut, the new cut applied, λ scaled by the change in `defMult` (it also scales the
shots cap). 2,889 of the 5,843 skater-games had a cut.

| the cut | log-lik / skater-game | Brier 3+ | λ a skater (actual 1.535) | lowest quarter of team-games |
| --- | --- | --- | --- | --- |
| as it was, 0.94–1.03 × (1 − raw) | −1.6035 | 0.1544 | 1.368 | 18.7 / 24.3 |
| × defDamp (the lift's damping) | −1.5989 | 0.1541 | 1.380 | 19.0 / 24.4 |
| × defDamp × 0.5 | −1.5958 | 0.1539 | 1.401 | 19.6 / 24.2 |
| **× defDamp × 0.25 (shipped)** | **−1.5947** | **0.1538** | 1.412 | 19.8 / 24.2 |
| no cut | −1.5940 | 0.1539 | 1.422 | 20.0 / 24.3 |

The run's λ runs low on its own (1.37 a skater against 1.54), so anything that raises it scores better; with each shot
tier's level fitted on the same rows the order holds (no cut −1.5657, ×0.25 −1.5661, ×0.5 −1.5666, ×1 −1.5686, as it
was −1.5695), and fitted before 11-13 and scored after (no cut −1.5701, ×0.25 −1.5702, ×1 −1.5720, as it was −1.5726).
A free exponent on the whole `defMult` (lift and cut) scores best at 0.25 of its strength. The gain of ×1 over the old
cut: +4.6 per 1,000 skater-games (95% 3.5 to 5.7, games resampled); ×0.5: +7.7 (5.9 to 9.7).

Shipped: `DEF_CUT_SHARE` = 0.25 (`opponentShotMult` in `model-core.js`, port group 10). The two larger findings are left
for a decision: the lift is too strong as well (an elite shooter against a soft defense: λ 3.31, 2.69 landed), and the
run's λ is off by shot tier whatever the opponent (actual over λ, season: elite 0.86, good 1.09, average 1.16, weak 1.41).
The board’s calibration was fitted on the old λ (the stored runs keep it); it learns the new one as runs made from today are graded.
