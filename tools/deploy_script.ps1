#Requires -Version 5.1
#
# Deploy Script to Shelly Device
# Downloads a script from GitHub and uploads it to a Shelly device via RPC API.
# Supports chunked uploads, autostart configuration, run after upload.
# Recognizes already uploaded script by its name (incl. suffixes) to overwrite it, if requested.
#
# Author: Michal Bartak
# Date: 2026-01-13
#

# --- Helper Function: Check JSON for Errors ---
function Check-RpcError {
    param(
        [object]$JsonResponse,
        [string]$ActionName
    )

    # Check if request failed to get any response
    if ($null -eq $JsonResponse) {
        Write-Host "Error: No response from device during '$ActionName'. Check connection." -ForegroundColor Red
        exit 1
    }

    # Extract code and message (handling both root-level and nested error object)
    # We look for a 'code' value that is negative.
    $code = if ($JsonResponse.code) { $JsonResponse.code } else { 0 }
    $message = if ($JsonResponse.message) { $JsonResponse.message } else { "" }
    $emessage = if ($JsonResponse.error_msg) { $JsonResponse.error_msg } else { "" }

    if ($emessage) {
        Write-Host "FAILED: $ActionName" -ForegroundColor Red
        Write-Host "Message: $emessage" -ForegroundColor Red
        exit 1
    }

    if ($code -lt 0) {
        Write-Host "FAILED: $ActionName" -ForegroundColor Red
        Write-Host "Error Code: $code" -ForegroundColor Red
        Write-Host "Message: $message" -ForegroundColor Red
        exit 1
    }
}

# --- Helper Function: Print Usage ---
function Print-Usage {
    Write-Host "Usage: $($MyInvocation.ScriptName) -u <github_url> -h <device_ip> [-a] [-s] [-o]"
    Write-Host "  -u: GitHub URL (required)"
    Write-Host "  -h: Device IP address (required)"
    Write-Host "  -a: Enable autostart (flag)"
    Write-Host "  -s: Start after upload (flag)"
    Write-Host "  -o: Overwrite existing script (flag)"
}

# Parse command line arguments
$GITHUB_URL = ""
$DEVICE_IP = ""
$AUTOSTART = $false
$RUN_NOW = $false
$OVERWRITE = $false

# PowerShell parameter parsing
$params = $args
$i = 0
while ($i -lt $params.Length) {
    switch ($params[$i]) {
        "-u" {
            if ($i + 1 -lt $params.Length) {
                $GITHUB_URL = $params[$i + 1]
                $i += 2
            } else {
                Write-Host "Option -u requires an argument." -ForegroundColor Red
                Print-Usage
                exit 1
            }
        }
        "-h" {
            if ($i + 1 -lt $params.Length) {
                $DEVICE_IP = $params[$i + 1]
                $i += 2
            } else {
                Write-Host "Option -h requires an argument." -ForegroundColor Red
                exit 1
            }
        }
        "-a" {
            $AUTOSTART = $true
            $i++
        }
        "-s" {
            $RUN_NOW = $true
            $i++
        }
        "-o" {
            $OVERWRITE = $true
            $i++
        }
        default {
            Write-Host "Invalid option: $($params[$i])" -ForegroundColor Red
            Print-Usage
            exit 1
        }
    }
}

# Check for required arguments
if ([string]::IsNullOrEmpty($GITHUB_URL) -or [string]::IsNullOrEmpty($DEVICE_IP)) {
    Write-Host "Error: -u (github_url) and -h (device_ip) are required arguments" -ForegroundColor Red
    Print-Usage
    exit 1
}

$CHAR_LIMIT = 1024  # Max characters per chunk
$SCRIPT_NAME = [System.IO.Path]::GetFileName($GITHUB_URL)

