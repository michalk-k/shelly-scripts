# Deploy script

The script downloads a shelly script from any URL (ie GitHub) and uploads it to a Shelly device via RPC API.

**Features**
* Bash and PowerShell version
* upload from remote location or file
* chunked uploads (needed by Shelly)
* option to set autostart
* option to run after upload
* recognize already uploaded script by its name to overwrite it, if requested.
* progress indicator

## Installation

Download script from the repo:

* Bash version: [click](./deploy_script.sh)
* PowerShell version: [click](./deploy_script.ps1)

## Usage

`deploy_script (-u <remote_url> | -f <local_file>) -h <device_ip> [-a] [-s] [-o]`

*Parameters:*

```
-u: Remote file URL (required if -f not specified)
-f: Local file path (required if -u not specified)
-h: Device IP address (required)
-a: Enable autostart (flag)
-s: Start after upload (flag)
-o: Overwrite existing script (flag)
```

## Demo
![Deploy script demo](../images/deploy_script.gif)
