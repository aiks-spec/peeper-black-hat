#!/usr/bin/env bash
set -euo pipefail

# Ensure tmux session exists
SESSION_NAME=osint
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux new-session -d -s "$SESSION_NAME" -n shell "bash"
fi

# Start ttyd on 3001 (internal) and Node on PORT (external)
TTYD_PORT=3001
if ! command -v ttyd >/dev/null 2>&1; then
  echo "❌ ttyd not found"
  exit 1
fi

echo "🚀 Starting ttyd on ${TTYD_PORT}..."
ttyd -p "$TTYD_PORT" -t titleFixed=OSINT-Terminal -t disableLeaveAlert=true tmux attach -t "$SESSION_NAME" &

PORT_ENV=${PORT:-3000}
echo "🌐 Starting Node server on ${PORT_ENV}..."
export PORT="$PORT_ENV"
exec node server.js


