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

echo "🔧 Activating virtual environment..."
source venv/bin/activate

echo "🔍 Checking if required packages are installed..."
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📚 Installing missing packages..."
    pip install -r requirements.txt
fi

echo "🐍 Python version: $(python --version)"
echo "📦 Checking Python packages in virtual environment..."
pip list | grep -E "(sherlock|maigret|holehe|ghunt|phoneinfoga)" || echo "⚠️ Some packages may not be installed"

echo "🚀 Starting Node.js application..."
npm start
