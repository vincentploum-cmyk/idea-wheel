# Model audit tools

Replays the boards' reads over the season from public data and lays one slate out game by
game, graded, with the site's own functions. Nothing here reaches the store: the NHL games come
from the NHL API through `tools/predictors/fetch.mjs`, the NBA box scores from ESPN. The first
audit (2026-10-27) is in `docs/audits/2026-10-27-model-audit.md`.

The scripts import the site's modules, whose relative imports carry no extension (Next's
resolution), through a loader hook: `register.mjs` → `resolve-ext.mjs`.

## NHL: the plain-rate read (`lib/nhl-data/picks-pure.js`)

```bash
# the seasons' games (resumable), the centres relabelled from the faceoffs
node tools/predictors/fetch.mjs 2025-10-07 2026-04-16 .nhl-data/predictors/2025/games
node tools/predictors/fetch.mjs 2026-10-01 $(date -u +%F) .nhl-data/predictors/2026/games
for y in 2025 2026; do node tools/predictors/faceoffs.mjs .nhl-data/predictors/$y/games .nhl-data/predictors/$y/faceoffs.json && python3 -I tools/predictors/relabel.py .nhl-data/predictors/$y/games .nhl-data/predictors/$y/faceoffs.json .nhl-data/predictors/$y/games-pos; done
npm run audit:nhl -- --date 2026-10-27
```

Writes `.nhl-data/audit/out/nhl-<date>.md` (every market season to date, calibration by band,
the variants beside the shipped read — the study's blends, the goal-rate shrink at other
strengths, last season's table, the table blended, shrunk toward the league, or absent —, the
windows of his own results, the cuts where the read runs high or low, the Best bets rule
replayed, the slate's tables with the box score, the biggest misses) and `nhl-<date>-rows.csv`
(every rated skater-game with every variant's figures). The model run's shots λ is not here: it
needs the History tab's export (`/api/nhl/data/scorecard?rows=1&from=<date>`, signed in) and
`tools/predictors/grade_blend.py`.

## NBA: the board (`lib/nba/picks.js` through `lib/picks/board.js`)

```bash
# ESPN: the season's scoreboards and box scores, every player's last-season game log, last season's box scores (the prior table)
#   .nhl-data/audit/nba/days/<YYYYMMDD>.json, games/<eventId>.json, gamelogs/<espnId>.json, prior/games/<eventId>.json
npm run audit:nba -- --date 2026-10-27 --prior .nhl-data/audit/nba/prior/games
```

The pull is built from the logs the way PropFinder's would be read (`asOf` cuts each player's
logs before his game), the opponent's per-position table through `defenseAllowed`, the injury
report from the block ESPN attaches to each game; the book's lines are not public, so a pseudo
line stands in (his last-ten average floored plus a half, the rung the board itself falls back
to) and the chance is graded at it without a price. `--top` is the pull's population a team (10,
PropFinder's odds-only count), `--from` the first slate graded. Writes `nba-<date>.md`,
`nba-<date>-summary.json` (the site's `summarize` output) and `nba-<date>-rows.csv` (every
projection with its parts: rate, matchup, team scale, lift, minutes factor, the figure).

## NBA: the cocktail (`nba_cocktail.py`, the board's `--cocktail`, `nba_ab.py`)

Which mix of reads predicts a player's night best: his windows (per game and per minute), the
matchup at every weight and damping, the book's game total and spread (ESPN's pickcenter), home,
rest, teammates out, then the chance at the rungs (the tail's share, the hit-rate weights, the
spread). Tuned on 2025-26 with 2024-25 behind it, checked unchanged on this season. Needs numpy,
pandas and scipy; the rows are cached beside the report (`--rebuild` reads the feeds again).

```bash
# last season's scoreboards and box scores, 2024-25 game logs: prior/days, prior/games, prior/gamelogs under --raw
python3 -I tools/audit/nba_cocktail.py --raw .nhl-data/audit/nba --date 2026-10-27 --out .nhl-data/audit/out/nba-cocktail.md
# the site's board with the shipped cocktail against the board as it was, this season and last
for ck in old site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-10-27 --from 2026-10-20 --raw .nhl-data/audit/nba --out .nhl-data/audit/ab --prior .nhl-data/audit/nba/prior/games --cocktail $ck --tag -$ck; done
for ck in old site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-21 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/ab --cocktail $ck --tag -$ck; done
python3 -I tools/audit/nba_ab.py .nhl-data/audit/ab/nba-2026-10-27-old-summary.json .nhl-data/audit/ab/nba-2026-10-27-site-summary.json "2026-27"
```

`--cocktail` takes `site` (`COCKTAIL` in `lib/nba/picks.js`), `old` (`COCKTAIL_DEFAULTS`, the board
before it) or a JSON object (`'{"factorMax":1.15}'` on top of the defaults, so pass the whole
cocktail to vary one setting; `"scope": "all" | "regular" | "season"` sets the games his windows
read); `--season` / `--days` / `--games` / `--gamelogs` point the replay at another season, `--tag`
names its files, `--from` the first night graded (the season's opening night grades it too). The last season's replay takes about five minutes. The
first run is written up in `docs/audits/2026-10-28-nba-cocktail.md`.

## NHL: the game script (`nhl_game_script.py`)

The team layer and the split tested on two seasons: what sets a team's shots and goals tonight
(its own volume and the opponent's, season / venue / last ten, rest, home; a Poisson model fitted
on the fit season and applied unchanged to the test season), the model's own Stage 1 rebuilt
beside it, whether an opponent's weakness by position persists from one half of a season to the
other, and the skaters' reads with the team's projected volume divided among them, graded against
the shipped read on the same skater-games. Needs pandas, scipy and statsmodels.

```bash
npm run audit:nhl -- --date 2026-10-27
node --import ./tools/audit/register.mjs tools/audit/nhl-audit.mjs --date 2026-04-16 --cur .nhl-data/predictors/2025/games-pos --prev .nhl-data/predictors/empty --out .nhl-data/audit/out25
python3 -I tools/audit/nhl_game_script.py --fit-games .nhl-data/predictors/2025/games-pos --fit-rows .nhl-data/audit/out25/nhl-2026-04-16-rows.csv --test-games .nhl-data/predictors/2026/games-pos --test-rows .nhl-data/audit/out/nhl-2026-10-27-rows.csv --date 2026-10-27 --out .nhl-data/audit/out/nhl-game-script-2026-10-27.md
```

The first run is written up in `docs/audits/2026-10-28-game-script.md`.
