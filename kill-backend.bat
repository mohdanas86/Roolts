@echo off
echo ========================================
echo   Roolts - Killing Stale Backend
echo ========================================
echo.
echo [INFO] Stopping all Python processes...
taskkill /F /IM python.exe /T
echo.
echo [INFO] Done. Please wait a few seconds and then run start-backend.bat again.
pause
