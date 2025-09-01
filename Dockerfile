# Multi-stage Dockerfile to completely isolate environment
FROM ubuntu:22.04 as base

# Install all dependencies including tput
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
    ncurses-bin \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Verify tput works
RUN which tput && tput colors

# Final stage
FROM base as final

# Install OSINT tools
RUN pip3 install --user sherlock-project holehe maigret ghunt

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY . .

# Copy and setup entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
