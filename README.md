# Shelly Scripts

The collection of Shelly scripts.
All scripts shares the same installation methods. Read [Installation](#installation) section

The repository offers following scripts:

**MQTT Discovery: Self** [docs](scripts/mqtt-discovery-self.md)\
The script registers the Shelly device (including addons) into MQTT using Discovery protocol (commonly used by Home Assistant).

**MQTT Discovery: BLE** \
The script registers BLE devices being proxied by the shelly device (proxy) into MQTT, using Discovery protocol (commonly used by Home Assistant).

**MQTT Discovery: Scripts Monitor** [docs](scripts/mqtt-discovery-scr-mon.md)\
The script monitors state of Shelly scripts, providing this information to Home assistant sensor, utilizing MQTT Discovery protocol

## Installation

There are several methods how to install scripts.

<details><summary><b>Manual copy&paste</b></summary>

---

1. In this GIT repository
   1. enter [scripts](./scripts) directory
   1. select the script
   1. press Copy Raw File button
1. Open Shelly GUI
   1. Select `Scripts` from menu
   1. Create new script (or open existing one)
   1. Paste copied script
   1. Run it, optionally mark as `Run at Startup`

---
</details>

<details><summary><b>Use library</b></summary>

---

1. Open Shelly GUI
   1. Select Scripts from menu
   1. press the `Library` button
   1. Enter URL listed below into `Configure URL` field. It will list all my scripts
   1. Pick one you want to install. it will create new script
   1. Run it, optionally mark as `Run at Startup`

```
https://raw.githubusercontent.com/michalk-k/shelly-scripts/main/manifest.json
```
---
</details>

<details><summary><b>Use utility to upload</b></summary>

---

I'm preparing an utility in form of bash and PowerShell scripts. The utility uploads a script from the any URL repository to shelly device on provided IP address.

---
</details>

