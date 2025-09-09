#!/usr/bin/env python3
import subprocess
import json
import re
import os
from typing import Dict, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="OSINT Tools API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_cli_tool(tool: str, args: List[str], timeout: int = 30) -> Dict:
    try:
        result = subprocess.run(
            [tool] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="/"
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "return_code": result.returncode,
            "tool": tool,
            "args": args
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Error running {tool}: {str(e)}",
            "return_code": -1,
            "tool": tool,
            "args": args
        }

def parse_holehe_output(stdout: str) -> Dict:
    results = []
    lines = stdout.split('\n')
    for line in lines:
        if '[' in line and ']' in line:
            match = re.search(r'\[([^\]]+)\]\s+(.+)', line)
            if match:
                site = match.group(1).strip()
                status = match.group(2).strip()
                exists = 'exists' in status.lower() or 'found' in status.lower()
                results.append({"site": site, "exists": exists, "status": status})
    return {"accounts": results, "total": len(results)}

def parse_sherlock_output(stdout: str) -> Dict:
    profiles = []
    lines = stdout.split('\n')
    for line in lines:
        if 'http' in line and '[' in line and ']' in line:
            match = re.search(r'\[([^\]]+)\]\s+(https?://[^\s]+)', line)
            if match:
                site = match.group(1).strip()
                url = match.group(2).strip()
                profiles.append({"site": site, "url": url})
    return {"profiles": profiles, "total": len(profiles)}

def parse_maigret_output(stdout: str) -> Dict:
    profiles = []
    lines = stdout.split('\n')
    for line in lines:
        if 'http' in line:
            urls = re.findall(r'https?://[^\s]+', line)
            for url in urls:
                profiles.append({"url": url})
    return {"profiles": profiles, "total": len(profiles)}

def parse_ghunt_output(stdout: str) -> Dict:
    info = {}
    lines = stdout.split('\n')
    for line in lines:
        if ':' in line:
            parts = line.split(':', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                value = parts[1].strip()
                info[key] = value
    return {"google_info": info}

@app.get("/")
async def root():
    return {"message": "OSINT Tools API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "tools": ["ghunt", "holehe", "sherlock", "maigret"]}

@app.get("/scan/email")
async def scan_email(value: str = Query(..., description="Email address to scan")):
    if not value or '@' not in value:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    results = {"email": value, "holehe": None, "ghunt": None, "timestamp": None}
    
    holehe_result = run_cli_tool("holehe", [value])
    if holehe_result["success"]:
        results["holehe"] = parse_holehe_output(holehe_result["stdout"])
    else:
        results["holehe"] = {"error": holehe_result["stderr"]}
    
    ghunt_result = run_cli_tool("ghunt", ["email", value])
    if ghunt_result["success"]:
        results["ghunt"] = parse_ghunt_output(ghunt_result["stdout"])
    else:
        results["ghunt"] = {"error": ghunt_result["stderr"]}
    
    results["timestamp"] = subprocess.run(["date", "-Iseconds"], capture_output=True, text=True).stdout.strip()
    return results

@app.get("/scan/username")
async def scan_username(value: str = Query(..., description="Username to scan")):
    if not value:
        raise HTTPException(status_code=400, detail="Username required")
    
    results = {"username": value, "sherlock": None, "maigret": None, "timestamp": None}
    
    sherlock_result = run_cli_tool("sherlock", [value])
    if sherlock_result["success"]:
        results["sherlock"] = parse_sherlock_output(sherlock_result["stdout"])
    else:
        results["sherlock"] = {"error": sherlock_result["stderr"]}
    
    maigret_result = run_cli_tool("maigret", [value])
    if maigret_result["success"]:
        results["maigret"] = parse_maigret_output(maigret_result["stdout"])
    else:
        results["maigret"] = {"error": maigret_result["stderr"]}
    
    results["timestamp"] = subprocess.run(["date", "-Iseconds"], capture_output=True, text=True).stdout.strip()
    return results

@app.get("/scan/full")
async def scan_full(value: str = Query(..., description="Email or username to scan with all tools")):
    if not value:
        raise HTTPException(status_code=400, detail="Value required")
    
    is_email = '@' in value
    username = value.split('@')[0] if is_email else value
    
    results = {
        "input": value,
        "type": "email" if is_email else "username",
        "username": username,
        "holehe": None,
        "ghunt": None,
        "sherlock": None,
        "maigret": None,
        "timestamp": None
    }
    
    if is_email:
        holehe_result = run_cli_tool("holehe", [value])
        if holehe_result["success"]:
            results["holehe"] = parse_holehe_output(holehe_result["stdout"])
        else:
            results["holehe"] = {"error": holehe_result["stderr"]}
        
        ghunt_result = run_cli_tool("ghunt", ["email", value])
        if ghunt_result["success"]:
            results["ghunt"] = parse_ghunt_output(ghunt_result["stdout"])
        else:
            results["ghunt"] = {"error": ghunt_result["stderr"]}
    
    sherlock_result = run_cli_tool("sherlock", [username])
    if sherlock_result["success"]:
        results["sherlock"] = parse_sherlock_output(sherlock_result["stdout"])
    else:
        results["sherlock"] = {"error": sherlock_result["stderr"]}
    
    maigret_result = run_cli_tool("maigret", [username])
    if maigret_result["success"]:
        results["maigret"] = parse_maigret_output(maigret_result["stdout"])
    else:
        results["maigret"] = {"error": maigret_result["stderr"]}
    
    results["timestamp"] = subprocess.run(["date", "-Iseconds"], capture_output=True, text=True).stdout.strip()
    return results

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", 8000))
    print(f"🐍 FastAPI starting on 0.0.0.0:{port}...")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
