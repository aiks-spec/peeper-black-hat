# Clean Dockerfile - no tput or colors.sh handling
FROM ubuntu:22.04

# Set environment variables to prevent shell issues
ENV TERM=dumb
ENV NO_COLOR=1
ENV FORCE_COLOR=0
ENV ANSI_COLORS_DISABLED=1
ENV CLICOLOR=0
ENV CLICOLOR_FORCE=0
ENV BASH_ENV=""
ENV ENV=""
ENV PYTHONPATH="/usr/local/lib/python3.10/dist-packages:/usr/lib/python3/dist-packages"
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

# Install all dependencies including Docker
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    postgresql-client \
    libpq-dev \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Docker
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce docker-ce-cli containerd.io && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Python OSINT tools with proper module support
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir \
    sherlock-project \
    maigret \
    holehe \
    ghunt

# Debug: Check what was installed
RUN echo "=== Installed Python packages ===" && \
    pip3 list | grep -E "(sherlock|holehe|maigret|ghunt)" || echo "No tools found in pip list" && \
    echo "=== Python version ===" && \
    python3 --version && \
    echo "=== Python path ===" && \
    which python3

# Verify Python tools are installed as modules
RUN echo "=== Testing module imports ===" && \
    python3 -c "import sherlock; print('✅ Sherlock module available')" && \
    python3 -c "import holehe; print('✅ Holehe module available')" && \
    python3 -c "import maigret; print('✅ Maigret module available')" && \
    python3 -c "import ghunt; print('✅ GHunt module available')"

# Test tool execution via Python modules (with verbose output for debugging)
RUN echo "=== Testing tool execution ===" && \
    echo "Testing Sherlock..." && \
    python3 -m sherlock --help 2>&1 | head -10 && \
    echo "✅ Sherlock test completed" && \
    echo "Testing Holehe..." && \
    python3 -m holehe --help 2>&1 | head -10 && \
    echo "✅ Holehe test completed" && \
    echo "Testing Maigret..." && \
    python3 -m maigret --help 2>&1 | head -10 && \
    echo "✅ Maigret test completed"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY . .

# Create temp directory for OSINT tool output files
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Copy and setup entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
