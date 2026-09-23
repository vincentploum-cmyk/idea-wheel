#!/bin/bash
launchctl bootout "gui/$(id -u)/com.nhlmodel.sync" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.nhlmodel.sync.plist"
rm -rf "$HOME/Applications/NHL Sync.app"
echo "NHL Model folder sync removed. (Token and log kept in ~/.config/nhl-model and ~/Library/Logs.)"
