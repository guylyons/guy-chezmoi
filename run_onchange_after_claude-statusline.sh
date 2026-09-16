#!/bin/sh
# Points Claude Code's status line at ~/.claude/statusline.sh (tracked in chezmoi).
#
# settings.json itself is NOT tracked: Claude Code rewrites it (permissions,
# hooks) and it holds machine-specific paths. Instead, merge just the
# statusLine key in with jq, leaving everything else untouched.
#   run_onchange_ = re-runs if this script changes
#   after_        = runs after statusline.sh has been written
set -eu

settings="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"
[ -f "$settings" ] || echo '{}' > "$settings"

tmp=$(mktemp)
jq '.statusLine = {"type": "command", "command": "~/.claude/statusline.sh", "padding": 0}' \
  "$settings" > "$tmp" && mv "$tmp" "$settings"
