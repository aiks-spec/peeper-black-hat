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

# Upgrade pip and install Python tools with explicit versions
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install Python OSINT tools with explicit versions and verification
RUN python3 -m pip install --no-cache-dir \
    sherlock-project==4.1.0 \
    holehe==1.4.0 \
    maigret==0.0.1 \
    ghunt==4.0.0

# Ensure Python tools are accessible globally
RUN python3 -m pip install --user --no-cache-dir \
    sherlock-project==4.1.0 \
    holehe==1.4.0 \
    maigret==0.0.1 \
    ghunt==4.0.0

# Verify Python tools are installed and accessible
RUN echo "=== Verifying Python tools installation ===" && \
    python3 -c "import sherlock; print('✅ Sherlock version:', sherlock.__version__)" && \
    python3 -c "import holehe; print('✅ Holehe version:', holehe.__version__)" && \
    python3 -c "import maigret; print('✅ Maigret version:', maigret.__version__)" && \
    python3 -c "import ghunt; print('✅ GHunt version:', ghunt.__version__)" && \
    echo "=== Testing tool execution ===" && \
    python3 -m sherlock --help 2>&1 | head -3 && \
    python3 -m holehe --help 2>&1 | head -3 && \
    python3 -m maigret --help 2>&1 | head -3 && \
    python3 -m ghunt --help 2>&1 | head -3

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

