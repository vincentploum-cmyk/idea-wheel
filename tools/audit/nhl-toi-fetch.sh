#!/bin/bash
# The NHL stats API's game-by-game reports for the TOI audit (tools/audit/nhl_toi.py): every skater-game's ice time split
# even strength / power play / short-handed (skater/timeonice) and every team-game's power plays and kills
# (team/powerplay, team/penaltykill), in two-week windows (a window stays under the API's 10,000-row page). Resumable.
#   tools/audit/nhl-toi-fetch.sh <out dir> "<seasonId> <from> <to>" …
#   tools/audit/nhl-toi-fetch.sh .nhl-data/toi "20252026 2025-10-01 2026-04-30" "20262027 2026-10-01 $(date -u -d tomorrow +%F)"
set -e
out=$1; shift
q() { python3 -I -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }
for spec in "$@"; do
  set -- $spec; s=$1; d=$2; end=$3
  mkdir -p "$out/$s"
  while [[ "$d" < "$end" ]]; do
    n=$(date -u -d "$d +14 day" +%F); [[ "$n" > "$end" ]] && n=$end
    for rep in skater/timeonice team/powerplay team/penaltykill; do
      f="$out/$s/${rep/\//-}-$d.json"; [ -s "$f" ] && continue
      e=$(q "seasonId=$s and gameTypeId=2 and gameDate>=\"$d\" and gameDate<\"$n\"")
      curl -sS -m 90 --retry 3 -f "https://api.nhle.com/stats/rest/en/$rep?isAggregate=false&isGame=true&start=0&limit=-1&cayenneExp=$e" -o "$f"
    done
    d=$n
  done
done
