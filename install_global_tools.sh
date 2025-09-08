#!/usr/bin/env bash
set -euo pipefail

echo "[+] Ensuring Python and pipx are available"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update || true
  sudo apt-get install python3.10 python3.10-venv python3-pip python3.10-dev || true
fi

python --version || true
python3 --version || true
pip --version || true
pip3 --version || true

echo "[+] Adjusting environment (avoid virtualenv user-site issues)"
unset PIP_USER || true
export PIPX_HOME="$HOME/.local/pipx"
export PIPX_BIN_DIR="$HOME/.local/bin"
mkdir -p "$PIPX_HOME" "$PIPX_BIN_DIR"
export PATH="$PIPX_BIN_DIR:/usr/local/bin:/usr/bin:/bin:$PATH"
export PIP_BREAK_SYSTEM_PACKAGES=1

echo "[+] Install/upgrade pipx and ensure PATH"
python -m pip install --upgrade pip pipx --break-system-packages || python3 -m pip install --upgrade pip pipx --break-system-packages || pip3 install --upgrade pip pipx --break-system-packages
python -m pipx ensurepath || python3 -m pipx ensurepath || pipx ensurepath || true
export PATH="$PIPX_BIN_DIR:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[+] Install sherlock via pipx"
python -m pipx install --pip-args="--no-input" sherlock-project || python3 -m pipx install --pip-args="--no-input" sherlock-project || pipx install sherlock-project || true

echo "[+] Install Maigret"
python -m pipx install --pip-args="--no-input" maigret || python3 -m pipx install --pip-args="--no-input" maigret || pipx install maigret || true

echo "[+] Install Holehe via pipx from GitHub"
python -m pipx install 'git+https://github.com/megadose/holehe.git' || python3 -m pipx install 'git+https://github.com/megadose/holehe.git' || pipx install 'git+https://github.com/megadose/holehe.git' || true

echo "[+] Install GHunt via pipx"
python -m pipx install --pip-args="--no-input" ghunt || python3 -m pipx install --pip-args="--no-input" ghunt || pipx install ghunt || true

