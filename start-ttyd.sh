#!/usr/bin/env bash
set -euo pipefail

# Ensure tmux session exists
SESSION_NAME=osint
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux new-session -d -s "$SESSION_NAME" -n shell "bash"
fi

# Serve ttyd bound to tmux session on configured port
PORT_ENV=${PORT:-3000}
exec ttyd -p "$PORT_ENV" -t titleFixed=OSINT-Terminal -t disableLeaveAlert=true tmux attach -t "$SESSION_NAME"


