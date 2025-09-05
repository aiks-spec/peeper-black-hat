#!/usr/bin/env python3
"""
OSINT Tools Runner for Render Free Plan
Creates a virtual environment, installs OSINT tools from GitHub, and runs them on an email.
Optimized for Linux environment without root permissions or Docker.
"""

import os
import sys
import subprocess
import venv
import json
import base64
from pathlib import Path

def run_command(cmd, cwd=None, timeout=300):
    """Run a command and return stdout, stderr, and return code."""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            cwd=cwd,
            capture_output=True, 
            text=True, 
            timeout=timeout,
            env={**os.environ, 'PYTHONUNBUFFERED': '1', 'NO_COLOR': '1'}
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1

def create_venv():
    """Create a virtual environment in the current directory."""
    venv_path = Path("osint_venv")
    
    if venv_path.exists():
        print("✅ Virtual environment already exists")
        return venv_path
    
    print("🐍 Creating virtual environment...")
    venv.create(venv_path, with_pip=True)
    print(f"✅ Virtual environment created at {venv_path}")
    return venv_path

def get_python_executable(venv_path):
    """Get the Python executable path for the virtual environment."""
    if os.name == 'nt':  # Windows
        return venv_path / "Scripts" / "python.exe"
    else:  # Linux/Unix
        return venv_path / "bin" / "python"

def setup_ghunt_config(venv_path):
    """Setup GHunt configuration from environment variables."""
    # Find the correct Python version directory dynamically
    lib_dir = venv_path / "lib"
    python_dirs = [d for d in lib_dir.iterdir() if d.is_dir() and d.name.startswith('python')]
    
    if not python_dirs:
        print("⚠️ No Python version directory found in venv")
        return
    
    python_version_dir = python_dirs[0]  # Use the first (and likely only) Python version
    ghunt_config_dir = python_version_dir / "site-packages" / "ghunt" / "config"
    ghunt_config_dir.mkdir(parents=True, exist_ok=True)
    print(f"🔧 GHunt config directory: {ghunt_config_dir}")
    
    # Setup GHunt token
    ghunt_token = os.environ.get('GHUNT_TOKEN')
    if ghunt_token:
        token_file = ghunt_config_dir / "tokens.json"
        token_data = {"oauth_token": ghunt_token}
        with open(token_file, 'w') as f:
            json.dump(token_data, f)
        print("✅ GHunt token configured")
    
    # Setup GHunt cookies
    ghunt_cookies_b64 = os.environ.get('GHUNT_COOKIES_B64')
    if ghunt_cookies_b64:
        try:
            cookies_data = base64.b64decode(ghunt_cookies_b64).decode('utf-8')
            cookies_file = ghunt_config_dir / "cookies.json"
            with open(cookies_file, 'w') as f:
                f.write(cookies_data)
            print("✅ GHunt cookies configured")
        except Exception as e:
            print(f"⚠️ Failed to decode GHunt cookies: {e}")

def install_packages(venv_path):
    """Install required packages from GitHub repositories."""
    python_exe = get_python_executable(venv_path)
    
    # GitHub repository URLs for each tool
    packages = [
        "git+https://github.com/sherlock-project/sherlock.git",
        "git+https://github.com/megadose/holehe.git", 
        "git+https://github.com/soxoj/maigret.git",
        "git+https://github.com/mxrch/GHunt.git"
    ]
    
    print("📦 Installing packages from GitHub repositories...")
    for package in packages:
        tool_name = package.split('/')[-1].replace('.git', '')
        print(f"Installing {tool_name}...")
        stdout, stderr, returncode = run_command(f'"{python_exe}" -m pip install {package} --quiet', timeout=600)
        if returncode == 0:
            print(f"✅ {tool_name} installed successfully")
        else:
            print(f"❌ Failed to install {tool_name}: {stderr}")
    
    print("✅ Package installation completed")
    
    # Setup GHunt configuration after installation
    setup_ghunt_config(venv_path)

