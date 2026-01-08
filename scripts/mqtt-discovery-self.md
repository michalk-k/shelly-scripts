# MQTT DISCOVERY: SELF

The script registers the Shelly device the script runs on and its entities to Home Assistant, using MQTT discovery.\
It creates entities for all supported properties: switches, sensors, etc.

**Features**

* Easy to use: just run it
* Supports wide range of gen2, gen3 and gen4 devices, inlcuding add-ons. See [Supported Devices](#supported-devices)
* Respects `consumption type` set to `light`
* Respects double-switch set to a `cover`
* Can utilize Shelly's device and channel names
* Less important sensors are disabled by default, for example power factor
* The script follows recent Home Assistant convention in entities configuration. Read [Naming](#naming) section for details
* provides periodic components refresh, i.e., for WiFi (RSSI) that is not reported by Shelly devices at all.
* Supports custom formulas and units (xvoltage, xpercentage)
* Re-publishes discovery data on Shelly configuration change or MQTT reconnect.
* Re-publishes Shelly data after discovery to avoid unknown values until the first value change comes.

## Requirements

1. Shelly gen2, gen3 or gen4 device
1. The MQTT has to be configured and enabled in the Shelly device.

## Installation and Configuration

For installation, read the [Installation](/#installation) section.

Link to the script: [link](./mqtt-discovery-self.shelly.js)

**Configuration parameters**

The script is configured to be run without the need for additional configuration.\
While valid for most cases, it still provides an option to change some settings.

| Variable | Default Value | Description |
| --- | --- | --- |
| `temperature_unit` | `"C"` | C or F - Uppercase!!!. Note that the degree symbol will be added by the script itself. |
| `disable_minor_entities` | `true` | Entities considered less unimportant will be disabled by default (can be enabled later in HA). Examples: `Power Factor`, `Voltage`, `Frequency`. It is not applied to addon entities |
| `custom_names.device` | `true` | Name HA device using device name set in Shelly configuration.<br>Read [Device naming](#device) section for more details. |
| `custom_names.channels` | `true` | Name entities using custom names configured for Shelly device channels (inputs, outputs, etc.), if set.<br>Read [Entities naming](#entities) section for more details. |
| `custom_names.addons` | `true` | Name entities using custom names configured for addon channels (inputs, outputs, etc.), if set.<br>Read [Entities naming](#entities) section for more details. |
| `report_ip` | `true` | Report ip address of the Shelly device to the Discovery data. It results in a clickable link on the device page in Home Assistant |
| `fake_macaddress` | `""` | For testing purposes, set alternative macaddress |
| `publish_init_data` | `true` | Ask Shelly to publish data to MQTT when the Discovery is completed.  With `false`, all entities remain in an unavailable state as long as values do not change. It helps to receive the current states immediately after the Discovery |
| `discovery_topic` | `"homeassistant"` | MQTT discovery topic |
| `mqtt_publish_pause` | `500` | [Milliseconds] Due to Shelly limitations, publishing of large number of topics to MQTT has to be slowed down. This is the pause added to every entry publication. |
| `components_refresh` | `["wifi"]` | List of Shelly component instances. Wifi is here by default because of intention of reporting RSSI to the Discovery. Other component instances can be also added (ie `temperature:0`) but it's advised to use dedicated [mqtt-periodic-pub](./mqtt-periodic-pub.md) script for that. It's more flexible. |
| `components_refresh_period` | `60` | [Seconds] Frequency of publishing selected components data |


## Compatibility

The script supports the following **Shelly Components** (they are building blocks of Shelly devices):
* switch (can be reported as a light)
* cover (incl. position and slat if enabled)
* pm1
* wifi <sup>*)</sup>
* em, em1
* emdata, em1data
* temperature <sup>**)</sup>
* humidity
* voltmeter (incl. custom formula and units)
* input (incl. custom formula and units)

<sup>*) The WiFi component isn't originally reported to MQTT. This script adds periodical reporting of Wifi component status to the topic configured in the MQTT configuration</sup>

<sup>**) Shelly devices report temperature only on temperature changes. Once the temperature stabilizes, the MQTT topic is not updated anymore. In conjunction with a non-retained topic, it might lead to an unknown value for a long time.</sup>

Note, some components provide not only data related to the component name. In addition, they may report other values. For example, the Switch component reports switch state, power, energy, voltage, current, power factor, and frequency.


## Supported devices

Compatibility with devices depends on the components that those devices implement. Tested with the following devices:

* Shelly 1 gen3
* Shelly Mini PM gen3
* Shelly Plus 1PM (gen2)
* Shelly Plus 2PM (gen2) - as switch, light, cover incl. position and slat support
* Shelly Pro EM3 (gen2) - both triphase and monophase profiles
* Addon Plus - with 4xDS18B20, DHT22, binary, analog and voltimeter inputs


The table below shows *potential* compatibility with devices:

✅ - Confirmed by comparison of components supported by the script\
☑️ - As above, but some components are not yet supported.
✔️ - Tested by me\
🔋 - Cannot confirm how it works with battery powered device

**Gen 2 devices**
| Device Name                     | Components                         | Supported |
| ------------------------------- | ---------------------------------- | ----------------- |
| Shelly Plus 1 (Mini)            | switch                             | ✅                 |
| Shelly Plus 1 PM (Mini)         | switch,                            | ✅ ✔️             |
| Shelly Plus 2 PM                | switch, cover                      | ✅ ✔️              |
| Shelly Plus I4                  | input                              | ✅                 |
| Shelly Plus Plug IT             | switch,                            | ✅                 |
| Shelly Plus Plug S              | switch,                            | ✅                 |
| Shelly Plus Plug UK             | switch,                            | ✅                 |
| Shelly Plus Plug US             | switch,                            | ✅                 |
| Shelly Plus H & T               | humidity, temperature, devicepower | ☑️🔋                  |
| Shelly Plus Smoke               | smoke                              |                   |
| Shelly Plus WallDimmer          | light                              |                   |
| Shelly Plus RGBW PM             | light, rgb, rgbw                   |                   |
| Shelly Plus 0 – 10 V Dimmer     | light                              |                   |
| Shelly Plus PM Mini             | switch, pm1                        | ✅                 |
| Shelly Plus Uni                 | switch, temperature, humidity, voltmeter  |  ✅   |
| Shelly Pro 1                    | switch                             | ✅                 |
| Shelly Pro 1 PM                 | switch                             | ✅                 |
| Shelly Pro 2                    | switch                             | ✅                 |
| Shelly Pro 2 PM                 | switch, cover                      | ✅   |
| Shelly Pro 3                    | switch                             | ✅                 |
| Shelly Pro 4 PM                 | switch                             | ✅                 |
| Shelly Pro Dual Cover PM        | cover                              | ✅                 |
| Shelly Pro EM                   | switch, em1, em1data               | ✅                 |
| Shelly Pro 3 EM (400)           | em, em1, emdata, em1data           | ✅ ✔️              |
| Shelly Pro Dimmer 1 PM          | light                              |                   |
| Shelly Pro Dimmer 2 PM          | light                              |                   |
| Shelly Pro Dimmer 0/1 – 10 V PM | light                              |                   |
| Shelly Pro RGBWW PM             | light, rgb, cct                    |                   |
| Shelly BLU Gateway              | *(none)*                           |                   |


**Gen 3 devices**
| Device Name                 | Components                         | Supported |
| --------------------------- | ---------------------------------- | ----------------- |
| Shelly 1                    | switch                             | ✅ ✔️              |
| Shelly 1 PM                 | switch                             | ✅                 |
| Shelly 2 PM                 | switch, cover                      | ✅                 |
| Shelly I4 / I4DC            | input                              | ✅                 |
| Shelly 1 L                  | switch                             | ✅                 |
| Shelly 2 L                  | switch                             | ✅                 |
| Shelly 1 Mini               | switch                             | ✅                 |
| Shelly 1 PM Mini            | switch                             | ✅                 |
| Shelly PM Mini              | pm1                                | ✅ ✔️              |
| Shelly AZ Plug              | switch                             | ✅                 |
| Shelly Plug S               | switch                             | ✅                 |
| Shelly Outdoor Plug S       | switch                             | ✅                 |
| Shelly Dimmer 0/1 – 10 V PM | light                              |                    |
| Shelly Dimmer               | light                              |                    |
| Shelly D Dimmer             | light                              |                    |
| Shelly H & T                | humidity, temperature, devicepower | ☑️🔋  |
| Shelly 3 EM                 | em, em1data                        | ✅                 |
| Shelly EM                   | em1, em1data                       | ✅                 |
| Shelly BLU Gateway Gen3     | *(none)*                           |                    |
| Shelly Shutter              | cover                      | ✅ |


**Gen 4 devices**
| Device Name      | Components  | Supported |
| ---------------- | ----------- | ----------------- |
| Shelly 1         | switch      | ✅                 |
| Shelly 1 PM      | switch      | ✅                 |
| Shelly 1 Mini    | switch      | ✅                 |
| Shelly 1 PM Mini | switch      | ✅✔️               |
| Shelly 2 PM      | switch      | ✅                 |

**Add Ons**
| Device Name      | Components  | Supported |
| ---------------- | ----------- | ----------------- |
| Shelly Plus Sensor | temperature, humidity, input, voltmeter      | ✅ ✔️                |
| Shelly Pro Output | switch      | hard to say              |

## Home Assistant Specifics

### Naming

#### Device

If Shelly device custom name is not configured, the device name follows the pattern:\
`<macaddress>-<modelname>`

example: `b8d6xxxxxxxx-Plus2PM`.

> The model name is what Shelly firmware reports. It doesn't match the product name exactly.

If the device custom name is configured in  `Settings / Device Name`, this name will override the pattern above. This feature can be disabled by setting `custom_names.device` script option to `false`.

> Note: the Home Assistant uses the device name as a prefix for entity names. However, changing the device name when entities are already registered DOES NOT affect entity names.

#### Entities

##### Entity Name
The entity name follows the tracked attribute function, for example: `Switch`, `Frequency`, `Power Factor`, `RSSI`. If the device contains more components of the same type (ie measurement channels), the names are suffixed by ordinal numbers, for example `Switch 1`, `Switch 2`, `Frequency 1`, `Frequency 2`, etc. The numbers come from component identifiers, being considered as fixed.

Several patterns might be applied for name creation, depending on whether the entity represents a device component, an addon component, or if there are more components, etc.

Examples for device components:\
`<function>`, i.e., `Switch` - for a single switch in the device\
`<function> <number>`, i.e., `Switch 1`, `Switch 2` - for multiple switches in the device.

Entities reflecting an Addon component are prefixed by the Addon word, and are numbered by a number coming from the Shelly addon component identifier.

Examples for add-on components:\
`Addon <function> <number>`, i.e., `Addon Humidity 1`

**Custom channel names**

Shelly devices offer the option to assign custom names to channels. This is available in the Shelly configuration under:\
`Output -> Name`, `Input -> Name` — for device channels\
`Addons -> channel -> Name` — for addon channels.

If custom name is set, it's used for entity creation. It changes the naming presented above into:\
`<custom name> <function>`, i.e., `My Room Temperature`, `My Room Humidity`, `Pantry Switch`

Note, there is no prefix nor numeric suffixes in the name anymore. But functionality is still reflected. That's needed in case a single channel reports several values (switch, temperature, voltage).

Using custom names for entity creation might be disabled separatelly for device channels and add-on channels, by setting variables `custom_names.channels` or `custom_names.addons` respecively to `false` value.

##### Friendly Name

The Home Assistant creates a friendly name joinin device name and entity name. The general patterns are:\
`<device name> <entity name>`

Depending custom names usage, it might look like:\
`b8d6xxxxxxxx-Plus2PM Backlight`\
`b8d6xxxxxxxx-Plus2PM Active Power 2`\
`AlcoveLight Active Power 2`\
`AlcoveLight Backlight`

> Note: You can change the friendly name in entity settings in Home Assistant. It takes precedence.

##### Unique_ID

The **unique_id** always follows the pattern: \
`<macaddress>-<function>` or\
`<macaddress>-<function-<number>`

Examples:\
`b8d6xxxxxxxx_power_factor_1`\
`b8d6xxxxxxxx_rssi`

> **Unique id never changes and is not influenced by configuration settings.**

##### Entity_ID

The **entity_id** is not set by this script. The entity id is generated by Home Assistant as a slug of:\
`<device_name>_<entity_name>`

Example:\
`sensor.b8d61a89xxxx_plus2pm_active_energy_2`\
`sensor.pantry_socket_active_energy_2`\
etc.

The `entity_id` may be influenced by the Device name set in Shelly configuration or changed later on in Home Assistant.

> Once registred, the entity id remains unchanged until modified in HA settings. It can be reset to its generic form described above by using reset button in entity settings.

### Alternative Device Class
It's often useful to have a switch interpreted by Home Assistant as a light.

It can be achieved in Home Assistant with the use of the "Change device type of a switch" helper. But it creates an additional entity in the system.

Shelly devices allow entering this information in settings at `Output Settings -> Consumption Type`. Entering `light` makes the switch be reported as a light to Home Assistant.

> Currently, only `light` as an alternative device class is supported

Note that the change neither influences `unique_id`, the name part of `entity_id`, nor the MQTT topic names. But it will affect the `entity name`, `friendly name`, as well as domain of the entity.

### Disabling entities by default

Some measurements are commonly less valuable than others. For example, the voltage provided by all switches in the house would be the same. Tracking voltage from every single Shelly device might not be useful.

Because of that, I've decided to report such entities as disabled by default. Such entities can be enabled in Home Assistant at any time.

Following reported params will cause entity to be disabled by default: `pf`, `voltage`, `freq`, `current`, `ret_aenergy`.

### Diagnostic Category

Some values are easy to define as belonging to a diagnostic category. Such entities will be reported this way to Home Assistant. There are `rssi` and `temperature`, but only if not coming from add-ons. Addon values are always reported as measurements.

There is one more situation to mention. Voltimetr and analog inputs (percentage) allows to set up a formula and units. In this case, the original entity (volts or %) will be moved to the diagnostics category and disabled. The new entities will be created based on values coming from the custom formula.

## Q&As

<details><summary>
After Home Assistant (or the MQTT broker) restarts, all entities become unavailable.</summary>

---

This is a known issue and is **not related to this script**.

Gen2+ Shelly devices publish their data to MQTT topics **without the RETAIN flag set**. As a result, after connecting to MQTT, these topics do not exist until new data is published.

Fortunately, all Shelly devices connected to MQTT listen to the `shellies/command` topic. This topic can be used to request all Shelly devices to republish their current state.

Below is a Home Assistant script that does exactly that:

```yaml
alias: Shellies Re-Announce
description: Asks Shelies to republish their states on HA or MQTT restart
triggers:
  - trigger: homeassistant
    event: start
  - trigger: event
    event_type: event_mqtt_reloaded
actions:
  - delay: 10
  - action: mqtt.publish
    data:
      payload: announce
      topic: shellies/command
mode: single
```
---
</details>

<details><summary>
Superfluous entities remains in HA</summary>

---

The script is aware only of the Shelly components that exist at the time the discovery is run. If significant changes are made to the Shelly configuration (for example, switching from Switch to Cover mode), a subsequent run of the script has no knowledge of previously created entities and therefore cannot remove them.

I made some attempts to address this issue (for example, handling a change between Switch and Light), but certain scenarios would require hard-coding a large number of dependencies.

**The easiest way to resolve this is to delete the device (from HA GUI) and then run the script again.**

---
</details>
