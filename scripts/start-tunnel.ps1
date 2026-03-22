$ErrorActionPreference = "Stop"

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  throw "cloudflared is not installed. Install it first, then rerun this script."
}

$localUrl = "http://127.0.0.1:8000"
Write-Host "Starting Cloudflare Quick Tunnel for $localUrl"
Write-Host "Press Ctrl+C to stop."

& $cloudflared.Source tunnel --url $localUrl
