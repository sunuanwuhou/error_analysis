$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = "python"
$port = 8000

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($existing) {
  Write-Host "xingce_v3_lab already listening on port $port (PID $($existing.OwningProcess))"
  exit 0
}

$proc = Start-Process -FilePath $python `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$port" `
  -WorkingDirectory $projectRoot `
  -PassThru

Write-Host "Started xingce_v3_lab at http://127.0.0.1:$port (PID $($proc.Id))"
