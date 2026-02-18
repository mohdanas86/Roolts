@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo   Roolts - First Time Setup ^& Quick Start
echo ==================================================
echo.

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python 3.10 or higher.
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Backend Setup
echo.
echo [1/3] Setting up Backend...
cd backend

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Installing backend dependencies...
call venv\Scripts\activate
pip install --upgrade pip >nul
pip install -r requirements.txt >nul

if not exist .env (
    echo Creating .env from example...
    copy .env.example .env >nul
    echo [IMPORTANT] Please edit backend/.env later with your API keys!
)
cd ..

:: 3. Frontend Setup
echo.
echo [2/3] Setting up Frontend...
cd frontend

if not exist node_modules (
    echo Installing frontend dependencies (this may take a minute)...
    
    :: Try to use local node if available, else system node
    set "LOCAL_NODE=%~dp0backend\compiler\nodejs\node-v18.17.0-win-x64"
    if exist "!LOCAL_NODE!" (
        set "PATH=!LOCAL_NODE!;%PATH%"
        echo Using portable Node.js runtime...
    )
    
    call npm install >nul
)
cd ..

:: 4. Launch
echo.
echo [3/3] System ready! 
echo.
echo Launching Roolts...
echo ==================================================

call run_roolts.bat
