# OSINT Local Repository Setup

This project runs multiple OSINT CLI tools (Sherlock, Holehe, GHunt, Maigret) from local repositories without using `git clone` in Render.

## Project Structure

```
/my-osint-project
├── main.py                 # Unified OSINT runner script
├── requirements.txt        # Python dependencies
├── setup_local_repos.py    # Setup helper script
├── setup_ghunt_auth.py     # GHunt authentication setup
├── README_OSINT.md         # This file
├── sherlock/               # Local Sherlock repository
├── holehe/                 # Local Holehe repository
├── ghunt/                  # Local GHunt repository
└── maigret/                # Local Maigret repository
```

## Setup Instructions

### 1. Clone Local Repositories

Run these commands in your project directory:

```bash
# Clone Sherlock
git clone https://github.com/sherlock-project/sherlock.git
mv sherlock/* ./sherlock/
rm -rf sherlock

# Clone Holehe
git clone https://github.com/megadose/holehe.git
mv holehe/* ./holehe/
rm -rf holehe

# Clone GHunt
git clone https://github.com/mxrch/GHunt.git
mv GHunt/* ./ghunt/
rm -rf GHunt

# Clone Maigret
git clone https://github.com/soxoj/maigret.git
mv maigret/* ./maigret/
rm -rf maigret
```

### 2. Set Up GHunt Authentication

Run the authentication setup script:

```bash
python setup_ghunt_auth.py
```

This will create the necessary authentication files for GHunt using your provided cookies and tokens.

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Test the Setup

```bash
python main.py test@example.com
```

## Usage

### Command Line

```bash
python main.py <email>
```

Example:
```bash
python main.py john.doe@gmail.com
```

### What It Does

1. **Extracts username** from email (part before @)
2. **Runs Holehe** on the email address
3. **Runs GHunt** on the email address
4. **Runs Sherlock** on the username
5. **Runs Maigret** on the username
6. **Collects results** and outputs structured JSON
7. **Saves results** to a timestamped JSON file

### Output

The script generates:
- **Console output** with progress and results
- **JSON file** with structured results (`osint_results_YYYYMMDD_HHMMSS.json`)

## Render Deployment

### Build Command (render.yaml)

```yaml
services:
  - type: web
    name: osint-runner
    env: python
    buildCommand: |
      pip install -r requirements.txt
    startCommand: python main.py
```

### Environment Variables

Set these in Render:
- `GHUNT_TOKEN`: Your GHunt OAuth token
- `GHUNT_COOKIES_B64`: Your GHunt cookies (base64 encoded)

## Features

- ✅ **No git clone in Render** - uses local repositories
- ✅ **Direct Python imports** - clean, efficient execution
- ✅ **Unified interface** - single script for all tools
- ✅ **Structured output** - JSON results with metadata
- ✅ **Error handling** - graceful failure handling
- ✅ **GHunt authentication** - pre-configured auth
- ✅ **Render compatible** - optimized for Free Plan

## Troubleshooting

### Import Errors

If you get import errors, ensure:
1. All repositories are cloned to the correct directories
2. Dependencies are installed: `pip install -r requirements.txt`
3. Python path includes the tool directories

### GHunt Authentication Issues

If GHunt fails:
1. Run `python setup_ghunt_auth.py`
2. Check that `ghunt/tokens.json` and `ghunt/cookies.json` exist
3. Verify your tokens are valid

### Missing Dependencies

If tools fail to run:
1. Check `requirements.txt` has all needed packages
2. Install missing packages: `pip install <package-name>`
3. Ensure Python 3.8+ is being used

## File Descriptions

- **main.py**: Main runner script that executes all OSINT tools
- **requirements.txt**: Python dependencies for all tools
- **setup_local_repos.py**: Helper script to check repository setup
- **setup_ghunt_auth.py**: Sets up GHunt authentication files
- **README_OSINT.md**: This documentation file

## Example Output

```json
{
  "email": "test@example.com",
  "username": "test",
  "timestamp": "2024-01-15T10:30:00",
  "tools": {
    "holehe": {
      "success": true,
      "data": [
        {
          "site": "GitHub",
          "exists": true,
          "confidence": "High",
          "url": "https://github.com/test"
        }
      ]
    },
    "ghunt": {
      "success": true,
      "data": {
        "name": "Test User",
        "profile_picture": "https://...",
        "emails": ["test@example.com"]
      }
    },
    "sherlock": {
      "success": true,
      "data": [
        {
          "site": "GitHub",
          "url": "https://github.com/test",
          "status": "Found"
        }
      ]
    },
    "maigret": {
      "success": true,
      "data": [
        {
          "site": "Twitter",
          "url": "https://twitter.com/test",
          "status": "Found"
        }
      ]
    }
  },
  "execution_time": 45.2,
  "summary": {
    "total_tools": 4,
    "successful_tools": 4,
    "failed_tools": 0,
    "total_results": 12
  }
}
```
