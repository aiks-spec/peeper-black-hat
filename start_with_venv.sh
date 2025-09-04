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

# Verify virtual environment structure
if [ ! -f "venv/bin/python" ] && [ ! -f "venv/bin/python3" ]; then
    echo "❌ Virtual environment appears corrupted. Recreating..."
    rm -rf venv
    chmod +x setup_python_env.sh
    ./setup_python_env.sh
    if [ $? -ne 0 ]; then
        echo "❌ Failed to recreate virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Verify activation worked
if [ -z "$VIRTUAL_ENV" ]; then
    echo "❌ Virtual environment activation failed"
    exit 1
fi

echo "✅ Virtual environment activated: $VIRTUAL_ENV"

# Check if packages are installed
echo "🔍 Checking if required packages are installed..."
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📚 Installing missing packages..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install packages"
        exit 1
    fi
fi

echo "🐍 Python version: $(python --version)"
echo "📦 Checking Python packages in virtual environment..."
pip list | grep -E "(sherlock|maigret|holehe|ghunt|phoneinfoga)" || echo "⚠️ Some packages may not be installed"

echo "🔍 Verifying virtual environment Python path..."
echo "Virtual environment Python: $(which python)"
echo "Virtual environment pip: $(which pip)"

# Final verification before starting
echo "🔍 Final package verification..."
python -c "import sherlock; print('✅ Sherlock ready')" || echo "❌ Sherlock not ready"
python -c "import maigret; print('✅ Maigret ready')" || echo "❌ Maigret not ready"
python -c "import holehe; print('✅ Holehe ready')" || echo "❌ Holehe not ready"
python -c "import ghunt; print('✅ GHunt ready')" || echo "❌ GHunt not ready"
python -c "import phoneinfoga; print('✅ PhoneInfoga ready')" || echo "❌ PhoneInfoga not ready"

echo "🔍 Checking command availability in virtual environment..."
which sherlock && echo "✅ Sherlock command available" || echo "❌ Sherlock command not found"
which maigret && echo "✅ Maigret command available" || echo "❌ Maigret command not found"
which holehe && echo "✅ Holehe command available" || echo "❌ Holehe command not found"
which phoneinfoga && echo "✅ PhoneInfoga command available" || echo "❌ PhoneInfoga command not found"

echo "🔍 Skipping external clones; using local tools/ copies"

# Prepare GHunt tokens/cookies from env or uploaded files
echo "🔐 Preparing GHunt credentials..."
node scripts/prepare-ghunt.js || true

# Start the application
echo "🚀 Starting Node.js application..."
node server.js
