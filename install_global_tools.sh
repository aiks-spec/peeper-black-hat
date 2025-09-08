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

echo "[+] Install/upgrade pipx and ensure PATH"
python -m pip install --user --upgrade pip pipx || python3 -m pip install --user --upgrade pip pipx || pip3 install --user --upgrade pip pipx
python -m pipx ensurepath || python3 -m pipx ensurepath || pipx ensurepath || true
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[+] Install sherlock via pipx"
python -m pipx install sherlock-project || python3 -m pipx install sherlock-project || pipx install sherlock-project || true

echo "[+] Install Maigret"
python -m pip install --user --upgrade maigret || python3 -m pip install --user --upgrade maigret || pip3 install --user --upgrade maigret

echo "[+] Install Holehe from GitHub"
git clone --depth=1 https://github.com/megadose/holehe.git /tmp/holehe || true
cd /tmp/holehe
python setup.py install || python3 setup.py install || pip3 install . || python -m pip install . || true
cd -

echo "[+] Install GHunt via pipx"
python -m pipx install ghunt || python3 -m pipx install ghunt || pipx install ghunt || true

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

