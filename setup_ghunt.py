#!/usr/bin/env python3
"""
GHunt authentication setup script
Automatically configures GHunt with provided credentials
"""
import os
import subprocess
import time
import pexpect
from pathlib import Path

def setup_ghunt_auth():
    """Setup GHunt authentication using oauth token (option 3)"""
    token = os.environ.get('GHUNT_TOKEN', '').strip()
    
    if not token:
        print("❌ No GHUNT_TOKEN environment variable found")
        return False
    
    # Create GHunt config directory
    config_dir = Path.home() / '.config' / 'ghunt'
    config_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"🔧 Setting up GHunt authentication with token...")
    
    try:
        # Use pexpect for non-interactive login
        child = pexpect.spawn('ghunt login', encoding='utf-8', timeout=60)
        child.expect('Choice =>')
        child.sendline('3')  # Select oauth token option
        time.sleep(2.0)
        child.expect(['oauth', 'token', '=>'], timeout=60)
        child.sendline(token)
        time.sleep(2.0)
        child.sendline('')  # Press Enter
        time.sleep(3.0)
        child.expect(pexpect.EOF, timeout=180)
        
        print("✅ GHunt authentication completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ GHunt authentication failed: {e}")
        return False

if __name__ == "__main__":
    setup_ghunt_auth()
