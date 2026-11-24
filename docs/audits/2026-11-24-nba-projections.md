# The NBA projections themselves, and why players beat them by a lot (2026-11-24)

Vincent, 2026-11-24, after the top-10 hit-rate audit ([2026-11-24-nba-top10.md](2026-11-24-nba-top10.md)): "you are only
looking at what hits.... can we just focus on getting the numbers right in the first place?" and "when a player hit well
over his projection, we need to know why so we can find patterns and use them going forward".

**Data.** The site's own boards for Oct 21 – Nov 23 rebuilt from a copy of the store with the site's code
(`tools/audit/nba-store-top10.mjs`, which also writes each projection's parts: the matchup, environment, team-scale, learned
model and book-line factors, `store-parts.csv`), against the stored box scores. 19,047 player-nights with a box score
(points, rebounds, assists, threes). 2025-26 replayed (`nba-audit.mjs`, 160 nights) as the second season. Scripts:
`tools/audit/nba_overs.py` (tables: [2026-11-24-nba-overs-tables.md](2026-11-24-nba-overs-tables.md)).

## How far off the projections are

| Stat | Night's top 10: projected → got (bias) | MAE top 10 | MAE, players with 5+ games | His season average there | His last ten there |
| --- | --- | ---: | ---: | ---: | ---: |
| Points | 23.8 → 24.9 (**+1.15**) | 6.47 | 4.70 | 4.85 | 4.86 |
| Rebounds | 9.5 → 9.7 (+0.17) | 2.84 | 1.86 | 1.93 | 1.94 |
| Assists | 6.9 → 7.0 (+0.03) | 2.29 | 1.37 | 1.42 | 1.42 |
| Threes | 3.0 → 3.0 (−0.04) | 1.48 | 1.00 | 1.02 | 1.03 |

The board beats a player's own averages everywhere, by 2–4%. Points for the night's top ten ran 1.15 low, and most of that
was one fault.

## Fixed: the points line blend read junk lines

The book's line moves the points and PRA centre half way to it (`LINE_BLEND`, 2026-11-13). The "main" line stored with the
pull was a first-quarter, window or alternate line on 175 of 2,136 blended player-nights: on Nov 6 a 9.5 took Gilgeous-Alexander
from 31.1 to 21.7 (he scored 28), a 4.5 Ajay Mitchell from 17.3 to 12.1 (35). The quarter of blends that pulled down most
moved players from 12.1 to 9.7 against a line averaging 6.6; they scored 11.0.

**Shipped**: `LINE_BLEND.ratio` = [0.6, 1.6], a line under 0.6× or over 1.6× the board's figure is not read
(`lib/picks/board.js`, `lib/nba/picks.js`). On the blended player-nights points MAE 5.07 → 4.94; on the night's top ten the
bias +1.15 → +0.42 and MAE 6.48 → 6.28; on every player 4.71 → 4.67. Tested with Gilgeous-Alexander's night
(`__tests__/nba-model.test.js`).

## Looked at, not changed

- **The learned model's weight** (half and half): its factor's top fifth still ran 3–13% under, but re-weighting it from 0 to
  1 on the site's nights, MAE is flat from 0.5 to 0.75 (points 4.715 → 4.716; after its fit date, 4.583 → 4.574). Stays.
- **The matchup factor**: in 2025-26 the softest fifth of matchups ran 2–6% under, the stingiest 2–7% over (the factor too
  strong); on the site's nights there is no such pattern. Not moved on one season.
- **The game environment**: the top fifth ran 6–9% under on the site's nights, but that factor also carries the line blend's
  pull, and the 2025-26 replay shows nothing. Re-read after the guard.
- **No teammate out**: 4–6% under, but those are the first week's nights, before the injury report was read.
- **The minutes read** for regulars runs 2+ minutes high in both seasons, offset by the rate (no bias in the figure).

## Why players beat their projection by a lot

A big night: points +10 and 1.5× the projection, rebounds or assists +4 and 1.5×, threes +3 and 2×. 855 of 19,047
player-nights (points 5.8%, rebounds 6.2%, assists 2.9%, threes 2.9%); 67–80% of them starters.

**It is the rate, not the minutes.** The surplus split: points +14.3 on a big night, +1.9 of it from minutes over the
board's read and +12.4 from what he did with them; rebounds +5.8 (+1.1 minutes), assists +5.5 (+0.4), threes +3.9 (+0.3).
What happened, big nights against the rest:

| | Points | Rebounds | Assists | Threes |
| --- | --- | --- | --- | --- |
| 6+ minutes over the read | 33% / 11% | 37% / 10% | 26% / 11% | 30% / 11% |
| Shots a minute 1.25× his usual | **57% / 20%** | 24% / 22% | 17% / 22% | 50% / 21% |
| 3+ more threes tried | 38% / 7% | | | **73% / 8%** |
| 5+ more free throws | 18% / 3% | | | |
| Shot 12+ points over his usual FG% | **56% / 7%** | | 23% / 10% | 50% / 10% |
| Rebounds / assists a minute 1.35× | | **83% / 21%** | **96% / 27%** | |
| Overtime | 10% / 5% | 8% / 5% | 6% / 5% | 9% / 5% |
| A regular teammate missing, not listed out | 4% / 3% | 5% / 3% | 1% / 3% | 5% / 3% |

So a big points night is a volume night that went in (more shots and threes, a hot hand), a big rebounds or assists night a
surge in his rate a minute, and overtime doubles the odds. Late scratches the board missed are rare (3–5%).

**What was knowable before tip.** Big-night share by fifth of each read (the tables): his best game of the last ten well
above the projection (points 9.1% in the top fifth against 4.9% in the bottom, assists 5.5 / 2.0, threes 4.0 / 2.3) and his
usage (points 8.4 / 3.1, assists 5.1 / 1.3). **The board already prices both**: its own chance of a big night rises the same
way and stands a little above what happened (assists top fifth said 8.1%, got 5.5%; threes 6.4 / 4.0). Recent minutes or shot
trends, the matchup, the environment, the model's factor and teammates out separate nothing. Nothing to add to the
projection from these: the big nights left are shooting nights, which the box score explains after the game and nothing
before it predicts.

## Next

- The line blend's own fault: why PropFinder's `isMain` lands on a window or alternate line (the pull's prop parse,
  `lib/nba/propfinder-nba.js`). The guard keeps the projection safe meanwhile.
- Re-read the environment factor and points' remaining +0.4 once the guard has run a few weeks.
