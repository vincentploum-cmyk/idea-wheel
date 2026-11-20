# Why the picks stopped hitting (NHL + NBA), 2026-11-20

Source: the daily-results artifacts (`.github/workflows/daily-results.yml`) for the ET nights 2026-11-15 to 11-19,
pooled. NBA: 11,808 graded plays, 2,618 on the board. NHL: 33 games, 1,111 skater-games. All five nights come after the
2026-11-12/13 model changes (NBA learned read and line blend; NHL ISCF goals read and line-minutes shots), so this window
cannot compare before and after. It shows only where the model stands now. The scorecard grades the model's `raw` chance
(`gradeSlate` replays without the calibration).

## NBA: the board overstates its chances by 16–20 points, every night

| Night | Board plays | Said | Hit | Book implied | ROI |
| --- | ---: | ---: | ---: | ---: | ---: |
| 11-15 | 567 | 65% | 50% | 54% | -11% |
| 11-16 | 543 | 66% | 48% | 55% | -13% |
| 11-17 | 451 | 67% | 49% | 55% | -11% |
| 11-18 | 772 | 66% | 50% | 54% | -8% |
| 11-19 | 285 | 65% | 46% | 54% | -15% |

- **The stated chance is about 4× too spread out.** Every play graded: said 84% hit 59%; said 74% hit 55%; said 64% hit 52%;
  said 36% hit 46%. A real 60% looks like a 52%.
- **After the price, the model adds almost nothing.** Logistic fit on 11,214 priced overs: hit = σ(-0.31 + 0.95·logit(book)
  + 0.05·logit(model)). Log loss: model 0.711, a flat 50% 0.693, the book 0.688. By group, the model's weight is
  **-0.19 on points / rebounds / assists / threes** (the learned-trees markets), -0.05 on combos, +0.11 on other stats and
  +0.20 on Q1 / first-3-minutes. Its "edge" picks out overpriced overs.
- **The edge sort helps a little but never gets above break-even**: edge 0–5 pts ROI -19%, 5–10 -13%, 10–15 -8%,
  15–20 -6%, 20+ -14%.
- **Q1 markets are a third of the board and the worst calibrated**: q1_ast said 68% hit 43%, q1_reb 71% / 45%,
  q1_pts 72% / 53% (847 board plays). Over 0.5 Q1 assists at plus money is a regular top pick and misses.
- **The "Hot" form tag hurts**: board hot plays said 70% hit 42% (11-19). The model is chasing recent form.
- **Overs only.** Every graded play is an over / yes; the scorecard leaves out `under` board rows. Overs at these prices hit
  49% against a 57% implied, so a board made only of overs starts behind.
- Steals (said 63% hit 30%), blocks (52 / 33), double-doubles (25 / 11) and rebounds (70 / 47) are the worst board markets.
  Turnovers (63 / 61, ROI +13%), FTA (+7%) and FGM (+3%) are the only ones that made money.
- Grading checked: 1 DNP-looking player-night in 544, so misses aren't coming from grading errors.

## NHL: shots λ is too spread out, goals λ is about 30% low, game winners worse than a coin

- **Goals are under-projected across the board**: λ goals averages 0.121 per skater against 0.177 scored (-32%). 1+ goal
  said < hit in every bucket under 30% (said 5 → 9, 14 → 21, 25 → 28). The run's Σλ goals per game is 3.86 against 6.42
  scored; the stored projection 5.59.
- **Shots λ is too wide**: λ ≥ 3 → 3.72 projected, 3.19 shot; λ < 1 → 0.67 projected, 0.99 shot; -0.20 shots overall.
  Its MAE (1.032) is worse than the plain season average (1.020) and the study read (1.002). The multipliers on top
  of the base rate (matchup, line minutes, PP) add noise.
- **3+ SOG from 50–70% is the hole**: 65 calls said 58% and hit 35%. Above 70% it holds (23 calls, 87% hit); the nightly
  top 5 went 13 of 20 (65%) against a stated ~79%.
- **Anytime goal at the top is overstated**: the nightly top-10 said 35% and hit 28%.
- **1+ point is the market that works**: the top-10 per night said 80% and hit 72%; buckets 30–80% line up within a few points.
  The 90%+ bucket (said 94%, hit 74%, n 19) is overstated.
- **Game winners: 13 of 33 (39%)**, home-win Brier 0.263, worse than a coin flip's 0.250 (small sample).
- **No book prices are stored for NHL** (`sogLine`, `goalOdds` null on every row; `edges` n = 0). The NHL picks are never
  checked against a price, so there's no way to know whether any of them had value.

## What to change, in order

1. **NBA: shrink toward the book.** Make the board's chance mostly the book's (vig-removed, both sides where an under price
   exists) plus a small model weight learned per market group on the graded nights, instead of the model's chance
   calibrated alone. With the current weights, the board needs a much bigger raw gap before it calls a play.
2. **NBA: re-check the 11-13 learned read and line blend on points / rebounds / assists / threes.** Its weight there is
   negative. Replay the walk-forward with `lineBlend: false` and the trees turned off on the same nights.
3. **NBA: cap or drop Q1 markets and over 0.5 on low counts (Q1 ast / reb, steals, blocks)** until they show they can
   beat the price. Drop the "Hot" boost.
4. **NBA: grade unders and price both sides.** The scorecard should include `under` board rows, and the edge should use
   the no-vig price.
5. **NHL: fix the goals level.** Recentre λ goals to the league's scoring (about 0.18 per skater-game). Check that the
   11-12 ISCF ratio (`defenseGoalMultiplier`, clamp 0.82–1.22) and the smooth ISCF/G term don't stack into a net cut.
6. **NHL: pull λ shots toward the season rate.** Shrink the multipliers (or blend λ with `ownSeason` / `studyS`) so the top
   is not over-projected; recheck the 50–70% 3+ SOG band after that.
7. **NHL: store book lines for SOG and anytime goal** so the picks can be graded against a price like the NBA's.
8. **NHL game winner: fall back to the stored projection / market until it beats a coin over a full month.**

Caveat: five nights; the NHL game sample (33) is small. The NBA findings (2,618 board plays, the same gap every night)
are solid.

## Shipped (2026-11-20): the NBA book anchor (fix 1)

`lib/picks/calibration.js` learns a second, price-aware fit per market from the same graded nights,
landed = σ(a + logit(implied) + wModel · (logit(stated) − logit(implied))), and the board prints it for every priced
play and rung once it beats the stated-only read on the three nights it never saw (notes: `docs/claude/picks-core.md`,
"The book anchor"). Replayed leave-one-night-out on these five nights with the shipped code:

| Read | Brier | Plays with an edge | Their hit | Their ROI |
| --- | ---: | ---: | ---: | ---: |
| As stated (the old board) | 0.2469 | 4,228 | 49% | -14.0% |
| The price alone | 0.2381 | – | – | – |
| Anchored | 0.2329 | 269 | 50% | -10.8% |

Learned per market on the five nights: wModel 0 on points, rebounds, assists, threes, PR / PA / PRA, Q1 assists, blocks;
0.29 turnovers, 0.42 FTA, 0.44 first-3-minute points, 0.33 Q1 rebounds. The margin a ≈ -0.2 to -0.4 everywhere: overs
landed under their price. It turns on with the next season relearn (the 2:11 AM job), using the whole season, not
these five nights. Fixes 2 and 3 (the learned read, Q1 / steals / blocks) are covered by it: a market whose read adds
nothing gets wModel 0 and stops calling plays. Fix 4 (grading unders) is still open.
