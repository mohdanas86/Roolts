# PowerShell API Testing Commands

## Quick Reference for PowerShell

PowerShell has different syntax than bash/curl. Use these commands instead:

---

## Environment Management

### Create Environment
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"name": "my-dev-env", "type": "nodejs"}'
```

### List Environments
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method GET -Headers @{"X-User-ID"="1"}
```

### Get Environment Details
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1" -Method GET -Headers @{"X-User-ID"="1"}
```

### Start Environment
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/start" -Method POST -Headers @{"X-User-ID"="1"}
```

### Stop Environment
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/stop" -Method POST -Headers @{"X-User-ID"="1"}
```

### Destroy Environment
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1" -Method DELETE -Headers @{"X-User-ID"="1"}
```

---

## Command Execution

### Execute Simple Command
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"command": "node --version"}'
```

### Test Security (Should be Blocked)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"command": "sudo rm -rf /"}'
```

### Echo Test
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"command": "echo Hello World"}'
```

### View Execution Logs
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/logs" -Method GET -Headers @{"X-User-ID"="1"}
```

---

## Package Management

### Install npm Package
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/install" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"manager": "npm", "packages": ["express"]}'
```

### Install Multiple Packages
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/install" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"manager": "npm", "packages": ["express", "lodash", "axios"]}'
```

### List Installed Packages
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/packages?manager=npm" -Method GET -Headers @{"X-User-ID"="1"}
```

---

## File Operations

### List Workspace Files
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files?path=/workspace" -Method GET -Headers @{"X-User-ID"="1"}
```

### Create/Write File
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method PUT -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"content": "console.log(\"Hello World\");"}'
```

### Read File
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method GET -Headers @{"X-User-ID"="1"}
```

### Delete File
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method DELETE -Headers @{"X-User-ID"="1"}
```

### Create Directory
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/mkdir" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"path": "/workspace/src"}'
```

---

## Complete Testing Workflow

Copy and paste these commands one by one:

```powershell
# 1. Health Check
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method GET

# 2. Create Node.js Environment
$env1 = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"name": "test-nodejs", "type": "nodejs"}'
Write-Host "Created environment ID: $($env1.environment.id)"

# 3. Start Environment
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/start" -Method POST -Headers @{"X-User-ID"="1"}

# 4. Test Node.js
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"command": "node --version"}'

# 5. Install Express
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/install" -Method POST -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"manager": "npm", "packages": ["express"]}'

# 6. Create app.js
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method PUT -Headers @{"Content-Type"="application/json"; "X-User-ID"="1"} -Body '{"content": "const express = require(\"express\");\nconst app = express();\napp.get(\"/\", (req, res) => res.send(\"Hello World\"));\napp.listen(3000, () => console.log(\"Server running\"));"}'

# 7. Read the file back
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files/app.js" -Method GET -Headers @{"X-User-ID"="1"}

# 8. List all files
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/files?path=/workspace" -Method GET -Headers @{"X-User-ID"="1"}

# 9. View logs
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/logs" -Method GET -Headers @{"X-User-ID"="1"}

# 10. Stop environment
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/stop" -Method POST -Headers @{"X-User-ID"="1"}

# 11. Destroy environment
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1" -Method DELETE -Headers @{"X-User-ID"="1"}
```

---

## Shorter Syntax (Using Aliases)

You can also use shorter variable names:

```powershell
# Set common headers
$headers = @{
    "Content-Type" = "application/json"
    "X-User-ID" = "1"
}

# Create environment
$result = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments" -Method POST -Headers $headers -Body '{"name": "test", "type": "nodejs"}'

# Start it
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/start" -Method POST -Headers @{"X-User-ID"="1"}

# Execute command
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/virtual-env/environments/1/execute" -Method POST -Headers $headers -Body '{"command": "node --version"}'
```

---

## Using curl.exe (Real curl)

If you have real curl installed (not PowerShell alias), use `curl.exe`:

```powershell
curl.exe -X POST http://127.0.0.1:5000/api/virtual-env/environments -H "Content-Type: application/json" -H "X-User-ID: 1" -d "{\"name\": \"my-dev-env\", \"type\": \"nodejs\"}"
```

---

## Tips

1. **PowerShell uses `Invoke-RestMethod`** instead of `curl`
2. **Headers** are passed as hashtables: `@{"Key"="Value"}`
3. **JSON strings** use single quotes on the outside: `'{"key": "value"}'`
4. **Escape quotes** in JSON when using double quotes: `"{\"key\": \"value\"}"`
5. **Results** are automatically parsed as PowerShell objects

---

## Troubleshooting

### Error: "curl is an alias"
Use `Invoke-RestMethod` instead of `curl`

### Error: "Cannot bind parameter"
Make sure you're using PowerShell syntax, not bash syntax

### Error: "Connection refused"
Make sure the backend server is running: `python app.py`

### Error: "404 Not Found"
Check the URL is correct and the virtual_env blueprint is registered

---

## Success Indicators

✓ Health check returns `virtual_environments: true`
✓ Environment creation returns an ID
✓ Commands execute and return output
✓ Dangerous commands are blocked (403 error)
✓ Files can be created and read
✓ Packages install successfully

