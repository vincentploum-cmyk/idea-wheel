#!/bin/bash
# NHL Model folder sync: uploads new PropFinder files — matchup workbooks
# (NHL-Goal-Matchups-*.xlsx) and the skater / team stats exports
# (nhl-skater-stats-*.csv, nhl-team-stats-*.csv) — saved anywhere in ~/Desktop/NHL
# (including the "Match days" subfolders) to ideareels.io, and fetches the beat
# writers' lines pages from gamedaytweets.com for the site (which cloud servers cannot
# reach): once an hour, and every 5 minutes while a game is within its warm-up window.
# Installed by install.command; launchd runs it when the folder changes and every 5 minutes.
set -u
CONF="$HOME/.config/nhl-model"
WATCH_DIR="${NHL_SYNC_DIR:-$HOME/Desktop/NHL}"
URL="${NHL_SYNC_URL:-https://ideareels.io/api/nhl/data/matchups}"
TOKEN_FILE="$CONF/sync-token"
STATE="$CONF/synced.txt"
LOG="$HOME/Library/Logs/nhl-sync.log"
mkdir -p "$CONF" "$(dirname "$LOG")"
touch "$STATE"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

if [ ! -s "$TOKEN_FILE" ]; then
  log "no sync token at $TOKEN_FILE"
  exit 0
fi
TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"

if ! ls "$WATCH_DIR" >/dev/null 2>&1; then
  log "cannot read $WATCH_DIR (allow Desktop access for bash in System Settings > Privacy & Security > Files and Folders)"
  exit 0
fi

# ── Beat writers' lines ───────────────────────────────────────────────────────
# gamedaytweets.com refuses cloud servers (Cloudflare challenge) but answers a home
# connection, so this Mac fetches the slate teams' pages once an hour and posts them
# to the site, which parses them and runs the model. Independent of the folder.
LINES_URL="${NHL_LINES_URL:-https://ideareels.io/api/nhl/data/lineups/gdt}"
LINES_STAMP="$CONF/lines-fetched-at"
LINES_GAP="${NHL_LINES_GAP_SEC:-3600}"          # between reads on a quiet afternoon
LINES_GAP_PREGAME="${NHL_LINES_GAP_PREGAME_SEC:-240}"  # inside a warm-up window: every launchd tick (5 min)
now=$(date +%s)
last=$(cat "$LINES_STAMP" 2>/dev/null || echo 0)
TODAY=$(TZ=America/New_York date +%F)
sched=$(curl -sS --max-time 30 "https://api-web.nhle.com/v1/schedule/$TODAY" 2>/dev/null)
# Today's block of the week: between "date":"<today>" and the next day's "date".
today_block=$(printf '%s' "$sched" | tr -d '\n' | sed -e "s/.*\"date\":\"$TODAY\"//" -e 's/"date":"20[0-9-]*".*//')
# The beat writers post warm-up lines 15 to 30 minutes before puck drop: while any game
# starts within the next 90 minutes (or started in the last 30), read every tick, not hourly.
gap="$LINES_GAP"
for t in $(printf '%s' "$today_block" | grep -oE '"startTimeUTC":"[0-9T:Z-]+"' | cut -d'"' -f4); do
  start=$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$t" +%s 2>/dev/null || date -u -d "$t" +%s 2>/dev/null || echo 0)
  [ "$start" -gt 0 ] || continue
  if [ $((start - now)) -le 5400 ] && [ $((now - start)) -le 1800 ]; then gap="$LINES_GAP_PREGAME"; break; fi
done
if [ $((now - last)) -ge "$gap" ]; then
  echo "$now" > "$LINES_STAMP"
  # Team codes of today's games, without jq: the abbrevs appear as "abbrev":"XXX" inside the day's block.
  teams=$(printf '%s' "$today_block" | grep -oE '"abbrev":"[A-Z]{3}"' | cut -d'"' -f4 | sort -u)
  if [ -n "$teams" ]; then
    tmp=$(mktemp -d)
    args=(-F "date=$TODAY")
    got=0
    for t in $teams; do
      code=$(curl -sS -o "$tmp/$t.html" -w '%{http_code}' --max-time 30 "https://www.gamedaytweets.com/lines?team=$t" 2>/dev/null || echo 000)
      if [ "$code" = "200" ]; then args+=(-F "$t=@$tmp/$t.html;type=text/html"); got=$((got + 1)); else log "lines: gamedaytweets answered $code for $t"; fi
      sleep 1
    done
    if [ "$got" -gt 0 ]; then
      resp="$(curl -sS --max-time 290 -w $'\n%{http_code}' -H "Authorization: Bearer $TOKEN" "${args[@]}" "$LINES_URL" 2>&1)"
      log "lines: posted $got pages -> ${resp##*$'\n'} $(printf '%s' "${resp%$'\n'*}" | head -c 600)"
    else
      log "lines: no pages fetched for $TODAY"
    fi
    rm -rf "$tmp"
  fi
fi

find "$WATCH_DIR" -maxdepth 3 -type f \( -name 'NHL-Goal-Matchups-*.xlsx' -o -name 'nhl-skater-stats-*.csv' -o -name 'nhl-team-stats-*.csv' \) -not -name '~$*' -not -path '*/.*' -mtime -3 -print0 2>/dev/null |
while IFS= read -r -d '' f; do
  name="$(basename "$f")"
  key="$name|$(stat -f %m "$f")|$(stat -f %z "$f")"
  grep -Fxq "$key" "$STATE" && continue
  # Let a download that's still being written settle.
  s1=$(stat -f %z "$f"); sleep 2; s2=$(stat -f %z "$f")
  [ "$s1" = "$s2" ] || continue
  resp="$(curl -sS --max-time 60 -w $'\n%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$f" "$URL" 2>&1)"
  code="${resp##*$'\n'}"
  body="${resp%$'\n'*}"
  if [ "$code" = "200" ]; then
    echo "$key" >> "$STATE"
    log "synced $name -> $body"
    osascript -e "display notification \"$name uploaded to the NHL model\" with title \"NHL Model\"" >/dev/null 2>&1 || true
  else
    log "FAILED ($code) $name -> $body"
  fi
done
exit 0