echo "[+] Configure GHunt (non-interactive) if creds provided"
if command -v ghunt >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/ghunt" "/opt/render/.config/ghunt"
  export XDG_CONFIG_HOME="$HOME/.config"
  # Fallback: embed cookies if not provided via env (requested by user)
  if [ -z "${GHUNT_COOKIES_B64:-}" ]; then
    export GHUNT_COOKIES_B64="eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDFBanlHNVNRZzFkclY4YVpVU2NtektoTjhKdzR2SXpoa05jQ0loMURnejlWSjU5U2RzRXlKMnMxN3NEemhicWNIMDJib3dBQ2dZS0FYUVNBUkFTRlFIR1gyTWloaElkNHpBRjVZNDQ3RjBvWnhIYjJSb1ZBVUY4eUtxcEYybDM5REloRU9TaG0tUHdjWFZKMDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMUFqeUc1U1FnMWRyVjhhWlVTY216S2hOOEp3NHZJemhrTmNDSWgxRGd6OVZKNTlTMmUzUDM0SUllVU1waUd2blk1Zk84Z0FDZ1lLQWVjU0FSQVNGUUhHWDJNaUVuWEQydGhFNzdRVW5CYXFNVEtEY1JvVkFVRjh5S3I4YmJBU0RWV01qNk9qcDJCZk10SEswMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMUFqeUc4bVhSWENUdmhfR1ptMERlRGJQb1pNVXZfUkVnbWtVRkN6eFU0aHd4eXBHb2FRdzNUVDZ6WDJLWkZ4eEk0ZFJ1UUFDZ1lLQVlRU0FSQVNGUUhHWDJNaVVTSS0tU3VCeHc1bUl6SEZQYk1FUlJvVkFVRjh5S3F3cDgyOGMyTnk3SVNVTjd5TDNwbS0wMDc2IiwiSFNJRCI6IkFXQWV5QkptY24zYjM1NHVnIiwiU1NJRCI6IkFoakRJR1NVLUUwdXNXWHJNIiwiQVBJU0lEIjoiYWVyblphdHpQQzhtMWdDbS9BZm56SVVESmZfSEx4aHNBYSIsIlNBUElTSUQiOiJacHFiMXZlY0dodVpmUlBlL0FMdXZ5RWFuak1nQ0NyMkd6In0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmdmUDZpb1p1VzJVdjFmNHhWVWttZVFRWWZJanVIUDV6UzZfSWx5TkRxaVZJQUhTcTBwWEtaTDNEZFQzdkhoUkEifQ=="
  fi
  if [ -z "${GHUNT_TOKEN:-}" ]; then
    export GHUNT_TOKEN="oauth2_4/0AVMBsJgfP6ioZuW2Uv1f4xVUkmeQQYfIjuHP5zS6_IlyNDqiVIAHSq0pXKZL3DdT3vHhRA"
  fi
  if [ -n "${GHUNT_TOKEN:-}" ]; then
    echo -n "$GHUNT_TOKEN" > "$HOME/.config/ghunt/token.txt"
    echo -n "$GHUNT_TOKEN" > "$HOME/.config/ghunt/token"
    echo -n "$GHUNT_TOKEN" > "/opt/render/.config/ghunt/token.txt" || true
  fi
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "$GHUNT_COOKIES_B64" | base64 -d > "$HOME/.config/ghunt/cookies.json" || true
    echo "$GHUNT_COOKIES_B64" | base64 -d > "/opt/render/.config/ghunt/cookies.json" || true
  fi
  # Robust non-interactive GHunt login: always choose option 2 and paste cookies
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "[+] Performing GHunt login via option 2 (cookies) with pexpect"
    # Ensure pexpect is available for the automation
    (python -m pip install -q --no-input --break-system-packages pexpect || true)
    (python3 -m pip install -q --no-input --break-system-packages pexpect || true)
    PYBIN="$(command -v python3 || command -v python || echo python3)"
    "$PYBIN" - <<'PY' || true
import os
import time
import pexpect

cookies_b64 = os.environ.get('GHUNT_COOKIES_B64', '').strip()
if not cookies_b64:
    raise SystemExit(0)

try:
    child = pexpect.spawn('ghunt login', encoding='utf-8', timeout=60)
    child.expect('Choice =>')
    child.sendline('2')
    time.sleep(1.2)
    child.sendline('')  # press Enter
    time.sleep(1.2)
    child.expect(['Paste', 'encoded', 'credentials', '=>'], timeout=60)
    child.sendline(cookies_b64)
    time.sleep(1.2)
    child.sendline('')  # press Enter after pasting
    time.sleep(1.2)
    child.expect(pexpect.EOF, timeout=180)
except Exception:
    pass
PY
    # Fallback: try plain stdin here-doc if pexpect flow fails for any reason
    ghunt login <<EOF || true
2
${GHUNT_COOKIES_B64}

EOF
  fi
  # No status check requested
fi

echo "[+] Make CLIs executable (best effort)"
chmod +x "$HOME/.local/bin/"* || true
# best-effort symlinks for CLIs into /usr/local/bin when writable
for bin in sherlock maigret holehe ghunt; do
  if command -v $bin >/dev/null 2>&1; then
    src=$(command -v $bin)
    dest="/usr/local/bin/$bin"
    if [ -w "/usr/local/bin" ] && [ ! -e "$dest" ]; then
      ln -s "$src" "$dest" 2>/dev/null || true
    fi
  fi
done

echo "[+] Final tool availability:"
for bin in sherlock maigret holehe ghunt; do
  if command -v $bin >/dev/null 2>&1; then
    echo "[✓] $bin: $(command -v $bin)"
  else
    echo "[✗] $bin not found in PATH"
  fi
done

echo "[✓] Global tool install finished"
npm install && npm run build

