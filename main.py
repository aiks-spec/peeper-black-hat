#!/usr/bin/env python3
"""
Unified OSINT Runner Script
Runs Sherlock, Holehe, GHunt, and Maigret from local repositories
"""

import sys
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add local tool directories to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sherlock'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'holehe'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ghunt'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'maigret'))

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
    
    def run_holehe(self, email: str) -> Dict[str, Any]:
        """Run Holehe on email"""
        print(f"🔍 Running Holehe on: {email}")
        try:
            # Import Holehe from local repository
            from holehe import holehe
            
            # Run Holehe
            results = holehe(email)
            
            # Parse results
            parsed_results = []
            if results:
                for result in results:
                    parsed_results.append({
                        'site': result.get('name', 'Unknown'),
                        'exists': result.get('exists', False),
                        'confidence': result.get('confidence', 'Unknown'),
                        'url': result.get('url', ''),
                        'error': result.get('error', '')
                    })
            
            self.results['tools']['holehe'] = {
                'success': True,
                'data': parsed_results,
                'error': None
            }
            
            print(f"✅ Holehe completed: {len(parsed_results)} results")
            return {'success': True, 'data': parsed_results}
            
        except Exception as e:
            error_msg = f"Holehe error: {str(e)}"
            print(f"❌ {error_msg}")
            self.results['tools']['holehe'] = {
                'success': False,
                'data': [],
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_ghunt(self, email: str) -> Dict[str, Any]:
        """Run GHunt on email"""
        print(f"🔍 Running GHunt on: {email}")
        try:
            # Import GHunt from local repository
            from ghunt import ghunt
            
            # Run GHunt
            results = ghunt.email(email)
            
            # Parse results
            parsed_results = {}
            if results:
                parsed_results = {
                    'name': results.get('name', ''),
                    'profile_picture': results.get('profile_picture', ''),
                    'cover_photo': results.get('cover_photo', ''),
                    'emails': results.get('emails', []),
                    'phone_numbers': results.get('phone_numbers', []),
                    'social_profiles': results.get('social_profiles', []),
                    'locations': results.get('locations', []),
                    'workplaces': results.get('workplaces', []),
                    'education': results.get('education', []),
                    'birthday': results.get('birthday', ''),
                    'gender': results.get('gender', ''),
                    'profile_url': results.get('profile_url', '')
                }
            
            self.results['tools']['ghunt'] = {
                'success': True,
                'data': parsed_results,
                'error': None
            }
            
            print(f"✅ GHunt completed: {len(parsed_results)} data points")
            return {'success': True, 'data': parsed_results}
            
        except Exception as e:
            error_msg = f"GHunt error: {str(e)}"
            print(f"❌ {error_msg}")
            self.results['tools']['ghunt'] = {
                'success': False,
                'data': {},
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_sherlock(self, username: str) -> Dict[str, Any]:
        """Run Sherlock on username"""
        print(f"🔍 Running Sherlock on: {username}")
        try:
            # Import Sherlock from local repository
            from sherlock import sherlock
            
            # Run Sherlock
            results = sherlock(username)
            
            # Parse results
            parsed_results = []
            if results:
                for result in results:
                    parsed_results.append({
                        'site': result.get('name', 'Unknown'),
                        'url': result.get('url', ''),
                        'status': result.get('status', 'Unknown'),
                        'response_time': result.get('response_time', 0)
                    })
            
            self.results['tools']['sherlock'] = {
                'success': True,
                'data': parsed_results,
                'error': None
            }
            
            print(f"✅ Sherlock completed: {len(parsed_results)} results")
            return {'success': True, 'data': parsed_results}
            
        except Exception as e:
            error_msg = f"Sherlock error: {str(e)}"
            print(f"❌ {error_msg}")
            self.results['tools']['sherlock'] = {
                'success': False,
                'data': [],
                'error': error_msg
            }
            return {'success': False, 'error': error_msg}
    
    def run_maigret(self, username: str) -> Dict[str, Any]:
        """Run Maigret on username"""
        print(f"🔍 Running Maigret on: {username}")
        try:
            # Import Maigret from local repository
            from maigret import maigret
            
            # Run Maigret
            results = maigret(username)
            
            # Parse results
            parsed_results = []
            if results:
                for result in results:
                    parsed_results.append({
                        'site': result.get('name', 'Unknown'),
                        'url': result.get('url', ''),
                        'status': result.get('status', 'Unknown'),
                        'response_time': result.get('response_time', 0)
                    })
            
            self.results['tools']['maigret'] = {
                'success': True,
                'data': parsed_results,
                'error': None
            }
            
            print(f"✅ Maigret completed: {len(parsed_results)} results")
            return {'success': True, 'data': parsed_results}
            
        except Exception as e:
            error_msg = f"Maigret error: {str(e)}"
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
