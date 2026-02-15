# 🚀 GET STARTED - Virtual Environment System

## Quick Start (5 Minutes)

Follow these steps to get your virtual environment system up and running:

### Step 1: Install Docker (if not already installed)

**Windows:**
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Start Docker Desktop
4. Verify: Open PowerShell and run `docker ps`

### Step 2: Run the Quick Setup Script

```powershell
cd c:\Users\anasa\sih\roolts\backend
.\test-virtual-env.bat
```

This script will:
- ✅ Check Docker installation
- ✅ Install Python dependencies
- ✅ Initialize database
- ✅ Verify models
- ✅ Pull Docker images
- ✅ Start the backend server

### Step 3: Test the API (in a new terminal)

**Note:** PowerShell uses different syntax. See [POWERSHELL_API_TESTS.md](file:///c:/Users/anasa/sih/roolts/backend/POWERSHELL_API_TESTS.md) for PowerShell commands.

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method GET
```

**If you have curl.exe installed:**
```powershell
curl.exe http://127.0.0.1:5000/api/health
```

**Expected:** You should see `"virtual_environments": true`

### Step 4: Create Your First Environment

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"name": "my-first-env", "type": "nodejs"}'
```

**Expected:** You'll get a JSON response with environment details and a container ID

### Step 5: Start and Test

```powershell
# Start the environment
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/start -H "X-User-ID: 1"

# Run a command
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"command\": \"node --version\"}"
```

**Expected:** You'll see the Node.js version in the response

---

## 📚 Documentation Files

I've created several guides to help you:

1. **[TESTING_GUIDE.md](file:///c:/Users/anasa/sih/roolts/backend/TESTING_GUIDE.md)** - Complete step-by-step testing (10 phases, 50+ tests)
2. **[QUICK_TEST.md](file:///c:/Users/anasa/sih/roolts/backend/QUICK_TEST.md)** - Copy-paste commands for quick testing
3. **[VIRTUAL_ENV_README.md](file:///c:/Users/anasa/sih/roolts/backend/VIRTUAL_ENV_README.md)** - Full documentation and API reference
4. **[test-virtual-env.bat](file:///c:/Users/anasa/sih/roolts/backend/test-virtual-env.bat)** - Automated setup script

---

## 🎯 What You Can Test

### ✅ Environment Management
- Create environments (Node.js, Python, Full-stack, C++)
- Start/Stop/Destroy environments
- List all environments
- View environment details and resource usage

### ✅ Command Execution
- Run any shell command
- Security validation (dangerous commands blocked)
- View execution logs
- Real-time output

### ✅ Package Management
- Install packages (npm, pip, yarn, apt)
- List installed packages
- Uninstall packages

### ✅ File Operations
- Create/Read/Update/Delete files
- Create directories
- List directory contents
- Move/Copy files

### ✅ Security Features
- Command validation
- Resource limits (CPU, RAM, Disk)
- Network isolation
- Audit logging

---

## 🔥 Quick Test Commands

**For PowerShell users:** See [POWERSHELL_API_TESTS.md](file:///c:/Users/anasa/sih/roolts/backend/POWERSHELL_API_TESTS.md) for complete PowerShell syntax.

**PowerShell Quick Test:**

```powershell
# 1. Create environment
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"name": "test", "type": "nodejs"}'

# 2. Start it
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/start" -Method POST -Headers @{"X-User-ID"="1"}

# 3. Run command
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"command": "echo Hello World"}'

# 4. Install package
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/install" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"manager": "npm", "packages": ["express"]}'

# 5. Create file
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method PUT -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"content": "console.log(\"Hello\");"}'

# 6. Read file
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method GET -Headers @{"X-User-ID"="1"}
```

---

## 🛠️ Troubleshooting

### Docker not running?
```powershell
# Start Docker Desktop from Windows Start Menu
# Wait for it to fully start (whale icon in system tray)
docker ps  # Should work without errors
```

### Dependencies not installed?
```powershell
pip install docker>=7.0.0 psutil>=5.9.0
```

### Port 5000 already in use?
```powershell
# Find and kill the process
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Database errors?
```powershell
# Reinitialize database
python -c "from app import create_app; app = create_app(); app.app_context().push(); from models import db; db.drop_all(); db.create_all()"
```

---

## 📊 Success Checklist

After testing, verify:

- [ ] Backend starts without errors
- [ ] Health check shows `virtual_environments: true`
- [ ] Can create environments
- [ ] Docker containers are created
- [ ] Can execute commands
- [ ] Dangerous commands are blocked
- [ ] Can install packages
- [ ] Can create and read files
- [ ] Data persists after restart
- [ ] Can destroy environments

---

## 🎓 Next Steps

1. **Complete Testing**: Follow [TESTING_GUIDE.md](file:///c:/Users/anasa/sih/roolts/backend/TESTING_GUIDE.md) for comprehensive testing
2. **Frontend Integration**: Build UI for environment management
3. **Customize**: Adjust resource limits in `services/docker_manager.py`
4. **Production**: Set up cleanup cron jobs for maintenance

---

## 📞 Need Help?

- **PowerShell Commands**: See `POWERSHELL_API_TESTS.md` (PowerShell-specific syntax)
- **Full Testing Guide**: See `TESTING_GUIDE.md` (50+ detailed tests)
- **Quick Commands**: See `QUICK_TEST.md` (copy-paste ready)
- **API Reference**: See `VIRTUAL_ENV_README.md` (complete documentation)
- **Code**: All services in `backend/services/` folder

---

## 🎉 You're Ready!

Your virtual environment system is fully implemented and ready to use. Start with the quick test above, then explore the full testing guide for comprehensive validation.

**Happy coding!** 🚀

