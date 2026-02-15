@echo off
setlocal

echo ==================================================
echo   Starting Roolts App (Local Dependencies Mode)
echo ==================================================

:: Set Local Node Path
set "NODE_PATH=%~dp0backend\compiler\nodejs\node-v18.17.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

echo 1. Starting Backend Server...
cd backend
start "Roolts Backend" cmd /k ".\venv\Scripts\activate && python app.py"
cd ..

echo 2. Starting Frontend Server...
cd frontend
start "Roolts Frontend" cmd /k "set \"PATH=%NODE_PATH%;%%PATH%%\" && npm run dev"
cd ..

echo 3. Waiting for servers to initialize...
:: Wait up to 15 seconds for backend to respond
set "READY=0"
for /L %%i in (1,1,15) do (
    curl -s http://localhost:5000/api/health >nul
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
start http://localhost:3000

echo ==================================================
echo   Roolts is running!
echo   Backend: http://localhost:5000
echo   Frontend: http://localhost:3000 (Local Node)
echo ==================================================
pause
