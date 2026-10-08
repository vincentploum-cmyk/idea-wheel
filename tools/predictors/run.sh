#!/usr/bin/env bash
# Rebuild the "which data points predict SOG and goals" study for one season from the
# public NHL API + MoneyPuck, end to end. Output lands in .nhl-data/predictors/<year>
# (gitignored). Needs node 18+ and python3 with pandas, scipy, statsmodels, scikit-learn.
#   tools/predictors/run.sh 2026            # the 2026-27 season, to date
#   tools/predictors/run.sh 2025 2025-10-07 2026-04-16
set -euo pipefail
cd "$(dirname "$0")/../.."
year=${1:?season start year, e.g. 2026}
from=${2:-$year-09-25}
to=${3:-$(date -u +%F)}
work=.nhl-data/predictors/$year
mkdir -p "$work/games" "$work/mp"
prev=$((year - 1))
for f in skaters teams; do
  [ -s "$work/mp/$f-$prev.csv" ] || curl -sSL -o "$work/mp/$f-$prev.csv" "https://moneypuck.com/moneypuck/playerData/seasonSummary/$prev/regular/$f.csv"
done
node tools/predictors/fetch.mjs "$from" "$to" "$work/games"
python3 -I tools/predictors/build_rows.py "$work/games" "$year" "$work/mp" "$work/rows.csv"
python3 -I tools/predictors/analyze.py "$work/rows.csv" "$year-$((year + 1 - 2000)) season" "${BOOT:-300}" | tee "$work/analysis.txt"
python3 -I tools/predictors/calib.py "$work/rows.csv" | tee "$work/calibration.txt"
echo "written to $work"
