#!/usr/bin/env bash
set -euo pipefail

echo "[+] Clean setup: removing prior pipx/venv and shims"
rm -rf "$HOME/.local/pipx" "/opt/render/.local/pipx" || true
rm -rf "$HOME/.local/bin"/* "/opt/render/.local/bin"/* || true
rm -rf ".venv" || true

echo "[+] Ensure Python and pip are available"
python3 --version || true
pip3 --version || true

TOOLS_DIR="tools"
BIN_DIR="$TOOLS_DIR/bin"
mkdir -p "$BIN_DIR"

clone_or_update() {
  local repo_url="$1"
  local dest_dir="$2"
  if [ -d "$dest_dir/.git" ]; then
    echo "[+] Updating $dest_dir"
    git -C "$dest_dir" pull --rebase || true
  else
    echo "[+] Cloning $repo_url -> $dest_dir"
    rm -rf "$dest_dir" || true
    git clone --depth=1 "$repo_url" "$dest_dir"
  fi
}

pip_install_reqs() {
  local dest_dir="$1"
  if [ -f "$dest_dir/requirements.txt" ]; then
    echo "[+] Installing requirements for $dest_dir"
    pip3 install --no-input --break-system-packages -r "$dest_dir/requirements.txt" || pip3 install -r "$dest_dir/requirements.txt" || true
  fi
}

echo "[+] Setting up Holehe"
clone_or_update "https://github.com/megadose/holehe.git" "$TOOLS_DIR/holehe"
pip_install_reqs "$TOOLS_DIR/holehe"

echo "[+] Setting up Maigret"
clone_or_update "https://github.com/soxoj/maigret.git" "$TOOLS_DIR/maigret"
pip_install_reqs "$TOOLS_DIR/maigret"

echo "[+] Setting up Sherlock"
clone_or_update "https://github.com/sherlock-project/sherlock.git" "$TOOLS_DIR/sherlock"
pip_install_reqs "$TOOLS_DIR/sherlock"

echo "[+] Setting up GHunt"
clone_or_update "https://github.com/mxrch/GHunt.git" "$TOOLS_DIR/ghunt"
pip_install_reqs "$TOOLS_DIR/ghunt"

echo "[+] Preparing GHunt creds if provided"
mkdir -p "$TOOLS_DIR/ghunt/.config/ghunt"
if [ -n "${GHUNT_COOKIES_B64:-}" ]; then
  echo "$GHUNT_COOKIES_B64" | base64 -d > "$TOOLS_DIR/ghunt/.config/ghunt/cookies.json" || true
fi
if [ -n "${GHUNT_TOKEN:-}" ]; then
  printf "%s" "$GHUNT_TOKEN" > "$TOOLS_DIR/ghunt/.config/ghunt/token.txt"
fi

echo "[+] Writing wrapper scripts"
cat > "$BIN_DIR/holehe" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../holehe"
exec python3 -m holehe.cli "$@"
SH

cat > "$BIN_DIR/maigret" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../maigret"
exec python3 -m maigret.maigret "$@"
SH

cat > "$BIN_DIR/sherlock" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../sherlock"
exec python3 sherlock.py "$@"
SH

cat > "$BIN_DIR/ghunt" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../ghunt"
exec python3 ghunt.py "$@"
SH

chmod +x "$BIN_DIR"/*

echo "[✓] Tool setup completed"

