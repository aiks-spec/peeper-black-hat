FROM node:20-bookworm-slim

# Update and install ncurses-bin which contains tput
RUN apt-get update && apt-get install -y ncurses-bin

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# UTF-8 and stdout-friendly env
ENV TERM=dumb \
    NO_COLOR=1 \
    FORCE_COLOR=0 \
    ANSI_COLORS_DISABLED=1 \
    CLICOLOR=0 \
    CLICOLOR_FORCE=0 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PYTHONUTF8=1 \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8 \
    LANGUAGE=C.UTF-8 \
    BASH_ENV="" \
    ENV="" \
    DB_TYPE=postgresql \
    DATABASE_URL=postgresql://peeper_aiks_database_user:kUs7g6cBDJTW6DPkaRebaMPa3E5Z6aGg@dpg-d2qnqep5pdvs738e09cg-a/peeper_aiks_database \
    PATH="/root/.local/bin:$PATH"

# OS deps
RUN apt-get update && apt-get install -y \
    curl wget git ca-certificates build-essential \
    python3 python3-pip python3-venv \
    libpq-dev postgresql-client \
 && rm -rf /var/lib/apt/lists/*

# Create isolated Python virtual environment to avoid PEP 668 and ensure tools availability
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Upgrade pip in venv and install build helpers
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Clone and install Python OSINT tools from source (install into venv)
RUN mkdir -p /opt/osint && cd /opt/osint \
 && git clone --depth 1 https://github.com/sherlock-project/sherlock.git \
 && git clone --depth 1 https://github.com/megadose/holehe.git \
 && git clone --depth 1 https://github.com/soxoj/maigret.git \
 && git clone --depth 1 https://github.com/mxrch/GHunt.git ghunt \
 && cd /opt/osint/sherlock && python -m pip install --no-cache-dir . \
 && cd /opt/osint/holehe && python -m pip install --no-cache-dir . \
 && cd /opt/osint/maigret && python -m pip install --no-cache-dir . \
 && cd /opt/osint/ghunt && python -m pip install --no-cache-dir .

# Verify Python tools are installed and accessible in the venv
RUN echo "=== Verifying Python tools installation (venv) ===" && \
    python -c "import sys; print(sys.executable)" && \
    python -c "import sherlock; print('✅ Sherlock version:', getattr(sherlock,'__version__','unknown'))" && \
    python -c "import holehe; print('✅ Holehe version:', getattr(holehe,'__version__','unknown'))" && \
    python -c "import maigret; print('✅ Maigret version:', getattr(maigret,'__version__','unknown'))" && \
    python -c "import ghunt; print('✅ GHunt import ok')" && \
    echo "=== Testing tool execution (venv) ===" && \
    python -m sherlock --help 2>&1 | head -3 && \
    python -m holehe --help 2>&1 | head -3 && \
    python -m maigret --help 2>&1 | head -3 && \
    python -m ghunt --help 2>&1 | head -3

# Install PhoneInfoga native binary
RUN mkdir -p /tmp/phoneinfoga \
 && cd /tmp/phoneinfoga \
 && curl -sSL -o phoneinfoga.tgz https://github.com/sundowndev/phoneinfoga/releases/latest/download/phoneinfoga_Linux_x86_64.tar.gz \
 && tar -xzf phoneinfoga.tgz \
 && mv phoneinfoga /usr/local/bin/phoneinfoga \
 && chmod +x /usr/local/bin/phoneinfoga \
 && phoneinfoga version || true

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application code
COPY . .

# Create persistent temp dir
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Neutralize any external shell color script Render might auto-source
RUN mkdir -p /home/render \
 && printf '#!/bin/sh\n# disabled\nexport NO_COLOR=1\nexport TERM=dumb\n' > /home/render/colors.sh \
 && chmod +x /home/render/colors.sh

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create non-root user for security
RUN useradd -r -s /bin/bash -u 1001 appuser \
 && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]

