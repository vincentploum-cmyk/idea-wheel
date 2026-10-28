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
