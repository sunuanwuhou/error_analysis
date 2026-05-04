param(
  [ValidateSet("up", "deploy", "ps", "logs", "smoke", "sh")]
  [string]$Action = "ps",
  [string]$Service = "app",
  [string]$Tail = "120",
  [string]$Cmd = ""
)

$ErrorActionPreference = "Stop"

function Convert-ToWslPath {
  param([Parameter(Mandatory = $true)][string]$WindowsPath)
  $normalized = $WindowsPath.Replace('\', '/')
  if ($normalized -match '^([A-Za-z]):/(.*)$') {
    $drive = $Matches[1].ToLower()
    $rest = $Matches[2]
    return "/mnt/$drive/$rest"
  }
  throw "Cannot convert path to WSL format: $WindowsPath"
}

$projectRoot   = Split-Path -Parent $PSScriptRoot
$wslProjectRoot = Convert-ToWslPath -WindowsPath $projectRoot

function Invoke-Wsl {
  param([Parameter(Mandatory = $true)][string]$InnerCommand)
  & wsl bash -lc "cd '$wslProjectRoot' && $InnerCommand"
}

# Build the Vue frontend inside WSL using the local Node installation.
# Skips if node is not available (will fail later if frontend/dist is missing).
function Build-Frontend {
  Write-Host "Building Vue frontend..." -ForegroundColor Cyan
  $nodeCheck = & wsl bash -lc "command -v node 2>/dev/null || echo MISSING"
  if ($nodeCheck -match "MISSING") {
    Write-Host "  node not found in WSL — trying npx/nvm fallback..." -ForegroundColor Yellow
  }
  Invoke-Wsl "cd frontend && npm ci --prefer-offline && npm run build && cd .."
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed. Check npm output above."
  }
  Write-Host "Frontend build complete -> frontend/dist/" -ForegroundColor Green
}

try {
  & wsl -l -q | Out-Null
} catch {
  throw "WSL is unavailable. Please install/enable WSL first."
}

switch ($Action) {
  "up" {
    # Local dev: build frontend then rebuild app container
    Build-Frontend
    Invoke-Wsl "docker compose up --build -d $Service"
    break
  }
  "deploy" {
    # Production deploy: build frontend + all services + Cloudflare tunnel
    # Requires TUNNEL_TOKEN in .env
    Build-Frontend
    Write-Host "Deploying with Cloudflare tunnel (profile: tunnel)..." -ForegroundColor Cyan
    Invoke-Wsl "docker compose --profile tunnel up --build -d"
    Write-Host ""
    Write-Host "Deploy complete." -ForegroundColor Green
    Write-Host "Tunnel logs: .\scripts\wsl.ps1 -Action logs -Service cloudflared" -ForegroundColor Yellow
    break
  }
  "ps" {
    Invoke-Wsl "docker compose ps"
    break
  }
  "logs" {
    Invoke-Wsl "docker compose logs --tail $Tail $Service"
    break
  }
  "smoke" {
    Invoke-Wsl "docker compose exec -T $Service python scripts/verify_v31_smoke.py"
    break
  }
  "sh" {
    if (-not $Cmd.Trim()) {
      throw "Action=sh requires -Cmd, for example: -Cmd `"docker compose ps`""
    }
    Invoke-Wsl $Cmd
    break
  }
}
