#Requires -Version 5.1
#
# Deploy Script to Shelly Device
# Downloads a script from remote location (ie GitHub) or loads from local file and uploads it to a Shelly device via RPC API.
# Supports chunked uploads, autostart configuration, run after upload.
# Recognizes already uploaded script by its name (incl. suffixes) to overwrite it, if requested.
#
# Author: Michal Bartak
# Date: 2026-01-18
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

# Manual Digest auth implementation using System.Security.Cryptography.SHA256 for hashing.
# The Invoke-ShellyDigestAuth function handles the full challenge-response flow.
# The function takes the following parameters:
# - Uri: The URI of the API endpoint
# - Username: The username for authentication
# - Password: The password for authentication
# - Method: The HTTP method to use (GET or POST)
# - Body: The body of the request (optional)
# The function returns the response from the API endpoint.
function Invoke-ShellyDigestAuth {
    param(
        [string]$Uri,
        [string]$Username,
        [string]$Password,
        [string]$Method = "GET",
        [string]$Body = $null
    )

    $fullUri = [System.Uri]$Uri

    # Step 1: Make initial request to get the WWW-Authenticate header
    $request1 = [System.Net.WebRequest]::Create($Uri)
    $request1.Method = $Method

    if ($Body) {
        $request1.ContentType = "application/json"
        $bodyBytes1 = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $request1.ContentLength = $bodyBytes1.Length
        $reqStream1 = $request1.GetRequestStream()
        $reqStream1.Write($bodyBytes1, 0, $bodyBytes1.Length)
        $reqStream1.Close()
    }

    try {
        $response1 = $request1.GetResponse()
        # If we get here without 401, auth not required
        $stream = $response1.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $response1.Close()
        return $content
    } catch [System.Net.WebException] {
        $response1 = $_.Exception.Response
        if ($response1.StatusCode -ne [System.Net.HttpStatusCode]::Unauthorized) {
            throw
        }
        $wwwAuth = $response1.Headers["WWW-Authenticate"]
        $response1.Close()
    }

    # Step 2: Parse the WWW-Authenticate header
    $realm = if ($wwwAuth -match 'realm="([^"]+)"') { $matches[1] } else { "" }
    $nonce = if ($wwwAuth -match 'nonce="([^"]+)"') { $matches[1] } else { "" }
    $qop = if ($wwwAuth -match 'qop="([^"]+)"') { $matches[1] } else { "" }
    $algorithm = if ($wwwAuth -match 'algorithm=([^,\s]+)') { $matches[1] } else { "MD5" }

    # Step 3: Generate client nonce and nonce count
    $cnonce = [System.Guid]::NewGuid().ToString("N").Substring(0, 16)
    $nc = "00000001"

    # Step 4: Compute digest based on algorithm
    function Get-Hash {
        param([string]$Text, [string]$Alg)

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)

        if ($Alg -eq "SHA-256") {
            $hasher = [System.Security.Cryptography.SHA256]::Create()
        } else {
            $hasher = [System.Security.Cryptography.MD5]::Create()
        }

        $hash = $hasher.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hash) -replace '-','').ToLower()
    }

    $uriPath = $fullUri.PathAndQuery

    # HA1 = hash(username:realm:password)
    $ha1 = Get-Hash -Text "${Username}:${realm}:${Password}" -Alg $algorithm

    # HA2 = hash(method:uri)
    $ha2 = Get-Hash -Text "${Method}:${uriPath}" -Alg $algorithm

    # Response = hash(HA1:nonce:nc:cnonce:qop:HA2) for qop=auth
    if ($qop -eq "auth") {
        $responseHash = Get-Hash -Text "${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}" -Alg $algorithm
    } else {
        $responseHash = Get-Hash -Text "${ha1}:${nonce}:${ha2}" -Alg $algorithm
    }

    # Step 5: Build Authorization header
    $authHeader = "Digest username=`"$Username`", realm=`"$realm`", nonce=`"$nonce`", uri=`"$uriPath`", algorithm=$algorithm, response=`"$responseHash`", qop=$qop, nc=$nc, cnonce=`"$cnonce`""

    # Step 6: Make authenticated request
    $request2 = [System.Net.WebRequest]::Create($Uri)
    $request2.Method = $Method
    $request2.Headers.Add("Authorization", $authHeader)

    if ($Body) {
        $request2.ContentType = "application/json"
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $request2.ContentLength = $bodyBytes.Length
        $reqStream = $request2.GetRequestStream()
        $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
        $reqStream.Close()
    }

    $response2 = $request2.GetResponse()
    $stream = $response2.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $reader.Close()
    $response2.Close()

    return $content
}

