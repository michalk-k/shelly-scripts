#!/bin/bash

# Check for minimum required arguments
if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <github_url> <device_ip> <script_id> [autostart: true/false] [run_now: true/false]"
    exit 1
fi

GITHUB_URL=$1
DEVICE_IP=$2
SCRIPT_ID=$3
AUTOSTART=${4:-false}
RUN_NOW=${5:-false}

# 1. Download source code from GitHub
# Note: We use 'L' to follow redirects (common for raw.githubusercontent.com)
echo "--- Downloading script from GitHub ---"
SCRIPT_CODE=$(curl -sL "$GITHUB_URL")

if [ -z "$SCRIPT_CODE" ]; then
    echo "Error: Failed to download script or file is empty."
    exit 1
fi

# 2. Upload script to Shelly
# We use the Script.Put RPC method. Code must be sent as a string.
echo "--- Uploading to Shelly (ID: $SCRIPT_ID) at $DEVICE_IP ---"
upload_response=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.Put" \
     -d "{
      \"id\": $SCRIPT_ID,
      \"code\": $(echo "$SCRIPT_CODE" | jq -Rsa .)
     }")

echo "Upload response: $upload_response"

# 3. Optionally set autostart
if [ "$AUTOSTART" = "true" ]; then
    echo "--- Setting autostart to true ---"
    curl -s -X POST "http://$DEVICE_IP/rpc/Script.SetConfig" \
         -d "{\"id\": $SCRIPT_ID, \"config\": {\"enable\": true}}"
fi

# 4. Optionally run immediately
if [ "$RUN_NOW" = "true" ]; then
    echo "--- Starting script now ---"
    curl -s -X POST "http://$DEVICE_IP/rpc/Script.Start" \
         -d "{\"id\": $SCRIPT_ID}"
fi

echo "--- Deployment finished ---"
