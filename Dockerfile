FROM debian:stable-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIPX_HOME=/opt/pipx \
    PIPX_BIN_DIR=/opt/pipx/bin \
    PATH=/opt/pipx/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl bash tmux git python3 python3-pip python3-venv \
    build-essential pkg-config libssl-dev libffi-dev libz-dev \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd
RUN curl -L -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.4/ttyd.x86_64 && \
    chmod +x /usr/local/bin/ttyd

# Install pipx
RUN python3 -m pip install --no-cache-dir pipx && \
    python3 -m pipx ensurepath

# Install OSINT tools globally via pipx
RUN pipx install sherlock-project --include-deps && \
    pipx install ghunt --include-deps || true && \
    pipx install maigret --include-deps && \
    pipx install holehe --include-deps

WORKDIR /app

# Copy web assets
COPY public ./public
COPY scripts ./scripts

# Create tools dir for any future use
RUN mkdir -p /app/tools/bin

# Port for ttyd
EXPOSE 3000

# Start script sets up tmux and ttyd
CMD ["/bin/bash", "/app/scripts/start-ttyd.sh"]


