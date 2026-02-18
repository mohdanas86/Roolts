# Virtual Environment System - Complete Testing Guide

## Step-by-Step Testing Process

Follow these steps in order to verify the entire virtual environment system works correctly.

---

## Phase 1: Prerequisites & Installation

### Step 1.1: Check Docker Installation

**Windows:**
```powershell
# Check if Docker is installed
docker --version

# Check if Docker is running
docker ps
```

**Expected Output:**
```
Docker version 24.x.x or higher
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

**If Docker is not installed:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop
- Install and restart your computer
- Start Docker Desktop
- Verify with `docker ps` again

---

### Step 1.2: Install Python Dependencies

```powershell
# Navigate to backend directory
cd c:\Users\anasa\sih\roolts\backend

# Install new dependencies
pip install docker>=7.0.0 psutil>=5.9.0

# Verify installation
python -c "import docker; print('Docker SDK:', docker.__version__)"
python -c "import psutil; print('psutil:', psutil.__version__)"
```

**Expected Output:**
```
Docker SDK: 7.x.x
psutil: 5.x.x
```

---

### Step 1.3: Initialize Database

```powershell
# Create database tables
python -c "from app import create_app; app = create_app(); app.app_context().push(); from models import db; db.create_all(); print('✅ Database initialized')"
```

**Expected Output:**
```
✅ Docker connection established
✅ Database initialized
```

---

### Step 1.4: Verify Models

```powershell
# Check if models are loaded correctly
python models.py
```

**Expected Output:**
```
==================================================
✅ models.py execution successful
==================================================
This file defines the database models for Roolts.

[Available Models]
- User: <class 'models.User'>
- SocialToken: <class 'models.SocialToken'>
- Snippet: <class 'models.Snippet'>
- VirtualEnvironment: <class 'models.VirtualEnvironment'>
- EnvironmentSession: <class 'models.EnvironmentSession'>
- EnvironmentLog: <class 'models.EnvironmentLog'>
```

---

## Phase 2: Start Backend Server

### Step 2.1: Start Flask Application

```powershell
# Start the backend server
python app.py
```

**Expected Output:**
```
✅ Docker connection established

