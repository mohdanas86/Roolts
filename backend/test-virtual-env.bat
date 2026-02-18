@echo off
REM Quick Start Script for Virtual Environment System Testing
REM This script helps you verify the installation step by step

echo ========================================
echo Virtual Environment System - Quick Test
echo ========================================
echo.

REM Step 1: Check Docker
echo [Step 1/7] Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker is installed

docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Step 2: Check Python dependencies
echo [Step 2/7] Checking Python dependencies...
python -c "import docker" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Docker SDK not installed
    echo Installing docker package...
    pip install docker>=7.0.0
)
echo [OK] Docker SDK installed

python -c "import psutil" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] psutil not installed
    echo Installing psutil package...
    pip install psutil>=5.9.0
)
echo [OK] psutil installed
echo.

REM Step 3: Initialize database
echo [Step 3/7] Initializing database...
python -c "from app import create_app; app = create_app(); app.app_context().push(); from models import db; db.create_all(); print('[OK] Database initialized')"
if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed
    pause
    exit /b 1
)
echo.

REM Step 4: Verify models
echo [Step 4/7] Verifying models...
python models.py | findstr "VirtualEnvironment"
if %errorlevel% neq 0 (
    echo [ERROR] Models verification failed
    pause
    exit /b 1
)
echo [OK] Models verified
echo.

REM Step 5: Pull Docker images
echo [Step 5/7] Pulling Docker images (this may take a few minutes)...
docker pull node:18-alpine
docker pull python:3.11-alpine
echo [OK] Docker images ready
echo.

REM Step 6: Start backend server
echo [Step 6/7] Starting backend server...
echo.
echo ========================================
echo Backend server will start now
echo Press Ctrl+C to stop the server
echo ========================================
echo.
echo After the server starts, open a new terminal and run:
echo   cd backend
echo   curl http://127.0.0.1:5000/api/health
echo.
echo You should see "virtual_environments": true
echo.
echo For complete testing, see TESTING_GUIDE.md
echo ========================================
echo.

python app.py

