#!/usr/bin/env bash
# The Patterns tab's refit (Vincent, 2026-11-12: "set up the weekly refit"): the season's public games through
# `through` (default: yesterday, Eastern), the patterns rows, the rules re-mined (searched on the first half of the
# skater-games, kept on the second) and the 3+ SOG model refitted (its frozen check: a fit through the first half,
# graded on the second). Writes lib/nhl-data/patterns-rules.json, lib/nhl-data/patterns-model.json and the scorer's
# parity fixture; the reports land in the work dir. Run weekly by .github/workflows/nhl-patterns-refit.yml.
#
#   tools/predictors/patterns-refit.sh [through YYYY-MM-DD] [work dir]
#
# Fails (writing nothing it has not already written; the workflow then commits nothing) when the games come back
# fewer than the shipped rules were built on, or the model's frozen check falls under MIN_CHECK of its 50%+ calls.
# Needs node 18+ and python3 with numpy, pandas and scikit-learn.
set -euo pipefail
cd "$(dirname "$0")/../.."
through=${1:-$(TZ=America/New_York date -d yesterday +%F)}
work=${2:-.nhl-data/predictors/patterns}
MIN_CHECK=${MIN_CHECK:-0.45}
y=$(date -d "$through" +%Y); m=$(date -d "$through" +%-m)
season=$(( m >= 7 ? y : y - 1 ))
from=$season-09-25
mkdir -p "$work/games"

# Only this season's nights; the last three again (a game that was not final when its night was fetched stays missing).
for f in "$work"/games/*.json; do [ -e "$f" ] || continue; b=$(basename "$f" .json); [[ "$b" < "$from" || "$b" > "$through" ]] && rm -f "$f"; done
for k in 0 1 2; do rm -f "$work/games/$(date -d "$through -$k day" +%F).json"; done
node tools/predictors/fetch.mjs "$from" "$through" "$work/games" | tail -3
node tools/predictors/faceoffs.mjs "$work/games" "$work/faceoffs.json"
rm -rf "$work/games-pos"
python3 -I tools/predictors/relabel.py "$work/games" "$work/faceoffs.json" "$work/games-pos"
node tools/predictors/patterns-rows.mjs "$work/games-pos" "$work/patterns.csv" --to "$through" 2>/dev/null

# The split: the first night of the second half of the skater-games (the rules' check, the model's frozen check).
read -r split fitlast rows < <(python3 -I - "$work/patterns.csv" <<'PY'
import sys, pandas as pd
d = pd.read_csv(sys.argv[1], usecols=['date', 'gp'])
c = d[d.gp >= 1].groupby('date').size().sort_index().cumsum()
split = c[c >= c.iloc[-1] / 2].index[0]
print(split, c[c.index < split].index[-1], int(c.iloc[-1]))
PY
)
shipped=$(python3 -I -c "import json; print(json.load(open('lib/nhl-data/patterns-rules.json')).get('rows', 0))")
echo "through $through: $rows skater-games (shipped rules: $shipped); rules searched to $fitlast, checked from $split"
if [ "$rows" -lt "$shipped" ]; then echo "::error::fewer skater-games ($rows) than the shipped rules were built on ($shipped): a fetch came back short"; exit 1; fi

python3 -I tools/predictors/patterns.py "$work/patterns.csv" "$split" --out "$work/patterns-report.md" --rules "$work/patterns-rules.json" > /dev/null
python3 -I tools/predictors/patterns_model.py "$work/patterns.csv" --through "$through" --check-through "$fitlast" \
  --out "$work/patterns-model.json" --fixture "$work/patterns-model-parity.json" --report "$work/model-report.md" > /dev/null

# The gate, then the files into the repo.
python3 -I - "$work/patterns-model.json" "$MIN_CHECK" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])); c = m['check']['calls']['50']
rate = c['hits'] / c['n'] if c['n'] else 0
print(f"model: fitted on {m['rows']} through {m['builtThrough']}; frozen through {m['check']['fitThrough']}, its 50%+ calls "
      f"landed {c['hits']} of {c['n']} ({rate:.0%}) on {m['check']['from']} to {m['check']['to']}")
if c['n'] < 50 or rate < float(sys.argv[2]):
    print(f"::error::the model's frozen check is under the floor ({c['n']} calls, {rate:.0%} < {float(sys.argv[2]):.0%}); nothing shipped")
    sys.exit(1)
PY
cp "$work/patterns-rules.json" lib/nhl-data/patterns-rules.json
cp "$work/patterns-model.json" lib/nhl-data/patterns-model.json
cp "$work/patterns-model-parity.json" __tests__/fixtures/patterns-model-parity.json
echo "$through $split $fitlast $rows" > "$work/refit.txt"
echo "written: lib/nhl-data/patterns-rules.json, lib/nhl-data/patterns-model.json, __tests__/fixtures/patterns-model-parity.json"
