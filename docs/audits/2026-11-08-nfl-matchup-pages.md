# PropFinder's matchup pages in the numbers, hand-set (2026-11-08)

Vincent, 2026-11-08, after the pages were measured (`2026-11-08-nfl-sources.md`, `2026-11-08-nfl-coverage.md`: no page earned a
weight): "we need them to feed our numbers". Asked how — a matchup-adjusted column beside the tested projection, the pages
into the projection at hand-set weights, or at the fitted ones (near zero) — he chose **into the projection, hand-set**.

## What feeds what (`lib/nfl/matchups.js`)

The pages are digested once a pull (`digestPages`, stored beside it as `propfinder-pages-digest.json`; a pull stored before
this change gets it on its first read, `withPages` in `lib/picks/store.js`), and every projection reads its factor
(`matchupFactor`). Each part is 1 + weight × (its ratio − 1), the parts multiplied, the product capped at ±12% (`CAP`).

| Market | Page | The ratio | Weight |
|---|---|---|---|
| Receiving yards (WR / TE / RB) | Receiver coverage splits × Coverage Matrix | his yards a route in each shell (pulled to his overall at 40 routes; last season's at half while this one holds < 150 routes) weighted by the opponent's shell mix, over his overall | 0.5 |
| | WR vs CB | PropFinder's advantage score against the corners he lines up on, over the slate's median (a 0.1 edge = +5%; "limited" at half; "unavailable" none; only against the defense the score was built for) | 0.5 per unit |
| Receptions | the same | half the receiving factor's distance from 1 | — |
| Rushing yards (a back) | Rushing Matchups | his adjusted direction share through the opponent's yards a game at each gap, over the league's at each gap | 0.5 |
| | Rushing Matchups | the opponent's EPA a rush allowed over the league's (0.1 EPA = +8%) | 0.8 per unit |
| Rushing yards (a quarterback) | Rushing Matchups | the EPA alone | 0.4 per unit |
| Passing yards | Coverage Matrix | the opponent's EPA a pass allowed over the league's (0.1 EPA = +6%) | 0.6 per unit |
| Anytime TD (λ; 1st half, 2+, first TD follow) | TD Matchups | the opponent's touchdowns allowed a game at his position over the league's, at gp / (gp + 16), the ratio within 0.6–1.4 | 0.5 |
| | Coverage Matrix | its red-zone touchdown rate allowed over the league's, at gp / (gp + 8) | 0.5 |

Role Matchups is the opponent's table by slot the projection reads already; it is not counted twice. The tested read rides on
every row (`beforePages`), the factor and each part with its reason in `pages`, and the hovers (the lists' Proj and TD cells,
the player card) say it: "PropFinder's matchup pages ×1.06: Coverage ×1.04 (his yards a route against SEA's coverage mix:
108% of his usual) · WR vs CB ×1.02 (advantage +0.067 against …)". `MATCHUP_PAGES = false` in `lib/nfl/projections.js` turns
it off; `WEIGHTS` and `CAP` set it.

## On the first slate (week 9, the pull of 2026-11-08)

| Market | Players read | 10th · median · 90th percentile | At the cap |
|---|---|---|---|
| Receiving yards | 247 | ×0.97 · ×1.01 · ×1.05 | 0 |
| Rushing yards | 129 | ×0.90 · ×1.00 · ×1.12 | 24 |
| Passing yards | 29 | ×0.93 · ×1.01 · ×1.12 | 5 |
| Anytime TD | 374 | ×0.88 · ×1.01 · ×1.12 | 103 |

## What it costs, measured where it can be

This season's pages cannot be graded on this season's games (they hold them). Last season's coverage and rushing pages
(PropFinder serves 2025's, the `…Prior` pages) through the same code on 2026's weeks 1–8, the games played, against the read
without them (`nfl-pf-audit.mjs --dump --pages-prior <export week>`): the coverage fit, the run fit, the EPAs and the red-zone
rate; WR vs CB and TD Matchups have no last-season copy.

| Market | Moved | Miss a game | Within ±10 (±1.5, ±25) |
|---|---|---|---|
| Receiving yards | 961 of 1,241 | 22.60 → 22.64 (+0.05, −0.01 to +0.10) | 32.8% → 32.2% |
| Receptions | 273 of 1,452 | 1.55 → 1.55 | 61.1% → 61.1% |
| Rushing yards | 510 of 636 | 21.28 → 21.32 (+0.04, −0.10 to +0.19) | 31.9% → 31.6% |
| Passing yards | 226 of 251 | 64.50 → 65.87 (+1.38, −0.14 to +2.85) | 24.3% → 26.7% |
| Anytime TD (the red-zone part) | 1,695 of 1,991 | Brier 0.1595 → 0.1596 (+0.0001, −0.0002 to +0.0004) | — |

Receiving, rushing and touchdowns: inside the noise either way. Passing is the cost to watch: the quarterbacks last season's
pass defense raised threw 12 yards under their read (the passing read reads PropFinder's table of this season's yards allowed
already). This season's pages may read better than last season's; the stored weeks will say (the export carries every page:
re-run this table on this season's snapshots at mid-season).
