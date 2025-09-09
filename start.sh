#!/bin/bash
set -e

echo "🚀 Starting OSINT Lookup Engine..."

# Start FastAPI in background
echo "🐍 Starting FastAPI on port 8000..."
python3 main.py &
FASTAPI_PID=$!

# Wait for FastAPI to be ready
echo "⏳ Waiting for FastAPI to start..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "✅ FastAPI is ready!"
        break
    fi
    echo "   Attempt $i/30: FastAPI not ready yet..."
    sleep 2
done

# Start Node.js
echo "🌐 Starting Node.js on port ${PORT:-3000}..."
exec node server.js
