# Complete Virtual Environment System Test Script
# This script tests all features of the virtual environment system

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Virtual Environment System - Full Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://127.0.0.1:5000"
$userId = "1"
$testsPassed = 0
$testsFailed = 0

# Helper function to test API calls
function Test-API {
    param(
        [string]$TestName,
        [scriptblock]$TestBlock
    )
    
    Write-Host "Testing: $TestName..." -NoNewline
    try {
        $result = & $TestBlock
        Write-Host " [OK]" -ForegroundColor Green
        $script:testsPassed++
        return $result
    }
    catch {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testsFailed++
        return $null
    }
}

Write-Host "Phase 1: System Health Check" -ForegroundColor Yellow
Write-Host "------------------------------"

$health = Test-API "Health Check" {
    Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET
}

if ($health.features.virtual_environments -eq $true) {
    Write-Host "  Virtual environments feature: ENABLED" -ForegroundColor Green
} else {
    Write-Host "  Virtual environments feature: DISABLED" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Phase 2: Environment Management" -ForegroundColor Yellow
Write-Host "--------------------------------"

# Create environment
$env = Test-API "Create Node.js Environment" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"name": "test-env", "type": "nodejs"}'
}

$envId = $env.environment.id
Write-Host "  Created environment ID: $envId" -ForegroundColor Cyan

# List environments
$envList = Test-API "List Environments" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}
Write-Host "  Total environments: $($envList.count)" -ForegroundColor Cyan

# Get environment details
$envDetails = Test-API "Get Environment Details" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}

# Start environment
Test-API "Start Environment" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/start" `
        -Method POST `
        -Headers @{"X-User-ID"=$userId}
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Phase 3: Command Execution" -ForegroundColor Yellow
Write-Host "---------------------------"

# Test Node.js version
$nodeVersion = Test-API "Execute: node --version" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/execute" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"command": "node --version"}'
}
if ($nodeVersion) {
    Write-Host "  Node.js version: $($nodeVersion.stdout.Trim())" -ForegroundColor Cyan
}

# Test npm version
$npmVersion = Test-API "Execute: npm --version" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/execute" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"command": "npm --version"}'
}
if ($npmVersion) {
    Write-Host "  npm version: $($npmVersion.stdout.Trim())" -ForegroundColor Cyan
}

# Test echo command
Test-API "Execute: echo 'Hello World'" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/execute" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"command": "echo \"Hello from Virtual Environment\""}'
}

# Test security - dangerous command should be blocked
Write-Host "Testing: Security - Block dangerous command..." -NoNewline
try {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/execute" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"command": "sudo rm -rf /"}'
    Write-Host " [FAILED - Command was not blocked!]" -ForegroundColor Red
    $script:testsFailed++
}
catch {
    $errorMessage = $_.Exception.Message
    # Check if it's a 403 Forbidden (security block) or contains security keywords
    if ($errorMessage -like "*403*" -or $errorMessage -like "*Forbidden*" -or $errorMessage -like "*blocked*" -or $errorMessage -like "*security*") {
        Write-Host " [OK - Command blocked]" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host " [FAILED - Unexpected error]" -ForegroundColor Red
        Write-Host "  Error: $errorMessage" -ForegroundColor Red
        $script:testsFailed++
    }
}

Write-Host ""
Write-Host "Phase 4: Package Management" -ForegroundColor Yellow
Write-Host "----------------------------"

# Install express package
$install = Test-API "Install Package: express" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/install" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"manager": "npm", "packages": ["express"]}'
}

Start-Sleep -Seconds 2

# Verify package installation
$verify = Test-API "Verify Package: express" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/execute" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"command": "npm list express"}'
}

# List packages
Test-API "List Installed Packages" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/packages?manager=npm" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}

Write-Host ""
Write-Host "Phase 5: File Operations" -ForegroundColor Yellow
Write-Host "-------------------------"

# Create a JavaScript file (simplified to avoid JSON escaping issues)
Test-API "Create File: app.js" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files/app.js" `
        -Method PUT `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"content": "console.log(\"Hello World\");\n"}'
}

# Read the file
$fileContent = Test-API "Read File: app.js" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files/app.js" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}

# Create a directory
Test-API "Create Directory: src" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/mkdir" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"path": "/workspace/src"}'
}

# Wait for filesystem to sync
Start-Sleep -Seconds 2

# List workspace files (with retry for timing issues)
Write-Host "Testing: List Workspace Files..." -NoNewline
$files = $null
$retries = 3
for ($i = 0; $i -lt $retries; $i++) {
    try {
        $files = Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files?path=/workspace" `
            -Method GET `
            -Headers @{"X-User-ID"=$userId}
        Write-Host " [OK]" -ForegroundColor Green
        $script:testsPassed++
        break
    }
    catch {
        if ($i -eq ($retries - 1)) {
            Write-Host " [FAILED]" -ForegroundColor Red
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:testsFailed++
        } else {
            Start-Sleep -Seconds 1
        }
    }
}
if ($files) {
    Write-Host "  Files in workspace:" -ForegroundColor Cyan
    foreach ($file in $files.files) {
        Write-Host "    - $($file.name) ($($file.type))" -ForegroundColor Gray
    }
}

# Create a test file in src
Test-API "Create File: src/test.js" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files/src/test.js" `
        -Method PUT `
        -Headers @{"Content-Type"="application/json"; "X-User-ID"=$userId} `
        -Body '{"content": "console.log(\"Test file\");"}'
}

# Delete test file
Test-API "Delete File: src/test.js" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files/src/test.js" `
        -Method DELETE `
        -Headers @{"X-User-ID"=$userId}
}

Write-Host ""
Write-Host "Phase 6: Logging & Monitoring" -ForegroundColor Yellow
Write-Host "------------------------------"

# View logs
$logs = Test-API "View Execution Logs" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/logs" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}
if ($logs) {
    Write-Host "  Total log entries: $($logs.count)" -ForegroundColor Cyan
}

# Get environment status
$status = Test-API "Get Environment Status" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}
if ($status.container_status) {
    Write-Host "  Container status: $($status.container_status.status)" -ForegroundColor Cyan
    Write-Host "  CPU usage: $($status.container_status.cpu_percent)%" -ForegroundColor Cyan
    Write-Host "  Memory usage: $($status.container_status.memory_usage_mb) MB" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Phase 7: Environment Lifecycle" -ForegroundColor Yellow
Write-Host "-------------------------------"

# Stop environment
Test-API "Stop Environment" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/stop" `
        -Method POST `
        -Headers @{"X-User-ID"=$userId}
}

Start-Sleep -Seconds 2

# Restart environment
Test-API "Restart Environment" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/start" `
        -Method POST `
        -Headers @{"X-User-ID"=$userId}
}

Start-Sleep -Seconds 2

# Verify data persistence
$persistCheck = Test-API "Verify Data Persistence" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/files/app.js" `
        -Method GET `
        -Headers @{"X-User-ID"=$userId}
}
if ($persistCheck) {
    Write-Host "  Data persisted after restart: YES" -ForegroundColor Green
}

# Stop and destroy
Test-API "Stop Environment (Final)" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId/stop" `
        -Method POST `
        -Headers @{"X-User-ID"=$userId}
}

Test-API "Destroy Environment" {
    Invoke-RestMethod -Uri "$baseUrl/api/virtual-env/environments/$envId" `
        -Method DELETE `
        -Headers @{"X-User-ID"=$userId}
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor Red
Write-Host "Total Tests: $($testsPassed + $testsFailed)"
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "All tests PASSED! Virtual environment system is working correctly." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests FAILED. Please review the errors above." -ForegroundColor Red
    exit 1
}

