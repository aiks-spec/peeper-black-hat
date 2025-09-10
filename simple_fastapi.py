#!/usr/bin/env python3
"""
Simple FastAPI server for testing
"""
import os
import sys
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok", "message": "FastAPI is running"}

@app.get("/test")
def test():
    return {"message": "Test endpoint working"}

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", 8001))
    print(f"🐍 Simple FastAPI starting on 0.0.0.0:{port}...")
    print(f"🔍 Environment: FASTAPI_PORT={os.getenv('FASTAPI_PORT', '8001')}")
    print(f"🔍 Python path: {sys.executable}")
    print(f"🔍 Working directory: {os.getcwd()}")
    print(f"🔍 Port binding test...")
    
    try:
        # Test if we can bind to the port
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('0.0.0.0', port))
        sock.close()
        print(f"✅ Port {port} is available")
        
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        print(f"❌ Simple FastAPI startup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
