#!/usr/bin/env python3
import subprocess
import json
import re
import os
import sys
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
    """Run CLI tool with multiple fallback methods for Render environment"""
    
    # Method 1: Try direct execution with common paths
    candidates = [
        f"/opt/render/.local/bin/{tool}",
        f"/home/render/.local/bin/{tool}",
        f"/usr/local/bin/{tool}",
        f"/usr/bin/{tool}",
        tool  # Try as-is
    ]
    
    for candidate in candidates:
        try:
            result = subprocess.run(
                [candidate] + args,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd="/",
                env={**os.environ, "PATH": "/opt/render/.local/bin:/home/render/.local/bin:/usr/local/bin:/usr/bin:/bin"}
            )
            if result.returncode == 0 or result.stdout.strip():
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "return_code": result.returncode,
                    "tool": tool,
                    "args": args,
                    "method": f"direct: {candidate}"
                }
        except Exception:
            continue
    
    # Method 2: Try pipx run
    try:
        result = subprocess.run(
            ["pipx", "run", tool] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="/",
            env={**os.environ, "PATH": "/opt/render/.local/bin:/home/render/.local/bin:/usr/local/bin:/usr/bin:/bin"}
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "return_code": result.returncode,
            "tool": tool,
            "args": args,
            "method": "pipx run"
        }
    except Exception:
        pass
    
    # Method 3: Try python -m for Python tools
    if tool in ["ghunt", "holehe", "sherlock", "maigret"]:
        module_map = {
            "ghunt": "ghunt",
            "holehe": "holehe",
            "sherlock": "sherlock",
            "maigret": "maigret"
        }
        
        for python_cmd in ["python3", "python", "/usr/bin/python3"]:
            try:
                result = subprocess.run(
                    [python_cmd, "-m", module_map[tool]] + args,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd="/",
                    env={**os.environ, "PATH": "/opt/render/.local/bin:/home/render/.local/bin:/usr/local/bin:/usr/bin:/bin"}
                )
                if result.returncode == 0 or result.stdout.strip():
                    return {
                        "success": result.returncode == 0,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "return_code": result.returncode,
                        "tool": tool,
                        "args": args,
                        "method": f"python -m: {python_cmd}"
                    }
            except Exception:
                continue
    
    # Method 4: Try shell execution with PATH
    try:
        cmd = f"export PATH='/opt/render/.local/bin:/home/render/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH' && {tool} {' '.join(args)}"
        result = subprocess.run(
            cmd,
            shell=True,
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
            "args": args,
            "method": "shell with PATH"
        }
    except Exception as e:
        pass
    
    # All methods failed
    return {
        "success": False,
        "stdout": "",
        "stderr": f"All execution methods failed for {tool}",
        "return_code": -1,
        "tool": tool,
        "args": args,
        "method": "none"
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

@app.get("/test")
async def test():
    return {"message": "FastAPI is working!", "timestamp": "now"}

@app.get("/health")
async def health():
    return {"status": "healthy", "tools": ["ghunt", "holehe", "sherlock", "maigret"]}

@app.get("/test-tool")
async def test_tool(tool: str = Query(...), value: str = Query(...)):
    """Test a specific tool with debugging output"""
    print(f"🧪 Testing {tool} with value: {value}")
    result = run_cli_tool(tool, [value] if tool != "ghunt" else ["email", value])
    print(f"🧪 {tool} result: {result}")
    return {
        "tool": tool,
        "value": value,
        "success": result["success"],
        "method": result.get("method", "unknown"),
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        "return_code": result["return_code"]
    }

@app.get("/scan/email")
async def scan_email(value: str = Query(..., description="Email address to scan")):
    if not value or '@' not in value:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    results = {"email": value, "holehe": None, "ghunt": None, "timestamp": None}
    
    print(f"🔍 Running holehe on: {value}")
    holehe_result = run_cli_tool("holehe", [value])
    print(f"🔧 Holehe result: success={holehe_result['success']}, method={holehe_result.get('method', 'unknown')}")
    print(f"🔧 Holehe stdout: {holehe_result['stdout'][:200]}...")
    print(f"🔧 Holehe stderr: {holehe_result['stderr'][:200]}...")
    if holehe_result["success"]:
        results["holehe"] = parse_holehe_output(holehe_result["stdout"])
    else:
        results["holehe"] = {"error": holehe_result["stderr"]}
    
    print(f"🔍 Running ghunt on: {value}")
    ghunt_result = run_cli_tool("ghunt", ["email", value])
    print(f"🔧 Ghunt result: success={ghunt_result['success']}, method={ghunt_result.get('method', 'unknown')}")
    print(f"🔧 Ghunt stdout: {ghunt_result['stdout'][:200]}...")
    print(f"🔧 Ghunt stderr: {ghunt_result['stderr'][:200]}...")
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
    
    print(f"🔍 Running sherlock on: {value}")
    sherlock_result = run_cli_tool("sherlock", [value])
    print(f"🔧 Sherlock result: success={sherlock_result['success']}, method={sherlock_result.get('method', 'unknown')}")
    print(f"🔧 Sherlock stdout: {sherlock_result['stdout'][:200]}...")
    print(f"🔧 Sherlock stderr: {sherlock_result['stderr'][:200]}...")
    if sherlock_result["success"]:
        results["sherlock"] = parse_sherlock_output(sherlock_result["stdout"])
    else:
        results["sherlock"] = {"error": sherlock_result["stderr"]}
    
    print(f"🔍 Running maigret on: {value}")
    maigret_result = run_cli_tool("maigret", [value])
    print(f"🔧 Maigret result: success={maigret_result['success']}, method={maigret_result.get('method', 'unknown')}")
    print(f"🔧 Maigret stdout: {maigret_result['stdout'][:200]}...")
    print(f"🔧 Maigret stderr: {maigret_result['stderr'][:200]}...")
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
        print(f"🔍 Running holehe on: {value}")
        holehe_result = run_cli_tool("holehe", [value])
        print(f"🔧 Holehe result: success={holehe_result['success']}, method={holehe_result.get('method', 'unknown')}")
        print(f"🔧 Holehe stdout: {holehe_result['stdout'][:200]}...")
        print(f"🔧 Holehe stderr: {holehe_result['stderr'][:200]}...")
        if holehe_result["success"]:
            results["holehe"] = parse_holehe_output(holehe_result["stdout"])
        else:
            results["holehe"] = {"error": holehe_result["stderr"]}
        
        print(f"🔍 Running ghunt on: {value}")
        ghunt_result = run_cli_tool("ghunt", ["email", value])
        print(f"🔧 Ghunt result: success={ghunt_result['success']}, method={ghunt_result.get('method', 'unknown')}")
        print(f"🔧 Ghunt stdout: {ghunt_result['stdout'][:200]}...")
        print(f"🔧 Ghunt stderr: {ghunt_result['stderr'][:200]}...")
        if ghunt_result["success"]:
            results["ghunt"] = parse_ghunt_output(ghunt_result["stdout"])
        else:
            results["ghunt"] = {"error": ghunt_result["stderr"]}
    
    print(f"🔍 Running sherlock on: {username}")
    sherlock_result = run_cli_tool("sherlock", [username])
    print(f"🔧 Sherlock result: success={sherlock_result['success']}, method={sherlock_result.get('method', 'unknown')}")
    print(f"🔧 Sherlock stdout: {sherlock_result['stdout'][:200]}...")
    print(f"🔧 Sherlock stderr: {sherlock_result['stderr'][:200]}...")
    if sherlock_result["success"]:
        results["sherlock"] = parse_sherlock_output(sherlock_result["stdout"])
    else:
        results["sherlock"] = {"error": sherlock_result["stderr"]}
    
    print(f"🔍 Running maigret on: {username}")
    maigret_result = run_cli_tool("maigret", [username])
    print(f"🔧 Maigret result: success={maigret_result['success']}, method={maigret_result.get('method', 'unknown')}")
    print(f"🔧 Maigret stdout: {maigret_result['stdout'][:200]}...")
    print(f"🔧 Maigret stderr: {maigret_result['stderr'][:200]}...")
    if maigret_result["success"]:
        results["maigret"] = parse_maigret_output(maigret_result["stdout"])
    else:
        results["maigret"] = {"error": maigret_result["stderr"]}
    
    results["timestamp"] = subprocess.run(["date", "-Iseconds"], capture_output=True, text=True).stdout.strip()
    return results

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", 8000))
    print(f"🐍 FastAPI starting on 0.0.0.0:{port}...")
    print(f"🔍 Environment: FASTAPI_PORT={os.getenv('FASTAPI_PORT', '8000')}")
    print(f"🔍 Python path: {sys.executable}")
    print(f"🔍 Working directory: {os.getcwd()}")
    try:
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        print(f"❌ FastAPI startup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
