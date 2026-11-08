# PropFinder's new NFL pages, measured against the board (2026-11-08)

Vincent, 2026-11-08: "now we have added several new data sources from NFL, analyze and redo our logic to determine
rushing, passing, receiving props as well as TDs". The sources are the cheat-sheet pages the pull keeps since that morning
(`pages` in `lib/nfl/propfinder-nfl.js`): Role Matchups, Receiver coverage splits, TD Matchups (two forms), WR vs CB, Team
Share, Milestones (receiving yards) and Rushing Matchups. `tools/audit/nfl_sources.py` prints every table below.

## How it was measured

The pages are one snapshot each, stored from 2026-11-08 on: no week of them has been graded. Most of what they print is a
season-to-date sum of the game rows PropFinder already sends with every pull (its logs back to 2024), so each week of 2024,
2025 and 2026 was rebuilt from the rows cut before that week — the page as it would have read that morning:

| Page | What it prints | Rebuilt as |
|---|---|---|
| Team Share | his share of the team's targets, carries, red-zone targets and carries, routes | `tgtShare` / `rushShare` on each row (PropFinder's own), red-zone counts summed by side; routes are not in the rows |
| Role Matchups | the opponent's table by slot (WR1 … RB2) and market | the board reads it already: the opponent's row at his depth-chart slot (`envPos`) |
| TD Matchups | the teams' touchdowns for and against, by position, red-zone trips | touchdowns allowed by position and in all, red-zone carries and targets allowed, the team's touchdowns a game |
| Rushing Matchups | the run defenses: yards a carry, carries faced | yards a carry allowed to backs, backs' carries faced |
| Milestones | his record at the mark, the books' prices | his own hit rate at the mark: what the board's rate reads |
| WR vs CB, coverage splits | alignment against corners, results by coverage shell | in no game row: not rebuildable, not graded (PropFinder's own note on WR vs CB: "a lean rather than an edge … about a percent of game-to-game variance") |

Each piece was fitted on top of the board's figure as shipped (the replay's dump, `nfl-pf-audit.mjs --dump --check-to 8`):
least absolute deviation for the yards (the game he is likeliest to have), logistic on the board's logit for the touchdowns.
Fitted on 2024's weeks 6–18 and 2025's weeks 4–18 (the shipped fit; 2025 alone gives the same verdicts), scored unchanged on
2026's weeks 1–8, each against the board case by case with a paired bootstrap's 95% interval. The quarterbacks and the
touchdowns have no 2024 dump: 2025 alone for them.

## Receiving yards (receivers, tight ends and backs projected 10+; 1,284 games on the check)

| On top of the board | Miss a game | Against the board | Within ±10 |
|---|---|---|---|
| The board as shipped | 22.36 | — | 32.1% |
| The board rescaled alone (c + b × board) | 22.39 | +0.03 (−0.07 to +0.13) | 33.4% |
| **Team Share: target share, last five** | **22.04** | **−0.32 (−0.51 to −0.14)** | **34.4%** |
| Team Share: target share, season | 22.22 | −0.14 (−0.35 to +0.07) | 34.1% |
| Team Share: target share × the side's targets × his yards a target | 22.01 | −0.36 (−0.58 to −0.13) | 33.6% |
| Team Share: red-zone share | 22.39 | +0.03 (−0.07 to +0.12) | 33.4% |
| Completed air-yards share | 22.23 | −0.14 (−0.31 to +0.03) | 33.4% |
| His yards after the catch, share | 22.38 | +0.01 (−0.09 to +0.12) | 32.9% |
| Role / TD Matchups: yards a target allowed at his position | 22.39 | +0.03 (−0.07 to +0.13) | 33.4% |
| Role Matchups: receiving yards allowed at his position | 22.38 | +0.02 (−0.08 to +0.12) | 33.3% |
| Opponent's pass attempts faced, sacks; team's pass attempts; implied points; spread | 22.37–22.40 | +0.01 to +0.03 | 33.3–33.8% |

PropFinder's `airYds` is the air yards of his catches, not of his targets (Nacua's 80 yards on Nov 1: 15 in the air, 65
after the catch), so it is no depth-of-target read. The matchup pages repeat the opponent table the board already reads.

## Receptions (1,405 games)

| On top of the board | Miss | Against the board | Within ±1.5 |
|---|---|---|---|
| The board as shipped | 1.61 | — | 58.5% |
| **Team Share: target share, last five** | **1.56** | **−0.04 (−0.06 to −0.02)** | **58.9%** |
| Target share × the side's targets | 1.57 | −0.04 (−0.06 to −0.02) | 59.3% |
| Opponent's pass attempts, implied points, spread | 1.58 | −0.02 | 58.4–58.7% |

## Rushing yards (backs projected 10+; 449 games)

| On top of the board | Miss | Against the board | Within ±10 |
|---|---|---|---|
| The board as shipped | 23.92 | — | 27.4% |
| Team Share: carry share, last five | 23.64 | −0.28 (−0.67 to +0.10) | 29.2% |
| Team Share: carry share, season | 23.65 | −0.27 (−0.63 to +0.09) | 29.4% |
| Carry share × the side's carries × his yards a carry | 24.00 | +0.08 (−0.25 to +0.41) | 28.5% |
| Team Share: red-zone share | 23.82 | −0.10 (−0.31 to +0.12) | 29.8% |
| Rushing Matchups: yards a carry allowed to backs | 23.99 | +0.07 (−0.11 to +0.23) | 32.1% |
| Rushing Matchups: backs' carries faced | 23.98 | +0.06 (−0.11 to +0.22) | 30.7% |
| Implied points · spread | 24.06 · 23.95 | +0.14 · +0.03 | 30.5% |

