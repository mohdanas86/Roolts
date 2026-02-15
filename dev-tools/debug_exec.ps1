$headers = @{ "Content-Type" = "application/json" }
Write-Host "1. Testing /health..."
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method Get -TimeoutSec 2
    Write-Host "Health: $($health | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Health Check Failed: $_"
}

Write-Host "`n2. Testing Python Execution (Simple Print)..."
$body = @{ code = "print('Backend is alive')"; language = "python"; filename = "test.py" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/executor/execute" -Method Post -Headers $headers -Body $body -TimeoutSec 5
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)"
} catch {
    Write-Host "Exec Failed: $_"
}

Write-Host "`n3. Testing Models Execution (No Output)..."
$body = @{ code = "import os`nclass User: pass"; language = "python"; filename = "models.py" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/executor/execute" -Method Post -Headers $headers -Body $body -TimeoutSec 5
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)"
} catch {
    Write-Host "Exec Failed: $_"
}

