$ErrorActionPreference = "Stop"

param(
    [string]$Hostname = "erroranaly.qzz.io",
    [string]$TunnelName = "erroranaly-qzz-io",
    [string]$Service = "http://app:8000",
    [string]$TokenPemPath = (Join-Path $PSScriptRoot "..\cloudflared\token.pem")
)

function Get-ArgoTokenPayload {
    param([string]$Path)
    if (!(Test-Path $Path)) {
        throw "Cloudflare token file not found: $Path"
    }
    $pem = Get-Content $Path -Raw
    $b64 = (($pem -split "`n") | Where-Object { $_ -notmatch "BEGIN|END" -and $_.Trim() }) -join ""
    if (-not $b64) {
        throw "Cloudflare token file is empty or invalid."
    }
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)) | ConvertFrom-Json
}

function Invoke-CfApi {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null,
        [string]$ApiToken
    )
    $headers = @{
        Authorization = "Bearer $ApiToken"
        "Content-Type" = "application/json"
    }
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Headers $headers -Uri $Uri
    }
    return Invoke-RestMethod -Method $Method -Headers $headers -Uri $Uri -Body ($Body | ConvertTo-Json -Depth 12)
}

function New-TunnelSecret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

$cf = Get-ArgoTokenPayload -Path $TokenPemPath
$accountId = $cf.accountID
$zoneId = $cf.zoneID
$apiToken = $cf.apiToken

$existing = Invoke-CfApi -Method GET -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/cfd_tunnel" -ApiToken $apiToken
$tunnel = $existing.result | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1

if (-not $tunnel) {
    $created = Invoke-CfApi -Method POST -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/cfd_tunnel" -ApiToken $apiToken -Body @{
        name = $TunnelName
        tunnel_secret = (New-TunnelSecret)
    }
    $tunnel = $created.result
    Write-Host "Created tunnel: $($tunnel.id)"
} else {
    Write-Host "Using existing tunnel: $($tunnel.id)"
}

$null = Invoke-CfApi -Method PUT -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/cfd_tunnel/$($tunnel.id)/configurations" -ApiToken $apiToken -Body @{
    config = @{
        ingress = @(
            @{ hostname = $Hostname; service = $Service },
            @{ service = "http_status:404" }
        )
    }
}

$records = Invoke-CfApi -Method GET -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?type=CNAME&name=$Hostname" -ApiToken $apiToken
$existingRecord = $records.result | Select-Object -First 1
$dnsBody = @{
    type = "CNAME"
    name = $Hostname
    content = "$($tunnel.id).cfargotunnel.com"
    proxied = $true
    ttl = 1
}

if ($existingRecord) {
    $null = Invoke-CfApi -Method PUT -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records/$($existingRecord.id)" -ApiToken $apiToken -Body $dnsBody
    Write-Host "Updated DNS record for $Hostname"
} else {
    $null = Invoke-CfApi -Method POST -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" -ApiToken $apiToken -Body $dnsBody
    Write-Host "Created DNS record for $Hostname"
}

Write-Host ""
Write-Host "Tunnel name : $($tunnel.name)"
Write-Host "Tunnel id   : $($tunnel.id)"
Write-Host "Hostname    : $Hostname"
Write-Host "Service     : $Service"
Write-Host "Token       : $($tunnel.token)"
