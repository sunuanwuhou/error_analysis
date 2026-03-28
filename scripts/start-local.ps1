$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = "python"
$port = 8000

$dockerApp = $null
try {
  $dockerApp = docker compose -f (Join-Path $projectRoot "docker-compose.yml") ps --status running app 2>$null
} catch {
  $dockerApp = $null
}

if ($dockerApp -and ($dockerApp | Select-String -Pattern "xingce_v3_app")) {
  Write-Host "Docker app is already running at http://127.0.0.1:8080"
  Write-Host "Per repo rule, prefer Docker first. Stop Docker only if you explicitly need local Python on 8000."
  exit 0
}

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($existing) {
  Write-Host "xingce_v3_lab already listening on port $port (PID $($existing.OwningProcess))"
  exit 0
}

$env:XINGCE_RUNTIME_MODE = "local"
$env:XINGCE_RUNTIME_LABEL = "Local Python / 127.0.0.1:8000"

$proc = Start-Process -FilePath $python `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$port" `
  -WorkingDirectory $projectRoot `
  -PassThru

Write-Host "Started xingce_v3_lab at http://127.0.0.1:$port (PID $($proc.Id))"
