FROM debian:stable-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIPX_HOME=/opt/pipx \
    PIPX_BIN_DIR=/opt/pipx/bin \
    PATH=/opt/pipx/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl bash git python3 python3-pip python3-venv nodejs npm \
    build-essential pkg-config libssl-dev libffi-dev libz-dev supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install pipx
RUN python3 -m pip install --no-cache-dir pipx && \
    python3 -m pipx ensurepath

# Install OSINT tools globally via pipx
RUN pipx install sherlock-project --include-deps && \
    pipx install ghunt --include-deps || true && \
    pipx install maigret --include-deps && \
    pipx install holehe --include-deps

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci || npm install

# Install Python dependencies
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make start script executable
RUN chmod +x /app/start.sh

# Create supervisor config
RUN cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:fastapi]
command=python3 main.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/var/log/fastapi.log
stderr_logfile=/var/log/fastapi.log
user=root

[program:nodejs]
command=node server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/var/log/nodejs.log
stderr_logfile=/var/log/nodejs.log
user=root
depends_on=fastapi
EOF

# Expose ports
EXPOSE 3000 8000

# Start both services with custom script
CMD ["/app/start.sh"]


