#!/bin/bash
# One-time setup for the NHL Model folder sync. Double-click to run.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
CONF="$HOME/.config/nhl-model"
AGENT="$HOME/Library/LaunchAgents/com.nhlmodel.sync.plist"
APP="$HOME/Applications/NHL Sync.app"
mkdir -p "$CONF" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$HERE/nhl-sync.sh" "$CONF/nhl-sync.sh"
chmod 700 "$CONF/nhl-sync.sh"

if [ ! -s "$CONF/sync-token" ]; then
  echo "Paste the sync token from ideareels.io (Folder sync and data tools > Create sync token):"
  read -r TOKEN
  printf '%s' "$TOKEN" > "$CONF/sync-token"
fi
chmod 600 "$CONF/sync-token"

# macOS only lets an *app* (not a background shell script) read Desktop, so
# the sync runs inside a tiny AppleScript app that gets its own one-time
# "allow access to Desktop" permission.
mkdir -p "$HOME/Applications"
rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"/bin/bash '$CONF/nhl-sync.sh'\""
# Keep it out of the Dock while it runs.
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :NSDesktopFolderUsageDescription string 'NHL Sync uploads new PropFinder matchup files from Desktop/NHL to ideareels.io.'" "$APP/Contents/Info.plist" 2>/dev/null || true
codesign --force --deep -s - "$APP" 2>/dev/null || true

cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nhlmodel.sync</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/open</string><string>-g</string><string>-j</string><string>-a</string><string>$APP</string></array>
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
echo "Running a first sync. macOS will ask whether \"NHL Sync\" may access your Desktop folder — click Allow."
: > "$HOME/Library/Logs/nhl-sync.log"
open -W -a "$APP"
tail -n 5 "$HOME/Library/Logs/nhl-sync.log" 2>/dev/null || true
echo
echo "Done. PropFinder matchup files saved in Desktop/NHL (or its Match days folders) now upload automatically."
echo "Log: ~/Library/Logs/nhl-sync.log   Uninstall: double-click uninstall.command"
