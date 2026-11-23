# Does a skater's record against similar defenses predict his shots? (2026-11-21)

Vincent, 2026-11-21: "What about checking how players performed against similar defenses?"

**Data.** Public NHL box scores, 2025-26 whole (1,312 games, 35,053 skater-games with 15+ games behind them) and 2026-27 to
Nov 20 (350 games, 5,722 skater-games with 10+). Leak-free: every read on a date is built from that season's games before it.
Scripts: `tools/predictors/similar_defenses.js <games dir> <min gp> <shuffle seed> <out.json>` (0 = real) →
`tools/predictors/similar_defenses_fit.js <out.json>`.

**Method.** Poisson on tonight's shots, offset by his season-to-date shots a game, with the opponent's shots allowed to his
position group (F / D, per skater, over the league) and home. Then one extra term: log of his shots a game against defenses
"similar" to tonight's (shrunk toward his rate at 10 games) over his rate. Three definitions of similar: the same third of
the league in shots allowed; the same third in shots allowed to his position; the 8 nearest teams on shots, attempts and
scoring chances allowed (standardised). Five-fold cross-validation by date. The null: the same fit with each skater's past
opponents shuffled among his own games (keeps his rate, kills any matchup), three seeds.

| 2025-26 | coefficient (z) | CV deviance change | shuffled nulls (z) |
| --- | --- | --- | --- |
| same third, shots allowed | -0.025 (-0.6) | +0.9 | +1.3, -1.1, -0.5 |
| same third, to his position | +0.047 (+1.2) | -1.0 | -0.8, +0.4, -0.9 |
| 8 most similar defenses | -0.008 (-0.2) | +2.2 | -0.3, -2.5, +1.0 |

2026-27: -0.3, +2.1 and -1.1 z; the buckets are not monotonic (a skater at 1.05-1.2× his rate against similar defenses shot
0.92× what was expected).

**Verdict: nothing.** The real terms sit inside the range the shuffled opponents produce (one shuffle reached z -2.5), and
no definition improves the cross-validated fit. A skater against "his kind" of defense shoots what his season rate and
tonight's opponent say: once against similar defenses (5+ games) at under 0.8× his rate he landed 1.02× expected, at 1.2×+
1.02× too. What does carry is the opponent itself: shots allowed to his position, coefficient 0.68 ± 0.05 (a defense
giving 10% more shots to the position than the league, about 7% more shots), as the site's tables already read. Same
answer as the head-to-head study (`docs/shots-goals-predictors.md` section 8): a matchup split is his rate plus noise.
