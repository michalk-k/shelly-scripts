# Deploy script

The script downloads a shelly script from any URL (ie GitHub) and uploads it to a Shelly device via RPC API.

**Features**
* Bash and PowerShell version
* upload from remote location or file
* Supports Shelly device credentials
* Chunked uploads (needed by Shelly)
* Option to set the Autostart and Run after upload
* Recognize already uploaded script by its name to overwrite it, if requested.
* Progress indicator

## Installation

Download script from the repo:

* Bash version: [click](./deploy_script.sh)
* PowerShell version: [click](./deploy_script.ps1)

## Usage

`deploy_script (-u <remote_url> | -f <local_file>) -h <device_addr> [-a] [-s] [-o]`

*Parameters:*

```
-u: Remote file URL (required if -f not specified). Note it has to point to **raw file**.
-f: Local file path (required if -u not specified)
-h: Shelly device address (required)
-a: Enable autostart (flag)
-s: Start after upload (flag)
-o: Overwrite existing script (flag). Script is recognized by its file name (incl. suffix)
-U: Username for device authentication (optional)
-P: Password for device authentication (optional, requires -U)
```

## Demo
![Deploy script demo](../images/deploy_script.gif)
