# Render Linux Deployment Guide

## 🐧 Target Environment: Render Linux Container

This guide is specifically designed for deploying the OSINT Lookup Engine on Render's **Linux container environment** (Debian-based).

## ⚠️ Key Requirements

- **No Docker**: Render containers cannot run nested Docker containers
- **Linux Paths**: All paths must use Linux format (`/` not `\`)
- **Python Virtual Environment**: Required for proper dependency isolation
- **Native Python Execution**: Tools run directly with `python3 -m <tool>`

## 🔧 Render-Specific Configuration

### 1. Build Process (`render.yaml`)

```yaml
buildCommand: |
  # Make setup scripts executable
  chmod +x setup_python_env.sh start_with_venv.sh
  # Create virtual environment and install Python dependencies
  echo "🐍 Creating Python virtual environment..."
  python3 -m venv venv
  echo "🔧 Activating virtual environment..."
  source venv/bin/activate
  echo "⬆️ Upgrading pip..."
  pip install --upgrade pip
  echo "📚 Installing Python packages..."
  pip install -r requirements.txt
  echo "🔍 Verifying installations..."
  python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" && echo "✅ All packages installed successfully"
  # Install Node.js dependencies
  npm install
```

### 2. Start Process (`start_with_venv.sh`)

```bash
#!/bin/bash
echo "🚀 Starting OSINT Lookup Engine with virtual environment..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Virtual environment not found. Creating one..."
    chmod +x setup_python_env.sh
    ./setup_python_env.sh
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if packages are installed
echo "🔍 Checking if required packages are installed..."
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📚 Installing missing packages..."
    pip install -r requirements.txt
fi

echo "🐍 Python version: $(python --version)"
echo "📦 Checking Python packages in virtual environment..."
pip list | grep -E "(sherlock|maigret|holehe|ghunt|phoneinfoga)" || echo "⚠️ Some packages may not be installed"

echo "🔍 Verifying virtual environment Python path..."
echo "Virtual environment Python: $(which python)"
echo "Virtual environment pip: $(which pip)"

# Start the application
echo "🚀 Starting Node.js application..."
node server.js
```

## 🐍 Python Tools Execution

### Virtual Environment Path
All tools run using the virtual environment Python:
```bash
venv/bin/python3 -m <tool> <arguments>
```

### Tool Commands

#### GHunt
```bash
venv/bin/python3 -m ghunt email aikyanaskar2006@gmail.com
```

#### Holehe
```bash
venv/bin/python3 -m holehe aikyanaskar2006@gmail.com -C --no-color
```

#### Sherlock (Default)
```bash
venv/bin/python3 -m sherlock aikyanaskar2006@gmail.com --print-found --no-color
```

#### Sherlock (Custom Sites)
```bash
venv/bin/python3 -m sherlock aikyanaskar2006@gmail.com --print-found \
--site instagram,facebook,twitter,linkedin,tinder,bumble,okcupid,hinge,pinterest,tiktok,snapchat,reddit,github,youtube,twitch,discord,telegram,whatsapp
```

#### Maigret
```bash
venv/bin/python3 -m maigret aikyanaskar2006@gmail.com --no-color
```

## 🔍 Node.js Integration

### Python Detection Logic
The `ensurePythonReady()` function in `server.js`:

1. **First Priority**: Linux virtual environment (`venv/bin/python3`)
2. **Second Priority**: Windows virtual environment (`venv/Scripts/python.exe`) - for local development
3. **Fallback**: System Python (`python3` or `python`)

### Tool Execution
```javascript
// Example: Running Holehe from Node.js
const py = await ensurePythonReady();
if (py) {
    const result = await execAsync(`${py} -m holehe ${email} -C --no-color`);
    // Process result
}
```

## 📦 Dependencies

### requirements.txt
```
sherlock-project
maigret
holehe
ghunt
phoneinfoga
```

### package.json
```json
{
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "sqlite3": "^5.1.6"
  }
}
```

## 🚀 Deployment Steps

### 1. Automatic Deployment (Recommended)
1. Push code to GitHub
2. Connect repository to Render
3. Render automatically:
   - Creates virtual environment
   - Installs Python packages
   - Installs Node.js dependencies
   - Starts application with virtual environment

### 2. Manual Verification
After deployment, check logs for:
```
✅ Using virtual environment Python: /opt/render/project/src/venv/bin/python3
✅ All packages installed successfully
Virtual environment Python: /opt/render/project/src/venv/bin/python
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "No module named" errors
**Cause**: Virtual environment not created or packages not installed
**Solution**: Check build logs for successful virtual environment creation

#### 2. "Using system Python3" warnings
**Cause**: Virtual environment not found
**Solution**: Ensure `venv` directory exists and contains `bin/python3`

#### 3. Permission errors
**Cause**: Scripts not executable
**Solution**: Ensure `chmod +x` commands run during build

### Debug Commands
```bash
# Check virtual environment
ls -la venv/bin/

# Verify Python packages
source venv/bin/activate
pip list

# Test tool imports
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga"

# Check Python path
which python
```

## 📋 Environment Variables

Required for Render:
```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 10000
  - key: DB_TYPE
    value: postgres
  - key: DATABASE_URL
    fromDatabase:
      name: osint-db
      property: connectionString
  - key: GHUNT_TOKEN
    value: [your_ghunt_oauth_token]
  - key: GHUNT_COOKIES_B64
    value: [your_base64_encoded_cookies]
```

## ✅ Success Indicators

When deployment is successful, you should see:
- ✅ Virtual environment created and activated
- ✅ All Python packages installed successfully
- ✅ Tools executing with `venv/bin/python3`
- ✅ No "No module named" errors
- ✅ Application responding to API requests

## 🎯 Key Benefits

1. **Linux Native**: Works perfectly in Render's Linux environment
2. **No Docker**: Avoids Docker-in-Docker issues
3. **Dependency Isolation**: Virtual environment prevents conflicts
4. **Reproducible**: Consistent behavior across deployments
5. **Efficient**: Direct Python execution without container overhead
