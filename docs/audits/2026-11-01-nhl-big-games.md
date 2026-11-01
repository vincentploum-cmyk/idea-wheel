# The NHL's big games (2026-11-01)

Vincent, 2026-11-01: "Do the same big games study for the NHL". The NFL's study (`2026-11-01-nfl-big-games.md`) and the
NBA's (`2026-11-01-nba-big-games.md`) each found a context that beat the board's own chance of a big night. This one
asks the same question of the skaters.

## The data

- **Box scores:** every regular-season game of 2024-25, 2025-26 and 2026-27 to Oct 31, from the NHL API.
  - Pipeline: `tools/predictors/fetch.mjs` → `faceoffs.mjs` → `relabel.py` → `build_rows.py`.
  - 1,312 + 1,312 + 226 games.
- **Rows:** one per skater-game, leak-free: every figure comes from the games before it.
  - 46,198 skater-games in 2025-26 and 7,783 in 2026-27.
  - A skater is rated once he has 5 games this season, or 10 last season.
- **The board's read:** the study's λ, rebuilt the way the site builds it (`project` in `lib/nhl-data/picks-pure.js`):
  - his rates this season from his fifth game, last season's regular season before that;
  - his ice time over his last five games;
  - home and back-to-back;
  - what the opponent allows per skater at his position this season.
- **The board's chance at a mark:** the Poisson tail of that λ.
- **What the replay cannot rebuild:** the saved model run's own λ, which the live board uses for shots. The ranking and
  the level below are the study λ's.
- **Contexts tested beside the board:**
  - his own record over his last 20 games across the season boundary: how often he reached the mark, his best of the
    last 10, his spread;
  - his attempts, unblocked attempts, scoring chances and high-danger chances lately;
  - his ice time and line;
  - the opponent's shots and goals allowed, overall and over the last ten, and at his position;
  - the opposing starter's save percentage;
  - both teams' pace;
  - rest, home and back-to-backs.
- **Big games:** 5+, 6+ and 7+ shots on goal (skaters projected at 1.5 shots and up), and 2+ goals.

## How

- **Two checks,** each fitted only on games before it:
  - 2025-26 Nov–Jan → Feb–Apr;
  - 2025-26 from November → 2026-27, Oct 7–31.
- **Models compared:**
  - the board as it is;
  - the board recalibrated: σ(a + b · logit p);
  - the board plus one context;
  - every context at once (logistic, and boosted trees);
  - one- to three-condition rules mined on the first fit.
- `tools/audit/nhl_big.py` writes `.nhl-data/audit/out/nhl-big.json` and the rows.

## Results

**Nothing beside the board's projection picks out the big nights.**
- On both checks the best single context moved the Brier by about 0.0001 or less, inside the noise (see the table).
- Those best contexts were home, line slot, ice time and high-danger chances.
- His record of big nights over his last 20 games added nothing for 5+, 6+ and 7+ shots or for 2+ goals. On the first
  check it did worse than the board alone.

| Mark | Check | Landed | Board said | Board | Recalibrated | Best + one context | Everything (logistic) | Everything (trees) |
|---|---|---|---|---|---|---|---|---|
| 5+ SOG | Feb–Apr | 9.0% | 7.7% | 0.07756 | 0.07755 | 0.07750 (home) | 0.07777 | 0.07830 |
| 5+ SOG | 2026-27 | 8.6% | 8.6% | 0.07732 | 0.07708 | 0.07633 (opp. at his position) | 0.07534 | 0.07663 |
| 6+ SOG | Feb–Apr | 3.7% | 3.0% | 0.03388 | 0.03387 | 0.03385 (home) | 0.03398 | 0.03406 |
| 6+ SOG | 2026-27 | 4.1% | 3.6% | 0.03907 | 0.03887 | 0.03873 (opp. at his position) | 0.03826 | 0.03870 |
| 7+ SOG | Feb–Apr | 1.6% | 1.1% | 0.01484 | 0.01480 | 0.01478 (home) | 0.01484 | 0.01495 |
| 2+ G | Feb–Apr | 1.7% | 1.7% | 0.01667 | 0.01666 | 0.01666 (line) | 0.01670 | 0.01668 |
| 2+ G | 2026-27 | 2.1% | 1.7% | 0.01973 | 0.01971 | 0.01967 (line) | 0.01959 | 0.01962 |

