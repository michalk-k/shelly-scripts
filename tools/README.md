# Deploy script

The script uploads any script to a Shelly device via RPC API. It can either upload local file or download the script from URL (ie GitHub).

**Features**
* Bash and PowerShell version
* upload from remote location or local file
* Supports Shelly device password
* Chunked uploads (required by Shelly)
* Option to set the Autostart and Run after upload
* Recognize already uploaded script by its name to overwrite it, if requested.
* Progress indicator

## Installation

Download script from the repo:

* Bash version: [click](./deploy_script.sh)
* PowerShell version: [click](./deploy_script.ps1)

## Usage

`deploy_script (-u <remote_url> | -f <local_file>) -h <device_addr> [-U <username>|admin] [-P <password>] [-a] [-s] [-o]`

*Parameters:*

```
-u: Remote file URL (required if -f not specified). Note it has to point to **raw file**.
-f: Local file path (required if -u not specified)
-h: Shelly device address (required)
-a: Enable autostart (flag)
-s: Start after upload (flag)
-o: Overwrite existing script (flag). Script is recognized by its file name (incl. suffix)
-U: Username for device authentication (optional). Shelly devices accepts `admin` only. If -U is missing while `-P` is provided, the -U defaults to `admin`
-P: Password for device authentication (optional).
```

## Demo
![Deploy script demo](../images/deploy_script.gif)
