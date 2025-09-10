#!/bin/bash
set -e

echo "🚀 Starting OSINT Lookup Engine..."

# Test Docker environment
echo "🐳 Testing Docker environment..."
python3 docker_test.py

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

# Test minimal FastAPI app
echo "🧪 Testing minimal FastAPI app..."
python3 test_minimal_fastapi.py || {
    echo "❌ Minimal FastAPI test failed"
    exit 1
}

# Test ultra-simple FastAPI
echo "🧪 Testing ultra-simple FastAPI..."
python3 test_fastapi_simple.py || {
    echo "❌ Ultra-simple FastAPI test failed"
    exit 1
}

# Get the main port from Render
MAIN_PORT=${PORT:-3000}
FASTAPI_PORT=8001  # Try different port to avoid conflicts

# Start FastAPI in background with detailed logging
echo "🐍 Starting FastAPI on port $FASTAPI_PORT..."
echo "🔍 Trying simple FastAPI first..."

# Test if we can run the simple FastAPI
echo "🧪 Testing simple FastAPI startup..."
timeout 10s python3 simple_fastapi.py &
TEST_PID=$!
sleep 3
kill $TEST_PID 2>/dev/null || true

# Start FastAPI in background
FASTAPI_PORT=$FASTAPI_PORT python3 simple_fastapi.py > /tmp/fastapi.log 2>&1 &
FASTAPI_PID=$!

# Give FastAPI time to start
echo "⏳ Waiting for FastAPI to start..."
sleep 3

# Show initial FastAPI logs
echo "📋 Initial FastAPI logs:"
cat /tmp/fastapi.log 2>/dev/null || echo "No logs yet"

# Wait for FastAPI to be ready
for i in {1..30}; do
    if curl -s http://127.0.0.1:$FASTAPI_PORT/health > /dev/null 2>&1; then
        echo "✅ FastAPI is ready!"
        break
    fi
    echo "   Attempt $i/30: FastAPI not ready yet..."
    echo "   FastAPI logs:"
    tail -10 /tmp/fastapi.log 2>/dev/null || echo "   No logs yet"
    echo "   Process status:"
    ps aux | grep python3 | grep -v grep || echo "   No Python processes found"
    echo "   Port status:"
    netstat -tlnp | grep $FASTAPI_PORT || echo "   Port $FASTAPI_PORT not in use"
    sleep 2
done

# Check if FastAPI started successfully
if ! curl -s http://127.0.0.1:$FASTAPI_PORT/health > /dev/null 2>&1; then
    echo "❌ FastAPI failed to start after 60 seconds"
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
