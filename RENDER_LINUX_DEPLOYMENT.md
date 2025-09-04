# 🚀 Render Linux Deployment Guide

## Overview
This guide explains how the OSINT Lookup Engine is configured for deployment on Render's Linux environment with Python virtual environment support.

## 🐍 Python Virtual Environment Setup

### Build Process (`render.yaml`)
The build process automatically:
1. **Creates virtual environment**: `python3 -m venv venv`
2. **Activates venv**: `source venv/bin/activate`
3. **Installs packages**: `pip install -r requirements.txt`
4. **Verifies installations**: Tests each package import
5. **Installs Node.js dependencies**: `npm install`

### Start Process (`start_with_venv.sh`)
The start process:
1. **Checks for venv**: Creates if missing
2. **Activates venv**: `source venv/bin/activate`
3. **Verifies packages**: Reinstalls if needed
4. **Starts Node.js app**: `node server.js`

## 🔧 Key Configuration Files

### `render.yaml`
```yaml
buildCommand: |
  # Creates venv, installs packages, verifies installations
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga"

startCommand: ./start_with_venv.sh
```

### `start_with_venv.sh`
```bash
#!/bin/bash
# Activates venv and starts Node.js app
source venv/bin/activate
node server.js
```

### `server.js` - Python Detection
```javascript
async function ensurePythonReady() {
    // Prioritizes Linux venv path
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3');
    if (fs.existsSync(venvPython)) {
        return venvPython; // ✅ Uses venv Python
    }
    // Fallback to system Python
    return 'python3';
}
```

## 📦 Python Packages (`requirements.txt`)
```
sherlock-project
maigret
holehe
ghunt
phoneinfoga
```

## 🛠️ Tool Execution

### Template System
All tools use `python3 -m <tool>` format:
- **Sherlock**: `python3 -m sherlock <email>`
- **Maigret**: `python3 -m maigret <email>`
- **Holehe**: `python3 -m holehe <email>`
- **PhoneInfoga**: `python3 -m phoneinfoga scan --number <phone_number>`
- **GHunt**: `python3 -m ghunt email <email>`

### Virtual Environment Priority
1. **Linux venv**: `venv/bin/python3` (preferred)
2. **Activated venv**: `$VIRTUAL_ENV/bin/python3`
3. **System Python**: `python3` (fallback)

## 🔍 Troubleshooting

### "No module named" Errors
**Cause**: Virtual environment not created or packages not installed
**Solution**: Check Render build logs for venv creation

### "Using system Python3" Warnings
**Cause**: Virtual environment not found
**Solution**: Ensure `start_with_venv.sh` is used as start command

### Build Failures
**Check**:
1. Python3 availability in Render environment
2. Package installation success
3. Virtual environment creation

### Runtime Failures
**Check**:
1. Virtual environment activation
2. Package availability in venv
3. Python path resolution

## ✅ Success Indicators

### Build Success
```
✅ Python3 found: Python 3.x.x
✅ All packages installed successfully
✅ Build process completed successfully
```

### Runtime Success
```
✅ Virtual environment activated: /opt/render/project/src/venv
✅ Using virtual environment Python: /opt/render/project/src/venv/bin/python3
✅ All tools ready
```

## 🚀 Deployment Steps

1. **Push to Git**: Ensure all files are committed
2. **Deploy on Render**: Connect repository
3. **Monitor Build**: Check for venv creation
4. **Verify Runtime**: Confirm venv activation
5. **Test Tools**: Run OSINT lookups

## 📝 Environment Variables

Required for Render:
- `NODE_ENV`: `production`
- `PORT`: `10000`
- `DB_TYPE`: `postgres`
- `DATABASE_URL`: From Render database
- `GHUNT_TOKEN`: OAuth token
- `GHUNT_COOKIES_B64`: Base64 encoded cookies

## 🔄 Update Process

When updating:
1. **Modify code**: Update `server.js`, scripts, etc.
2. **Push changes**: Commit and push to Git
3. **Render rebuilds**: Automatically recreates venv
4. **Verify deployment**: Check logs and test tools

## 🎯 Key Points

- ✅ **No Docker**: Uses native Python execution
- ✅ **Linux venv**: `venv/bin/python3` path
- ✅ **Automatic setup**: Build process handles everything
- ✅ **Robust detection**: Multiple fallback paths
- ✅ **Package verification**: Tests each tool import
- ✅ **Error handling**: Graceful fallbacks and logging
