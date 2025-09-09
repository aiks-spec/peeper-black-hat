#!/usr/bin/env python3
"""
GHunt Authentication Setup Script
Helps set up GHunt authentication with provided cookies and tokens
"""

import os
import json
import base64
from pathlib import Path

def setup_ghunt_auth():
    """Set up GHunt authentication files"""
    print("🔐 Setting up GHunt authentication...")
    
    # Create ghunt directory if it doesn't exist
    ghunt_dir = Path("ghunt")
    ghunt_dir.mkdir(exist_ok=True)
    
    # GHunt token (from your previous messages)
    ghunt_token = "oauth2_4/0AVMBsJhZXoYyYy5MPJGQlj-LqpmiBcq8p17KvkDqp0WaD73nHGL4hH3gpZtmtz8Dm8C1Bg"
    
    # GHunt cookies (base64 encoded from your previous messages)
    ghunt_cookies_b64 = "eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDFBanlHeVhfNVR2Rm1vMEtZOFBaM3N3cTdkejJ4RUI0eWhzVG12SGJFV1JJUE5BQk5RS1cwOERGVmRaWng5bm50elJGMUFBQ2dZS0FTb1NBUkFTRlFIR1gyTWl6S1daWTN0RmhDbFVEVzBLTENhNnhSb1ZBVUY4eUtvTkR4RTJxcnhXVFJaVkE5cWJHVHE5MDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMUFqeUd5WF81VHZGbW8wS1k4UFozc3dxN2R6MnhFQjR5aHNUbXZIYkVXUklQTkFCMnp1Q09WLUF0SEFUcFdGRU1xdWhDQUFDZ1lLQVp3U0FSQVNGUUhHWDJNaWFwd05KUUVpYVhqUWxLLTY1ZS1RYkJvVkFVRjh5S3JBbE1rLWNZektQYXJvUURwVW5FRFcwMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMUFqeUd3ZXllWFhVb184WnBOLVoyLTFnT2lWQVFHQkNYemE3V0pzXzhDaXE3eDE3bTZnSnhEaUFHWU92Q3BpVjZvQUhJUUFDZ1lLQVl3U0FSQVNGUUhHWDJNaVBPVlRvWDB1RUhfeVhqQ2dwSGJyYlJvVkFVRjh5S3FjRzF1UWZfaFVhNTJjWWZ4TlZlQkYwMDc2IiwiSFNJRCI6IkFnUUlOdXVndGhwX3JuXzlUIiwiU1NJRCI6IkFwMGVwdW5KalZDelpQeHRqIiwiQVBJU0lEIjoiTFN3X0h0dmFNZ1VkR3NKNi9BWGRVQ1F2UGw1NW1jc2lwdiIsIlNBUElTSUQiOiJDWTF3UFJHXzYzQ0dOMjd6L0FYQ3J4Z0Z4OHhpTVpqSkdlIn0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmhaWG9ZeVl5NU1QSkdRbGotTHFwbWlCY3E4cDE3S3ZrRHFwMFdhRDczbkhHTDRoSDNncFp0bXR6OERtOEMxQmcifQ=="
    
    try:
        # Decode cookies
        cookies_json = base64.b64decode(ghunt_cookies_b64).decode('utf-8')
        cookies_data = json.loads(cookies_json)
        
        # Create tokens.json
        tokens_data = {
            "oauth_token": ghunt_token
        }
        
        tokens_file = ghunt_dir / "tokens.json"
        with open(tokens_file, 'w') as f:
            json.dump(tokens_data, f, indent=2)
        print(f"✅ Created tokens.json: {tokens_file}")
        
        # Create cookies.json
        cookies_file = ghunt_dir / "cookies.json"
        with open(cookies_file, 'w') as f:
            json.dump(cookies_data, f, indent=2)
        print(f"✅ Created cookies.json: {cookies_file}")
        
        # Create config directory structure that GHunt expects
        config_dir = Path.home() / ".config" / "ghunt"
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy files to config directory
        import shutil
        shutil.copy2(tokens_file, config_dir / "tokens.json")
        shutil.copy2(cookies_file, config_dir / "cookies.json")
        
        print(f"✅ Copied auth files to: {config_dir}")
        print("🔐 GHunt authentication setup complete!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up GHunt authentication: {e}")
        return False

def verify_setup():
    """Verify that the setup is correct"""
    print("\n🔍 Verifying setup...")
    
    # Check if files exist
    files_to_check = [
        "ghunt/tokens.json",
        "ghunt/cookies.json",
        "main.py",
        "requirements.txt"
    ]
    
    all_good = True
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"✅ {file_path} exists")
        else:
            print(f"❌ {file_path} missing")
            all_good = False
    
    # Check if directories exist
    dirs_to_check = ["sherlock", "holehe", "ghunt", "maigret"]
    for dir_path in dirs_to_check:
        if os.path.exists(dir_path):
            print(f"✅ {dir_path}/ directory exists")
        else:
            print(f"❌ {dir_path}/ directory missing")
            all_good = False
    
    return all_good

def main():
    """Main function"""
    print("🚀 GHunt Authentication Setup")
    print("="*40)
    
    # Set up authentication
    if setup_ghunt_auth():
        # Verify setup
        if verify_setup():
            print("\n🎉 Setup complete! You can now run:")
            print("   python main.py test@example.com")
        else:
            print("\n⚠️  Setup incomplete. Please check the missing files/directories.")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
