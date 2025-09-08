#!/usr/bin/env python3
"""
Test script to verify OSINT setup
"""

import sys
import os

def test_imports():
    """Test if all required modules can be imported"""
    print("🔍 Testing imports...")
    
    # Add local tool directories to Python path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sherlock'))
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'holehe'))
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ghunt'))
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'maigret'))
    
    imports_to_test = [
        ('requests', 'requests'),
        ('beautifulsoup4', 'bs4'),
        ('colorama', 'colorama'),
        ('termcolor', 'termcolor'),
    ]
    
    all_good = True
    
    for package_name, import_name in imports_to_test:
        try:
            __import__(import_name)
            print(f"✅ {package_name} imported successfully")
        except ImportError as e:
            print(f"❌ {package_name} import failed: {e}")
            all_good = False
    
    return all_good

def test_directories():
    """Test if all required directories exist"""
    print("\n🔍 Testing directory structure...")
    
    required_dirs = ['sherlock', 'holehe', 'ghunt', 'maigret']
    all_good = True
    
    for directory in required_dirs:
        if os.path.exists(directory):
            print(f"✅ {directory}/ directory exists")
        else:
            print(f"❌ {directory}/ directory missing")
            all_good = False
    
    return all_good

def test_files():
    """Test if all required files exist"""
    print("\n🔍 Testing required files...")
    
    required_files = [
        'main.py',
        'requirements.txt',
        'setup_ghunt_auth.py',
        'setup_local_repos.py'
    ]
    
    all_good = True
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path} exists")
        else:
            print(f"❌ {file_path} missing")
            all_good = False
    
    return all_good

def test_ghunt_auth():
    """Test if GHunt authentication files exist"""
    print("\n🔍 Testing GHunt authentication...")
    
    auth_files = [
        'ghunt/tokens.json',
        'ghunt/cookies.json'
    ]
    
    all_good = True
    
    for file_path in auth_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path} exists")
        else:
            print(f"❌ {file_path} missing")
            all_good = False
    
    return all_good

def main():
    """Main test function"""
    print("🚀 OSINT Setup Test")
    print("="*40)
    
    # Run all tests
    tests = [
        test_imports,
        test_directories,
        test_files,
        test_ghunt_auth
    ]
    
    all_passed = True
    for test in tests:
        if not test():
            all_passed = False
    
    print("\n" + "="*40)
    if all_passed:
        print("🎉 All tests passed! Setup is complete.")
        print("You can now run: python main.py test@example.com")
    else:
        print("❌ Some tests failed. Please check the setup.")
        print("Run: python setup_local_repos.py")
        print("Run: python setup_ghunt_auth.py")
    print("="*40)

if __name__ == "__main__":
    main()
