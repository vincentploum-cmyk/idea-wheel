# The NBA cocktail, measured (2026-10-28)

Vincent, 2026-10-28: *for the NBA, can't you just figure out yourself what the best cocktail is?
You already have two weeks of teams playing against each other.*

Yes, with two seasons of box scores. The answer is now on the NBA board as `COCKTAIL` in
`lib/nba/picks.js`. The tables are in the appendix,
[2026-10-28-nba-cocktail-tables.md](2026-10-28-nba-cocktail-tables.md). The NFL keeps the board as
it was (`COCKTAIL_DEFAULTS` in `lib/picks/board.js`).

## Update, later the same day: this season's games alone, and the backtest

Vincent, before the merge: *we should look at the last 10 games for now. I don't want to blend with
last season's games because playoffs were at the end. Did you test the new rules on the first games
of this season, and how accurate were the predictions?*

**What the board read.** His last 5 / 10 / 20 were his newest games whatever the season, and the pull
keeps last season's playoff games (PropFinder's seasonType PST; only the preseason was dropped). A
player on a playoff team therefore carried last spring's playoff nights into his last ten until he
had ten games this season. The board as it was did this too.

**The change.** The NBA's windows now read this season's regular-season games alone (`scope: 'season'`
in the cocktail, `windowGames` in `board.js`): the season with his last ten at 0.65 / 0.35, and the hit
rates, the minutes and the shuffle's windows the same way. The last twenty is gone. Inside a player's
first ten games "his last ten" and "his season" are the same games. After that, blending the two
read better than the last ten alone at every stretch of last season (below).

**The backtest.** The site's own board was replayed night by night over this season, opening night
included: 8 nights, 56 games, 986 player-games with a points projection, each night built only from
the games before it (each player's logs cut at the date, the opponent's table as it stood that
morning). Graded against what the players did:

| This season, opening night to Oct 27 | Points miss | Rebounds | Assists | Threes | PRA | The tables' plays: said → hit |
| --- | --- | --- | --- | --- | --- | --- |
| The board as it was | 5.59 | 2.28 | 1.60 | 1.09 | 7.52 | 528 plays · 59% → 56% |
| The first cut (last season in, playoffs too) | 5.08 | 2.09 | 1.48 | 1.01 | 6.80 | 622 · 60% → 57% |
| Last season's regular season, the playoffs out | 5.11 | 2.09 | 1.49 | 1.02 | 6.84 | 720 · 61% → 57% |
| **This season's games alone (on the branch)** | **5.39** | **2.20** | **1.58** | **1.02** | **7.08** | **897 · 61% → 55%** |
| This season's games alone, his last ten alone | 5.46 | 2.22 | 1.60 | 1.03 | 7.21 | 897 · 61% → 55% |

The misses are the average distance between the projection and his figure. For scale, a plain
average of his last ten across the seasons missed points by 5.43, and of his last ten this season by
5.67. Night by night the shipped read missed points by 4.98 to 5.85 (the appendix, section 7).

**What it costs, and when.** The cost is all in the first two weeks of a season, while a player has
one to six games. Last season gave the same pattern:

| Points miss | 2025-26, days 1–14 | days 15–28 | the rest | 2026-27, days 1–14 |
| --- | --- | --- | --- | --- |
| The board as it was | 5.59 | 5.07 | 5.12 | 5.59 |
| Last season in, playoffs too | 5.27 | 4.99 | 5.07 | 5.08 |
| Last season's regular season, the playoffs out | 5.29 | 4.98 | 5.08 | 5.11 |
| This season's games alone (on the branch) | 5.43 | 4.99 | 5.08 | 5.39 |
| This season's games alone, his last ten alone | 5.48 | 5.01 | 5.10 | 5.46 |

- **The playoffs themselves did no harm.** Taking them out and keeping last season's regular season
  read the same as leaving them in: 5.11 against 5.08 this season, 5.29 against 5.27 last season.
