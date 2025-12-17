param (
    [Parameter(Mandatory=$true)]
    [string]$GitHubUrl,

    [Parameter(Mandatory=$true)]
    [string]$DeviceIp,

    [Parameter(Mandatory=$true)]
    [int]$ScriptId,

    [bool]$Autostart = $false,
    [bool]$RunNow = $false
)

# 1. Download source code from GitHub
Write-Host "--- Downloading script from GitHub ---" -ForegroundColor Cyan
try {
    $scriptCode = Invoke-RestMethod -Uri $GitHubUrl -Method Get
} catch {
    Write-Error "Failed to download script: $_"
    exit
}

# 2. Upload script to Shelly
# PowerShell's Invoke-RestMethod handles the JSON conversion automatically
Write-Host "--- Uploading to Shelly (ID: $ScriptId) at $DeviceIp ---" -ForegroundColor Cyan
$uploadBody = @{
    id   = $ScriptId
    code = $scriptCode
}

$uploadResponse = Invoke-RestMethod -Uri "http://$DeviceIp/rpc/Script.Put" `
                                    -Method Post `
                                    -Body ($uploadBody | ConvertTo-Json)
Write-Host "Upload response: $($uploadResponse | ConvertTo-Json -Compress)"

# 3. Optionally set autostart
if ($Autostart) {
    Write-Host "--- Setting autostart to true ---" -ForegroundColor Cyan
    $configBody = @{
        id     = $ScriptId
        config = @{ enable = $true }
    }
    Invoke-RestMethod -Uri "http://$DeviceIp/rpc/Script.SetConfig" `
                      -Method Post `
                                      -Body ($configBody | ConvertTo-Json)
}

# 4. Optionally run immediately
if ($RunNow) {
    Write-Host "--- Starting script now ---" -ForegroundColor Cyan
    $startBody = @{ id = $ScriptId }
    Invoke-RestMethod -Uri "http://$DeviceIp/rpc/Script.Start" `
                      -Method Post `
                      -Body ($startBody | ConvertTo-Json)
}

Write-Host "--- Deployment finished ---" -ForegroundColor Green
