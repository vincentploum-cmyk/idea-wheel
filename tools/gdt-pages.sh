#!/bin/bash
# Fetch the GameDayTweets lines page for every team playing on DATE and post the
# raw HTML to the site, which parses the beat writers' lines against its rosters,
# snapshots positions and runs the model. Run from GitHub Actions (the site's own
# server is refused by gamedaytweets.com). Needs NHL_ACTIONS_TOKEN.
#   tools/gdt-pages.sh 2026-10-01 [https://ideareels.io]
set -u
DATE="${1:?date YYYY-MM-DD}"
SITE="${2:-https://ideareels.io}"
if [ -z "${NHL_ACTIONS_TOKEN:-}" ]; then echo "NHL_ACTIONS_TOKEN not set; skipping the GameDayTweets pages"; exit 0; fi
TEAMS=$(curl -sS --max-time 30 "https://api-web.nhle.com/v1/schedule/$DATE" | jq -r --arg d "$DATE" '[.gameWeek[] | select(.date == $d) | .games[] | select(.gameType == 2 or .gameType == 3) | .awayTeam.abbrev, .homeTeam.abbrev] | unique | .[]')
if [ -z "$TEAMS" ]; then echo "No games on $DATE"; exit 0; fi
tmp=$(mktemp -d)
n=0
for t in $TEAMS; do
  code=$(curl -sS -o "$tmp/$t.html" -w '%{http_code}' --max-time 30 -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' "https://www.gamedaytweets.com/lines?team=$t" || echo 000)
  if [ "$code" = "200" ]; then n=$((n + 1)); else echo "$t: $code"; rm -f "$tmp/$t.html"; fi
  sleep 1
done
echo "Fetched $n pages for: $(echo $TEAMS | tr '\n' ' ')"
# Refused as a datacenter address (Cloudflare challenge): try again with a real Chrome.
missing=$(for t in $TEAMS; do [ -f "$tmp/$t.html" ] || echo "$t"; done)
if [ -n "$missing" ] && command -v node >/dev/null 2>&1; then
  echo "Trying a browser for: $(echo $missing | tr '\n' ' ')"
  ( cd "$(dirname "$0")/.." && [ -d node_modules/playwright-core ] || npm install --no-save --no-audit --no-fund playwright-core >/dev/null 2>&1 )
  ( cd "$(dirname "$0")/.." && node tools/gdt-browser.mjs "$tmp" $missing ) || true
  n=$(ls "$tmp"/*.html 2>/dev/null | wc -l | tr -d ' ')
  echo "After the browser: $n pages"
fi
[ "$n" -gt 0 ] || exit 0
# What each page holds, for the log: tweet count and the first tweet's header lines.
for f in "$tmp"/*.html; do
  t=$(basename "$f" .html)
  echo "$t: $(grep -c 'full-sized-tweet' "$f") tweet blocks, $(wc -c < "$f") bytes; first: $(grep -A4 -m1 'full-sized-tweet' "$f" | tr -s ' \n' ' ' | head -c 220)"
done
# { date, pages: { ABBR: html } }
jq -n --arg date "$DATE" '{date: $date, pages: {}}' > "$tmp/body.json"
for f in "$tmp"/*.html; do
  t=$(basename "$f" .html)
  jq --arg t "$t" --rawfile html "$f" '.pages[$t] = $html' "$tmp/body.json" > "$tmp/body2.json" && mv "$tmp/body2.json" "$tmp/body.json"
done
code=$(curl -sS -o "$tmp/resp.json" -w '%{http_code}' --max-time 290 -X POST -H "Authorization: Bearer $NHL_ACTIONS_TOKEN" -H 'Content-Type: application/json' --data-binary "@$tmp/body.json" "$SITE/api/nhl/data/lineups/gdt")
echo "Site answered $code: $([ -f "$tmp/resp.json" ] && head -c 1500 "$tmp/resp.json")"
rm -rf "$tmp"
[ "$code" = "200" ]
