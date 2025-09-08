#!/usr/bin/env python3
"""
Setup script to help organize local OSINT tool repositories
Run this script to create the proper directory structure
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def create_directory_structure():
    """Create the required directory structure"""
    directories = ['sherlock', 'holehe', 'ghunt', 'maigret']
    
    print("📁 Creating directory structure...")
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"✅ Created directory: {directory}")
        else:
            print(f"📁 Directory already exists: {directory}")

def check_repositories():
    """Check if repositories are properly set up"""
    print("\n🔍 Checking repository setup...")
    
    repos = {
        'sherlock': {
            'files': ['sherlock.py', 'requirements.txt'],
            'url': 'https://github.com/sherlock-project/sherlock.git'
        },
        'holehe': {
            'files': ['holehe.py', 'requirements.txt'],
            'url': 'https://github.com/megadose/holehe.git'
        },
        'ghunt': {
            'files': ['ghunt.py', 'requirements.txt'],
            'url': 'https://github.com/mxrch/GHunt.git'
        },
        'maigret': {
            'files': ['maigret.py', 'requirements.txt'],
            'url': 'https://github.com/soxoj/maigret.git'
        }
    }
    
    missing_repos = []
    
    for repo_name, repo_info in repos.items():
        print(f"\n📂 Checking {repo_name}...")
        
        if not os.path.exists(repo_name):
            print(f"❌ Directory {repo_name} not found")
            missing_repos.append(repo_name)
            continue
        
        # Check for key files
        missing_files = []
        for file in repo_info['files']:
            file_path = os.path.join(repo_name, file)
            if not os.path.exists(file_path):
                missing_files.append(file)
        
        if missing_files:
            print(f"❌ Missing files in {repo_name}: {', '.join(missing_files)}")
            missing_repos.append(repo_name)
        else:
            print(f"✅ {repo_name} appears to be properly set up")
    
    return missing_repos

def print_setup_instructions():
    """Print instructions for setting up local repositories"""
    print("\n" + "="*60)
    print("📋 SETUP INSTRUCTIONS")
    print("="*60)
    print("To complete the setup, you need to manually clone the repositories:")
    print()
    print("1. Clone Sherlock:")
    print("   git clone https://github.com/sherlock-project/sherlock.git")
    print("   mv sherlock/* ./sherlock/")
    print()
    print("2. Clone Holehe:")
    print("   git clone https://github.com/megadose/holehe.git")
    print("   mv holehe/* ./holehe/")
    print()
    print("3. Clone GHunt:")
    print("   git clone https://github.com/mxrch/GHunt.git")
    print("   mv GHunt/* ./ghunt/")
    print()
    print("4. Clone Maigret:")
    print("   git clone https://github.com/soxoj/maigret.git")
    print("   mv maigret/* ./maigret/")
    print()
    print("5. Set up GHunt authentication:")
    print("   - Copy your cookies.json to ./ghunt/cookies.json")
    print("   - Copy your tokens.json to ./ghunt/tokens.json")
    print()
    print("6. Install dependencies:")
    print("   pip install -r requirements.txt")
    print()
    print("7. Test the setup:")
    print("   python main.py test@example.com")
    print("="*60)

def main():
    """Main setup function"""
    print("🚀 OSINT Local Repository Setup")
    print("="*40)
    
    # Create directory structure
    create_directory_structure()
    
    # Check repositories
    missing_repos = check_repositories()
    
    if missing_repos:
        print(f"\n⚠️  Missing repositories: {', '.join(missing_repos)}")
        print_setup_instructions()
    else:
        print("\n✅ All repositories appear to be properly set up!")
        print("You can now run: python main.py test@example.com")

if __name__ == "__main__":
    main()
