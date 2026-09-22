#!/bin/bash
# One-time setup for the NHL Model folder sync. Double-click to run.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
CONF="$HOME/.config/nhl-model"
AGENT="$HOME/Library/LaunchAgents/com.nhlmodel.sync.plist"
mkdir -p "$CONF" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$HERE/nhl-sync.sh" "$CONF/nhl-sync.sh"
chmod 700 "$CONF/nhl-sync.sh"

if [ ! -s "$CONF/sync-token" ]; then
  echo "Paste the sync token from ideareels.io (Folder sync and data tools > Create sync token):"
  read -r TOKEN
  printf '%s' "$TOKEN" > "$CONF/sync-token"
fi
chmod 600 "$CONF/sync-token"

cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nhlmodel.sync</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$CONF/nhl-sync.sh</string></array>
  <key>WatchPaths</key><array><string>$HOME/Desktop/NHL</string><string>$HOME/Desktop/NHL/Match days</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/nhl-sync.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/com.nhlmodel.sync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo
echo "Running a first sync (macOS may ask to allow access to the Desktop folder — click Allow)..."
/bin/bash "$CONF/nhl-sync.sh"
tail -n 5 "$HOME/Library/Logs/nhl-sync.log" 2>/dev/null || true
echo
echo "Done. PropFinder matchup files saved in Desktop/NHL (or its Match days folders) now upload automatically."
echo "Log: ~/Library/Logs/nhl-sync.log   Uninstall: double-click uninstall.command"
