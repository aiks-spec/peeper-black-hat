#!/bin/bash

echo "🚀 Starting OSINT Lookup Engine with virtual environment..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Virtual environment not found. Creating one..."
    chmod +x setup_python_env.sh
    ./setup_python_env.sh
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if packages are installed
echo "🔍 Checking if required packages are installed..."
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📚 Installing missing packages..."
    pip install -r requirements.txt
fi

echo "🐍 Python version: $(python --version)"
echo "📦 Checking Python packages in virtual environment..."
pip list | grep -E "(sherlock|maigret|holehe|ghunt|phoneinfoga)" || echo "⚠️ Some packages may not be installed"

echo "🔍 Verifying virtual environment Python path..."
echo "Virtual environment Python: $(which python)"
echo "Virtual environment pip: $(which pip)"

# Start the application
echo "🚀 Starting Node.js application..."
node server.js
