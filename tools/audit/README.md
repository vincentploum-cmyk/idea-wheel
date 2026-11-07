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
node tools/audit/nba-fetch.mjs --from 2026-10-20 --to 2026-10-30 --raw .nhl-data/audit/nba --season 2026
node tools/audit/nba-fetch.mjs --from 2025-10-21 --to 2026-04-12 --raw .nhl-data/audit/nba/prior --season 2025 --no-logs
npm run audit:nba -- --date 2026-10-27 --prior .nhl-data/audit/nba/prior/games
```

`nba-fetch.mjs` is resumable (a file on disk is not fetched again); `--season` is ESPN's label for the game logs (2026 =
2025-26). This season through Oct 30 is 71 games, 455 players, 260 MB; last season's box scores 1,235 games.

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
names its files, `--from` the first night graded (the season's opening night grades it too), `--board` also writes
the `--date` slate's board and its shuffle payloads as `nba-<date><tag>-board.json` (the pages' data: serve it in
place of `/api/nba/picks` and `/api/nba/shuffle` to look at the views on a replayed night). The last season's replay takes about five minutes. The
first run is written up in `docs/audits/2026-10-28-nba-cocktail.md`.

## NBA: the projections stat by stat (`nba_stats.py`)

The replay's game rows carry each player's usage, computed from the box score the standard way
(100 × (FGA + 0.44 FTA + TOV) × team minutes / 5 / (minutes × the team's)), so the board's role read
off usage runs as on the site; ESPN carries no rebound chances or potential assists.

`report <rows.csv> [label]` reads a replay's rows (`nba-audit.mjs` writes them with each player's
games this season, his own windows, the minutes read and the matchup undamped): how far off each stat
is in its own units, how much of the miss is his minutes, by the size of the projection and his games
this season, each ingredient taken out. `pull <fit rows> <test rows>` fits the pull toward his role a
stat at a time on rows built without it (`--cocktail` with `"pull": null`). Written up in
`docs/audits/2026-10-29-nba-projections.md`.

```bash
python3 -I tools/audit/nba_stats.py report .nhl-data/audit/ab3/nba-2026-10-27-pull-rows.csv "This season"
```

## NBA: the ceiling read

`nba-audit.mjs` carries on every projection row the stated centre before the ceiling read (`base`), his upside and downside
(the top and bottom quarter of his nights over his mean, `up` / `down`), the opponent's rank at his spot and `reachAdd`,
and on every rung `base`, `up`, `down`, `where`, `gp`; its "The ceiling read" section asks whether a player beats his centre
in a soft matchup, then grids the cocktail's `reach` / `reachK` / `reachDown` over the projections and the rungs. Run the
two replays above (`--cocktail site`, or a JSON cocktail with `"reach": 0` for the board without it). Written up in
`docs/audits/2026-10-31-nba-ceiling.md` (shipped at 0.3, K 10, no pull toward the floor).

## NBA: what predicts each stat (`nba-box-fetch.mjs`, `nba_stat_drivers.py`)

Points, rebounds, assists and threes one at a time, from the box scores rather than the board: his own record at every
window and half-life (per game, and his rate a minute × his minutes), then the opponent (at his position and in all, season
and last ten), pace, the misses on offer, the opponent's threes allowed, teammates out, home, rest, his venue split and his
head to head, each as a Poisson read on top of his own, fitted on one season and scored unchanged on the next; the head to
head against a control (his games against other teams at the same dates). `--board` joins `nba-audit.mjs`'s rows to compare
with the site's whole board on the same player-games. The rows are cached as `stat-drivers-rows.pkl` beside the box scores
(`--rebuild` reads them again, about four minutes).

```bash
# trimmed box scores (header, boxscore, pickcenter), 25 MB a season; the first season is history only
node tools/audit/nba-box-fetch.mjs --from 2023-10-24 --to 2024-04-14 --out .nhl-data/audit/nba-box
node tools/audit/nba-box-fetch.mjs --from 2024-10-22 --to 2025-04-13 --out .nhl-data/audit/nba-box
node tools/audit/nba-box-fetch.mjs --from 2025-10-21 --to 2026-04-12 --out .nhl-data/audit/nba-box
node tools/audit/nba-box-fetch.mjs --from 2026-10-20 --to $(date -u +%F) --out .nhl-data/audit/nba-box
# the site's board on both check seasons (last season's needs --max-old-space-size=12000: it ran out of heap at the default)
python3 -I tools/audit/nba_stat_drivers.py --box .nhl-data/audit/nba-box --out docs/audits/2026-11-03-nba-stat-drivers-tables.md \
  --board .nhl-data/audit/cmp/nba-2026-04-12-site-rows.csv .nhl-data/audit/cmp/nba-2026-11-02-site-rows.csv
