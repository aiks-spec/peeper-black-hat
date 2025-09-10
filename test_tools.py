#!/usr/bin/env python3
import subprocess
import os
import sys

def test_tool(tool, args):
    print(f"\n🔍 Testing {tool} with args: {args}")
    
    # Try different execution methods
    methods = [
        # Method 1: Direct execution
        lambda: subprocess.run([tool] + args, capture_output=True, text=True, timeout=30),
        # Method 2: pipx run
        lambda: subprocess.run(["pipx", "run", tool] + args, capture_output=True, text=True, timeout=30),
        # Method 3: python -m
        lambda: subprocess.run(["python3", "-m", tool] + args, capture_output=True, text=True, timeout=30),
        # Method 4: Shell with PATH
        lambda: subprocess.run(f"export PATH='/opt/render/.local/bin:/home/render/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH' && {tool} {' '.join(args)}", shell=True, capture_output=True, text=True, timeout=30)
    ]
    
    for i, method in enumerate(methods, 1):
        try:
            print(f"  Method {i}: Trying {method.__name__}...")
            result = method()
            print(f"    Return code: {result.returncode}")
            print(f"    Stdout: {result.stdout[:200]}...")
            print(f"    Stderr: {result.stderr[:200]}...")
            if result.returncode == 0 or result.stdout.strip():
                print(f"    ✅ SUCCESS with method {i}")
                return result
        except Exception as e:
            print(f"    ❌ Method {i} failed: {e}")
    
    print(f"  ❌ All methods failed for {tool}")
    return None

if __name__ == "__main__":
    print("🧪 Testing OSINT Tools...")
    
    # Test each tool
    tools_to_test = [
        ("holehe", ["aikyanaskar2006@gmail.com"]),
        ("ghunt", ["email", "aikyanaskar2006@gmail.com"]),
        ("sherlock", ["aikyanaskar2006"]),
        ("maigret", ["aikyanaskar2006"])
    ]
    
    for tool, args in tools_to_test:
        result = test_tool(tool, args)
        if result:
            print(f"✅ {tool} working!")
        else:
            print(f"❌ {tool} not working!")
    
    print("\n🔍 Checking available tools in PATH...")
    try:
        result = subprocess.run(["which", "holehe", "ghunt", "sherlock", "maigret"], capture_output=True, text=True)
        print(f"Available tools: {result.stdout}")
    except:
        print("Could not check which tools are available")
    
    print("\n🔍 Checking pipx installations...")
    try:
        result = subprocess.run(["pipx", "list"], capture_output=True, text=True)
        print(f"Pipx installations: {result.stdout}")
    except:
        print("Could not check pipx installations")
