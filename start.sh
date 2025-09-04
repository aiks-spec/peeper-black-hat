#!/bin/bash
echo "🚀 Starting OSINT Lookup Engine..."
echo "🐍 Python version: $(python3 --version)"
echo "📦 Checking Python packages..."
pip3 list | grep -E "(sherlock|maigret|holehe|ghunt)" || echo "⚠️ Some packages may not be installed"
echo "🔧 Starting Node.js application..."
npm start
