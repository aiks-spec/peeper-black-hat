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
export PATH="$PIPX_BIN_DIR:/opt/render/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
echo "[+] Current PATH after pipx setup: $PATH"

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
    export GHUNT_COOKIES_B64="eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDFBanlHeVhfNVR2Rm1vMEtZOFBaM3N3cTdkejJ4RUI0eWhzVG12SGJFV1JJUE5BQk5RS1cwOERGVmRaWng5bm50elJGMUFBQ2dZS0FTb1NBUkFTRlFIR1gyTWl6S1daWTN0RmhDbFVEVzBLTENhNnhSb1ZBVUY4eUtvTkR4RTJxcnhXVFJaVkE5cWJHVHE5MDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMUFqeUd5WF81VHZGbW8wS1k4UFozc3dxN2R6MnhFQjR5aHNUbXZIYkVXUklQTkFCMnp1Q09WLUF0SEFUcFdGRU1xdWhDQUFDZ1lLQVp3U0FSQVNGUUhHWDJNaWFwd05KUUVpYVhqUWxLLTY1ZS1RYkJvVkFVRjh5S3JBbE1rLWNZektQYXJvUURwVW5FRFcwMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMUFqeUd3ZXllWFhVb184WnBOLVoyLTFnT2lWQVFHQkNYemE3V0pzXzhDaXE3eDE3bTZnSnhEaUFHWU92Q3BpVjZvQUhJUUFDZ1lLQVl3U0FSQVNGUUhHWDJNaVBPVlRvWDB1RUhfeVhqQ2dwSGJyYlJvVkFVRjh5S3FjRzF1UWZfaFVhNTJjWWZ4TlZlQkYwMDc2IiwiSFNJRCI6IkFnUUlOdXVndGhwX3JuXzlUIiwiU1NJRCI6IkFwMGVwdW5KalZDelpQeHRqIiwiQVBJU0lEIjoiTFN3X0h0dmFNZ1VkR3NKNi9BWGRVQ1F2UGw1NW1jc2lwdiIsIlNBUElTSUQiOiJDWTF3UFJHXzYzQ0dOMjd6L0FYQ3J4Z0Z4OHhpTVpqSkdlIn0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmhaWG9ZeVl5NU1QSkdRbGotTHFwbWlCY3E4cDE3S3ZrRHFwMFdhRDczbkhHTDRoSDNncFp0bXR6OERtOEMxQmcifQ=="
  fi
  # Use oauth token for login (option 3)
  if [ -z "${GHUNT_TOKEN:-}" ]; then
    export GHUNT_TOKEN="oauth2_4/0AVMBsJhZXoYyYy5MPJGQlj-LqpmiBcq8p17KvkDqp0WaD73nHGL4hH3gpZtmtz8Dm8C1Bg"
  fi
  # Clear any cookies to force token-only login
  rm -f "$HOME/.config/ghunt/cookies.json" "/opt/render/.config/ghunt/cookies.json" || true
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "$GHUNT_COOKIES_B64" | base64 -d > "$HOME/.config/ghunt/cookies.json" || true
    echo "$GHUNT_COOKIES_B64" | base64 -d > "/opt/render/.config/ghunt/cookies.json" || true
  fi
  # Robust non-interactive GHunt login: always choose option 3 and paste oauth token
  if [ -n "${GHUNT_TOKEN:-}" ]; then
    echo "[+] Performing GHunt login via option 3 (oauth token) with pexpect"
    # Ensure pexpect is available for the automation
    (python -m pip install -q --no-input --break-system-packages pexpect || true)
    (python3 -m pip install -q --no-input --break-system-packages pexpect || true)
    PYBIN="$(command -v python3 || command -v python || echo python3)"
    "$PYBIN" - <<'PY' || true
import os
import time
import pexpect

token = os.environ.get('GHUNT_TOKEN', '').strip()
if not token:
    raise SystemExit(0)

try:
    child = pexpect.spawn('ghunt login', encoding='utf-8', timeout=60)
    child.expect('Choice =>')
    child.sendline('3')
    time.sleep(2.0)
    child.expect(['oauth', 'token', '=>'], timeout=60)
    child.sendline(token)
    time.sleep(2.0)
    child.sendline('')  # press Enter after pasting
    time.sleep(3.0)
    child.expect(pexpect.EOF, timeout=180)
except Exception:
    pass
PY
    # Fallback: try plain stdin here-doc if pexpect flow fails for any reason
    ghunt login <<EOF || true
3
${GHUNT_TOKEN}

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
    # Test that the tool actually works
    $bin --version >/dev/null 2>&1 && echo "  └─ Version check: OK" || echo "  └─ Version check: FAILED"
  else
    echo "[✗] $bin not found in PATH"
    # Try to find it manually
    for search_path in "/opt/render/.local/bin" "$HOME/.local/bin" "/usr/local/bin" "/usr/bin"; do
      if [ -f "$search_path/$bin" ]; then
        echo "  └─ Found at: $search_path/$bin"
        break
      fi
    done
  fi
done

echo "[+] pipx availability:"
if command -v pipx >/dev/null 2>&1; then
  echo "[✓] pipx: $(command -v pipx)"
  pipx list || true
else
  echo "[✗] pipx not found"
fi

echo "[✓] Global tool install finished"
npm install && npm run build

