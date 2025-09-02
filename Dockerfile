FROM ubuntu:22.04

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
    LANGUAGE=C.UTF-8

# Add ncurses to your Alpine-based Dockerfile
RUN apk add ncurses

# OS deps
RUN apt-get update && apt-get install -y \
    curl wget git ca-certificates build-essential \
    python3 python3-pip python3-venv \
    libpq-dev postgresql-client \
    ncurses-bin \
 && rm -rf /var/lib/apt/lists/*

# Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && node --version && npm --version

# Python tools
RUN python3 -m pip install --no-cache-dir --upgrade pip \
 && python3 -m pip install --no-cache-dir \
    sherlock-project \
    holehe \
    maigret \
    ghunt

# PhoneInfoga native binary
RUN mkdir -p /tmp/phoneinfoga \
 && cd /tmp/phoneinfoga \
 && curl -sSL -o phoneinfoga.tgz https://github.com/sundowndev/phoneinfoga/releases/latest/download/phoneinfoga_Linux_x86_64.tar.gz \
 && tar -xzf phoneinfoga.tgz \
 && mv phoneinfoga /usr/local/bin/phoneinfoga \
 && chmod +x /usr/local/bin/phoneinfoga \
 && phoneinfoga version || true

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Create persistent temp dir
RUN mkdir -p /app/temp && chmod 777 /app/temp

# Neutralize any external shell color script Render might auto-source
RUN mkdir -p /home/render \
 && printf '#!/bin/sh\n# disabled\nexport NO_COLOR=1\nexport TERM=dumb\n' > /home/render/colors.sh \
 && chmod +x /home/render/colors.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]


