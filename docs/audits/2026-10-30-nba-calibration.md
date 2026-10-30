# The NBA board's chances, calibrated (2026-10-30)

Vincent, 2026-10-30, after the NHL board's chances were calibrated: "do the same calibration for the NBA board".

## What ships

The NBA board prints every chance it shows through a calibration learned from this season's graded nights
(`lib/picks/calibration.js`). Two reads, each fitted per market:

- **A play's chance** (the tables, the ranked list, the side's picks, the card's "His lines tonight"): his hit rates over
  the line shrunk toward the book's price (`chanceOf`). Over / yes and under / no are fitted apart.
- **A rung's chance** (the Tonight table, the court's bar, the card's ladder, the shuffle on the board's blend): his
  distribution's tail beside how often he cleared it (`ladderOf`).

The fit is the NHL's: landed = σ(a + b · logit(stated)), a light pull toward the identity, 300 graded chances and 25
hits at least. No export of the site's own graded nights (real lines, real prices) had been read when it shipped, so
each fit has to earn its place: it is fitted again on the nights before the last three, scored on those three, and the
board prints it only when it beats the stated chance there (Brier, 100 chances at least). Otherwise that market prints
as stated. The board's math is untouched; the stated chance shows on every hover. The site relearns the calibration
whenever the season's scorecard is built (the Scorecard panel and the shuffle on open, and in the background after the
2:11 AM job stores last night's box scores). The scorecard's "The calibration" table shows each fit, what a stated 50 /
60 / 70 / 80% prints, the check, and whether the board uses it.

## Checked on the replay

The replay rebuilds the board from ESPN's box scores (`tools/audit/nba-audit.mjs`, the site's own functions). Book
lines are not public, so the plays are read at a stand-in line (his last-ten average floored, plus a half) without a
price, and the rungs at the ladder's own steps. The site's real plays sit on book lines and shrink toward the price, so
the site's own fit will differ. What the replay shows is how the mechanism behaves: walked forward, each night printed
through the fit learned on the nights before it, with the same check.

### 2025-26, the whole regular season (165 nights; refitted every seven)

| | Brier as stated | Brier as printed | 60–70% said → landed, stated | printed |
| --- | --- | --- | --- | --- |
| Plays (122,858) | 0.2381 | **0.2366** | 63.6% → 54.8% | 63.3% → 57.2% |
| Rungs (782,853) | 0.1408 | **0.1404** | 64.9% → 64.0% | 64.8% → 66.3% |

Every market's plays and rungs came out at or below their stated Brier. By the season's end every fit but the steals
plays passed its check. The play read is the one that overstates. Over the season a stated 60% landed about 53% and a
stated 80% about 66% (b 0.52–0.68 for points, rebounds, assists and PRA). The ladder's rungs were close to honest over
a whole season, and the fit only nudges them (b ≈ 0.82–0.88). Steals and blocks are the exception (b ≈ 0.71–0.74): a
normal tail overstates a count that is mostly 0, 1 or 2.

### 2026-27 so far (10 nights; refitted every night)

| | Brier as stated | Brier as printed | printed calibrated |
| --- | --- | --- | --- |
| Plays (8,078) | 0.2371 | **0.2357** | 1,242 |
| Rungs (51,388) | 0.1389 | **0.1388** | 13,837 |

The first week overstated more than the nights after it: rungs at 70%+ landed 66% on Oct 23 and 73–77% from Oct 26.
So a fit learned on the first nights over-corrected the later ones for points, rebounds, assists and PRA, and the check
kept those markets as stated (points rungs: 0.1828 stated, 0.1832 calibrated on Oct 27–29). Steals, blocks and threes
passed, and so did the rebounds, steals, threes and blocks plays. This is what the check is for. Early in a season the
calibration only touches the markets where it holds on unseen nights, and it takes over as the season settles.

## Reproduce

```bash
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-29 --from 2026-10-20 --raw .nhl-data/audit/nba --out .nhl-data/audit/cal --prior .nhl-data/audit/nba/prior/games --tag -cal --graded
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-21 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/cal --tag -cal25 --graded
```

Each report's last section is "The calibration, walked forward"; `--graded` writes every graded chance as stated
(`nba-<date><tag>-graded.json`), the same shape as the site's `GET /api/nba/scorecard?rows=1`. Run that export through
the same check to read the fit on real book lines.
