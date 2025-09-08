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
    ghunt_token = "oauth2_4/0AVMBsJihaCHpsqoEm3L-M7XKc_3kEWEVvqBP4Jzm14hCBOsHKqcI9mm-y0GA0iVO_6jtLw"
    
    # GHunt cookies (base64 encoded from your previous messages)
    ghunt_cookies_b64 = "eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDB3anlHMXVCT0FKQWQtUGVIWlUwVFo4RkZGeFdZenZzRnphYTBON1NEZElRcHZGTjZsYlIyY010Z0VUTlpLXy1HSGpOTHdBQ2dZS0FYb1NBUkFTRlFIR1gyTWlkemlvN0gxU2pEazBpcm4tUEN3MzN4b1ZBVUY4eUtvbXZncmZKSWh0bVJRYTBwTlVjd3YyMDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMHdqeUcxdUJPQUpBZC1QZUhaVTBUWjhGRkZ4V1l6dnNGemFhME43U0RkSVFwdkZOMTNYX2cxRDB3SXVSTi1lT3pRTnpjQUFDZ1lLQWNFU0FSQVNGUUhHWDJNaUdTY0lpMktxa3A1WVgzRVZBUU40TVJvVkFVRjh5S3BSWGxxY3huQlE2aGNQTmtCVjZFRngwMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMHdqeUc2dmJ1LTRyWUJHSTZ1aE5hU1ZsekVIZjN4OGJHV2tTdmYwNWxtS2J5eEFSRGpCbVJlSmd2TUkybDlaQmVZdjAyd0FDZ1lLQWQwU0FSQVNGUUhHWDJNaUdTbU1yQ1dtMUhCcU5hVnVhQ3A5S1JvVkFVRjh5S3F5R0MxdHJDUmp3R204clFGcTJHTnYwMDc2IiwiSFNJRCI6IkFkYlQ4aXZxVzMwbjBMQkpwIiwiU1NJRCI6IkE0TkNnYkEzTVNYQWhCVV8tIiwiQVBJU0lEIjoiMU9oOEc1Rm5XV1FCY3ZrdC9BODBGVmVBbjltdUU5aUlZWCIsIlNBUElTSUQiOiItTExlWnNFNmJGTlFMY042L0FCMG1rTF9xNTJqQ0ZwTWUxIn0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmloYUNIcHNxb0VtM0wtTTdYS2NfM2tFV0VWdnFCUDRKem0xNGhDQk9zSEtxY0k5bW0teTBHQTBpVk9fNmp0THcifQ=="
    
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
