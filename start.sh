#!/bin/bash
set -e

echo "🚀 Starting OSINT Lookup Engine..."

# Check if FastAPI dependencies are installed
echo "🔍 Checking FastAPI dependencies..."
python3 -c "import fastapi, uvicorn" 2>/dev/null || {
    echo "❌ FastAPI dependencies not found, installing..."
    pip install fastapi uvicorn
}

# Test basic FastAPI import
echo "🧪 Testing FastAPI import..."
python3 -c "
from fastapi import FastAPI
import uvicorn
print('✅ FastAPI modules imported successfully')
" || {
    echo "❌ FastAPI import test failed"
    exit 1
}

# Get the main port from Render
MAIN_PORT=${PORT:-3000}
FASTAPI_PORT=${FASTAPI_PORT:-8000}

# Start FastAPI in background with detailed logging
echo "🐍 Starting FastAPI on port $FASTAPI_PORT..."

# Start FastAPI in background
echo "🔧 Starting FastAPI with command: FASTAPI_PORT=$FASTAPI_PORT python3 main.py"
FASTAPI_PORT=$FASTAPI_PORT python3 main.py > /tmp/fastapi.log 2>&1 &
FASTAPI_PID=$!

# Give FastAPI time to start
echo "⏳ Waiting for FastAPI to start..."
sleep 3

# Show initial FastAPI logs
echo "📋 Initial FastAPI logs:"
cat /tmp/fastapi.log 2>/dev/null || echo "No logs yet"

# Check if FastAPI process is running
echo "🔍 FastAPI process status:"
ps aux | grep "python3 main.py" | grep -v grep || echo "FastAPI process not found"

# Wait for FastAPI to be ready
for i in {1..10}; do
    if curl -s http://127.0.0.1:$FASTAPI_PORT/health > /dev/null 2>&1; then
        echo "✅ FastAPI is ready!"
        break
    fi
    echo "⏳ Waiting for FastAPI... ($i/10)"
    if [ $i -eq 5 ]; then
        echo "📋 FastAPI logs so far:"
        cat /tmp/fastapi.log 2>/dev/null || echo "No logs yet"
    fi
    sleep 2
done

# Check if FastAPI started successfully
if ! curl -s http://127.0.0.1:$FASTAPI_PORT/health > /dev/null 2>&1; then
    echo "❌ FastAPI failed to start after 20 seconds"
    echo "📋 Full FastAPI logs:"
    cat /tmp/fastapi.log 2>/dev/null || echo "No FastAPI logs found"
    echo "🔍 Checking if FastAPI process is running:"
    ps aux | grep python3 || echo "No Python processes found"
    echo "🔍 Checking port $FASTAPI_PORT:"
    netstat -tlnp | grep $FASTAPI_PORT || echo "Port $FASTAPI_PORT not in use"
    echo "⚠️ Continuing without FastAPI - Node.js will run in standalone mode..."
    
    # Kill any hanging FastAPI process
    if [ ! -z "$FASTAPI_PID" ]; then
        kill $FASTAPI_PID 2>/dev/null || true
    fi
fi

# Start Node.js on the main port (what Render expects)
echo "🌐 Starting Node.js on port $MAIN_PORT..."
PORT=$MAIN_PORT exec node server.js
