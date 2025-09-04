@echo off
echo 🚀 Starting OSINT Lookup Engine with virtual environment...

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Virtual environment not found. Creating one...
    call setup_python_env.bat
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if packages are installed
echo 🔍 Checking if required packages are installed...
python -c "import sherlock, maigret, holehe, ghunt, phoneinfoga" 2>nul
if errorlevel 1 (
    echo 📚 Installing missing packages...
    pip install -r requirements.txt
)

REM Start the application
echo 🚀 Starting Node.js application...
node server.js
