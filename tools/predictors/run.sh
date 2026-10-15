#!/usr/bin/env bash
# Rebuild the "which data points predict SOG and goals" study for one season from the
# public NHL API + MoneyPuck, end to end. Output lands in .nhl-data/predictors/<year>
# (gitignored). Needs node 18+ and python3 with pandas, scipy, statsmodels, scikit-learn.
#   tools/predictors/run.sh 2026            # the 2026-27 season, to date
#   tools/predictors/run.sh 2025 2025-10-07 2026-04-16
# The previous season is fetched too (it is the skater's and the opponent's last-season read, and
# the control the formulas are fitted on); the one before that only for its MoneyPuck summary.
set -euo pipefail
cd "$(dirname "$0")/../.."
year=${1:?season start year, e.g. 2026}
from=${2:-$year-09-25}
to=${3:-$(date -u +%F)}
root=.nhl-data/predictors
work=$root/$year
prev=$((year - 1))
mkdir -p "$work/games" "$work/mp" "$root/$prev/games"
for y in $prev $((year - 2)); do
  for f in skaters teams goalies; do
    [ -s "$root/mp-$f-$y.csv" ] || curl -sSL -o "$root/mp-$f-$y.csv" "https://moneypuck.com/moneypuck/playerData/seasonSummary/$y/regular/$f.csv"
  done
done
for f in skaters teams; do [ -s "$work/mp/$f-$prev.csv" ] || cp "$root/mp-$f-$prev.csv" "$work/mp/$f-$prev.csv"; done
season_dates() { case $1 in 2023) echo 2023-10-10 2024-04-18;; 2024) echo 2024-10-04 2025-04-17;; 2025) echo 2025-10-07 2026-04-16;; *) echo "$1-10-01" "$(($1 + 1))-04-20";; esac; }
# the previous season, whole (skipped when already pulled)
read pfrom pto < <(season_dates $prev)
node tools/predictors/fetch.mjs "$pfrom" "$pto" "$root/$prev/games"
node tools/predictors/fetch.mjs "$from" "$to" "$work/games"
for y in $prev $year; do
  node tools/predictors/faceoffs.mjs "$root/$y/games" "$root/$y/faceoffs.json"
  python3 -I tools/predictors/relabel.py "$root/$y/games" "$root/$y/faceoffs.json" "$root/$y/games-pos"
done
python3 -I tools/predictors/build_rows.py "$work/games-pos" "$year" "$work/mp" "$work/rows.csv" --prev-games "$root/$prev/games-pos" --mp-root "$root"
python3 -I tools/predictors/analyze.py "$work/rows.csv" "$year-$((year + 1 - 2000)) season" "${BOOT:-300}" | tee "$work/analysis.txt"
python3 -I tools/predictors/calib.py "$work/rows.csv" | tee "$work/calibration.txt"
python3 -I tools/predictors/angles.py "$work/rows.csv" "$year-$((year + 1 - 2000))" | tee "$work/angles.txt"
# the replay needs the previous season's rows (built with ITS previous season as the prior): run.sh <prev> first
if [ -s "$root/$prev/rows.csv" ]; then
  second=""; [ -s "$root/$((year - 2))/rows.csv" ] && second="$root/$((year - 2))/rows.csv"
  python3 -I tools/predictors/replay.py "$root/$prev/rows.csv" "$work/rows.csv" "$year-$((year + 1 - 2000)) to $to" $second | tee "$work/replay.txt"
fi
echo "written to $work"
