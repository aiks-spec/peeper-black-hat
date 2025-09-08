#!/usr/bin/env bash
set -euo pipefail

echo "[+] Ensuring Python and pipx are available"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y || true
  sudo apt-get install -y python3.10 python3.10-venv python3-pip python3.10-dev || true
fi

python --version || true
python3 --version || true
pip --version || true
pip3 --version || true

echo "[+] Install/upgrade pipx and ensure PATH"
python -m pip install --user --upgrade pip pipx || pip3 install --user --upgrade pip pipx
python -m pipx ensurepath || pipx ensurepath || true
export PATH="$HOME/.local/bin:$PATH"

echo "[+] Install sherlock via pipx"
pipx install sherlock-project || true

echo "[+] Install Maigret"
pip3 install --user --upgrade maigret || python -m pip install --user --upgrade maigret

echo "[+] Install Holehe from GitHub"
git clone --depth=1 https://github.com/megadose/holehe.git /tmp/holehe || true
cd /tmp/holehe
python setup.py install || python3 setup.py install
cd -

echo "[+] Install GHunt via pipx"
pipx install ghunt || true

echo "[+] Configure GHunt (non-interactive) if creds provided"
if command -v ghunt >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/ghunt"
  if [ -n "${GHUNT_TOKEN:-}" ]; then
    echo -n "$GHUNT_TOKEN" > "$HOME/.config/ghunt/token.txt"
  fi
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "$GHUNT_COOKIES_B64" | base64 -d > "$HOME/.config/ghunt/cookies.json" || true
  fi
fi

echo "[+] Make CLIs executable (best effort)"
chmod +x "$HOME/.local/bin/"* || true

echo "[+] Final tool availability:"
command -v sherlock || echo "sherlock not found"
command -v maigret || echo "maigret not found"
command -v holehe || echo "holehe not found"
command -v ghunt || echo "ghunt not found"

echo "[✓] Global tool install finished"


