# MQTT PERIODIC COMPONENT PUBLISHER

This script republishes, at a configurable interval, the states of selected components to MQTT.

It is useful for components that are never published by the Shelly device (e.g. `wifi`, `eth`) or for values that are updated only infrequently, such as temperatures.

> **Note:** The switch component also includes temperature measurements. To refresh this temperature more frequently, the switch component itself must be published.

> **Avoid** publishing the same components by different scripts. For example `mqtt-discovery-self`script by default publishes `wifi`.

**Features**

* Easy to use: just run it
* Publishes data from all components, including those not reported by Shelly by default
* Allows configuration of a specific instance (e.g. `temperature:0`) or all instances of a component (e.g. `temperature`)

## Requirements

1. Shelly Gen2, Gen3, or Gen4 device
2. MQTT must be configured and enabled on the Shelly device

## Installation and Configuration

For installation instructions, see the [Installation](/#installation) section.

Link to the script: [link](./mqtt-periodic-pub.shelly.js)

**Configuration parameters**

The script is designed to run without any additional configuration.\
While this is sufficient for most use cases, several settings can be customized if needed.

| Variable | Default Value | Description |
| --- | --- | --- |
| `components` | `["temperature"]` | List of components or their instances, e.g. `temperature` or `temperature:0` |
| `refresh_period` | `60` | [seconds] Interval at which component state data is published |
| `publish_delay` | `500` | [milliseconds] Delay between publishing individual topics, to prevent internal Shelly MQTT queue overflow |
