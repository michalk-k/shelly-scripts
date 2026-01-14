#!/usr/bin/env bash
#
# Deploy Script to Shelly Device
# Downloads a script from remote location (ie GitHub) or loads from local file and uploads it to a Shelly device via RPC API.
# Supports chunked uploads, autostart configuration, run after upload.
# Recognizes already uploaded script by its name (incl. suffixes) to overwrite it, if requested.
#
# Author: Michal Bartak
# Date: 2026-01-14
#

# --- Helper Function: Check JSON for Errors ---
check_rpc_error() {
    local json_response=$1
    local action_name=$2

    # Check if curl failed to get any response
    if [ -z "$json_response" ]; then
        echo "Error: No response from device during '$action_name'. Check connection."
        exit 1
    fi

    # Extract code and message (handling both root-level and nested error object)
    # We look for a 'code' value that is negative.
    local code=$(echo "$json_response" | jq -r '.code // 0')
    local message=$(echo "$json_response" | jq -r '.message // ""')
    local emessage=$(echo "$json_response" | jq -r '.error_msg // ""')

    if [[ -n "$emessage" ]]; then
        echo "FAILED: $action_name"
        echo "Message: $emessage"
        exit 1
    fi

    if [[ "$code" -lt 0 ]]; then
        echo "FAILED: $action_name"
        echo "Error Code: $code"
        echo "Message: $message"
        exit 1
    fi
}

# --- Helper Function: Print Usage ---
print_usage() {
    echo "Usage: $0 (-u <github_url> | -f <local_file>) -h <device_ip> [-a] [-s] [-o]"
    echo "  -u: GitHub URL (required if -f not specified)"
    echo "  -f: Local file path (required if -u not specified)"
    echo "  -h: Device IP address (required)"
    echo "  -a: Enable autostart (flag)"
    echo "  -s: Start after upload (flag)"
    echo "  -o: Overwrite existing script (flag)"
}

# Parse command line arguments
GITHUB_URL=""
LOCAL_FILE=""
DEVICE_IP=""
AUTOSTART="false"
RUN_NOW="false"
OVERWRITE="false"

while getopts "u:f:h:aso" opt; do
    case $opt in
        u)
            GITHUB_URL="$OPTARG"
            ;;
        f)
            LOCAL_FILE="$OPTARG"
            ;;
        h)
            DEVICE_IP="$OPTARG"
            ;;
        a)
            AUTOSTART="true"
            ;;
        s)
            RUN_NOW="true"
            ;;
        o)
            OVERWRITE="true"
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            print_usage
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument." >&2
            exit 1
            ;;
    esac
done

# Check for required arguments
if [ -z "$DEVICE_IP" ]; then
    echo "Error: -h (device_ip) is required" >&2
    print_usage
    exit 1
fi

if [ -z "$GITHUB_URL" ] && [ -z "$LOCAL_FILE" ]; then
    echo "Error: Either -u (github_url) or -f (local_file) must be specified" >&2
    print_usage
    exit 1
fi

if [ -n "$GITHUB_URL" ] && [ -n "$LOCAL_FILE" ]; then
    echo "Error: Cannot specify both -u and -f. Use either -u or -f." >&2
    print_usage
    exit 1
fi

CHAR_LIMIT=1024  # Max characters per chunk

# Determine script name from URL or file path
if [ -n "$GITHUB_URL" ]; then
    SCRIPT_NAME=$(basename "$GITHUB_URL")
elif [ -n "$LOCAL_FILE" ]; then
    SCRIPT_NAME=$(basename "$LOCAL_FILE")
fi

# 1. Check if script with the same name exists
echo "--- Checking existing scripts ---"
RESPONSE=$(curl -s -X GET "http://$DEVICE_IP/rpc/Script.List")
check_rpc_error "$RESPONSE" "Retrieving script list"

SCRIPT_ID=$(echo "$RESPONSE" | jq --arg name "$SCRIPT_NAME" '.scripts[] | select(.name == $name) | .id')

