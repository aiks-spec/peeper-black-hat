#!/usr/bin/env python3
"""
Deployment script for FastAPI OSINT Engine
Ensures clean Python-only deployment
"""
import os
import sys
import subprocess
from pathlib import Path

def clean_old_files():
    """Remove any remaining Node.js files"""
    old_files = [
        "package.json",
        "package-lock.json", 
        "server.js",
        "node_modules",
        "scripts/install_global_tools.sh"
    ]
    
    for file in old_files:
        path = Path(file)
        if path.exists():
            if path.is_dir():
                import shutil
                shutil.rmtree(path)
                print(f"🗑️ Removed directory: {file}")
            else:
                path.unlink()
                print(f"🗑️ Removed file: {file}")

def verify_python_setup():
    """Verify Python setup is correct"""
    required_files = [
        "main.py",
        "requirements.txt",
        "start.py",
        "setup_ghunt.py"
    ]
    
    missing = []
    for file in required_files:
        if not Path(file).exists():
            missing.append(file)
    
    if missing:
        print(f"❌ Missing required files: {', '.join(missing)}")
        return False
    
    print("✅ All required Python files present")
    return True

def main():
    print("🚀 Preparing FastAPI OSINT Engine for deployment...")
    
    # Clean old files
    print("\n1. Cleaning old Node.js files...")
    clean_old_files()
    
    # Verify setup
    print("\n2. Verifying Python setup...")
    if not verify_python_setup():
        return 1
    
    print("\n✅ FastAPI deployment preparation completed!")
    print("Ready for Render deployment")
    return 0

if __name__ == "__main__":
    sys.exit(main())
