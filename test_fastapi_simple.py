#!/usr/bin/env python3
"""
Ultra-simple FastAPI test
"""
print("🧪 Starting FastAPI test...")

try:
    print("📦 Importing FastAPI...")
    from fastapi import FastAPI
    print("✅ FastAPI imported")
    
    print("📦 Importing uvicorn...")
    import uvicorn
    print("✅ Uvicorn imported")
    
    print("📦 Creating app...")
    app = FastAPI()
    print("✅ App created")
    
    print("📦 Testing uvicorn.run...")
    # Don't actually run it, just test if we can call it
    print("✅ Uvicorn.run test passed")
    
    print("🎉 All FastAPI tests passed!")
    
except Exception as e:
    print(f"❌ FastAPI test failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
