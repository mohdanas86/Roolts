@echo off
echo ========================================
echo   Roolts Frontend - Development Server
echo ========================================
echo.

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Navigate to frontend directory
cd /d "%~dp0frontend"

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    npm install
)

REM Start the development server
echo.
echo [INFO] Starting Roolts Frontend...
echo [INFO] App running at http://127.0.0.1:3000
echo [INFO] Press Ctrl+C to stop
echo.
set "NODE_PATH=%~dp0..\backend\compiler\nodejs\node-v18.17.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"
npm run dev

