#!/bin/bash
# Claude Code status line: delegates to ccusage (model, session/today/5h-block cost, burn rate, context %).
# Managed by chezmoi. Status line runs without a login shell, so find bunx explicitly.
input=$(cat)
bunx=$(command -v bunx || ls "$HOME/.bun/bin/bunx" /opt/homebrew/bin/bunx 2>/dev/null | head -1)
[ -n "$bunx" ] && out=$(printf '%s' "$input" | "$bunx" ccusage@latest statusline 2>/dev/null)
if [ -n "$out" ]; then
  printf '%s' "$out"
else
  printf '%s' "$input" | jq -r '"🤖 \(.model.display_name // "Claude") | 💰 $\(.cost.total_cost_usd // 0 | . * 100 | round / 100)"'
fi
