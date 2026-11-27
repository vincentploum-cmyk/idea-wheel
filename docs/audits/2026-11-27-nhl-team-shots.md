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

Not changed: the run's λ is the model's math (ported from the local app). A likely cause to test is `defMult`'s asymmetry:
a soft opponent's lift is damped by the skater's floor (`defDamp`), a tough opponent's cut is applied at 0.9× to 1.12× in
full. The printed chances go through the calibration, which absorbs part of the bias.
