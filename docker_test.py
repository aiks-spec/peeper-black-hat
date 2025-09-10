#!/usr/bin/env python3
"""
Simple test to verify Docker environment
"""
import os
import sys

print("🐳 Docker Environment Test")
print(f"🔍 Python version: {sys.version}")
print(f"🔍 Working directory: {os.getcwd()}")
print(f"🔍 Environment variables:")
for key in ['PORT', 'FASTAPI_PORT', 'NODE_ENV']:
    print(f"   {key}: {os.getenv(key, 'Not set')}")

# Test FastAPI
try:
    import fastapi
    print(f"✅ FastAPI version: {fastapi.__version__}")
except ImportError as e:
    print(f"❌ FastAPI import failed: {e}")

# Test uvicorn
try:
    import uvicorn
    print(f"✅ Uvicorn imported successfully")
except ImportError as e:
    print(f"❌ Uvicorn import failed: {e}")

print("🐳 Docker test completed")
