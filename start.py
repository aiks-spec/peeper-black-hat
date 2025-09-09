#!/usr/bin/env python3
"""
Startup script for FastAPI OSINT Engine
Ensures proper setup and starts the server
"""
import os
import sys
import subprocess
from pathlib import Path

def check_tools():
    """Check if OSINT tools are available"""
    tools = ["ghunt", "holehe", "sherlock", "maigret"]
    missing = []
    
    for tool in tools:
        try:
            result = subprocess.run(["which", tool], capture_output=True, text=True)
            if result.returncode != 0:
                missing.append(tool)
        except:
            missing.append(tool)
    
    return missing

def setup_ghunt():
    """Setup GHunt authentication if needed"""
    try:
        from setup_ghunt import setup_ghunt_auth
        return setup_ghunt_auth()
    except Exception as e:
        print(f"⚠️ GHunt setup failed: {e}")
        return False

def main():
    print("🚀 Starting FastAPI OSINT Engine...")
    
    # Check tools
    missing_tools = check_tools()
    if missing_tools:
        print(f"❌ Missing tools: {', '.join(missing_tools)}")
        print("Please ensure tools are installed via pipx")
        return 1
    
    print("✅ All OSINT tools available")
    
    # Setup GHunt
    print("🔧 Setting up GHunt authentication...")
    setup_ghunt()
    
    # Start FastAPI
    print("🐍 Starting FastAPI server...")
    os.execv(sys.executable, [sys.executable, "main.py"])

if __name__ == "__main__":
    sys.exit(main())