```

Written up in `docs/audits/2026-11-03-nba-stat-drivers.md`.

The recipe built from it is the site's cocktail since that day; the replay A / B (`--cocktail before` = the board until then,
`recipe` = that with the recipe, `site+{json}` / `before+{json}` = either with one setting varied), compared on the same
player-games:

```bash
for ck in before site; do node --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --date 2026-11-02 --from 2026-10-20 --raw .nhl-data/audit/nba --out .nhl-data/audit/ab4 --prior .nhl-data/audit/nba/prior/games --cocktail $ck --tag -$ck; done
python3 -I tools/audit/nba_ab_rows.py .nhl-data/audit/ab4/nba-2026-11-02 before site --label "This season"
# last season (about 17 minutes a run; two at a time fit in 15 GB at --max-old-space-size=6500)
node --max-old-space-size=6500 --import ./tools/audit/register.mjs tools/audit/nba-audit.mjs --season 2025 --date 2026-04-12 --from 2025-10-21 --raw .nhl-data/audit/nba --days .nhl-data/audit/nba/prior/days --games .nhl-data/audit/nba/prior/games --gamelogs .nhl-data/audit/nba/prior/gamelogs --out .nhl-data/audit/ab4 --cocktail site --tag -site
```

## NBA: the minutes read (`nba_minutes.py`)

The replay's rows say what the projection would miss had the board known his minutes; this script tries to get there:
each player's minutes history from the box scores and his last-season log, a dozen predictors (season, last 3 / 5,
EWMA, last season behind the season) against the minutes he played, each stat re-projected as his per-minute read ×
the prediction, and a straight shrink of the projection's spread — chosen on the fit slates, scored on the held-out ones.

```bash
python3 -I tools/audit/nba_minutes.py --rows .nhl-data/audit/out/nba-2026-10-30-site-rows.csv --raw .nhl-data/audit/nba --test-from 2026-10-27
```

Written up in `docs/audits/2026-10-31-nba-accuracy.md` (nothing changed: the minutes are the game's own swing).

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

## NHL: special teams and the predicted score (`nhl_special_teams.py`)

Vincent, 2026-10-31: whether the power plays a team draws and gives (ShotPropz's boards) move the shots and goals
read, and a predicted score to grade the goals reads against. The team power-play counts come from the NHL API's
right-rail (`gamecenter/<id>/right-rail`: SOG, power plays as goals/opportunities, PIM, the score), one file a game;
the skater rows from `tools/predictors/fetch.mjs`. Report: `docs/audits/2026-10-31-nhl-special-teams-and-score.md`.

```bash
# the right-rail stats per game id (resumable; a 404 ends a season's run)  →  .nhl-data/pp/<season>/<gameId>.json
node tools/audit/nhl-pp-fetch.mjs 2025 1 1312 .nhl-data/pp/2025
node tools/audit/nhl-pp-fetch.mjs 2026 1 400 .nhl-data/pp/2026
python3 -I tools/audit/nhl_special_teams.py --pp .nhl-data/pp --games .nhl-data/predictors --out .nhl-data/audit/out/nhl-special-teams.md
```

Four sections: what a power play is worth inside a game (OLS of a team's shots and goals on the power plays it got
and killed); whether tonight's count can be foreseen (a Poisson fit of a team's power plays on its drawn rate and the
opponent's given rate, shrunk at K, with the odd / even persistence of every rate); whether the opponent's discipline
moves a team's shots and goals beyond its own volume and the opponent's allowed table, with the mechanical factor
(the forecast's extra power plays × a power play's worth) tested the same way; and the predicted score (the league,
own goals × allowed, the fitted team layer, Σ of the skaters' study λ goals, the blends), per team and per game,
fitted on 2025-26 and scored unchanged on 2026-27. The JSON at the end is what `lib/nhl-data/special-teams.js`
(`ST`) and `lib/nhl-data/score.js` (`SCORE`) carry. Needs numpy, pandas and statsmodels.


## NHL: projected minutes, the line and the power plays (`nhl_toi.py`)

Vincent, 2026-11-07: whether a skater's minutes can be projected from his line and the power plays the matchup should
bring. The NHL stats API's game-by-game reports (`skater/timeonice`: each skater-game's minutes split even strength /
power play / short-handed; `team/powerplay`, `team/penaltykill`: each team-game's power plays and kills), fetched with
curl in two-week windows. Report: `docs/audits/2026-11-07-nhl-toi.md`.

```bash
tools/audit/nhl-toi-fetch.sh .nhl-data/toi "20252026 2025-10-01 2026-04-30" "20262027 2026-10-01 $(date -u -d tomorrow +%F)"
python3 -I tools/audit/nhl_toi.py --raw .nhl-data/toi --out .nhl-data/audit/out/nhl-toi.md
```

Five sections: minutes by line (as played and as projected from his recent even-strength minutes) and by power-play role;
what one more power play or kill does to a skater's minutes, in hindsight; how well the matchup's power plays are
foreseen (`specialTeamsRead`'s shape); the projections scored (his last 10 / 5, the model's `projectedToiFromLineup`, a
split read, fits with the line and the power-play role); the skaters who played a different line than their minutes said.
## NHL: the by-line read (`nhl_lines.py`)

Vincent, 2026-10-31: do the slot badges on the rink (the opponent's rank against the LW1, the C2, the D1 …) help —
was the LW1 the top shooter? Every skater-game replayed against the opponent's by-slot table as it stood that
morning (this season's games alone, a cell from three skater-games, ranked 1 = allows the most, the softest
slot the best rank) and graded; the slot is the ice-time rank inside the position that night (the public box
score carries no lines), the positions the relabelled ones. Report: `docs/audits/2026-10-31-nhl-lines.md`.

```bash
python3 -I tools/audit/nhl_lines.py --games .nhl-data/predictors --dir games-pos --out .nhl-data/audit/out/nhl-lines.md
```

Four sections: the softest slot against the top shooter (and the slot's base rate, and the highest own rate as the
yardstick); the lift by third of the slot table beside the position table; the slot cell on top of his own rate and
the position cell (a Poisson fit, 2025-26 fitted, 2026-27 scored); the odd / even persistence of the cells.

## NFL: the projections (`lib/nfl/projections.js` on `lib/nfl/picks.js`)

```bash
# ESPN: every week's scoreboard and finished games (box score, scoring plays, the line), the rosters' positions
node tools/audit/nfl-fetch.mjs --season 2025 --weeks 1-18 --raw .nhl-data/audit/nfl
node tools/audit/nfl-fetch.mjs --season 2026 --weeks 1-9 --raw .nhl-data/audit/nfl
node --max-old-space-size=6144 --import ./tools/audit/register.mjs tools/audit/nfl-audit.mjs --out .nhl-data/audit/out
```

Every week rebuilt from the games before it (each player's logs, each defense's table by position, the game's line) and
run through the site's own board and projections, then graded on the week's box scores. The board's cocktail, the game
script, the floor and ceiling and the touchdown read are searched on 2025's weeks 4–18 and checked unchanged on 2026's
finished weeks; `nfl-backtest.json` carries every table. ESPN takes the season as `dates=<year>` (`year` is ignored);
a past game's line is in the summary's pickcenter or ESPN's core odds. First run: `docs/audits/2026-11-01-nfl-backtest.md`.

On PropFinder's own data: run the `NFL PropFinder export (audit)` workflow (GitHub → Actions; it calls
`GET /api/nfl/propfinder?export=1` with the site token for every stored week), unzip its artifact into
`.nhl-data/audit/nfl-pf`, then (with the ESPN files above for the schedule and the lines):

```bash
node --max-old-space-size=8192 --import ./tools/audit/register.mjs tools/audit/nfl-pf-audit.mjs --pf .nhl-data/audit/nfl-pf --raw .nhl-data/audit/nfl
```

The same replay on the pulls' PropFinder logs (zeros in) with the defense tables rebuilt from them, the rebuilt tables
against PropFinder's published ones, the week whose pre-game pull survived on PropFinder's own tables and against the
books' lines of that day, and the constants searched again; `nfl-pf-backtest.json`. First run:
`docs/audits/2026-11-01-nfl-propfinder-backtest.md`.

The big games (`docs/audits/2026-11-01-nfl-big-games.md`): `nfl-pf-audit.mjs --dump` writes the board's read for every
player-game of 2024 (with `nfl-fetch.mjs --season 2024`), 2025 and 2026, `python3 tools/audit/nfl_big.py` (scikit-learn,
pandas) builds the morning's features from the PropFinder export and fits / checks the models and the rules,
`nfl-pf-audit.mjs --big` grades the site's own `BIG` read on the replay.

## NBA: the big games (`nba_big.py`)

`nba-audit.mjs`'s rows (with `espnId` and `venue` since 2026-11-01) for 2025-26 and 2026-27, joined in Python to ESPN's box
scores and lines (`--raw`'s `games/` and `prior/games/`), fit and check the big-game models; `--big` on either replay grades
the site's own `lib/nba/big.js` read. Written up in `docs/audits/2026-11-01-nba-big-games.md` (commands there).
