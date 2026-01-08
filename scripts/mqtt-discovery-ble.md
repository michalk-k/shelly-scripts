# MQTT DISCOVERY: BLE (Passive BLE Scanner & MQTT Gateway)

The script is a passive BLE scanner and MQTT gateway that automatically registers detected BLE devices and their entities to Home Assistant (or other MQTT autodiscovery consumers). It can filter detected devices by MAC address.

**Features**

* Passive BLE scanner + MQTT gateway
* MQTT Autodiscovery support (creates discovery topics under configured discovery topic)
* In HomeAssistant BLE device will appear as proxied by proxying device. Pairing by macaddress
* Filtering by MAC address (recommended) with KVS-enabled configuration
* Supports BTHomev2 (Shelly) as well as ATC and Xiaomi advertisement payloads

## Requirements

1. Shelly device with Bluetooth/ BLE enabled (check `Settings / System / Bluetooth` or device component config)
1. MQTT configured and enabled on the Shelly device

## Installation and Configuration

For installation, read the [Installation](/#installation) section.

Link to the script: [link](./mqtt-discovery-ble.shelly.js)

**Quick instructions**

1. Run the script with default settings (debug and filtering enabled by default)
2. Open the script debug console in Shelly UI
3. Press the button on the BLE device you want to add, or wait for it to advertise
4. Copy the MAC address from the debug console
5. Add the MAC to the `allowed_devices` variable in the script or add it to the KVS key `allowed_devices` (JSON format, see below)
6. Restart the script
7. Look for the device and its entities in Home Assistant

**Configuration parameters**

| Variable | Default Value | Description |
| --- | --- | --- |
| `filter_devices` | `true` | If `true` only devices present in `allowed_devices` (or in the KVS `allowed_devices` key) are processed. If `false`, all BLE advertisements are processed (not recommended). |
| `debug` | `true` | When `true` prints detected/ignored MACs and discovered entity names to console. |
| `allowed_devices` | `{}` | Local structure of allowed devices. Keys are normalized MAC (no `:`/`-`, lowercase). Value is array: `["Manufacturer", "Model"]`. If manufacturer or model are not known, use empty array `[]`. |
| `mqtt_src` | `<device_id> (<device_name>)` | Added to reported payload as `src` to identify which Shelly device forwarded the advertisement. Set to `null` to disable.<br>:bulb: This value is not used to join the BLE devices with proxy devices. |
| `kvs_key` | `"allowed_devices"` | KVS key used to load allowed devices (JSON). The script merges KVS values into `allowed_devices` at startup. |
| `mqtt_topic` | `"blegateway/"` | Base MQTT topic used to publish BLE data. Final topic is `mqtt_topic/<mac>/<subtopic>` (see "Topics & Discovery" section). |
| `discovery_topic` | `"homeassistant/"` | Base MQTT discovery topic used for publishing entity configuration. |

> :warning: If `filter_devices` is `true` and neither `allowed_devices` nor the KVS key are set, the script will ignore all devices.

**KVS: Adding allowed devices without editing the script**

You can store the devices list in Shelly KVS under the `allowed_devices` key. It should be valid JSON with the structure:

```json
{
  "3c2e1a7b8c9d": ["Shelly", "H&T BLU"],
  "aabbccddeeff": []
}
```

After setting the KVS key, restart the script so the new data are merged into `CONFIG.allowed_devices`.


## How it works

- The script subscribes to BLE scanner events and passively inspects advertisements.
- It recognizes Shelly, ATC, Xiaomi and BTHomev2 payload types and extracts supported values (temperature, humidity, battery, illuminance, pressure, rotation, motion, window/contact, button events, etc.).
- For a detected device (MAC), if allowed by filtering, the script publishes the measurement payload to an MQTT topic and creates MQTT discovery entries for entities that Home Assistant can use.
- Discovery topics are published retained so HA will pick up entities; measurement topics are mostly non-retained, except for a few per-value retained subtopics (see below) to help with availability after restarts.

## Topics & Discovery

- Measurement topic: `<CONFIG.mqtt_topic>/<normalized_mac>/<topicName>`
  - `topicName` is either the single parameter name (e.g., `temperature`) or `data` if multiple keys exist.
  - Example: `blegateway/3c2e1a7b8c9d/temperature` or `blegateway/3c2e1a7b8c9d/data`
- Discovery config topic: `<CONFIG.discovery_topic>/<domain>/<normalized_mac>/<subtopic>/config`
  - Example: `homeassistant/sensor/3c2e1a7b8c9d/temperature/config`
- The script publishes retained discovery config messages. To reduce 'unknown' states after HA or broker restart, the script also publishes retained values for `window` (contact) and `rotation` (tilt) under subtopics `.../window` and `.../rotation` when present.

## Entities created

Depending on reported payload keys, the script will create appropriate entity types in Home Assistant using MQTT discovery:

- Sensors: `temperature`, `humidity`, `battery` (diagnostic), `illuminance`, `pressure`, `rssi` (diagnostic), `rotation` (tilt)
- Binary sensors: `motion`, `window` (contact)
- Buttons: created as event-type entities (button press, double press, long press, hold, etc.)

## Debugging

- Set `debug` to `true` to print `Ignored MAC:` and `Processed MAC:` messages and to see created entity names in console.
- To temporarily accept all BLE messages, set `filter_devices` to `false` (not recommended for long runs).

## Q&As

<details><summary>How do I add a device to be processed?</summary>

---

1. Run the script with `debug=true`.
1. Trigger the BLE device to advertise and copy its MAC address from the Shelly console.
1. Add the normalized MAC and optional `["manufacturer","model"]` pair to `CONFIG.allowed_devices` or to KVS key `allowed_devices` (see example above).
1. Restart the script.

---

</details>

<details><summary>Why do entities show unknown/unavailable after HA or broker restart?</summary>

---

This is a common MQTT discovery/retention issue: measurement topics are not always published with the retain flag by BLE devices. Discovery config is retained, so entities exist, but state topics may be empty until the next advertisement. You can ask Shelly devices to republish retained data using the `shellies/command` `announce` payload or use automations to trigger a republish.

---

</details>

<details><summary>Can this script report BLE devices connected to Shelly (the device's attached BLE clients)?</summary>

---

This script is a passive scanner for all nearby BLE advertisements and is not limited to BLE peripherals connected to the Shelly device. It is complementary to scripts that read device-attached BLE nodes.

---
</details>
