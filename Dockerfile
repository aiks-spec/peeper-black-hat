FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pipx
RUN pip install --break-system-packages pipx
RUN pipx ensurepath

# Set environment variables
ENV PATH="/root/.local/bin:$PATH"
ENV PIPX_HOME="/root/.local/pipx"
ENV PIPX_BIN_DIR="/root/.local/bin"

# Install OSINT tools via pipx
RUN pipx install sherlock-project
RUN pipx install maigret
RUN pipx install 'git+https://github.com/megadose/holehe.git'
RUN pipx install ghunt

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --break-system-packages -r requirements.txt

# Copy application code
COPY main.py .

# Create results directory
RUN mkdir -p results

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
