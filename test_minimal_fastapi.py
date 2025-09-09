#!/usr/bin/env python3
"""
Minimal FastAPI test to verify basic functionality
"""
import sys
import os

def test_minimal_fastapi():
    print("🧪 Testing minimal FastAPI startup...")
    
    try:
        # Test imports
        from fastapi import FastAPI
        import uvicorn
        print("✅ Imports successful")
        
        # Create minimal app
        app = FastAPI()
        
        @app.get("/test")
        def test():
            return {"status": "ok"}
        
        print("✅ App created successfully")
        
        # Test if we can start uvicorn (but don't actually run it)
        print("✅ FastAPI test passed")
        return True
        
    except Exception as e:
        print(f"❌ FastAPI test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_minimal_fastapi()
    sys.exit(0 if success else 1)
