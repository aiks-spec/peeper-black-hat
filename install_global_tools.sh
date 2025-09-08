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
  if [ -n "${GHUNT_TOKEN:-}" ]; then
    echo -n "$GHUNT_TOKEN" > "$HOME/.config/ghunt/token.txt"
    echo -n "$GHUNT_TOKEN" > "$HOME/.config/ghunt/token"
    echo -n "$GHUNT_TOKEN" > "/opt/render/.config/ghunt/token.txt" || true
  fi
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "$GHUNT_COOKIES_B64" | base64 -d > "$HOME/.config/ghunt/cookies.json" || true
    echo "$GHUNT_COOKIES_B64" | base64 -d > "/opt/render/.config/ghunt/cookies.json" || true
  fi
  # Non-interactive GHunt login using provided credentials
  if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
    echo "[+] Performing non-interactive GHunt login with cookies (option 2)"
    # Feed option 2 and then the BASE64 string itself (not decoded)
    ghunt login <<EOF || true
2
${GHUNT_COOKIES_B64}

EOF
  elif [ -n "${GHUNT_TOKEN:-}" ]; then
    echo "[+] Performing non-interactive GHunt login with oauth token (option 3)"
    ghunt login <<EOF || true
3
${GHUNT_TOKEN}

EOF
  fi
  # Post-login status (non-fatal)
  ghunt login status || true
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

