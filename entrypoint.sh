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
echo "=== Stdout Handling Environment Variables ==="
echo "PYTHONUNBUFFERED: $PYTHONUNBUFFERED"
echo "PYTHONIOENCODING: $PYTHONIOENCODING"
echo "PYTHONUTF8: $PYTHONUTF8"
echo "LC_ALL: $LC_ALL"
echo "LANG: $LANG"
echo "LANGUAGE: $LANGUAGE"
echo "=== Python Tools Test ==="
python3 -c "import sherlock; print('✅ Sherlock available')" 2>&1 || echo "❌ Sherlock not available"
python3 -c "import holehe; print('✅ Holehe available')" 2>&1 || echo "❌ Holehe not available"
python3 -c "import maigret; print('✅ Maigret available')" 2>&1 || echo "❌ Maigret not available"
python3 -c "import ghunt; print('✅ GHunt available')" 2>&1 || echo "❌ GHunt not available"
echo "=== Testing Stdout Encoding ==="
python3 -c "import sys; print('stdout encoding:', sys.stdout.encoding); print('stderr encoding:', sys.stderr.encoding)" 2>&1
echo "=== Starting Application ==="

# Start the application
exec "$@"
