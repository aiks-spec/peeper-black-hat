#!/bin/bash
set -e

echo "=== Entrypoint Starting ==="

# Disable shell configuration loading to prevent issues like colors.sh sourcing
unset BASH_ENV || true
unset ENV || true

# Set environment variables for proper stdout handling and color suppression
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
export LANGUAGE=C.UTF-8
export TERM=dumb
export NO_COLOR=1
export FORCE_COLOR=0
export ANSI_COLORS_DISABLED=1
export CLICOLOR=0
export CLICOLOR_FORCE=0

echo "=== Environment Setup ==="
echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "Python: $(python3 --version 2>&1 || true)"
echo "Pip: $(python3 -m pip --version 2>&1 || true)"
echo "PhoneInfoga: $(phoneinfoga version 2>&1 || true)"
echo "PATH: $PATH"
echo "PYTHONUNBUFFERED: $PYTHONUNBUFFERED"
echo "LC_ALL: $LC_ALL"

echo "=== Python tools verification ==="
echo "Checking Sherlock..."
python3 -c "import sherlock; print('✅ Sherlock module available - version:', sherlock.__version__)" 2>&1 || echo "❌ Sherlock missing"
echo "Checking Holehe..."
python3 -c "import holehe; print('✅ Holehe module available - version:', holehe.__version__)" 2>&1 || echo "❌ Holehe missing"
echo "Checking Maigret..."
python3 -c "import maigret; print('✅ Maigret module available - version:', maigret.__version__)" 2>&1 || echo "❌ Maigret missing"
echo "Checking GHunt..."
python3 -c "import ghunt; print('✅ GHunt module available - version:', ghunt.__version__)" 2>&1 || echo "❌ GHunt missing"

echo "=== Tool execution test ==="
echo "Testing Sherlock help..."
python3 -m sherlock --help 2>&1 | head -5 || echo "❌ Sherlock execution failed"
echo "Testing Holehe help..."
python3 -m holehe --help 2>&1 | head -5 || echo "❌ Holehe execution failed"
echo "Testing Maigret help..."
python3 -m maigret --help 2>&1 | head -5 || echo "❌ Maigret execution failed"
echo "Testing GHunt help..."
python3 -m ghunt --help 2>&1 | head -5 || echo "❌ GHunt execution failed"
echo "Testing PhoneInfoga help..."
phoneinfoga --help 2>&1 | head -5 || echo "❌ PhoneInfoga execution failed"

echo "=== Python path verification ==="
python3 -c "import sys; print('Python executable:', sys.executable); print('Python path:', sys.path)" 2>&1 || echo "❌ Python path check failed"

echo "=== Starting application ==="
exec "$@"