# --- Helper Function: Print Usage ---
function Print-Usage {
    Write-Host "Usage: $($MyInvocation.ScriptName) (-u <github_url> | -f <local_file>) -h <device_ip> [-U <username>] [-P <password>] [-a] [-s] [-o]"
    Write-Host "  -u: GitHub URL (required if -f not specified)"
    Write-Host "  -f: Local file path (required if -u not specified)"
    Write-Host "  -h: Device IP address (required)"
    Write-Host "  -U: Username for device authentication (optional, defaults to 'admin' if -P is provided)"
    Write-Host "  -P: Password for device authentication (optional)"
    Write-Host "  -a: Enable autostart (flag)"
    Write-Host "  -s: Start after upload (flag)"
    Write-Host "  -o: Overwrite existing script (flag)"
}

# Parse command line arguments
$GITHUB_URL = ""
$LOCAL_FILE = ""
$DEVICE_IP = ""
$DEVICE_USER = ""
$DEVICE_PASS = ""
$AUTOSTART = $false
$RUN_NOW = $false
$OVERWRITE = $false

# PowerShell parameter parsing
$params = $args
$i = 0
while ($i -lt $params.Length) {
    switch -CaseSensitive ($params[$i]) {
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
        "-f" {
            if ($i + 1 -lt $params.Length) {
                $LOCAL_FILE = $params[$i + 1]
                $i += 2
            } else {
                Write-Host "Option -f requires an argument." -ForegroundColor Red
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
        "-U" {
            if ($i + 1 -lt $params.Length) {
                $DEVICE_USER = $params[$i + 1]
                $i += 2
            } else {
                Write-Host "Option -U requires an argument." -ForegroundColor Red
                Print-Usage
                exit 1
            }
        }
        "-P" {
            if ($i + 1 -lt $params.Length) {
                $DEVICE_PASS = $params[$i + 1]
                $i += 2
            } else {
                Write-Host "Option -P requires an argument." -ForegroundColor Red
                Print-Usage
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
if ([string]::IsNullOrEmpty($DEVICE_IP)) {
    Write-Host "Error: -h (device_ip) is required" -ForegroundColor Red
    Print-Usage
    exit 1
}

if ([string]::IsNullOrEmpty($GITHUB_URL) -and [string]::IsNullOrEmpty($LOCAL_FILE)) {
    Write-Host "Error: Either -u (github_url) or -f (local_file) must be specified" -ForegroundColor Red
    Print-Usage
    exit 1
}

if (-not [string]::IsNullOrEmpty($GITHUB_URL) -and -not [string]::IsNullOrEmpty($LOCAL_FILE)) {
    Write-Host "Error: Cannot specify both -u and -f. Use either -u or -f." -ForegroundColor Red
    Print-Usage
    exit 1
}

if (-not [string]::IsNullOrEmpty($DEVICE_PASS) -and [string]::IsNullOrEmpty($DEVICE_USER)) {
    $DEVICE_USER = "admin"
}

# Determine script name from URL or file path
if (-not [string]::IsNullOrEmpty($GITHUB_URL)) {
    $SCRIPT_NAME = [System.IO.Path]::GetFileName($GITHUB_URL)
} elseif (-not [string]::IsNullOrEmpty($LOCAL_FILE)) {
    $SCRIPT_NAME = [System.IO.Path]::GetFileName($LOCAL_FILE)
}

# 1. Check if script with the same name exists
Write-Host "--- Checking existing scripts ---" -ForegroundColor Cyan
try {
    $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.List" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "GET"
    $response = $responseText | ConvertFrom-Json
    Check-RpcError -JsonResponse $response -ActionName "Retrieving script list"
} catch {
    Write-Host "Failed to retrieve script list: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$SCRIPT_ID = $null
$SCRIPT_RUNNING = $null
if ($response.scripts) {
    $script = $response.scripts | Where-Object { $_.name -eq $SCRIPT_NAME }
    if ($script) {
        $SCRIPT_ID = $script.id
        $SCRIPT_RUNNING = $script.running
    }
}

# 2. If not, create a new script slot with that name
if ($null -eq $SCRIPT_ID) {
    Write-Host "No existing script named '$SCRIPT_NAME' found. Creating new script slot..." -ForegroundColor Yellow
    try {
        $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.Create?name=$SCRIPT_NAME" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "GET"
        $response = $responseText | ConvertFrom-Json
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
    if ($SCRIPT_RUNNING) {
        Write-Host "--- Stopping existing script ---" -ForegroundColor Cyan
        try {
            $stopBody = @{ id = $SCRIPT_ID } | ConvertTo-Json -Compress
            $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.Stop" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "POST" -Body $stopBody
            $response = $responseText | ConvertFrom-Json
            Check-RpcError -JsonResponse $response -ActionName "Stopping script at slot id: $SCRIPT_ID"
        } catch {
            Write-Host "Failed to stop script: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
}

# 3. Load source code from URL or local file
if (-not [string]::IsNullOrEmpty($GITHUB_URL)) {
    Write-Host "--- Downloading script from GitHub ---" -ForegroundColor Cyan
    try {
        $SCRIPT_CONTENT = Invoke-RestMethod -Uri $GITHUB_URL -Method Get
    } catch {
        Write-Host "Failed to download script from GitHub: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} elseif (-not [string]::IsNullOrEmpty($LOCAL_FILE)) {
    Write-Host "--- Reading script from local file ---" -ForegroundColor Cyan
    if (-not (Test-Path -Path $LOCAL_FILE -PathType Leaf)) {
        Write-Host "Error: Local file '$LOCAL_FILE' does not exist" -ForegroundColor Red
        exit 1
    }
    try {
        $SCRIPT_CONTENT = Get-Content -Path $LOCAL_FILE -Raw
    } catch {
        Write-Host "Failed to read local file: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 4. Upload in chunks
Write-Host "--- Starting chunked upload to Shelly (script slot id: $SCRIPT_ID) ---" -ForegroundColor Cyan

$CHAR_LIMIT = 1024  # Max characters per chunk
$TOTAL_CHARS = $SCRIPT_CONTENT.Length
$CURRENT_CHAR = 0
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

        $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.PutCode" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "POST" -Body $putCodeBody
        $response = $responseText | ConvertFrom-Json

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

        $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.SetConfig" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "POST" -Body $configBody
        $response = $responseText | ConvertFrom-Json
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
        $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.Start" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "POST" -Body $startBody
        $response = $responseText | ConvertFrom-Json
        Check-RpcError -JsonResponse $response -ActionName "Starting Script"

        Start-Sleep -Seconds 2

        $statusBody = @{ id = $SCRIPT_ID } | ConvertTo-Json -Compress
        $responseText = Invoke-ShellyDigestAuth -Uri "http://$DEVICE_IP/rpc/Script.GetStatus" -Username $DEVICE_USER -Password $DEVICE_PASS -Method "POST" -Body $statusBody
        $response = $responseText | ConvertFrom-Json
        Check-RpcError -JsonResponse $response -ActionName "Script Status Check"
    } catch {
        Write-Host "Failed to start script: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "--- Deployment Finished ---" -ForegroundColor Green
