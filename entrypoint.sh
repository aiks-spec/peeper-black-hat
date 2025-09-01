#!/bin/bash
# Simple entrypoint - no tput or colors.sh handling needed
# Prevent sourcing of shell configuration files

# Disable shell configuration loading
set +o allexport
unset BASH_ENV
unset ENV

# Start the application
exec "$@"
