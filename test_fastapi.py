#!/usr/bin/env python3
"""
Test script to verify FastAPI setup
"""
import subprocess
import sys

def test_imports():
    """Test if all required modules can be imported"""
    try:
        import fastapi
        import uvicorn
        import requests
        print("✅ All required modules imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_tools():
    """Test if OSINT tools are available"""
    tools = ["ghunt", "holehe", "sherlock", "maigret"]
    available = []
    
    for tool in tools:
        try:
            result = subprocess.run(["which", tool], capture_output=True, text=True)
            if result.returncode == 0:
                available.append(tool)
                print(f"✅ {tool}: {result.stdout.strip()}")
            else:
                print(f"❌ {tool}: not found")
        except Exception as e:
            print(f"❌ {tool}: error checking - {e}")
    
    return len(available) == len(tools)

def main():
    print("🧪 Testing FastAPI OSINT Engine setup...")
    
    print("\n1. Testing Python imports...")
    imports_ok = test_imports()
    
    print("\n2. Testing OSINT tools...")
    tools_ok = test_tools()
    
    print(f"\n📊 Results:")
    print(f"   Imports: {'✅ OK' if imports_ok else '❌ FAILED'}")
    print(f"   Tools: {'✅ OK' if tools_ok else '❌ FAILED'}")
    
    if imports_ok and tools_ok:
        print("\n🎉 FastAPI setup is ready!")
        return 0
    else:
        print("\n❌ FastAPI setup has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())
