# Clean Dockerfile - no tput or colors.sh handling
FROM ubuntu:22.04

# Install all dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install OSINT tools with proper paths
RUN pip3 install --user sherlock-project holehe maigret ghunt

# Create symlinks for tools in system PATH
RUN ln -sf /root/.local/bin/sherlock /usr/local/bin/sherlock
RUN ln -sf /root/.local/bin/holehe /usr/local/bin/holehe
RUN ln -sf /root/.local/bin/maigret /usr/local/bin/maigret
RUN ln -sf /root/.local/bin/ghunt /usr/local/bin/ghunt

# Verify tools are accessible
RUN which sherlock && which holehe && which maigret && which ghunt

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