# 1. Check if script with the same name exists
Write-Host "--- Checking existing scripts ---" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.List" -Method Get
    Check-RpcError -JsonResponse $response -ActionName "Retrieving script list"
} catch {
    Write-Host "Failed to retrieve script list: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$SCRIPT_ID = $null
if ($response.scripts) {
    $script = $response.scripts | Where-Object { $_.name -eq $SCRIPT_NAME }
    if ($script) {
        $SCRIPT_ID = $script.id
    }
}

# 2. If not, create a new script slot with that name
if ($null -eq $SCRIPT_ID) {
    Write-Host "No existing script named '$SCRIPT_NAME' found. Creating new script slot..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.Create?name=$SCRIPT_NAME" -Method Get
        Check-RpcError -JsonResponse $response -ActionName "Creating the script"
        $SCRIPT_ID = $response.id
        Write-Host "Created new script with id: $SCRIPT_ID" -ForegroundColor Green
    } catch {
        Write-Host "Failed to create script: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    if (-not $OVERWRITE) {
        Write-Host "Error: Script named '$SCRIPT_NAME' already exists (id: $SCRIPT_ID)" -ForegroundColor Red
        Write-Host "Use -o flag to overwrite the existing script" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "--- Stopping existing script ---" -ForegroundColor Cyan
    try {
        $stopBody = @{ id = $SCRIPT_ID } | ConvertTo-Json -Compress
        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.Stop" -Method Post -Body $stopBody -ContentType "application/json"
        Check-RpcError -JsonResponse $response -ActionName "Stopping script at slot id: $SCRIPT_ID"
    } catch {
        Write-Host "Failed to stop script: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 3. Download source code to a temporary variable
Write-Host "--- Downloading script from GitHub ---" -ForegroundColor Cyan
try {
    $SCRIPT_CONTENT = Invoke-RestMethod -Uri $GITHUB_URL -Method Get
} catch {
    Write-Host "Failed to download script from GitHub: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$TOTAL_CHARS = $SCRIPT_CONTENT.Length
$CURRENT_CHAR = 0

# 4. Upload in chunks
Write-Host "--- Starting chunked upload to Shelly (script slot id: $SCRIPT_ID) ---" -ForegroundColor Cyan

$OFFSET = 0
$APPEND = $false

while ($CURRENT_CHAR -lt $TOTAL_CHARS) {
    # Slice the string by character count
    $remaining = $TOTAL_CHARS - $CURRENT_CHAR
    $chunkSize = [Math]::Min($CHAR_LIMIT, $remaining)
    $CHUNK = $SCRIPT_CONTENT.Substring($CURRENT_CHAR, $chunkSize)

    # Calculate progress
    $UPLOADED_CHARS = $CURRENT_CHAR + $CHUNK.Length
    if ($UPLOADED_CHARS -gt $TOTAL_CHARS) {
        $UPLOADED_CHARS = $TOTAL_CHARS
    }
    $PERCENTAGE = [Math]::Floor(($UPLOADED_CHARS * 100) / $TOTAL_CHARS)

    # Print progress in single line (overwrite previous line)
    Write-Host "`rUploading: $UPLOADED_CHARS from $TOTAL_CHARS ($PERCENTAGE%)" -NoNewline

    try {
        $putCodeBody = @{
            id = $SCRIPT_ID
            code = $CHUNK
            append = $APPEND
        } | ConvertTo-Json -Compress

        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.PutCode" `
                                     -Method Post `
                                     -Body $putCodeBody `
                                     -ContentType "application/json; charset=utf-8"

        Check-RpcError -JsonResponse $response -ActionName "Upload at char $CURRENT_CHAR"
    } catch {
        Write-Host ""
        Write-Host "Failed to upload chunk at char $CURRENT_CHAR : $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    $CURRENT_CHAR = $CURRENT_CHAR + $CHAR_LIMIT
    $APPEND = $true
}

# Print newline after progress line
Write-Host ""
Write-Host "Upload complete." -ForegroundColor Green

# 5. Optionally set autostart
if ($AUTOSTART) {
    Write-Host "--- Enabling Autostart ---" -ForegroundColor Cyan
    try {
        $configBody = @{
            id = $SCRIPT_ID
            config = @{ enable = $true }
        } | ConvertTo-Json -Compress

        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.SetConfig" `
                                     -Method Post `
                                     -Body $configBody `
                                     -ContentType "application/json"
        Check-RpcError -JsonResponse $response -ActionName "Setting Autostart"
    } catch {
        Write-Host "Failed to set autostart: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 6. Optionally run immediately
if ($RUN_NOW) {
    Write-Host "--- Starting Script ---" -ForegroundColor Cyan
    try {
        $startBody = @{ id = $SCRIPT_ID } | ConvertTo-Json -Compress
        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.Start" `
                                     -Method Post `
                                     -Body $startBody `
                                     -ContentType "application/json"
        Check-RpcError -JsonResponse $response -ActionName "Starting Script"

        Start-Sleep -Seconds 2

        $statusBody = @{ id = $SCRIPT_ID } | ConvertTo-Json -Compress
        $response = Invoke-RestMethod -Uri "http://$DEVICE_IP/rpc/Script.GetStatus" `
                                     -Method Post `
                                     -Body $statusBody `
                                     -ContentType "application/json"
        Check-RpcError -JsonResponse $response -ActionName "Script Status Check"
    } catch {
        Write-Host "Failed to start script: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "--- Deployment Finished ---" -ForegroundColor Green
