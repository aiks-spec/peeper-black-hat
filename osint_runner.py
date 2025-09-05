#!/usr/bin/env python3
"""
OSINT Tools Runner for Render Production
Creates a virtual environment, installs OSINT tools, and runs them on an email.
Optimized for Linux environment without root permissions or Docker.
"""

import os
import sys
import subprocess
import venv
import json
from pathlib import Path

def run_command(cmd, cwd=None, timeout=600):
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

def install_packages(venv_path):
    """Install required packages in the virtual environment."""
    python_exe = get_python_executable(venv_path)
    
    packages = [
        "ghunt",
        "holehe", 
        "sherlock-project",
        "maigret"
    ]
    
    print("📦 Installing packages...")
    for package in packages:
        print(f"Installing {package}...")
        stdout, stderr, returncode = run_command(f'"{python_exe}" -m pip install {package} --quiet', timeout=600)
        if returncode == 0:
            print(f"✅ {package} installed successfully")
        else:
            print(f"❌ Failed to install {package}: {stderr}")
    
    print("✅ Package installation completed")

def extract_username_from_email(email):
    """Extract username from email address."""
    if '@' in email:
        return email.split('@')[0]
    return email

def run_osint_tools(venv_path, email):
    """Run all OSINT tools on the provided email and return structured results."""
    python_exe = get_python_executable(venv_path)
    username = extract_username_from_email(email)
    
    # Try different approaches for each tool
    tools = [
        {
            "name": "Holehe",
            "commands": [
                f'"{python_exe}" -c "import holehe; holehe.main([\'{email}\'])"',
                f'"{python_exe}" -m holehe {email}',
                f'holehe {email}'
            ],
            "description": "Email breach checker"
        },
        {
            "name": "Sherlock", 
            "commands": [
                f'"{python_exe}" -c "import sherlock_project; sherlock_project.main([\'{username}\'])"',
                f'"{python_exe}" -m sherlock_project {username}',
                f'sherlock {username}'
            ],
            "description": "Username search across social networks"
        },
        {
            "name": "Maigret",
            "commands": [
                f'"{python_exe}" -c "import maigret; maigret.main([\'{username}\'])"',
                f'"{python_exe}" -m maigret {username}',
                f'maigret {username}'
            ],
            "description": "Username search with advanced techniques"
        },
        {
            "name": "GHunt",
            "commands": [
                f'"{python_exe}" -c "import ghunt; ghunt.main([\'email\', \'{email}\'])"',
                f'"{python_exe}" -m ghunt email {email}',
                f'ghunt email {email}'
            ],
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
        
        success = False
        for i, command in enumerate(tool['commands']):
            print(f"🔄 Trying method {i+1}: {command}")
            stdout, stderr, returncode = run_command(command, timeout=300)
            
            if returncode == 0 and stdout.strip():
                print("✅ Tool completed successfully")
                print("📄 Output:")
                print(stdout)
                results[tool['name'].lower()] = {
                    "success": True,
                    "output": stdout.strip(),
                    "error": None
                }
                success = True
                break
            else:
                print(f"❌ Method {i+1} failed: {stderr.strip() if stderr.strip() else 'No output'}")
        
        if not success:
            print(f"❌ All methods failed for {tool['name']}")
            results[tool['name'].lower()] = {
                "success": False,
                "output": None,
                "error": f"All execution methods failed for {tool['name']}"
            }
        
        print("-" * 40)
    
    return results

def main():
    """Main function."""
    if len(sys.argv) != 2:
        print("Usage: python osint_runner.py <email>")
        print("Example: python osint_runner.py test@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    
    # Validate email format
    if '@' not in email or '.' not in email.split('@')[1]:
        print("❌ Invalid email format")
        sys.exit(1)
    
    print("🚀 OSINT Tools Runner - Production Mode")
    print("=" * 60)
    
    try:
        # Create virtual environment
        venv_path = create_venv()
        
        # Install packages
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
        
        return results
        
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
