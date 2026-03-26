$ErrorActionPreference = "Stop"

$name = "codex_quick_tunnel"
$targetUrl = "http://host.docker.internal:8000"

Write-Host "Starting Docker-based Cloudflare Quick Tunnel for $targetUrl"

docker rm -f $name *> $null
docker run -d --name $name cloudflare/cloudflared:latest tunnel --no-autoupdate --url $targetUrl | Out-Null

Start-Sleep -Seconds 2
$logs = ""
$match = $null
for ($i = 0; $i -lt 10; $i++) {
  $logs = (cmd /c "docker logs $name 2>&1") | Out-String
  $match = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { break }
  Start-Sleep -Seconds 2
}

if (-not $match.Success) {
  Write-Host $logs
  throw "Quick tunnel URL not found in logs."
}

Write-Host "Quick tunnel URL:"
Write-Host $match.Value
Write-Host ""
Write-Host "Stop it with:"
Write-Host "docker rm -f $name"
