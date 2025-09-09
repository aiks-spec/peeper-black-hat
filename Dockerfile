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

# Create supervisor config
RUN echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:nodejs]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=node server.js' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/nodejs.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/nodejs.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:fastapi]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=python3 main.py' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/fastapi.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/fastapi.log' >> /etc/supervisor/conf.d/supervisord.conf

# Expose ports
EXPOSE 3000 8000

# Start both services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]


