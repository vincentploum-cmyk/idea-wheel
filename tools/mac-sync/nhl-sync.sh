#!/bin/bash
# NHL Model folder sync: uploads new PropFinder matchup workbooks
# (NHL-Goal-Matchups-*.xlsx) saved anywhere in ~/Desktop/NHL (including the
# "Match days" subfolders) to ideareels.io. Installed by install.command;
# launchd runs it when the folder changes and every 5 minutes.
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

find "$WATCH_DIR" -maxdepth 3 -type f -name 'NHL-Goal-Matchups-*.xlsx' -not -name '~$*' -not -path '*/.*' -mtime -3 -print0 2>/dev/null |
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
