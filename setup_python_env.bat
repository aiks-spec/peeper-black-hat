@echo off
echo 🐍 Setting up Python virtual environment for OSINT tools...

REM Check if Python3 is available
python3 --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python3 is not installed. Please install Python 3.8+ first.
    echo 💡 Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python3 found:
python3 --version

REM Create virtual environment
echo 📦 Creating virtual environment...
python3 -m venv venv

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo ⬆️ Upgrading pip...
python -m pip install --upgrade pip

REM Install required packages
echo 📚 Installing required packages from requirements.txt...
pip install -r requirements.txt

REM Verify installations
echo 🔍 Verifying installations...
python -c "import sherlock; print('✅ Sherlock installed')" 2>nul || echo ❌ Sherlock not found
python -c "import maigret; print('✅ Maigret installed')" 2>nul || echo ❌ Maigret not found
python -c "import holehe; print('✅ Holehe installed')" 2>nul || echo ❌ Holehe not found
python -c "import ghunt; print('✅ GHunt installed')" 2>nul || echo ❌ GHunt not found
python -c "import phoneinfoga; print('✅ PhoneInfoga installed')" 2>nul || echo ❌ PhoneInfoga not found

echo ✅ Python environment setup complete!
echo 💡 To activate the virtual environment, run: venv\Scripts\activate.bat
echo 💡 To run the application with the virtual environment, update your start command to use: venv\Scripts\python.exe
pause