def extract_username_from_email(email):
    """Extract username from email address."""
    if '@' in email:
        return email.split('@')[0]
    return email

def run_osint_tools(venv_path, email):
    """Run all OSINT tools on the provided email and return structured results."""
    python_exe = get_python_executable(venv_path)
    username = extract_username_from_email(email)
    
    # Tool configurations with proper module names
    tools = [
        {
            "name": "Holehe",
            "command": f'"{python_exe}" -m holehe {email}',
            "description": "Email breach checker"
        },
        {
            "name": "Sherlock", 
            "command": f'"{python_exe}" -m sherlock {username}',
            "description": "Username search across social networks"
        },
        {
            "name": "Maigret",
            "command": f'"{python_exe}" -m maigret {username}',
            "description": "Username search with advanced techniques"
        },
        {
            "name": "GHunt",
            "command": f'"{python_exe}" -m ghunt email {email}',
            "description": "Google account information gathering"
        }
    ]
    
    print(f"\n🔍 Running OSINT tools on: {email}")
    print(f"👤 Username extracted: {username}")
    print("=" * 60)
    
    results = {}
    
    for tool in tools:
        print(f"\n🔧 Running {tool['name']} ({tool['description']})")
        print("-" * 40)
        print(f"Command: {tool['command']}")
        
        stdout, stderr, returncode = run_command(tool['command'], timeout=300)
        
        if returncode == 0:
            print("✅ Tool completed successfully")
            if stdout.strip():
                print("📄 Output:")
                print(stdout)
                results[tool['name'].lower()] = {
                    "success": True,
                    "output": stdout.strip(),
                    "error": None
                }
            else:
                print("ℹ️  No output generated")
                results[tool['name'].lower()] = {
                    "success": True,
                    "output": "No results found",
                    "error": None
                }
        else:
            print(f"❌ Tool failed with return code {returncode}")
            if stderr.strip():
                print("📄 Error output:")
                print(stderr)
            results[tool['name'].lower()] = {
                "success": False,
                "output": None,
                "error": stderr.strip() if stderr.strip() else f"Tool failed with return code {returncode}"
            }
        
        print("-" * 40)
    
    return results

def main():
    """Main function."""
    try:
        print("🔧 Starting OSINT runner script...")
        print(f"🔧 Python version: {sys.version}")
        print(f"🔧 Script arguments: {sys.argv}")
        
        if len(sys.argv) != 2:
            print("Usage: python osint_runner.py <email>")
            print("Example: python osint_runner.py test@example.com")
            sys.exit(1)
        
        email = sys.argv[1]
        print(f"🔧 Email received: {email}")
        
        # Validate email format
        if '@' not in email or '.' not in email.split('@')[1]:
            print("❌ Invalid email format")
            sys.exit(1)
        
        print("🚀 OSINT Tools Runner - Render Free Plan Mode")
        print("=" * 60)
        
        # Create virtual environment
        venv_path = create_venv()
        
        # Install packages from GitHub
        install_packages(venv_path)
        
        # Run OSINT tools
        results = run_osint_tools(venv_path, email)
        
        print("\n✅ OSINT analysis completed!")
        print(f"💡 Virtual environment saved at: {venv_path}")
        
        # Output results in JSON format for easy parsing
        print("\n📊 RESULTS SUMMARY:")
        print("=" * 60)
        for tool_name, result in results.items():
            status = "✅ SUCCESS" if result['success'] else "❌ FAILED"
            print(f"{tool_name.upper()}: {status}")
            if result['success'] and result['output']:
                print(f"  Output: {result['output'][:100]}{'...' if len(result['output']) > 100 else ''}")
            elif not result['success'] and result['error']:
                print(f"  Error: {result['error'][:100]}{'...' if len(result['error']) > 100 else ''}")
        
        # Also output structured JSON for programmatic access
        print("\n🔧 JSON OUTPUT:")
        print("=" * 60)
        print(json.dumps(results, indent=2))
        
        return results
        
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ An error occurred in main: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
