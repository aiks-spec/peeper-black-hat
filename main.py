#!/usr/bin/env python3
"""
Unified OSINT Runner Script
Runs Sherlock, Holehe, GHunt, and Maigret from local repositories using subprocess
"""

import sys
import json
import os
import time
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional

class OSINTRunner:
    def __init__(self):
        self.results = {
            'email': '',
            'username': '',
            'timestamp': datetime.now().isoformat(),
            'tools': {
                'holehe': {'success': False, 'output': '', 'error': None},
                'ghunt': {'success': False, 'output': '', 'error': None},
                'sherlock': {'success': False, 'output': '', 'error': None},
                'maigret': {'success': False, 'output': '', 'error': None}
            }
        }
    
    def _tool_script(self, folder: str, script: str) -> str:
        return os.path.join(os.path.dirname(__file__), folder, script)

    def _find_tool_script(self, folder: str, candidates: List[str]) -> Optional[str]:
        base = os.path.join(os.path.dirname(__file__), folder)
        for name in candidates:
            path = os.path.join(base, name)
            if os.path.exists(path):
                return path
        return None

    def _find_any_script(self, candidates: List[List[str]]) -> Optional[str]:
        base = os.path.dirname(__file__)
        for parts in candidates:
            path = os.path.join(base, *parts)
            if os.path.exists(path):
                return path
        return None

    def extract_username(self, email: str) -> str:
        """Extract username from email (part before @)"""
        return email.split('@')[0] if '@' in email else email
    
    def run_subprocess_tool(self, cmd: List[str], tool_name: str) -> Dict[str, Any]:
        """Generic subprocess runner for OSINT tools"""
        try:
            print(f"🔧 Executing: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=os.path.dirname(os.path.abspath(__file__))  # Run from project root
            )
            
            if result.returncode == 0:
                print(f"✅ {tool_name} completed successfully")
                return {
                    'success': True,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'returncode': result.returncode
                }
            else:
                print(f"❌ {tool_name} failed with return code {result.returncode}")
                if result.stdout:
                    preview = result.stdout[:400]
                    print(f"↪ stdout: {preview}")
                if result.stderr:
                    preview = result.stderr[:400]
                    print(f"↪ stderr: {preview}")
                return {
                    'success': False,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'returncode': result.returncode
                }
                
        except subprocess.TimeoutExpired:
            error_msg = f"{tool_name} timed out after 5 minutes"
            print(f"⏰ {error_msg}")
            return {
                'success': False,
                'stdout': '',
                'stderr': error_msg,
                'returncode': -1
            }
        except Exception as e:
            error_msg = f"{tool_name} subprocess error: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                'success': False,
                'stdout': '',
                'stderr': error_msg,
                'returncode': -1
            }
    
    def run_with_module_fallback(self, module_cmd: List[str], script_cmd: List[str], tool_name: str) -> Dict[str, Any]:
        """Try python -m first; if it fails or gives no JSON, run the local script path."""
        first = self.run_subprocess_tool(module_cmd, f"{tool_name} (-m)")
        if first['success'] and (first.get('stdout') or '').strip():
            return first
        # Decide whether to fallback based on common module errors or empty output
        stderr = (first.get('stderr') or '').lower()
        if ('no module named' in stderr) or ('__main__' in stderr) or ('enoent' in stderr) or ('eacces' in stderr) or not (first.get('stdout') or '').strip():
            print(f"🔁 Falling back to script for {tool_name}…")
            return self.run_subprocess_tool(script_cmd, f"{tool_name} (script)")
        return first
    
    def parse_urls_from_text(self, text: str) -> List[Dict[str, str]]:
        """Extract URLs from arbitrary text output and return as list of { url } dicts."""
        if not text:
            return []
        urls: List[Dict[str, str]] = []
        for line in text.split('\n'):
            line = line.strip()
            if not line:
                continue
            if 'http://' in line or 'https://' in line:
                start = line.find('http')
                candidate = line[start:].split()[0]
                # ensure starts with http(s)
                if candidate.startswith('http://') or candidate.startswith('https://'):
                    urls.append({'url': candidate})
        return urls
    
    def run_holehe(self, email: str) -> Dict[str, Any]:
        """Run Holehe on email using subprocess"""
        print(f"🔍 Running Holehe on: {email}")
        
        # Run Holehe from local cloned repo (no --json; capture raw output)
        script_path = self._find_any_script([
            ['holehe', 'holehe', 'core.py'],
            ['holehe', 'cli.py'],
            ['holehe', 'holehe.py']
        ])
        if not script_path:
            tried = 'holehe/holehe/core.py, holehe/cli.py, holehe/holehe.py'
            msg = f"Holehe script missing (tried: {tried})"
            print(f"❌ {msg}")
            self.results['tools']['holehe'] = {
                'success': False,
                'output': '',
                'error': msg
            }
            return {'success': False}
        script_cmd = ['python3', script_path, email]
        result = self.run_subprocess_tool(script_cmd, 'Holehe')
        if result['success']:
            self.results['tools']['holehe'] = {
                'success': True,
                'output': result.get('stdout') or '',
                'error': None
            }
            print("✅ Holehe completed (raw output captured)")
            return {'success': True}
        else:
            self.results['tools']['holehe'] = {
                'success': False,
                'output': result.get('stdout') or '',
                'error': result.get('stderr') or 'Holehe failed'
            }
            print("❌ Holehe failed (raw output captured)")
            return {'success': False}
    
    def run_ghunt(self, email: str) -> Dict[str, Any]:
        """Run GHunt on email using subprocess"""
        print(f"🔍 Running GHunt on: {email}")
        
        # Run GHunt from local cloned repo (no --json; capture raw output)
        script_path = self._find_any_script([
            ['Ghunt', 'main.py'],
            ['Ghunt', 'ghunt', 'ghunt.py'],
            ['ghunt', 'ghunt.py'],
            ['ghunt', '__main__.py']
        ])
        if not script_path:
            tried = 'Ghunt/main.py, Ghunt/ghunt/ghunt.py, ghunt/ghunt.py, ghunt/__main__.py'
            msg = f"GHunt script missing (tried: {tried})"
            print(f"❌ {msg}")
            self.results['tools']['ghunt'] = {
                'success': False,
                'output': '',
                'error': msg
            }
            return {'success': False}
        script_cmd = ['python3', script_path, 'email', email]
        result = self.run_subprocess_tool(script_cmd, 'GHunt')
        if result['success']:
            self.results['tools']['ghunt'] = {
                'success': True,
                'output': result.get('stdout') or '',
                'error': None
            }
            print("✅ GHunt completed (raw output captured)")
            return {'success': True}
        else:
            self.results['tools']['ghunt'] = {
                'success': False,
                'output': result.get('stdout') or '',
                'error': result.get('stderr') or 'GHunt failed'
            }
            print("❌ GHunt failed (raw output captured)")
            return {'success': False}
    
    def run_sherlock(self, username: str) -> Dict[str, Any]:
        """Run Sherlock on username using subprocess"""
        print(f"🔍 Running Sherlock on: {username}")
        
        # Run Sherlock from local cloned repo (no --json; capture raw output)
        script_path = self._find_any_script([
            ['sherlock', 'sherlock_project', 'sherlock.py'],
            ['sherlock', '__main__.py'],
            ['sherlock', 'sherlock.py']
        ])
        if not script_path:
            tried = 'sherlock/sherlock_project/sherlock.py, sherlock/__main__.py, sherlock/sherlock.py'
            msg = f"Sherlock script missing (tried: {tried})"
            print(f"❌ {msg}")
            self.results['tools']['sherlock'] = {
                'success': False,
                'output': '',
                'error': msg
            }
            return {'success': False}
        script_cmd = ['python3', script_path, username]
        result = self.run_subprocess_tool(script_cmd, 'Sherlock')
        if result['success']:
            self.results['tools']['sherlock'] = {
                'success': True,
                'output': result.get('stdout') or '',
                'error': None
            }
            print("✅ Sherlock completed (raw output captured)")
            return {'success': True}
        else:
            self.results['tools']['sherlock'] = {
                'success': False,
                'output': result.get('stdout') or '',
                'error': result.get('stderr') or 'Sherlock failed'
            }
            print("❌ Sherlock failed (raw output captured)")
            return {'success': False}
    
    def run_maigret(self, username: str) -> Dict[str, Any]:
        """Run Maigret on username using subprocess"""
        print(f"🔍 Running Maigret on: {username}")
        
        # Run Maigret from local cloned repo (no --json; capture raw output)
        script_path = self._find_any_script([
            ['maigret', 'maigret', 'maigret.py'],
            ['maigret', 'maigret.py'],
            ['maigret', '__main__.py']
        ])
        if not script_path:
            tried = 'maigret/maigret/maigret.py, maigret/maigret.py, maigret/__main__.py'
            msg = f"Maigret script missing (tried: {tried})"
            print(f"❌ {msg}")
            self.results['tools']['maigret'] = {
                'success': False,
                'output': '',
                'error': msg
            }
            return {'success': False}
        script_cmd = ['python3', script_path, username]
        result = self.run_subprocess_tool(script_cmd, 'Maigret')
        if result['success']:
            self.results['tools']['maigret'] = {
                'success': True,
                'output': result.get('stdout') or '',
                'error': None
            }
            print("✅ Maigret completed (raw output captured)")
            return {'success': True}
        else:
            self.results['tools']['maigret'] = {
                'success': False,
                'output': result.get('stdout') or '',
                'error': result.get('stderr') or 'Maigret failed'
            }
            print("❌ Maigret failed (raw output captured)")
            return {'success': False}
    
    def run_all_tools(self, email: str) -> Dict[str, Any]:
        """Run all OSINT tools on the provided email"""
        print(f"🚀 Starting OSINT analysis for: {email}")
        
        # Set email and extract username
        self.results['email'] = email
        username = self.extract_username(email)
        self.results['username'] = username
        
        print(f"📧 Email: {email}")
        print(f"👤 Username: {username}")
        print("-" * 50)
        
        # Run tools
        start_time = time.time()
        
        # Run email-based tools
        self.run_holehe(email)
        self.run_ghunt(email)
        
        # Run username-based tools
        self.run_sherlock(username)
        self.run_maigret(username)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Add execution summary
        self.results['execution_time'] = round(execution_time, 2)
        # Ensure summary defaults exist
        s = self.results.get('summary', {})
        s.setdefault('total_results', 0)
        s.setdefault('social_profiles', 0)
        s.setdefault('breaches', 0)
        s.setdefault('google_data', 'No')
        s['total_tools'] = 4
        s['successful_tools'] = sum(1 for tool in self.results['tools'].values() if tool.get('success'))
        s['failed_tools'] = sum(1 for tool in self.results['tools'].values() if not tool.get('success'))
        s['total_results'] = s.get('social_profiles', 0) + s.get('breaches', 0)
        s['notes'] = {
            'holehe': 'see raw output',
            'ghunt': 'see raw output',
            'sherlock': 'see raw output',
            'maigret': 'see raw output'
        }
        self.results['summary'] = s
        
        print("-" * 50)
        print(f"⏱️  Total execution time: {execution_time:.2f} seconds")
        print(f"✅ Successful tools: {self.results['summary'].get('successful_tools', 0)}/4")
        print(f"❌ Failed tools: {self.results['summary'].get('failed_tools', 0)}/4")
        print(f"📊 Total results: {self.results['summary'].get('total_results', 0)}")
        
        return self.results
    
    def save_results(self, filename: Optional[str] = None) -> str:
        """Save results to JSON file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"osint_results_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Results saved to: {filename}")
        return filename

def main():
    """Main function"""
    if len(sys.argv) != 2:
        print("Usage: python main.py <email>")
        print("Example: python main.py test@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    
    # Validate email format
    if '@' not in email or '.' not in email.split('@')[1]:
        print("❌ Invalid email format. Please provide a valid email address.")
        sys.exit(1)
    
    # Create runner and execute
    runner = OSINTRunner()
    results = runner.run_all_tools(email)
    
    # Save results
    output_file = runner.save_results()
    
    # Print summary
    print("\n" + "="*60)
    print("🎯 OSINT ANALYSIS COMPLETE")
    print("="*60)
    print(f"📧 Target: {email}")
    print(f"👤 Username: {results['username']}")
    print(f"⏱️  Execution time: {results.get('execution_time', 0)}s")
    print(f"✅ Successful: {results.get('summary', {}).get('successful_tools', 0)}/4 tools")
    print(f"📊 Total results: {results.get('summary', {}).get('total_results', 0)}")
    print(f"💾 Output file: {output_file}")
    print("="*60)
    
    # Return exit code based on success
    if results['summary']['successful_tools'] > 0:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