- **Contexts that helped one check only:** the opponent's table at his position, and every figure at once, helped this
  season's three weeks. They made Feb–Apr worse.
- **Why that is a warning:** early in a season the board's rates are thin, so anything that pulls toward the middle
  helps. That is not a trait that holds.
- **The mined rules fell apart.** Rules that hit 30–50% on the fit landed 0–23% on the checks:
  - "5+ in 30% of his last 20, a 22% board chance and 17% shooting": 51% on the fit → 23% Feb–Apr → 14% this season.

**What the study found is the level.**
- **Shots:** a Poisson tail of the λ is too thin for the big shot nights. At 5+ it said 7.7% and 9.0% landed; at 6+
  3.0% → 3.7%; at 7+ 1.1% → 1.6%.
  - A negative binomial with one dispersion fitted on the counts (r ≈ 14–18) puts the first check's level right:
    8.8%, 3.9%, 1.7%.
  - On this season's three weeks it overshoots 5+ (9.5% against 8.6%).
- **Goals:** the 2+ goal tail is about right (1.71% said, 1.73% landed). The top of the night overstates:

  | Board's 2+ goal chance (Feb–Apr) | Said | Landed |
  |---|---|---|
  | 8%+ | 9.6% | 7.9% |
  | Night's top 5 | 9.2% | 6.9% |

**The top of the night.** The board's five likeliest 5+ shot nights each night:

| Check | Said | Landed | Field (projected 1.5+ shots) | All skaters |
|---|---|---|---|---|
| Feb–Apr | 25.6% | 29.5% | 9.0% | 4.3% |
| 2026-27 | 31.4% | 20.0% | 8.6% | 4.0% |

- **On Feb–Apr:** the top pick landed 38%, a 10-a-night list 25.5%.
- **On this season's three weeks:** the top of the board overstates. Its 30%+ band said 38% and landed 28%, the same
  early-season thinness the calibration audit saw at 3+ and 4+ (`2026-10-30-nhl-model-check.md`).

## What shipped

**The Big games tab** (`#big`, `components/nhl/BigGamesPanel.jsx`, `lib/nhl-data/big-pure.js`):
- the night's likeliest 5+ / 6+ shots and 2+ goals;
- each chance is the board's own, as the shuffle prints it: `chanceAt` on the board's read through the calibration the
  board prints with, the stated Poisson tail on the hover;
- so one skater has one number across Best bets, the shuffle and this tab;
- the calibration is what corrects the level the study measured: its fits at 5+ and 6+ come from the site's graded
  nights, on the run's own λ.
- **Each row:**
  - his projected shots or goals (λ);
  - how often he reached the mark over his last ten and this season, for reference: the study says it does not move the
    chance;
  - once the game is stored, what he got.
- **Lists:** from 10% at 5+ shots and 4% at 2+ goals. 7+ shots and 3+ goals are left off: the calibration has no fit
  there, and 3+ goals is 0.2% of skater-games.

**Not shipped:** a negative-binomial tail or a context model. Neither held on both checks, and the site's calibration
corrects the level from the site's own graded nights.

## What it cannot say yet

- **The run's λ:** the board's shots read is the saved model run's λ, which this replay cannot rebuild. Its ranking at
  the big marks is graded only by the site's own scorecard: 5+ and 6+ calibration fits on 5,371 graded skater-games
  through Oct 30, 229 and 96 hits.
- **This season:** three weeks, 33 nights.

```bash
tools/predictors/run.sh 2026            # or fetch / faceoffs / relabel / build_rows for 2025 and 2026 as run.sh does
python3 -I tools/audit/nhl_big.py
```
