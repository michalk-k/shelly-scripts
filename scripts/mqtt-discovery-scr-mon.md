# MQTT DISCOVERY: SCRIPTS MONITOR

The script monitors state of Shelly scripts, providing the data to Home Assistant.\
State of all installed scripts is collected and reported using MQTT discovery.

If you run other scripts from this package, the entity will be added to Diagnostic section.

**Features**

* Easy to use: just run it
* Creates entity with information about all Shelly scripts installed on this device
* Creates a HA device or attach to existing one created by other script from this suite.

## Requirements

1. Shelly gen2, gen3 or gen4 device
1. The MQTT has to be configured and enabled in the Shelly device.
1. Home Assistant have to have mqtt discovery enabled

## Installation and Configuration

For installation, read the [Installation](../README.md#installation) section.

**Configuration parameters**

The script is configured to be run without the need for additional configuration.\
While valid for most cases, it still provides an option to change some settings.

| Variable | Default Value | Description |
| --- | --- | --- |
| `custom_names.device` | `true` | Name HA device using device name set in Shelly configuration.<br>Read [Device naming](#device) section for more details. |
| `report_ip` | `true` | Report ip address of the Shelly device to the Discovery data. It results in a clickable link on the device page in Home Assistant. |
| `fake_macaddress` | `""` | For testing purposes, set alternative macaddress. |
| `discovery_topic` | `"homeassistant"` | MQTT discovery topic. |
| `components_refresh_period` | `60` | [Seconds] Frequency of publishing scripts state data. |


## How does it work

The script collects all data about scripts, provided by Shelly API.\
It creates new MQTT topic, at the same location other data of this Shelly device are reported. The new topic is called `scripts`.

On Shelly start, the script registers a sensor entity that utilizes this topic as data source, using MQTT Discovery.

While entity state reflects number of running script, information about scripts are located in sensor attributes. Here is an example:

```json
{
  "friendly_name": "PCroom HVAC Socket Scripts",
  "icon": "mdi:script-text-outline",
  "mem_free": 12922,
  "scripts": [
    {
      "enable": true,
      "id": 1,
      "mem_peak": 14294,
      "mem_used": 9282,
      "name": "ble-pasv-mqtt-gw",
      "running": true
    },
    {
      "enable": false,
      "id": 2,
      "name": "mqtt-discovery-self",
      "running": false
    },
    {
      "enable": true,
      "id": 3,
      "mem_peak": 3402,
      "mem_used": 2422,
      "name": "mqtt-discovery-scr-mon",
      "running": true
    },
    {
      "enable": false,
      "id": 4,
      "name": "error test",
      "running": false,
      "errors": [
        "reference_error"
      ],
      "error_msg": "Uncaught ReferenceError: \"adfd\" is not defined\n at adfd\n^\n\n"
    }
  ]
}
```

Attributes comes from Shelly API. Here is their meaning:

| Name | Datatype | Description |
| :---- | :-------- | :----------- |
| mem_free | int   | Amount of free memory for scripting (shared for all scripts). The key is not available if no script is running.|
| scripts | json | array of objects that reflects state of all scripts. |
| id | int   | Identifier of the script. |
| name | string   | Name of the script. |
| enable | bool   | If true, script is executed at Shelly (re)start. |
| running | bool   | The script is currently running. |
| mem_peak | int   | Maximum memory footprint (in bytes) registered for this script since last run. The key is not available if script is not running.|
| mem_used | int   | Current memory usage (in bytes) of ths script. The key is not available if script is not running. |
| errors | json array   | Array of errors names (strings). The key is not available when no errors reported.  |
| error_msg | string   | Last error message. The key is not available if no error has been reported. |

## Q&As

<details><summary>
Data provided in `state/script:N` topics doesn't match reported by this script</summary>

---

Indeed, Shelly does't report script statuses often enough.\
The most recent values are available for example by calling `http://shelly.address/rpc/Script.GetStatus?id=N`, or `Sys.GetStatus` and `Shelly.GetStatus` that aggregates data from all components.

This script provides up-to-date values retrieved at time of reporting from Script.GetStatus method.

---
</details>