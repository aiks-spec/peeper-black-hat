#!/usr/bin/env python3
"""
OSINT Tools Runner
Creates a virtual environment, installs OSINT tools, and runs them on an email.
Works on Linux without root permissions or Docker.
"""

import os
import sys
import subprocess
import venv
import tempfile
import shutil
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
            timeout=timeout
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

def get_pip_executable(venv_path):
    """Get the pip executable path for the virtual environment."""
    if os.name == 'nt':  # Windows
        return venv_path / "Scripts" / "pip.exe"
    else:  # Linux/Unix
        return venv_path / "bin" / "pip"

def install_packages(venv_path):
    """Install required packages in the virtual environment."""
    python_exe = get_python_executable(venv_path)
    pip_exe = get_pip_executable(venv_path)
    
    packages = [
        "ghunt",
        "holehe", 
        "sherlock-project",
        "maigret"
    ]
    
    print("📦 Installing packages...")
    for package in packages:
        print(f"Installing {package}...")
        stdout, stderr, returncode = run_command(f'"{python_exe}" -m pip install {package}', timeout=300)
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
    """Run all OSINT tools on the provided email."""
    python_exe = get_python_executable(venv_path)
    username = extract_username_from_email(email)
    
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
    
    for tool in tools:
        print(f"\n🔧 Running {tool['name']} ({tool['description']})")
        print("-" * 40)
        
        stdout, stderr, returncode = run_command(tool['command'], timeout=300)
        
        if returncode == 0:
            print("✅ Tool completed successfully")
            if stdout.strip():
                print("📄 Output:")
                print(stdout)
            else:
                print("ℹ️  No output generated")
        else:
            print(f"❌ Tool failed with return code {returncode}")
            if stderr.strip():
                print("📄 Error output:")
                print(stderr)
        
        print("-" * 40)

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
    
    print("🚀 OSINT Tools Runner")
    print("=" * 60)
    
    try:
        # Create virtual environment
        venv_path = create_venv()
        
        # Install packages
        install_packages(venv_path)
        
        # Run OSINT tools
        run_osint_tools(venv_path, email)
        
        print("\n✅ OSINT analysis completed!")
        print(f"💡 Virtual environment saved at: {venv_path}")
        print("💡 You can reuse it for future runs to avoid reinstalling packages")
        
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
