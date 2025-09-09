#!/usr/bin/env python3
"""
Verification script for FastAPI OSINT Engine
Ensures all required files are present and properly configured
"""
import os
import sys
from pathlib import Path

def check_files():
    """Check if all required files are present"""
    required_files = [
        "main.py",
        "requirements.txt", 
        "render.yaml",
        "start.py",
        "setup_ghunt.py",
        "test_fastapi.py",
        "README.md",
        "Dockerfile"
    ]
    
    missing = []
    for file in required_files:
        if not Path(file).exists():
            missing.append(file)
    
    return missing

def check_render_yaml():
    """Check if render.yaml is properly configured for FastAPI"""
    try:
        with open("render.yaml", "r") as f:
            content = f.read()
            
        checks = [
            "env: python" in content,
            "pip install" in content,
            "pipx install" in content,
            "python main.py" in content or "python start.py" in content,
            "install_global_tools" not in content
        ]
        
        return all(checks)
    except:
        return False

def main():
    print("🔍 Verifying FastAPI OSINT Engine setup...")
    
    # Check files
    print("\n1. Checking required files...")
    missing_files = check_files()
    if missing_files:
        print(f"❌ Missing files: {', '.join(missing_files)}")
        return 1
    else:
        print("✅ All required files present")
    
    # Check render.yaml
    print("\n2. Checking render.yaml configuration...")
    if check_render_yaml():
        print("✅ render.yaml properly configured for FastAPI")
    else:
        print("❌ render.yaml configuration issues")
        return 1
    
    # Check for old files
    print("\n3. Checking for old Node.js files...")
    old_files = ["package.json", "server.js", "scripts/install_global_tools.sh"]
    found_old = []
    for file in old_files:
        if Path(file).exists():
            found_old.append(file)
    
    if found_old:
        print(f"⚠️ Old files still present: {', '.join(found_old)}")
        print("   These should be backed up or removed")
    else:
        print("✅ No old Node.js files found")
    
    print("\n🎉 FastAPI setup verification completed!")
    print("Ready for deployment to Render")
    return 0

if __name__ == "__main__":
    sys.exit(main())
