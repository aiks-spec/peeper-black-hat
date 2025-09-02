#!/bin/bash
set -e

echo "=== Entrypoint ==="
echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "Python: $(python3 --version 2>&1 || true)"
echo "Pip: $(python3 -m pip --version 2>&1 || true)"
echo "PhoneInfoga: $(phoneinfoga version 2>&1 || true)"
echo "PATH: $PATH"

echo "=== Python tools check ==="
python3 -c "import sherlock; print('Sherlock OK')" 2>&1 || echo "Sherlock missing"
python3 -c "import holehe; print('Holehe OK')" 2>&1 || echo "Holehe missing"
python3 -c "import maigret; print('Maigret OK')" 2>&1 || echo "Maigret missing"
python3 -c "import ghunt; print('GHunt OK')" 2>&1 || echo "GHunt missing"

exec "$@"


