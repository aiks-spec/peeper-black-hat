FROM debian:stable-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PIPX_HOME=/opt/pipx \
    PIPX_BIN_DIR=/opt/pipx/bin \
    PATH=/opt/pipx/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl bash git python3 python3-pip python3-venv nodejs npm \
    build-essential pkg-config libssl-dev libffi-dev libz-dev \
    procps net-tools \
    && rm -rf /var/lib/apt/lists/*

# Install pipx
RUN python3 -m pip install --no-cache-dir pipx && \
    python3 -m pipx ensurepath

# Install OSINT tools globally via pipx
RUN pipx install sherlock-project --include-deps && \
    pipx install ghunt --include-deps || true && \
    pipx install maigret --include-deps && \
    pipx install holehe --include-deps

# Install additional Python packages for OSINT tools
RUN python3 -m pip install --no-cache-dir \
    pexpect \
    requests \
    beautifulsoup4 \
    lxml \
    fastapi \
    uvicorn

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci || npm install

# Install Python dependencies
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create explicit Docker marker
RUN echo "Docker environment: active" > /app/docker_marker.txt && \
    echo "Build timestamp: $(date)" >> /app/docker_marker.txt && \
    echo "Container: OSINT Lookup Engine" >> /app/docker_marker.txt

# Make start script executable
RUN chmod +x /app/start.sh

# Create logs directory
RUN mkdir -p /var/log

# Expose ports
EXPOSE 3000 8000

# Start both services with custom script
CMD ["/app/start.sh"]


