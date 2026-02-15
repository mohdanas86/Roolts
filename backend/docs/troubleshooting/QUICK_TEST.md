# Quick Test Commands for Virtual Environment System
# Copy and paste these commands one by one in PowerShell

# ============================================
# PHASE 1: SETUP (Run these first)
# ============================================

# 1. Check Docker
docker --version
docker ps

# 2. Install dependencies
cd c:\Users\anasa\sih\roolts\backend
pip install docker>=7.0.0 psutil>=5.9.0

# 3. Initialize database
python -c "from app import create_app; app = create_app(); app.app_context().push(); from models import db; db.create_all(); print('✅ Database initialized')"

# 4. Pull Docker images (optional, will auto-pull when needed)
docker pull node:18-alpine
docker pull python:3.11-alpine

# 5. Start backend server (keep this running in one terminal)
python app.py

# ============================================
# PHASE 2: TESTING (Open new terminal for these)
# ============================================

# Test 1: Health check
curl http://127.0.0.1:5000/api/health

# Test 2: Create environment
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"name\": \"test-env\", \"type\": \"nodejs\"}"

# Test 3: List environments
curl http://127.0.0.1:5000/api/virtual-env/environments -H "X-User-ID: 1"

# Test 4: Start environment (replace {id} with actual ID from step 2)
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/start -H "X-User-ID: 1"

# Test 5: Execute command
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"command\": \"node --version\"}"

# Test 6: Test security (should be blocked)
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/execute -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"command\": \"sudo rm -rf /\"}"

# Test 7: Install package
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/install -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"manager\": \"npm\", \"packages\": [\"express\"]}"

# Test 8: Create file
curl -X PUT http://127.0.0.1:5000/api/virtual-env/environments/1/files/test.js -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"content\": \"console.log('Hello World');\"}"

# Test 9: Read file
curl http://127.0.0.1:5000/api/virtual-env/environments/1/files/test.js -H "X-User-ID: 1"

# Test 10: List files
curl "http://127.0.0.1:5000/api/virtual-env/environments/1/files?path=/workspace" -H "X-User-ID: 1"

# Test 11: View logs
curl http://127.0.0.1:5000/api/virtual-env/environments/1/logs -H "X-User-ID: 1"

# Test 12: Stop environment
curl -X POST http://127.0.0.1:5000/api/virtual-env/environments/1/stop -H "X-User-ID: 1"

# Test 13: Destroy environment
curl -X DELETE http://127.0.0.1:5000/api/virtual-env/environments/1 -H "X-User-ID: 1"

# ============================================
# VERIFICATION
# ============================================

# Check Docker containers
docker ps -a --filter "label=roolts.user_id=1"

# Check Docker volumes
docker volume ls --filter "label=user_id=1"

# View cleanup stats
cd utils
python environment_cleanup.py stats

# ============================================
# SUCCESS CRITERIA
# ============================================
# ✅ Health check shows "virtual_environments": true
# ✅ Environment created with container ID
# ✅ Commands execute successfully
# ✅ Dangerous commands are blocked
# ✅ Packages install successfully
# ✅ Files can be created and read
# ✅ Logs show all operations
# ✅ Environment can be stopped and destroyed

