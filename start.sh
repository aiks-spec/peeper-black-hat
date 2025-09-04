#!/bin/bash
echo "🚀 Starting OSINT Lookup Engine..."
echo "🐍 Python version: $(python3 --version)"
echo "📦 Checking Python packages..."
pip3 list | grep -E "(ghunt)" || echo "⚠️ GHunt package may not be installed"
echo "🐳 OSINT tools (Sherlock, Maigret, Holehe, PhoneInfoga) now use Docker containers"
echo "🔧 Starting Node.js application..."
npm start