The carry share leans the right way on 2026 and fitted on 2024 it read 2025 no better (+0.11, −0.13 to +0.35): not shipped.

## Passing yards (starters, 229 starts)

| On top of the passing read | Miss | Against it |
|---|---|---|
| The passing read as shipped | 55.87 | — |
| His attempts a start · completed air yards a throw · sacks a start | 55.34–55.37 | −0.50 to −0.53 (each ±1.1) |
| Opponent's yards a pass allowed · pass attempts faced · sacks | 55.24–55.47 | −0.41 to −0.63 (each ±1.1–1.3) |
| Team's pass attempts a game | 55.54 | −0.34 (−1.50 to +0.81) |

Every piece reads what the passing read's rescale alone reads (55.34): nothing is the page's.

## Anytime touchdown (backs, receivers, tight ends; 1,867 games, fitted on 2025)

| On top of the board (TD_CAL + the engine) | Brier | Against the board | Each week's six likeliest scored |
|---|---|---|---|
| The board as shipped | 0.1621 | — | 64.6% |
| TD Matchups: touchdowns allowed at his position | 0.1622 | +0.0001 (−0.0006 to +0.0007) | 64.6% |
| TD Matchups: touchdowns allowed in all | 0.1621 | −0.0000 (−0.0007 to +0.0007) | 64.6% |
| TD Matchups: red-zone carries / targets allowed | 0.1622 | +0.0000 | 66.7% |
| Team Share: red-zone share (last five · season) | 0.1621 · 0.1622 | ±0.0001 | 64.6 · 66.7% |
| Red-zone share × the team's red-zone looks | 0.1620 | −0.0001 (−0.0012 to +0.0009) | 68.8% |
| Team's touchdowns a game | 0.1624 | +0.0003 (−0.0005 to +0.0010) | 64.6% |

The touchdown engine (2026-11-03) reads his red-zone looks and the implied points already; the pages add nothing to it.

## What shipped

**The target share on the receiving read** (`TGT_SHARE`, `tgtShareRead`, `shareRead` in `lib/nfl/projections.js`): a
receiver's, a tight end's or a back's receiving yards and receptions are c + b × the board's read (after the shrink) + w ×
his target share over his last five games with a touch (PropFinder's `tgtShare` per row, the number Team Share sums; rows
without it left out; no share → the board's read), from the lists' floor (10 yards, 1 reception):

| Market | c | b (the board's) | w (his share) |
|---|---|---|---|
| Receiving yards | −5.479 | 0.7828 | 81.477 |
| Receptions | 0.050 | 0.610 | 6.059 |

A 25% share at a board read of 60 is 62 yards; 10% at 60 is 49. The ladder's curve (`RESID.rec_yds`, `RESID.receptions`)
and the floor / ceiling (`RANGE`) are refitted on the new figure (2024–25). The big games keep reading the projection
before the shrink and the share (their models were fitted on it); `y.board` and `y.tgtShare` ride on the row, the hover
says the share.

Through the site's own replay (the board built every week from the pulls, all graded games, inactive in):

| | 2025 (in the fit) | 2026 weeks 1–8 |
|---|---|---|
| Receiving: miss | 20.14 → 19.95 | 22.01 → 21.55 |
| Receiving: within ±10 | 31.8% → 34.2% | 29.5% → 33.7% |
| Receptions: miss | 1.50 → 1.47 | 1.60 → 1.56 |
| Receptions: within ±1.5 | 61.3% → 62.8% | 58.8% → 60.9% |

The rungs on 2026 (said / landed): receiving strong 65.8 / 64.9%, lean 50.3 / 49.6%, thin 33.7 / 33.4% (the board's
66.2 / 63.9, 50.1 / 49.1, 33.6 / 33.8); receptions strong 71.6 / 72.5%, lean 51.6 / 53.9%, thin 37.0 / 37.6% (the
board's landed 3–5 points over what they said: 70.6 / 74.0, 53.0 / 57.0, 36.0 / 40.6). The outliers on the new figure:
receiving's week's top ten said 17.0% and landed 18.8% on 2026 (16.8 / 26.2% before); receptions' said 13.7% and landed
11.2% (10.5 / 10.0% before) — the receptions' `typical` spread was fitted on the old figure.

**Not shipped**: rushing (the carry share), passing, touchdowns — nothing beat the board out of sample.

## Open

- The pages as stored: WR vs CB and the coverage splits cannot be rebuilt; graded once a few weeks of snapshots are kept
  beside their box scores (the export carries them: `exportWeek` `pages`).
- Routes run and route share (Team Share) are in no game row: the same, once stored.
- The receptions' outlier spread (`NFL_OUTLIERS.receptions.typical`) on the new figure.
- The backs' carry share: re-test at the season's end (449 games on the check).
