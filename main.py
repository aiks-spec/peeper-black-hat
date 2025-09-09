#!/usr/bin/env python3
import os
import json
import subprocess
from datetime import datetime
from pathlib import Path
import shutil
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="OSINT Lookup Engine", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(exist_ok=True)

def run_tool(tool_name: str, args: list, timeout: int = 300):
    try:
        tool_path = shutil.which(tool_name)
        if not tool_path:
            return {"success": False, "error": f"Tool '{tool_name}' not found in PATH", "output": "", "tool_path": None}
        
        result = subprocess.run([tool_name] + args, capture_output=True, text=True, timeout=timeout, env={**os.environ, "NO_COLOR": "1", "PYTHONUNBUFFERED": "1"})
        return {"success": result.returncode == 0, "output": result.stdout, "error": result.stderr, "return_code": result.returncode, "tool_path": tool_path}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Tool '{tool_name}' timed out after {timeout} seconds", "output": "", "tool_path": tool_path if 'tool_path' in locals() else None}
    except Exception as e:
        return {"success": False, "error": str(e), "output": "", "tool_path": tool_path if 'tool_path' in locals() else None}

def extract_username_from_email(email: str) -> str:
    return email.split('@')[0]

def save_results(results: dict, target: str, search_type: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{search_type}_{target}_{timestamp}.json"
    filepath = RESULTS_DIR / filename
    with open(filepath, 'w') as f:
        json.dump(results, f, indent=2)
    return str(filepath)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "service": "OSINT Lookup Engine"}

@app.get("/osint/email")
async def osint_email_lookup(target: str = Query(..., description="Email address to investigate")):
    if not target or '@' not in target:
        raise HTTPException(status_code=400, detail="Valid email address required")
    
    username = extract_username_from_email(target)
    results = {"target": target, "username": username, "search_type": "email", "timestamp": datetime.now().isoformat(), "tools": {}}
    
    print(f"🔍 Running holehe on {target}")
    results["tools"]["holehe"] = run_tool("holehe", [target])
    
    print(f"🔍 Running ghunt on {target}")
    results["tools"]["ghunt"] = run_tool("ghunt", ["email", target])
    
    print(f"🔍 Running sherlock on {username}")
    results["tools"]["sherlock"] = run_tool("sherlock", [username])
    
    print(f"🔍 Running maigret on {username}")
    results["tools"]["maigret"] = run_tool("maigret", [username])
    
    filepath = save_results(results, target.replace('@', '_at_'), "email")
    results["results_file"] = filepath
    
    successful_tools = sum(1 for tool in results["tools"].values() if tool["success"])
    results["summary"] = {"total_tools": len(results["tools"]), "successful_tools": successful_tools, "target": target, "username": username}
    
    return JSONResponse(content=results)

@app.get("/osint/username")
async def osint_username_lookup(target: str = Query(..., description="Username to investigate")):
    if not target:
        raise HTTPException(status_code=400, detail="Username required")
    
    results = {"target": target, "search_type": "username", "timestamp": datetime.now().isoformat(), "tools": {}}
    
    print(f"🔍 Running sherlock on {target}")
    results["tools"]["sherlock"] = run_tool("sherlock", [target])
    
    print(f"🔍 Running maigret on {target}")
    results["tools"]["maigret"] = run_tool("maigret", [target])
    
    filepath = save_results(results, target, "username")
    results["results_file"] = filepath
    
    successful_tools = sum(1 for tool in results["tools"].values() if tool["success"])
    results["summary"] = {"total_tools": len(results["tools"]), "successful_tools": successful_tools, "target": target}
    
    return JSONResponse(content=results)

@app.get("/tools/status")
async def tools_status():
    tools = ["holehe", "ghunt", "sherlock", "maigret"]
    status = {}
    for tool in tools:
        tool_path = shutil.which(tool)
        status[tool] = {"available": tool_path is not None, "path": tool_path, "version": None}
        if tool_path:
            try:
                version_result = run_tool(tool, ["--version"], timeout=10)
                if version_result["success"]:
                    status[tool]["version"] = version_result["output"].strip()
            except:
                pass
    return JSONResponse(content=status)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
