# NHL λ shots: the tier bias is a spread bias (2026-11-27)

Vincent: "fix the tier bias first" (after `2026-11-27-nhl-team-shots.md`: the run's λ shots landed 0.85 of itself for
elite shooters and 1.41 for the weak tier).

Rows: the scorecard export (`GET /api/nhl/data/scorecard?from=2026-10-01&rows=1`), 5,843 graded skater-games, each
with its `defMult` and shot tier; the softer cut of the same day replayed in first (`DEF_CUT_SHARE` 0.25), so the fit is
on top of what is live. The board prints the run's λ for shots.

## Where the bias sits

Actual over λ by shot tier: elite 0.85, good 1.08, average 1.15, weak 1.41 (the same since 11-13: 0.85 / 1.10 / 1.16 /
1.44). By F / D and line: F1 0.98, F2 1.05, F3 1.19, F4 1.22; D1 1.06, D2 1.18, D3 1.23. By the size of λ:

| λ band | n | λ | landed | ratio |
| --- | --- | --- | --- | --- |
| < 0.5 | 494 | 0.36 | 0.78 | 2.18 |
| 0.5–0.8 | 1,122 | 0.66 | 0.99 | 1.50 |
| 0.8–1.1 | 1,102 | 0.94 | 1.16 | 1.24 |
| 1.1–1.5 | 1,046 | 1.29 | 1.54 | 1.20 |
| 1.5–2.0 | 913 | 1.73 | 1.86 | 1.08 |
| 2.0–2.5 | 446 | 2.21 | 2.12 | 0.96 |
| 2.5–3.0 | 295 | 2.73 | 2.36 | 0.86 |
| 3.0–3.5 | 209 | 3.23 | 2.62 | 0.81 |
| ≥ 3.5 | 216 | 4.20 | 3.23 | 0.77 |

Inside each tier the same slope: elite read 1.81 took 2.26 (1.25), elite read 4.20 took 3.23 (0.77); weak read 0.35 took
0.77 (2.16), weak read 1.20 took 1.39 (1.16). The tier only follows the size of λ: λ is too wide.

## The fix, held out (fitted on the games before 11-13, scored on the 3,024 after)

| read | log-lik / skater-game | Brier 3+ | Brier 4+ | mean λ (landed 1.533) |
| --- | --- | --- | --- | --- |
| λ as live (softer cut) | −1.6025 | 0.1573 | 0.0824 | 1.388 |
| one factor | −1.5959 | 0.1583 | 0.0839 | 1.484 |
| one factor per tier | −1.5702 | 0.1541 | 0.0803 | 1.499 |
| **A · λ^B** | **−1.5507** | **0.1514** | **0.0791** | 1.509 |
| A · λ^B × tier | −1.5458 | 0.1509 | 0.0791 | 1.514 |
| A · λ^B × F / D | −1.5500 | 0.1511 | 0.0790 | 1.510 |

Shipped: A · λ^B with A = 1.30, B = 0.611 (the season's fit; the early-half fit was 1.28 and 0.632). The tier on top adds
5 per 1,000 for four more numbers whose fitted shape (B 0.37 with tier steps) would not survive a refit; left out.

## The board's calibration

The board prints chances through a logistic recalibration learned on the season's graded runs. Learned and scored the
same way (before / after 11-13), the shrunk λ needs none (b ≈ 1.0 at 2+ … 5+ against b ≈ 0.6 on the live λ) and both land
on the same Brier after it (3+: 0.15137 / 0.15136; 4+: 0.07905 / 0.07908). So the printed board chances barely move; what
changes is the λ itself (the expected shots shown, every team's Σλ, the Saves row without a goalie, the special-teams
split) and the local app's odds, which have no calibration. Because the calibration is learned on stored runs, a run saved
before the change is read as the model makes it now (`lambdaSNow` in `lib/nhl-data/calibration.js`), else the fit would
pull the new λ in twice.

Where it goes: `shotSpreadLambda` in `model-core.js` on the published λ shots and the odds from it (p2s … p5s); the
ladder, the attack score and the tiers read the λ before it (`lambdaSRaw` on the row). Port group 12.

## The lift against a soft defense: left as it is (Vincent: "yes fix the boost and port it")

Before the spread, an elite shooter lifted by a soft defense was read 3.31 and took 2.69, and a free exponent on the whole
`defMult` scored best at 0.25 of its strength. Both were the spread: replayed with the lift at a share L of
(raw − 1) × defDamp and the spread refitted each time (fitted before 11-13, scored after), the lift as it is scored best:

| lift share L | held-out log-lik | Brier 3+ | Brier 4+ | lifted rows only |
| --- | --- | --- | --- | --- |
| **1.0 (as it is)** | **−1.55065** | **0.15136** | **0.07914** | **−1.56226** |
| 0.5 | −1.55145 | 0.15157 | 0.07921 | −1.56371 |
| 0.25 | −1.55194 | 0.15170 | 0.07926 | −1.56457 |
| 0 | −1.55249 | 0.15184 | 0.07932 | −1.56554 |

With the spread the lifted rows land at their λ in every tier (actual over λ: elite 1.01, good 1.08, average 0.95, weak
0.97). The cut checked the same way: as it was −1.55064, ×1 −1.55105, ×0.5 −1.55070, ×0.25 −1.55065, none −1.55068 (Brier
3+ 0.15156 / 0.15153 / 0.15140 / 0.15136 / 0.15134): within noise of each other once the spread is in, 0.25 kept. Nothing
changed in the model, nothing to port.
