#!/bin/bash
# Simple entrypoint - no tput or colors.sh handling needed
# Prevent sourcing of shell configuration files

# Disable shell configuration loading
set +o allexport
unset BASH_ENV
unset ENV

# Debug: Show environment
echo "=== Entrypoint Debug Info ==="
echo "Python version: $(python3 --version 2>&1 || echo 'Python3 not found')"
echo "Node version: $(node --version 2>&1 || echo 'Node not found')"
echo "Working directory: $(pwd)"
echo "PATH: $PATH"
echo "Python tools test:"
python3 -c "import sherlock; print('✅ Sherlock available')" 2>&1 || echo "❌ Sherlock not available"
python3 -c "import holehe; print('✅ Holehe available')" 2>&1 || echo "❌ Holehe not available"
python3 -c "import maigret; print('✅ Maigret available')" 2>&1 || echo "❌ Maigret not available"
echo "=== Starting Application ==="

# Start the application
exec "$@"
