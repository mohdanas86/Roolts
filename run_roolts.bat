@echo off
echo ==================================================
echo   Starting Roolts App - Build. Learn. Share.
echo ==================================================

echo 1. Starting Backend Server...
start "Roolts Backend" cmd /k "cd backend && call venv\Scripts\activate && python app.py"

echo 2. Starting Frontend Server...
set "NODE_DIR=%~dp0backend\compiler\nodejs\node-v18.17.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
start "Roolts Frontend" cmd /k "cd frontend && npm run dev"

echo 3. Waiting for servers to initialize...
:: Wait up to 15 seconds for backend to respond
set "READY=0"
for /L %%i in (1,1,15) do (
    curl -s http://127.0.0.1:5000/api/health >nul
    if %errorlevel% equ 0 (
        set "READY=1"
        goto :servers_ready
    )
    timeout /t 1 /nobreak >nul
)

:servers_ready
if "%READY%"=="1" (
    echo [OK] Backend is ready.
) else (
    echo [WARNING] Backend is taking longer than expected to start.
    echo Please check the "Roolts Backend" window for errors.
)

echo 4. Opening Application...
start http://127.0.0.1:3000

echo ==================================================
echo   Roolts is running!
echo   Backend: http://127.0.0.1:5000
echo   Frontend: http://127.0.0.1:3000
echo   You can minimize the command windows, but 
echo   DO NOT close them until you are done.
echo ==================================================
pause

