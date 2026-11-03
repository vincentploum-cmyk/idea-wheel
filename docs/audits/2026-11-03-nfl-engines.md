# The two-engine NFL spec, tested piece by piece (2026-11-03)

Vincent, 2026-11-03, a spec to implement: TD plays and yardage plays are two separate models; Engine 1 the yards (proj =
volume × matchup × efficiency × game script, the edge over the book's line, a "max ladder" gate for volume monsters);
Engine 2 the touchdowns (red-zone opportunity × the team's implied total, the top ~6); an outlier rule (a top-decile
red-zone player off the card is played or justified); a card cap (2 receiving ladders, 2 rushing ladders, 6 TD values); the
sheets before the book; a grading loop.

Every piece was scored case by case on 2026's weeks 1–7 against the board as shipped, fitted on 2025's weeks 4–18 where it
carries a weight. `tools/audit/nfl_engines.py` prints every table; `nfl-pf-audit.mjs --dump` now writes the touchdown reads
too (`nfl-board-tds.json`). PropFinder's logs carry red-zone carries (`rzAtt`) and targets (`rzTgt`) for 2024–2026. They have
no inside-5 split, no cornerback (WR / CB) rank and no offensive-line rank: the matchup is what the defense gives up at his
position.

## The verdict, piece by piece

| Piece | Measured | Shipped |
|---|---|---|
| Two separate models | The board already reads yards and touchdowns apart | — |
| Engine 1: volume × matchup × efficiency × script | Receiving within ±10: 29.5% against the board's 32.1% (−2.7, 95% interval −4.9 to −0.2); rushing 24.5% / 25.9%; with its weights searched on 2025, 30.0% / 25.2% | No |
| … the matchup and the script inside it | The weight search on 2025 kept the matchup at 0.6 / 0.3 and the script at 0 / 0.02; neither beat the board on 2026 | No |
| The over-projection the card exposed | The board's top 5% of receiving projections got 11.4 yards fewer than said, rushing 18.2; each week's top 2 17.8 / 19.5 | **The shrink** |
| Max-ladder gate, receivers (8+ targets over 5, 22%+ share, 15%+ in each of 3) | 71 gated games: thin rungs said 33.7% landed 29.6%, strong 66.6% / 56.3% — worse than the rest (thin 39.8%) | No |
| Max-ladder gate, backs (60%+ carry share, a weak run defense, favoured) | 18 games: thin said 34.3% landed 50.0% — promising, far too few | Not yet |
| Card cap, 2 + 2 ladders | Each week's top 2 by projection land well under what they say (strong 65% → 36–43%), even after the shrink; the gated top 2 land closer on 14 picks | No |
| Engine 2: red-zone share × implied total, as written | Brier +0.0021 against the board (−0.0027 to +0.0069): no better | No |
| Engine 2: the board's read + red-zone looks + implied points | Brier −0.0034 (−0.0053 to −0.0015); each week's six likeliest 27 of 42 scored (23 before) | **Yes** |
| The outlier rule | Top-decile red-zone players the board left off its six scored 44.8% (it said 37.0%); under the engine 34 of them make the six (26 before), 70.6% scored | **Yes, through the engine** |
| The edge over the book, the sheets first | The page carries no price (2026-11-01); only two stored pulls hold pre-game lines | Not tested |
| The grading loop | The audit tools grade every replayed week; this study's fits come from it | The tools stand |

## What shipped

**The shrink** (`YARDS_SHRINK` in `lib/nfl/projections.js`): a receiver's yards are 2.07 + 0.772 × the board's, a back's
rushing 1.29 + 0.887 × the board's (least absolute deviation on 2025: the game he is likeliest to have). The ladder's curve
(`RESID.rec_yds`, `RESID.rush_yds`) and the floor / ceiling (`RANGE`) are refitted on the shrunk projection; the unshrunk
figure rides on the row as `unshrunk`, and the big games read it on its own curve (`RESID_UNSHRUNK`), since their models
were fitted on it. A quarterback's rushing (`QB_RUSH`) and the receptions are not shrunk.

| Through the site's replay | 2025 (fitted) | 2026 weeks 1–7 |
|---|---|---|
| Receiving within ±10 | 30.7% → 34.3% | 27.5% → 32.2% |
| Receiving way off (> 30) | 22.7% → 20.4% | 28.2% → 25.1% |
| Rushing within ±10 | 29.7% → 30.2% | 23.0% → 27.2% |
| Rushing way off | 28.7% → 27.5% | 27.9% → 26.2% |

On every 2026 player the rungs land as said: strong 66.0% said / 64.1% landed, lean 50.0 / 50.4, thin 33.7 / 34.9 (the board's
lean and thin landed 5–6 points over). The week's top picks still land under (strong said 65%, landed 43–46% on 14 and 35
picks): a list sorted by the projection picks the players it over-reads; the shrink narrows it, it does not close it.

**The touchdown engine** (`TD_ENGINE`, `tdEngine`, `rzLooksOf`): the board's chance (after `TD_CAL`) read again as
σ(−0.2844 + 0.8527 · logit(p) + 0.117 · his red-zone looks a game over his last five games with a touch + 0.0449 · (his
team's implied points − 22)). Quarterbacks keep the board's read. `td.board`, `td.rz`, `td.points` ride on the row; the
anytime cell's hover spells it out.

| Through the site's replay | 2025 (fitted) | 2026 weeks 1–7 |
|---|---|---|
| Brier | 0.1239 → 0.1231 | 0.1237 → 0.1222 |
| Each week's six likeliest: said → scored | 51.3% → 57.8% before; 58.6% → 62.2% after | 56.0% → 54.8% before; 62.8% → 66.7% after |

Week 8 (the stored pre-game pull of Nov 1, ESPN's injury feed): receiving within ±10 32.1% → 35.8%, rushing 17.0% → 23.4%;
touchdown Brier 0.1542 → 0.1515, the six likeliest 3 of 6 before and after.

## Open

- The backs' max-ladder gate: 18 games read well; re-test at mid-season.
- The card: a sorted list's top over-reads; a card of two needs a pick rule that has been graded, not the top of the list.
- Inside-5 carries, cornerback and line ranks are not in the data the replay holds.