- **Last season's regular season is what carries the first two weeks.** Without it the projection
  reads off one to six games. This week it gave back 60% of the cocktail's gain on points (5.59 →
  5.39 instead of 5.08). The ladders' chances went back to about the old board's: rung Brier on
  rebounds 0.1760 and assists 0.1485, against the old board's 0.1754 and 0.1471. The tables put
  more plays up (897) at a higher said (61%) and a lower hit (55%).
- **From the third week on, the choice makes no difference.**

**How blind the test was.** The matchup's damping, the hit-rate weights, the tail's share and the
spread were set from last season alone. The minutes cap and the vacated share were chosen with both
seasons in view: both agreed, and this week agreed more strongly. The windows are now your call.

**Where last season still enters, with the windows on this season's games** (none of these include
the playoffs):

- **Before his first game this season.** His last 82 regular-season games stand in, as on opening
  night.
- **His spread.** How much his nights vary, from his last 82 regular-season games. Five games cannot
  measure it.
- **His long-run shooting percentage.** The anchor this season's threes and free-throw percentage
  shrink toward.

Two reads outside the cocktail still take his newest games whatever the season, playoffs included:

- the line the card shows as the book's main one (`playerProps`, the main-flagged line nearest his
  last-ten average)
- the first-basket starters' shares (`lib/nba/firstbasket.js`)

## How it was measured

- **Data.** ESPN's box scores for every regular-season game of 2025-26 and of 2026-27 to October
  27, plus every player's 2024-25 game log. Every read is built from the games before the date.
- **Fit and test.** The weights were tuned on 2025-26, the fit season, with 2024-25 behind it. They
  were then checked unchanged on 2026-27's first week, with 2025-26 behind it. That first week is
  only 53 games, but it is the part of the season the board is reading now.
- **Two tools.** `tools/audit/nba_cocktail.py` scores each ingredient on its own. The fit season
  has 20,239 priced player-games (15+ minutes a game over his last ten), the test week 717. The
  site's own board is then replayed with each cocktail (`tools/audit/nba-audit.mjs --cocktail`)
  and graded with the site's scorecard: 1,229 games last season, 53 this season.
- **Lines.** The books' lines are not public, so a pseudo line stands in for the main rung: his
  last-ten average floored, plus a half. The chance is graded at it without a price.

## What the data says

### 1. His rate: the board leaned on two windows, the data wants four

The board read his season to date with his last ten at 0.65 / 0.35. Adding his last twenty and his
last five reads better at every stage of the season. One set of weights held everywhere:
**season 0.4, last ten 0.2, last five 0.1, last twenty 0.3**.

| Weights | Fit, 1–3 games | 4–9 | 10–29 | 30+ | Test |
| --- | --- | --- | --- | --- | --- |
| Season 0.65 / last ten 0.35 (the board) | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| Season 0.4 / L10 0.2 / L5 0.1 / L20 0.3 | 0.987 | 0.995 | 0.997 | 0.998 | 0.978 |
| The same, the last twenty kept inside this season | 1.008 | 1.001 | 0.998 | 0.998 | 1.011 |

The numbers are MAE against the board's. Below 1.000 is better.

The last twenty reaches into last season's games until a player has twenty this season, as the last
ten always did. That is where its gain comes from. Kept inside this season it reads worse than the
board did (1.011 this season). **Decided later the same day: the windows read this season's games
alone, the season with his last ten at 0.65 / 0.35** (the update at the top).

Not shipped:

- **Last season's average behind his season to date.** Shrunk at 5 games, it read 3% better this
  season. It is out by the same call.
- **A per-minute rate × his minutes.** Level with the windows on the fit season (0.994 against
  0.997), better this week (0.960 against 0.979). It needs a bigger change to `ownRate`, so it is the candidate
  to watch over the next weeks.

### 2. The matchup is worth little, and early it costs

