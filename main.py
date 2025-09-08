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
                'holehe': {'success': False, 'data': [], 'error': None},
                'ghunt': {'success': False, 'data': {}, 'error': None},
                'sherlock': {'success': False, 'data': [], 'error': None},
                'maigret': {'success': False, 'data': [], 'error': None}
            }
        }
    
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
    
    def run_holehe(self, email: str) -> Dict[str, Any]:
        """Run Holehe on email using subprocess"""
        print(f"🔍 Running Holehe on: {email}")
        
        # Try module first, then local script as fallback
        module_cmd = ['python3', '-m', 'holehe', email, '--json']
        script_cmd = ['python3', os.path.join(os.path.dirname(__file__), 'holehe', 'holehe.py'), email, '--json']
        result = self.run_with_module_fallback(module_cmd, script_cmd, 'Holehe')
        
        if result['success']:
            try:
                # Parse JSON output
                if result['stdout'].strip():
                    parsed_data = json.loads(result['stdout'])
                    if isinstance(parsed_data, list):
                        parsed_results = []
                        for item in parsed_data:
                            parsed_results.append({
                                'site': item.get('name', 'Unknown'),
                                'exists': item.get('exists', False),
                                'confidence': item.get('confidence', 'Unknown'),
                                'url': item.get('url', ''),
                                'error': item.get('error', '')
                            })
                    else:
                        parsed_results = [parsed_data] if parsed_data else []
                else:
                    parsed_results = []
                
                self.results['tools']['holehe'] = {
                    'success': True,
                    'data': parsed_results,
                    'error': None
                }
                
                print(f"✅ Holehe completed: {len(parsed_results)} results")
                return {'success': True, 'data': parsed_results}
                
            except json.JSONDecodeError as e:
                error_msg = f"Holehe JSON parse error: {str(e)}"
                print(f"❌ {error_msg}")
                print(f"Raw output: {result['stdout'][:200]}...")
                self.results['tools']['holehe'] = {
                    'success': False,
                    'data': [],
                    'error': error_msg
                }
                return {'success': False, 'error': error_msg}
        else:
            error_msg = f"Holehe execution failed: {result['stderr']}"
            print(f"❌ {error_msg}")
            self.results['tools']['holehe'] = {
                'success': False,
                'data': [],
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_ghunt(self, email: str) -> Dict[str, Any]:
        """Run GHunt on email using subprocess"""
        print(f"🔍 Running GHunt on: {email}")
        
        # Try module first, then local script as fallback
        module_cmd = ['python3', '-m', 'ghunt', 'email', email, '--json']
        script_cmd = ['python3', os.path.join(os.path.dirname(__file__), 'ghunt', 'ghunt.py'), 'email', email, '--json']
        result = self.run_with_module_fallback(module_cmd, script_cmd, 'GHunt')
        
        if result['success']:
            try:
                # Parse JSON output
                if result['stdout'].strip():
                    parsed_data = json.loads(result['stdout'])
                    parsed_results = {
                        'name': parsed_data.get('name', ''),
                        'profile_picture': parsed_data.get('profile_picture', ''),
                        'cover_photo': parsed_data.get('cover_photo', ''),
                        'emails': parsed_data.get('emails', []),
                        'phone_numbers': parsed_data.get('phone_numbers', []),
                        'social_profiles': parsed_data.get('social_profiles', []),
                        'locations': parsed_data.get('locations', []),
                        'workplaces': parsed_data.get('workplaces', []),
                        'education': parsed_data.get('education', []),
                        'birthday': parsed_data.get('birthday', ''),
                        'gender': parsed_data.get('gender', ''),
                        'profile_url': parsed_data.get('profile_url', '')
                    }
                else:
                    parsed_results = {}
                
                self.results['tools']['ghunt'] = {
                    'success': True,
                    'data': parsed_results,
                    'error': None
                }
                
                print(f"✅ GHunt completed: {len(parsed_results)} data points")
                return {'success': True, 'data': parsed_results}
                
            except json.JSONDecodeError as e:
                error_msg = f"GHunt JSON parse error: {str(e)}"
                print(f"❌ {error_msg}")
                print(f"Raw output: {result['stdout'][:200]}...")
                self.results['tools']['ghunt'] = {
                    'success': False,
                    'data': {},
                    'error': error_msg
                }
                return {'success': False, 'error': error_msg}
        else:
            error_msg = f"GHunt execution failed: {result['stderr']}"
            print(f"❌ {error_msg}")
            self.results['tools']['ghunt'] = {
                'success': False,
                'data': {},
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_sherlock(self, username: str) -> Dict[str, Any]:
        """Run Sherlock on username using subprocess"""
        print(f"🔍 Running Sherlock on: {username}")
        
        # Try module first, then local script as fallback
        module_cmd = ['python3', '-m', 'sherlock', username, '--json']
        script_cmd = ['python3', os.path.join(os.path.dirname(__file__), 'sherlock', 'sherlock.py'), username, '--json']
        result = self.run_with_module_fallback(module_cmd, script_cmd, 'Sherlock')
        
        if result['success']:
            try:
                # Parse JSON output
                if result['stdout'].strip():
                    parsed_data = json.loads(result['stdout'])
                    if isinstance(parsed_data, list):
                        parsed_results = []
                        for item in parsed_data:
                            parsed_results.append({
                                'site': item.get('name', 'Unknown'),
                                'url': item.get('url', ''),
                                'status': item.get('status', 'Unknown'),
                                'response_time': item.get('response_time', 0)
                            })
                    else:
                        parsed_results = [parsed_data] if parsed_data else []
                else:
                    parsed_results = []
                
                self.results['tools']['sherlock'] = {
                    'success': True,
                    'data': parsed_results,
                    'error': None
                }
                
                print(f"✅ Sherlock completed: {len(parsed_results)} results")
                return {'success': True, 'data': parsed_results}
                
            except json.JSONDecodeError as e:
                error_msg = f"Sherlock JSON parse error: {str(e)}"
                print(f"❌ {error_msg}")
                print(f"Raw output: {result['stdout'][:200]}...")
                self.results['tools']['sherlock'] = {
                    'success': False,
                    'data': [],
                    'error': error_msg
                }
                return {'success': False, 'error': error_msg}
        else:
            error_msg = f"Sherlock execution failed: {result['stderr']}"
            print(f"❌ {error_msg}")
            self.results['tools']['sherlock'] = {
                'success': False,
                'data': [],
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_maigret(self, username: str) -> Dict[str, Any]:
        """Run Maigret on username using subprocess"""
        print(f"🔍 Running Maigret on: {username}")
        
        # Try module first, then local script as fallback
        module_cmd = ['python3', '-m', 'maigret', username, '--json']
        script_cmd = ['python3', os.path.join(os.path.dirname(__file__), 'maigret', 'maigret.py'), username, '--json']
        result = self.run_with_module_fallback(module_cmd, script_cmd, 'Maigret')
        
        if result['success']:
            try:
                # Parse JSON output
                if result['stdout'].strip():
                    parsed_data = json.loads(result['stdout'])
                    if isinstance(parsed_data, list):
                        parsed_results = []
                        for item in parsed_data:
                            parsed_results.append({
                                'site': item.get('name', 'Unknown'),
                                'url': item.get('url', ''),
                                'status': item.get('status', 'Unknown'),
                                'response_time': item.get('response_time', 0)
                            })
                    else:
                        parsed_results = [parsed_data] if parsed_data else []
                else:
                    parsed_results = []
                
                self.results['tools']['maigret'] = {
                    'success': True,
                    'data': parsed_results,
                    'error': None
                }
                
                print(f"✅ Maigret completed: {len(parsed_results)} results")
                return {'success': True, 'data': parsed_results}
                
            except json.JSONDecodeError as e:
                error_msg = f"Maigret JSON parse error: {str(e)}"
                print(f"❌ {error_msg}")
                print(f"Raw output: {result['stdout'][:200]}...")
                self.results['tools']['maigret'] = {
                    'success': False,
                    'data': [],
                    'error': error_msg
                }
                return {'success': False, 'error': error_msg}
        else:
            error_msg = f"Maigret execution failed: {result['stderr']}"
            print(f"❌ {error_msg}")
            self.results['tools']['maigret'] = {
                'success': False,
                'data': [],
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
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
        self.results['summary'] = {
            'total_tools': 4,
            'successful_tools': sum(1 for tool in self.results['tools'].values() if tool['success']),
            'failed_tools': sum(1 for tool in self.results['tools'].values() if not tool['success']),
            'total_results': sum(len(tool['data']) for tool in self.results['tools'].values() if isinstance(tool['data'], list))
        }
        
        print("-" * 50)
        print(f"⏱️  Total execution time: {execution_time:.2f} seconds")
        print(f"✅ Successful tools: {self.results['summary']['successful_tools']}/4")
        print(f"❌ Failed tools: {self.results['summary']['failed_tools']}/4")
        print(f"📊 Total results: {self.results['summary']['total_results']}")
        
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
    print(f"⏱️  Execution time: {results['execution_time']}s")
    print(f"✅ Successful: {results['summary']['successful_tools']}/4 tools")
    print(f"📊 Total results: {results['summary']['total_results']}")
    print(f"💾 Output file: {output_file}")
    print("="*60)
    
    # Return exit code based on success
    if results['summary']['successful_tools'] > 0:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