# 2. If not, create a new script slot with that name
if [ -z "$SCRIPT_ID" ]; then
  echo "No existing script named '$SCRIPT_NAME' found. Creating new script slot..."
  RESPONSE=$(curl -s -X GET "http://$DEVICE_IP/rpc/Script.Create?name=$SCRIPT_NAME")
  check_rpc_error "$RESPONSE" "Creating the script"
  SCRIPT_ID=$(echo "$RESPONSE" | jq '.id')

  echo "Created new script with id: $SCRIPT_ID"
else
    if [ "$OVERWRITE" != "true" ]; then
        echo "Error: Script named '$SCRIPT_NAME' already exists (id: $SCRIPT_ID)"
        echo "Use -o flag to overwrite the existing script"
        exit 1
    fi
    echo "--- Stopping existing script ---"
    RESPONSE=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.Stop" -d "{\"id\": $SCRIPT_ID}")
    check_rpc_error "$RESPONSE" "Stopping script at slot id: $SCRIPT_ID"
fi


# 3. Load source code from URL or local file
if [ -n "$GITHUB_URL" ]; then
    echo "--- Downloading script from GitHub ---"
    SCRIPT_CONTENT=$(curl -sL "$GITHUB_URL") || exit 1
elif [ -n "$LOCAL_FILE" ]; then
    echo "--- Reading script from local file ---"
    if [ ! -f "$LOCAL_FILE" ]; then
        echo "Error: Local file '$LOCAL_FILE' does not exist" >&2
        exit 1
    fi
    SCRIPT_CONTENT=$(cat "$LOCAL_FILE") || exit 1
fi

TOTAL_CHARS=${#SCRIPT_CONTENT}
CURRENT_CHAR=0

# 4. Upload in chunks
echo "--- Starting chunked upload to Shelly (script slot id: $SCRIPT_ID) ---"

OFFSET=0
APPEND="false"

while [ $CURRENT_CHAR -lt $TOTAL_CHARS ]; do
    # Slice the string by character count
    CHUNK="${SCRIPT_CONTENT:$CURRENT_CHAR:$CHAR_LIMIT}"

    # Calculate progress
    UPLOADED_CHARS=$((CURRENT_CHAR + ${#CHUNK}))
    if [ $UPLOADED_CHARS -gt $TOTAL_CHARS ]; then
        UPLOADED_CHARS=$TOTAL_CHARS
    fi
    PERCENTAGE=$((UPLOADED_CHARS * 100 / TOTAL_CHARS))

    # Print progress in single line (overwrite previous line)
    printf "\rUploading: %d from %d (%d%%)" "$UPLOADED_CHARS" "$TOTAL_CHARS" "$PERCENTAGE"

    RESPONSE=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.PutCode" \
         -H "Content-Type: application/json; charset=utf-8" \
         -d "{
          \"id\": $SCRIPT_ID,
          \"code\": $(echo -n "$CHUNK" | jq -Rs .),
          \"append\": $APPEND
         }")

    check_rpc_error "$RESPONSE" "Upload at char $CURRENT_CHAR"

    CURRENT_CHAR=$((CURRENT_CHAR + CHAR_LIMIT))
    APPEND="true"
done

# Print newline after progress line
echo ""
echo "Upload complete."

# 5. Optionally set autostart
if [ "$AUTOSTART" = "true" ]; then
    echo "--- Enabling Autostart ---"
    RESPONSE=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.SetConfig" \
         -d "{\"id\": $SCRIPT_ID, \"config\": {\"enable\": true}}")
    check_rpc_error "$RESPONSE" "Setting Autostart"
fi

# 6. Optionally run immediately
if [ "$RUN_NOW" = "true" ]; then
    echo "--- Starting Script ---"
    RESPONSE=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.Start" -d "{\"id\": $SCRIPT_ID}")
    check_rpc_error "$RESPONSE" "Starting Script"

    sleep 2
    RESPONSE=$(curl -s -X POST "http://$DEVICE_IP/rpc/Script.GetStatus" -d "{\"id\": $SCRIPT_ID}")

    check_rpc_error "$RESPONSE" "Script Status Check"
fi

echo "--- Deployment Finished ---"