The opponent's table at full weight from the first game cost 12% of MAE this season (the matchup
grid in the appendix: weight 0.6, no damping, 1.122). A table of four games reads noise, as the
first audit found. Over a whole season the matchup is worth about 0.1%.

The cocktail keeps the read but counts it at **games / (games + 40)** of itself. That is a tenth in
the first week and two thirds over a full season. The hovers on the court, the card and the shuffle
say how much it counted ("counted at 0.091 of × 1.12 for the 4 games behind the table").

The cheat sheet's tile carries no game count. Where it stands alone, without a PropFinder table, it
is not damped. It moves a projection ±9% at most.

### 3. The game script, home, rest, teammates out: no gain per player

Each was measured on top of the windows and the damped matchup, then taken out one at a time:

| Taken out | Fit | Test |
| --- | --- | --- |
| The book's game total and spread (implied team points over its usual) | 1.001 | 0.994 |
| Home | 1.000 | 1.000 |
| Back-to-back | 1.001 | 1.003 |
| Teammates out, at 0.2 of their production | 1.001 | 1.000 |
| The new windows (back to the board's) | 1.003 | 1.021 |

None of the first four is worth its code. The script was the closest, and it reads *worse* this
season. Back-to-backs are read from log dates that ESPN gives in UTC, so a late tip-off can shift a
game to the next day. That is one more reason to leave rest out.

### 4. The chance: the tail should carry more, a hot last five less

A rung's chance was half his distribution's tail and half how often he cleared it. A play's chance
was hit rates over L5 / L10 / season at 0.3 / 0.3 / 0.4. Both read hot streaks as real. A hot last
five said 55% and hit 36% this week (the first audit's finding).

The cocktail:

| Setting | Was | Now |
| --- | --- | --- |
| Tail's share of a rung | 0.5 | 0.7 (`ladderModel`) |
| Hit-rate weights, L5 / L10 / season (rungs and the plays' chance) | 0.3 / 0.3 / 0.4 | 0.1 / 0.3 / 0.6 (`hitWeights`) |
| Cleared-it half in his first games | Full weight | Gives up 6 / (n + 6) of its share to the tail (`empK`) |
| His spread | His own | × (1 + 0.2 · 5 / (n + 5)): × 1.17 after one game, × 1.1 after five, × 1.02 after forty |

| Chance at the rungs | Fit Brier | Test Brier | Test 70–80%: said → hit | Test 80%+ |
| --- | --- | --- | --- | --- |
| The board as it was | 0.1584 | 0.1653 | 75.0% → 59.6% | 88.2% → 72.2% |
| The cocktail | 0.1566 | 0.1552 | 74.8% → 66.4% | 86.5% → 77.8% |
| The cocktail, the spread widened early | 0.1565 | 0.1553 | 74.8% → 68.7% | 85.8% → 80.9% |

The widening is even on Brier but brings the top rungs closer to what they say, so it ships. Each
rung carries the tail's share as `wModel`. The shuffle recentres the tail at that share when you
read from another window.

### 5. The minutes factor lifted players whose minutes then fell

The rotation read multiplies a player's rate by his minutes tonight over the minutes behind his
rate. Tonight's minutes are his last five blended in, plus the out players' minutes. This season
the players it lifted played *fewer* minutes than the board assumed. Those lifted 10–20% read 27.6
minutes and played 21.2. Those at the cap of 1.3 read 24.6 and played 14.4. Their points ran 2.3
and 5.0 high. Over 2025-26 the lift was roughly even: right on average, noisy row by row, and the
ladders read a touch better without it.

The ceiling, with the vacated share still at 0.6:

| Minutes factor's ceiling | Test pts MAE | Test PRA rung Brier | Fit pts MAE | Fit PRA rung Brier |
| --- | --- | --- | --- | --- |
| 1.3 (the board) | 5.19 | 0.1726 | 5.12 | 0.1792 |
| 1.15 | 5.17 | 0.1718 | 5.11 | 0.1791 |
| 1 | 5.11 | 0.1698 | 5.10 | 0.1790 |

So **`factorMax` is 1** for the NBA. Minutes that fell still cut a rate, down to × 0.75. Minutes
that rose lift none of it. The cut that is left is about even: on the rows it moved, MAE 3.26
against 3.24 without it last season, 3.09 against 3.10 this week.

### 6. The vacated share: 0.2

An out player's production still reaches his teammates through the vacated lift. Before, the lift
gave up whatever his teammate's extra minutes already added, and with the minutes at 1.3 that was
most of it: 6,664 rows carried a lift last season. With the minutes capped the lift stands whole
(37,054 rows), and at 0.6 of the out player's production the lifted rows read worse than without
it. The study's fit was 0.2, and the replay agrees on both seasons:

| Vacated share (minutes at 1) | Test pts MAE | Test pts rung Brier | Fit pts MAE | Fit pts rung Brier |
| --- | --- | --- | --- | --- |
| 0.6 (the board) | 5.11 | 0.1769 | 5.10 | 0.1898 |
| 0.3 | 5.10 | 0.1764 | 5.09 | 0.1896 |
| 0.2 | 5.09 | 0.1763 | 5.08 | 0.1894 |

So **`vacatedShare` is 0.2**. Even at 0.2 the lifted rows read a hair worse than without the lift
(MAE 4.64 against 4.62 this week, 4.52 against 4.50 last season). It stays because your ask was
that an out point guard's assists land on someone, and last season it moves those rows' bias the
right way (−0.73 → −0.47). Below 0.2 was not replayed.

## The first cut on the site's board

The board was replayed slate by slate with the first cut (the windows across the seasons, last
season's playoffs in), against the board as it was, from the season's second night. Pseudo lines,
no price. The windows inside this season are in the update at the top. In those runs ESPN's game
logs carried last season's preseason as regular season, which the later runs leave out as the pull
does.

**This season (53 games):**

| | Was | Now |
| --- | --- | --- |
| Projection MAE: points / rebounds / assists / threes / PRA | 5.62 / 2.31 / 1.60 / 1.07 / 7.59 | 5.09 / 2.10 / 1.48 / 1.00 / 6.84 |
| Rung Brier: points / rebounds / assists / threes / PRA | 0.1857 / 0.1767 / 0.1469 / 0.1152 / 0.1783 | 0.1763 / 0.1671 / 0.1391 / 0.1111 / 0.1695 |
| Points rungs at 60–70%: said → hit | 64.8% → 52.3% | 64.7% → 61.6% |
| Points rungs at 70–80%: said → hit | 74.6% → 64.4% | 74.7% → 69.8% |
| The tables' plays: said → hit (Brier) | 58.6% → 55.4% (0.2478) | 59.2% → 56.1% (0.2451) |
| Hot plays: said → hit | 54.5% → 35.8% | 50.3% → 35.8% |

**Last season (1,229 games):**

| | Was | Now |
| --- | --- | --- |
| Projection MAE: points / rebounds / assists / threes / PRA | 5.15 / 2.05 / 1.50 / 1.03 / 6.77 | 5.08 / 2.02 / 1.48 / 1.02 / 6.66 |
| Rung Brier: points / rebounds / assists / threes / PRA | 0.1902 / 0.1687 / 0.1438 / 0.1142 / 0.1783 | 0.1894 / 0.1674 / 0.1433 / 0.1133 / 0.1786 |
| The tables' plays: said → hit (Brier) | 61.2% → 53.4% (0.2560) | 61.2% → 54.1% (0.2537) |
| Hot plays: said → hit | 59.7% → 50.0% | 55.5% → 50.0% |

Every figure improves on both seasons except one: the PRA ladder last season, 0.1783 → 0.1786 (main
rung 0.2493 → 0.2500). Its rungs at the top are better calibrated (70–80%: 72.4% → 74.8% hit), and
the projection under it improves (MAE 6.77 → 6.66). The main rung pays for it. It stays as is.

The tables still say more than they hit: 59% → 56% this season, 61% → 54% last season. That is
the over-confidence the first audit found. The cocktail narrows it but does not close it. Against
real lines the tables' chance is also shrunk toward the book's price, which the replay cannot
grade.

## Still open

- **The team scale.** The ceiling that scales a side down to the team's expected total helps this
  season and costs last season. On the rows it moved: MAE 3.49 → 3.38 this week, 3.36 → 3.41 last
  season. Last season the board ran a point low on points (bias −1.07) and the ceiling is most of
  that. Over a settled season the players' rates add up to more than the team's because each rate
  counts only the games he played. It is left as is. The next audit should read it against the
  rotation actually used.
- **A per-minute rate** (section 1), the candidate for the windows.

## What changed on the site

- `lib/picks/board.js`: `makeBoard({ cocktail })`. `COCKTAIL_DEFAULTS` is the board as it was.
  `windowGames` reads the cocktail's `scope` ('all' as before, 'regular', 'season') for every window
  of his: the averages, the hit rates, the minutes and the shuffle's and scorecard's windows.
  `ladderOf` reads the tail's share, the shrink, the widening and the hit-rate weights. `chanceOf`
  reads the hit-rate weights. The tables carry `k`. The minutes and the lifts take the ceiling and
  the share, and the notes' "Vacated production" line says the share.
- `lib/picks/projection.js`: `blendWindows` (the weights renormalised over the windows he has),
  `matchupOf`'s damping, `dampOf`, `blendText` and `dampText` for the hovers.
- `lib/nba/picks.js`: `COCKTAIL`, and `nbaBoard(cocktail)` for the A/B. `lib/nfl/picks.js` is
  untouched.
- The court, the card and the shuffle: the hovers name the weights and the damping. The shuffle
  reads each rung's `wModel`.
- Tests: `__tests__/nba-cocktail.test.js` (the three scopes on a playoff team's logs among them),
  plus the NBA board and shuffle tests on the new numbers (each also checks the old board's).
- `tools/audit/nba-audit.mjs`: last season's preseason left out of ESPN's game logs, as the pull
  leaves it out.

## Limits

- **Test week.** One week of this season: 56 games with opening night, about 990 projections a
  market. The fit season is what makes the weights trustworthy, and the test week is what makes
  them urgent.
- **The injury list.** The replay's players out are ESPN's list on each game's summary, fetched
  after the game, not the pregame report the site reads.
- **Pseudo lines.** No price, no book ladder. The real board's main lines are the books', nearer
  the median, where every read is hardest.
- **Positions.** ESPN's G / F / C, read at SG / SF / C. PropFinder's depth chart slots are not in
  the replay.
- **Pull.** The replay takes the ten players a team with the most minutes, plus those ESPN lists
  out. The opponent's table is rebuilt from the box scores the way PropFinder publishes it.

## Rerun

```bash
python3 -I tools/audit/nba_cocktail.py --raw .nhl-data/audit/nba --date 2026-10-27 --out .nhl-data/audit/out/nba-cocktail.md
for ck in old site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-27 --from 2026-10-20 --raw .nhl-data/audit/nba --out .nhl-data/audit/ab --prior .nhl-data/audit/nba/prior/games --cocktail $ck --tag -$ck; done
for ck in old site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-21 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/ab --cocktail $ck --tag -$ck; done
python3 -I tools/audit/nba_ab.py .nhl-data/audit/ab/nba-2026-10-27-old-summary.json .nhl-data/audit/ab/nba-2026-10-27-site-summary.json "2026-27"
```

A variant is a JSON cocktail on top of the defaults: the playoffs out with last season's regular
season kept is the shipped cocktail with `"scope": "regular"`.
