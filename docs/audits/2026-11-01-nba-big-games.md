# The NBA's big games: what predicts them (2026-11-01)

Vincent, 2026-11-01: "Do the same big games study for the NBA" (the NFL's: `2026-11-01-nfl-big-games.md`).

## Data

- **The board:** the site's NBA board replayed slate by slate from ESPN's box scores (`tools/audit/nba-audit.mjs`, the
  cocktail as shipped).
  - 2025-26: November to April.
  - 2026-27: Oct 22–31.
  - Every player-game with his projection, his spread, the minutes read, the matchup factor, the opponent's rank at his
    spot, the without split and the vacated lift.
- **Built from ESPN** for each (`tools/audit/nba_big.py`), what was known that morning:
  - his minutes, usage, shots, threes and free throws attempted over his last 5 / 10;
  - how often he reached each mark over his last 20 games, his best of his last 10, his spread over 20;
  - the line: ESPN's pickcenter total and spread, his team's implied points; 979 of last season's 1,235 games and every
    game of this season;
  - home, a back-to-back for either side, both teams' pace (possessions a game this season).
- **Rows:** 31,014 player-game-stat rows.
- **Marks:** 30+ / 40+ points (projected 12+), 12+ / 15+ rebounds (5+), 10+ / 12+ assists (4+), 5+ / 7+ threes (1.5+),
  40+ / 50+ PRA (20+).
- **The board's chance** of a mark: the normal tail of his distribution tonight.
- **Two checks, each fitted on what came before it:** 2025-26 Nov–Jan → Feb–Apr, and 2025-26 → 2026-27.

## What held up

| Mark | The board's chance plus | Brier: board → recalibrated → model, Feb–Apr | Same, 2026-27 |
|---|---|---|---|
| 30+ points | his 30-point games over his last 20 | 0.0789 → 0.0788 → 0.0779 | 0.0733 → 0.0770 → 0.0726 |
| 40+ points | his 40-point games over his last 20 | 0.0149 → 0.0151 → 0.0150 | 0.0174 → 0.0177 → 0.0170 |
| 12+ rebounds | his 12-rebound games over his last 20 | 0.0845 → 0.0845 → 0.0835 | 0.0822 → 0.0838 → 0.0808 |
| 10+ assists | his 10-assist games over his last 20 | 0.1015 → 0.1013 → 0.1007 | 0.0823 → 0.0858 → 0.0814 |
| 5+ threes | his threes attempted, last 5 | 0.0869 → 0.0865 → 0.0857 | 0.0679 → 0.0700 → 0.0683 |
| 40+ PRA | his 40-PRA games over his last 20 | 0.1061 → 0.1056 → 0.1032 | 0.0901 → 0.0985 → 0.0915 |
| 50+ PRA | his 50-PRA games over his last 20 | 0.0322 → 0.0320 → 0.0312 | 0.0354 → 0.0359 → 0.0349 |
| 15+ rebounds, 12+ assists, 7+ threes | nothing (the board's chance as it is) | — | — |

- **Unlike the NFL, the player's own record speaks.** Over 82 games a star's 30-point nights are a trait the board's normal
  tail underrates.
- **Recalibration alone fails.** Fitted on 2025-26, it overstated 2026-27's first ten nights on every mark: fewer big
  games so far this season. The models keep his own record in, so they move with his season.

## What did not

- **The rest of the context:** the matchup factor, the opponent's rank at his spot, pace, the line (total, spread,
  implied points), home and back-to-backs. None beat the recalibrated board on both checks for any mark.
- **The groups:**
  - everything at once (logistic) won on some marks, not all;
  - the trees overfit;
  - for the rarest marks (15+ rebounds, 12+ assists, 7+ threes) nothing beat the board's own chance.
- **The mined rules did not survive:** 60–80% on Nov–Jan, 15–55% on Feb–Apr, mostly 0–40% on 2026-27's few players.

## Shipped

- **The models:** `NBA_BIG` / `nbaBigChance` in `lib/nba/big.js`, fitted on both seasons. `nbaBigGames` runs on every
  built board (`board.big`, the binding's `buildBoard` in `lib/nba/picks.js`).
- **The tab:** "Big games" on `/nba` (`#big`, `components/nba/NbaBigGames.jsx`):
  - per stat the night's likeliest, with the reason ("30+ in 7 of his last 20", "8.4 threes attempted a game lately");
  - cut to one game by the head's dropdown; a name opens the card.
- **The site's own read on the replay** (`nba-audit.mjs --big`):

  | Mark | Feb–Apr 2025-26: said → landed | Top 5 a night | 2026-27: said → landed | Top 5 a night |
  |---|---|---|---|---|
  | 30+ points | 10.0% → 9.9% | 35% / 34% | 12.3% → 8.4% | 37% / 29% |
  | 12+ rebounds | 11.9% → 12.1% | 41% / 45% | 12.7% → 10.6% | 41% / 42% |
  | 10+ assists | 13.0% → 13.3% | 29% / 32% | 14.5% → 9.1% | 31% / 24% |
  | 40+ PRA | 15.5% → 15.2% | 51% / 52% | 17.4% → 11.7% | 52% / 40% |
  | 5+ threes | 10.3% → 9.9% | 24% / 22% | 10.5% → 8.1% | 24% / 24% |

- **This season's first ten nights run under the chance shown,** across the field as at the top. Read again in a few
  weeks.

```bash
node tools/audit/nba-fetch.mjs --from 2026-10-20 --to 2026-10-31 --raw .nhl-data/audit/nba --season 2026
node tools/audit/nba-fetch.mjs --from 2025-10-21 --to 2026-04-12 --raw .nhl-data/audit/nba/prior --season 2025
node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-23 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/big --tag -prior
node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-31 --raw .nhl-data/audit/nba --prior .nhl-data/audit/nba/prior/games --out .nhl-data/audit/big --tag -cur
python3 tools/audit/nba_big.py --rows .nhl-data/audit/big
# the site's read graded: add --big to either replay (writes nba-<date><tag>-big.json)
```
