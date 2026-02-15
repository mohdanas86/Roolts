@echo off
echo ========================================
echo   Roolts - AI-Powered Code Publisher
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Navigate to backend directory
cd /d "%~dp0backend"

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate

REM Install dependencies
echo [INFO] Installing dependencies...
pip install -r requirements.txt --quiet

REM Check if .env exists
if not exist ".env" (
    echo [INFO] Creating .env from template...
    copy .env.example .env
    echo [WARNING] Please edit backend\.env with your API keys
)

REM Start the server
echo.
echo [INFO] Starting Roolts Backend Server...
echo [INFO] Server running at http://127.0.0.1:5000
echo [INFO] Press Ctrl+C to stop
echo.
python app.py

