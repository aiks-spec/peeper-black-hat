# Dockerfile for OSINT Lookup Engine - Render.com compatible
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    git \
    build-essential \
    postgresql-client \
    libpq-dev \
    ncurses-bin \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: Create tput replacement in ALL possible locations
RUN echo '#!/bin/bash\necho ""' > /usr/bin/tput && chmod +x /usr/bin/tput
RUN echo '#!/bin/bash\necho ""' > /usr/local/bin/tput && chmod +x /usr/local/bin/tput
RUN echo '#!/bin/bash\necho ""' > /bin/tput && chmod +x /bin/tput
RUN echo '#!/bin/bash\necho ""' > /home/render/.local/bin/tput && chmod +x /home/render/.local/bin/tput

# CRITICAL: Override Render's colors.sh system
RUN mkdir -p /home/render
RUN echo '#!/bin/bash\nexit 0' > /home/render/colors.sh && chmod +x /home/render/colors.sh

# Set environment variables
ENV TERM=dumb
ENV FORCE_COLOR=0
ENV NO_COLOR=1
ENV ANSI_COLORS_DISABLED=1
ENV CLICOLOR=0
ENV CLICOLOR_FORCE=0
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8
ENV RICH_NO_COLOR=1
ENV PYTHONUTF8=1
ENV PATH="/usr/bin:/usr/local/bin:/bin:$PATH"

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

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
