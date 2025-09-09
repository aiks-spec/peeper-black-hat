#!/usr/bin/env python3
"""
Simple test to verify FastAPI can start
"""
import sys
import subprocess

def test_fastapi():
    print("🔍 Testing FastAPI startup...")
    
    # Test 1: Check if modules can be imported
    try:
        import fastapi
        import uvicorn
        print("✅ FastAPI modules imported successfully")
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    
    # Test 2: Try to start FastAPI with a simple app
    try:
        from fastapi import FastAPI
        app = FastAPI()
        
        @app.get("/test")
        def test():
            return {"status": "ok"}
        
        print("✅ FastAPI app created successfully")
        return True
    except Exception as e:
        print(f"❌ FastAPI app creation failed: {e}")
        return False

if __name__ == "__main__":
    success = test_fastapi()
    sys.exit(0 if success else 1)
