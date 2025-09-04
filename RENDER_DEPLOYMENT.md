# Render.com Deployment Guide

## Overview
This guide explains how to deploy the OSINT Lookup Engine on Render.com with proper Python virtual environment management.

## Key Changes for Render Deployment

### 1. Virtual Environment Setup
The deployment now uses Python virtual environments to ensure proper dependency isolation:

- **`setup_python_env.sh`**: Creates and configures the virtual environment
- **`start_with_venv.sh`**: Automatically sets up and activates the virtual environment before starting the app
- **`requirements.txt`**: Specifies all Python dependencies

### 2. Updated Render Configuration

#### `render.yaml` Changes:
- **Build Command**: Now creates virtual environment and installs Python dependencies
- **Start Command**: Uses `start_with_venv.sh` for proper environment activation

```yaml
buildCommand: |
  # Make setup scripts executable
  chmod +x setup_python_env.sh start_with_venv.sh
  # Create virtual environment and install Python dependencies
  ./setup_python_env.sh
  # Install Node.js dependencies
  npm install
startCommand: ./start_with_venv.sh
```

#### `start.sh` Changes:
- Automatically detects and creates virtual environment if missing
- Activates virtual environment before starting the application
- Verifies Python package installation
- Uses virtual environment Python for all tool execution

### 3. Python Tools Integration

All OSINT tools now run within the virtual environment:

- **Sherlock**: `python -m sherlock <email>`
- **Maigret**: `python -m maigret <email>`
- **Holehe**: `python -m holehe <email>`
- **GHunt**: `python -m ghunt email <email>`
- **PhoneInfoga**: `python -m phoneinfoga scan --number <phone_number>`

### 4. Environment Variables

Required environment variables for Render:

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

## Deployment Process

### 1. Automatic Setup
When deployed to Render:

1. **Build Phase**:
   - Makes setup scripts executable
   - Creates Python virtual environment
   - Installs Python dependencies from `requirements.txt`
   - Installs Node.js dependencies

2. **Start Phase**:
   - Activates virtual environment
   - Verifies package installation
   - Starts Node.js application

### 2. Manual Verification
To verify the deployment:

1. Check build logs for successful virtual environment creation
2. Verify Python packages are installed: `pip list`
3. Test tool execution: `python -m sherlock --help`

## Troubleshooting

### Common Issues

1. **"No module named" errors**:
   - Ensure virtual environment is activated
   - Check `requirements.txt` includes all needed packages
   - Verify build logs show successful package installation

2. **Permission errors**:
   - Ensure setup scripts are executable: `chmod +x setup_python_env.sh start_with_venv.sh`

3. **Python version conflicts**:
   - Virtual environment isolates Python dependencies
   - Check Python version in virtual environment: `python --version`

### Debug Commands

```bash
# Check virtual environment
ls -la venv/

# Verify Python packages
source venv/bin/activate
pip list

# Test tool imports
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga"

# Check Python path
python -c "import sys; print(sys.path)"
```

## Local Development

For local development, use the provided scripts:

### Linux/macOS:
```bash
./setup_python_env.sh    # Create virtual environment
./start_with_venv.sh     # Start with virtual environment
```

### Windows:
```batch
setup_python_env.bat     # Create virtual environment
start_with_venv.bat      # Start with virtual environment
```

## Benefits of Virtual Environment

1. **Dependency Isolation**: Prevents conflicts between system and project Python packages
2. **Reproducible Environment**: Ensures consistent behavior across different systems
3. **Easy Management**: Simple setup and cleanup of Python dependencies
4. **Render Compatibility**: Works seamlessly with Render's Node.js environment

## Next Steps

After deployment:

1. Test all OSINT tools with sample inputs
2. Verify GHunt authentication works correctly
3. Monitor application logs for any issues
4. Update environment variables as needed
