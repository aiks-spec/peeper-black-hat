#!/usr/bin/env bash
set -euo pipefail

# Prepare terminal backend (tmux preferred)
SESSION_NAME=osint
TTYD_PORT=3001
if command -v tmux >/dev/null 2>&1; then
  if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux new-session -d -s "$SESSION_NAME" -n shell "bash"
  fi
  echo "🚀 Starting ttyd (tmux) on ${TTYD_PORT}..."
  ttyd -p "$TTYD_PORT" -t titleFixed=OSINT-Terminal -t disableLeaveAlert=true tmux attach -t "$SESSION_NAME" &
else
  echo "⚠️ tmux not found, starting ttyd with bash directly"
  ttyd -p "$TTYD_PORT" -t titleFixed=OSINT-Terminal -t disableLeaveAlert=true bash &
fi

PORT_ENV=${PORT:-3000}
echo "🌐 Starting Node server on ${PORT_ENV}..."
export PORT="$PORT_ENV"
exec node server.js


