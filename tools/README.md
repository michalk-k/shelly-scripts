This directory contain some tools helping with work with Shellies

## deploy_script

This is a script uploading a Shelly script directly to the Shelly device. The script is available for the `bash` and the `PowerShell`.

Usage:
```
deploy_script.sh <github_url> <device_ip> <script_id> [autostart: true/false] [run_now: true/false]
```

Example:
```
./deploy_script.sh "https://raw.githubusercontent.com/michalk-k/shelly-scripts/master/scripts/mqtt-discovery-self.shelly.js" 192.168.1.50 1 true true
```
