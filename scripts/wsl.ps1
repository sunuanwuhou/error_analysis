param(
  [ValidateSet("up", "ps", "logs", "smoke", "sh")]
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

function Invoke-WslProjectCommand {
  param([Parameter(Mandatory = $true)][string]$InnerCommand)
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $wslProjectRoot = Convert-ToWslPath -WindowsPath $projectRoot
  $bashCommand = "cd '$wslProjectRoot' && $InnerCommand"
  & wsl bash -lc $bashCommand
}

try {
  & wsl -l -q | Out-Null
} catch {
  throw "WSL is unavailable. Please install/enable WSL first."
}

switch ($Action) {
  "up" {
    Invoke-WslProjectCommand "docker compose up --build -d $Service"
    break
  }
  "ps" {
    Invoke-WslProjectCommand "docker compose ps"
    break
  }
  "logs" {
    Invoke-WslProjectCommand "docker compose logs --tail $Tail $Service"
    break
  }
  "smoke" {
    Invoke-WslProjectCommand "docker compose exec -T $Service python scripts/verify_v31_smoke.py"
    break
  }
  "sh" {
    if (-not $Cmd.Trim()) {
      throw "Action=sh requires -Cmd, for example: -Cmd `"docker compose ps`""
    }
    Invoke-WslProjectCommand $Cmd
    break
  }
}
