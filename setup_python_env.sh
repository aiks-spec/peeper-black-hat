#!/bin/bash

echo "🐍 Setting up Python virtual environment for OSINT tools..."

# Check if Python3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

echo "✅ Python3 found: $(python3 --version)"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install required packages
echo "📚 Installing required packages from requirements.txt..."
pip install -r requirements.txt

# Verify installations
echo "🔍 Verifying installations..."
echo "Sherlock: $(python -c 'import sherlock; print("✅ Installed")' 2>/dev/null || echo "❌ Not found")"
echo "Maigret: $(python -c 'import maigret; print("✅ Installed")' 2>/dev/null || echo "❌ Not found")"
echo "Holehe: $(python -c 'import holehe; print("✅ Installed")' 2>/dev/null || echo "❌ Not found")"
echo "GHunt: $(python -c 'import ghunt; print("✅ Installed")' 2>/dev/null || echo "❌ Not found")"
echo "PhoneInfoga: $(python -c 'import phoneinfoga; print("✅ Installed")' 2>/dev/null || echo "❌ Not found")"

echo "✅ Python environment setup complete!"
echo "💡 To activate the virtual environment, run: source venv/bin/activate"
echo "💡 To run the application with the virtual environment, update your start command to use: ./venv/bin/python3"