>>> Roolts Backend Starting...
==================================================
API Server: http://127.0.0.1:5000
API Docs:   http://127.0.0.1:5000/
Auth:       /api/auth/*
AI Hub:     /api/ai-hub/*
==================================================

Press Ctrl+C to stop

 * Running on http://0.0.0.0:5000
```

**Keep this terminal running!** Open a new terminal for testing.

---

### Step 2.2: Test Health Check

**In a new terminal:**
```powershell
# Test health endpoint
curl http://127.0.0.1:5000/api/health
```

**Expected Output:**
```json
{
  "status": "healthy",
  "service": "roolts-backend",
  "version": "2.0.0",
  "features": {
    "authentication": true,
    "multi_ai": true,
    "social_publishing": true,
    "code_execution": true,
    "learning": true,
    "virtual_environments": true
  }
}
```

✅ **Checkpoint:** If you see `"virtual_environments": true`, the integration is successful!

---

## Phase 3: Test Environment Management

### Step 3.1: Create a Node.js Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"name\": \"test-nodejs\", \"type\": \"nodejs\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "environment": {
    "id": 1,
    "user_id": 1,
    "name": "test-nodejs",
    "type": "nodejs",
    "container_id": "abc123...",
    "status": "stopped",
    "resources": {
      "cpu_limit": 1.0,
      "memory_limit": 512,
      "disk_limit": 1024
    },
    "created_at": "2026-02-07T..."
  },
  "message": "Environment created successfully"
}
```

**What to verify:**
- ✅ `success: true`
- ✅ `container_id` is present
- ✅ `status: "stopped"`
- ✅ Resource limits are set correctly

**Save the environment ID** (e.g., `1`) for next steps!

---

### Step 3.2: Verify Docker Container Created

```powershell
# List Docker containers
docker ps -a --filter "label=roolts.user_id=1"
```

**Expected Output:**
```
CONTAINER ID   IMAGE            COMMAND   CREATED         STATUS    NAMES
abc123def456   node:18-alpine   "/bin/sh" 30 seconds ago Created   roolts_1_1_test-nodejs
```

✅ **Checkpoint:** Container should be created with status "Created"

---

### Step 3.3: List User Environments

```powershell
curl http://127.0.0.1:5000/api/virtual-env/environments ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "environments": [
    {
      "id": 1,
      "name": "test-nodejs",
      "type": "nodejs",
      "status": "stopped",
      ...
    }
  ],
  "count": 1
}
```

---

### Step 3.4: Start the Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/start ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Environment started successfully"
}
```

**Verify container is running:**
```powershell
docker ps --filter "label=roolts.user_id=1"
```

**Expected Output:**
```
CONTAINER ID   IMAGE            STATUS          NAMES
abc123def456   node:18-alpine   Up 5 seconds    roolts_1_1_test-nodejs
```

✅ **Checkpoint:** Container status should be "Up"

---

## Phase 4: Test Command Execution

### Step 4.1: Execute Simple Command

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"node --version\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "exit_code": 0,
  "stdout": "v18.x.x\n",
  "stderr": "",
  "execution_time": 0.15,
  "severity": "safe"
}
```

✅ **Checkpoint:** Node.js version should be displayed

---

### Step 4.2: Test Security - Blocked Command

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"sudo rm -rf /\"}"
```

**Expected Output:**
```json
{
  "error": "Command blocked for security reasons",
  "reason": "Command contains dangerous pattern: \\bsudo\\b"
}
```

✅ **Checkpoint:** Dangerous command should be BLOCKED (403 status)

---

### Step 4.3: Test Warning Command

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"echo 'Hello World'\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "exit_code": 0,
  "stdout": "Hello World\n",
  "stderr": "",
  "execution_time": 0.12,
  "severity": "safe"
}
```

---

### Step 4.4: View Execution Logs

```powershell
curl http://127.0.0.1:5000/api/virtual-env/environments/1/logs ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "logs": [
    {
      "id": 3,
      "action_type": "command",
      "command": "echo 'Hello World'",
      "status": "success",
      "output": "Hello World\n",
      "execution_time": 0.12,
      "created_at": "2026-02-07T..."
    },
    {
      "id": 2,
      "action_type": "command",
      "command": "sudo rm -rf /",
      "status": "blocked",
      "output": "Command contains dangerous pattern...",
      "created_at": "2026-02-07T..."
    },
    ...
  ],
  "count": 3
}
```

✅ **Checkpoint:** All commands (including blocked ones) should be logged

---

## Phase 5: Test Package Management

### Step 5.1: Install npm Package

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/install ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"manager\": \"npm\", \"packages\": [\"express\"]}"
```

**Expected Output:**
```json
{
  "success": true,
  "stdout": "added 57 packages...\n",
  "stderr": "",
  "execution_time": 15.3
}
```

**Note:** This may take 10-30 seconds as it downloads packages

✅ **Checkpoint:** Package should install successfully

---

### Step 5.2: Verify Package Installation

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"npm list express\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "stdout": "└── express@4.x.x\n",
  ...
}
```

---

### Step 5.3: List Installed Packages

```powershell
curl "http://127.0.0.1:5000/api/virtual-env/environments/1/packages?manager=npm" ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "packages": "workspace@1.0.0\n└── express@4.x.x\n",
  "error": null
}
```

---

## Phase 6: Test File Operations

### Step 6.1: List Workspace Files

```powershell
curl "http://127.0.0.1:5000/api/virtual-env/environments/1/files?path=/workspace" ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "path": "/workspace",
  "files": [
    {
      "name": "node_modules",
      "type": "directory",
      "permissions": "drwxr-xr-x",
      "size": "4.0K",
      "modified": "2026-02-07 11:30"
    },
    {
      "name": "package.json",
      "type": "file",
      "permissions": "-rw-r--r--",
      "size": "234",
      "modified": "2026-02-07 11:30"
    }
  ]
}
```

---

### Step 6.2: Create a File

```powershell
curl -X PUT http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"content\": \"const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('Hello World'));\napp.listen(3000);\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "File written successfully",
  "path": "/workspace/app.js"
}
```

---

### Step 6.3: Read the File

```powershell
curl http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "path": "/workspace/app.js",
  "content": "const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('Hello World'));\napp.listen(3000);"
}
```

---

### Step 6.4: Create a Directory

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/mkdir ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"path\": \"/workspace/src\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Directory created successfully",
  "path": "/workspace/src"
}
```

---

### Step 6.5: Execute the Created File

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"node app.js &\", \"timeout\": 5}"
```

**Expected Output:**
```json
{
  "success": true,
  "exit_code": 0,
  "stdout": "",
  "stderr": "",
  ...
}
```

---

### Step 6.6: Delete a File

```powershell
curl -X DELETE http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## Phase 7: Test Environment Lifecycle

### Step 7.1: Get Environment Details

```powershell
curl http://127.0.0.1:5000/api/virtual-env/environments/1 ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "environment": {
    "id": 1,
    "name": "test-nodejs",
    "status": "running",
    ...
  },
  "container_status": {
    "status": "running",
    "running": true,
    "cpu_percent": 0.5,
    "memory_usage_mb": 45.2,
    "memory_percent": 8.8
  }
}
```

✅ **Checkpoint:** Container should show resource usage

---

### Step 7.2: Stop Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/stop ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Environment stopped successfully"
}
```

**Verify:**
```powershell
docker ps --filter "label=roolts.user_id=1"
```

Should show no running containers.

---

### Step 7.3: Restart Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/start ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Environment started successfully"
}
```

---

### Step 7.4: Verify Data Persistence

```powershell
# Check if the src directory still exists
curl "http://127.0.0.1:5000/api/virtual-env/environments/1/files?path=/workspace" ^
  -H "X-User-ID: 1"
```

**Expected Output:**
Should still show the `src` directory and `node_modules` from before

✅ **Checkpoint:** Data persists across container restarts!

---

## Phase 8: Test Multiple Environments

### Step 8.1: Create Python Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"name\": \"test-python\", \"type\": \"python\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "environment": {
    "id": 2,
    "type": "python",
    ...
  }
}
```

---

### Step 8.2: Start Python Environment

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/2/start ^
  -H "X-User-ID: 1"
```

---

### Step 8.3: Test Python Command

```powershell
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/2/execute ^
  -H "Content-Type: application/json" ^
  -H "X-User-ID: 1" ^
  -d "{\"command\": \"python --version\"}"
```

**Expected Output:**
```json
{
  "success": true,
  "stdout": "Python 3.11.x\n",
  ...
}
```

---

### Step 8.4: List All Environments

```powershell
curl http://127.0.0.1:5000/api/virtual-env/environments ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "environments": [
    {"id": 1, "name": "test-nodejs", "type": "nodejs", ...},
    {"id": 2, "name": "test-python", "type": "python", ...}
  ],
  "count": 2
}
```

✅ **Checkpoint:** Both environments should be listed

---

## Phase 9: Test Cleanup Utilities

### Step 9.1: View Cleanup Statistics

```powershell
cd c:\Users\anasa\sih\roolts\backend\utils
python environment_cleanup.py stats
```

**Expected Output:**
```
📊 Environment Statistics:
  total_environments: 2
  running: 2
  stopped: 0
  idle_candidates: 0
  old_candidates: 0
```

---

### Step 9.2: Test Idle Cleanup (Simulation)

```powershell
# This won't actually stop anything since we just created them
python environment_cleanup.py idle 0
```

**Expected Output:**
```
✅ Stopped 2 idle environments
```

---

## Phase 10: Cleanup & Destroy

### Step 10.1: Destroy Python Environment

```powershell
curl -X DELETE http://127.0.0.1:5000/api/virtual-env/environments/2 ^
  -H "X-User-ID: 1"
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Environment destroyed successfully"
}
```

---

### Step 10.2: Verify Container Removed

```powershell
docker ps -a --filter "label=roolts.env_id=2"
```

**Expected Output:**
Should show no containers (container and volume removed)

---

### Step 10.3: Destroy Node.js Environment

```powershell
curl -X DELETE http://127.0.0.1:5000/api/virtual-env/environments/1 ^
  -H "X-User-ID: 1"
```

---

## Testing Checklist

Use this checklist to track your testing progress:

### Prerequisites
- [ ] Docker installed and running
- [ ] Python dependencies installed (docker, psutil)
- [ ] Database initialized
- [ ] Models verified

### Backend
- [ ] Flask server starts without errors
- [ ] Health check shows virtual_environments: true

### Environment Management
- [ ] Create Node.js environment
- [ ] Docker container created
- [ ] List environments
- [ ] Start environment
- [ ] Get environment details
- [ ] Stop environment
- [ ] Restart environment

### Command Execution
- [ ] Execute simple command (node --version)
- [ ] Dangerous command blocked (sudo rm -rf /)
- [ ] Echo command works
- [ ] View execution logs

### Package Management
- [ ] Install npm package (express)
- [ ] Verify package installed
- [ ] List installed packages

### File Operations
- [ ] List workspace files
- [ ] Create file (app.js)
- [ ] Read file
- [ ] Create directory
- [ ] Delete file

### Data Persistence
- [ ] Data persists after container restart

### Multiple Environments
- [ ] Create Python environment
- [ ] Test Python commands
- [ ] List multiple environments

### Cleanup
- [ ] View cleanup statistics
- [ ] Destroy environments
- [ ] Verify containers removed

---

## Troubleshooting

### Issue: "Docker is not available"
**Solution:**
```powershell
# Start Docker Desktop
# Wait for it to fully start
docker ps  # Should work without errors
```

### Issue: "Container creation failed"
**Solution:**
```powershell
# Pull images manually
docker pull node:18-alpine
docker pull python:3.11-alpine
```

### Issue: "Permission denied" on Linux
**Solution:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Issue: "Module not found: docker"
**Solution:**
```powershell
pip install docker psutil
```

### Issue: Port 5000 already in use
**Solution:**
```powershell
# Change port in app.py or kill the process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

---

## Success Criteria

✅ All checkpoints passed
✅ No error messages in Flask logs
✅ Docker containers created and managed correctly
✅ Commands execute successfully
✅ Packages install correctly
✅ Files persist across restarts
✅ Security blocks dangerous commands
✅ Cleanup utilities work

**If all tests pass, your virtual environment system is working perfectly!** 🎉

