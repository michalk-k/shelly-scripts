# MQTT DISCOVERY: SELF

The script registers the Shelly device the script runs on and its entities, to Home Assistant, using MQTT discovery.\
It creates entities for all supported properties: switches, sensors etc.

**Features**

* Easy to use: just run it
* Supports wide range of gen2, gen3 and gen4 devices, inlcuding add-ons. See [Supported Devices](#supported-devices)
* Respects `consumption type` set to `light`
* Respects double-switch set to a `cover`
* Can utilize Shelly's device and channel names
* Less important sensors are disabled by default, for example power factor
* The script follows recent Home Assistant conventions in entities configuration. Read [Naming](#naming) section for details
* provides periodic components refresh, ie for WiFi
* Supports custom formulas and units (xvoltage, xpercentage)
* Re-publishes discovery data on Shelly configuration change or MQTT reconnect.
* Re-publishes Shelly data after discovery to avoid unknown values until first change come.

## Requirements

> Requires the MQTT to be enabled and configured in the Shelly device.

## Installation and Configuration

For instalation, read the [Installation](../README.md#installation) section. 

**Configuration parameters**

The script is configured to be run without need of additional configuration.\
While valid for most cases, it still provides option to change some settings.

| Variable | Default Value | Description |
| --- | --- | --- |
| `temperature_unit` | `"C"` | C or F - Uppercase!!!. Note, that degree symbol will be added by the script itself. |
| `disable_minor_entities` | `true` | Entities considered less unimportant will be disabled by default (can be enabled later in HA). Examples: `Power Factor`, `Voltage`, `Frequency`. It is not applied to addons entities |
| `custom_names.device` | `true` | Name HA device using device name set in Shelly configuration |
| `custom_names.channels` | `true` | Name entities using custom names configured for Shelly device channels (inputs, outputs etc), if set |
| `custom_names.addons` | `true` | Name entities using custom names configured for addon channels (inputs, outputs etc), if set. |
| `report_ip` | `true` | Report ip address of the Shelly device to the Discovery data. It results in clickable link on device page in Home Assistant |
| `fake_macaddress` | `""` | For testing purposes, set alternative macaddress |
| `publish_init_data` | `true` | Ask Shelly to publish data to MQTT when the Discovery is completted.  With `false` all entities remains in unavailable state as long as values do not change. It helps to receive current states immediatelty after the Discovery |
| `discovery_topic` | `"homeassistant"` | MQTT discovery topic |
| `mqtt_publish_pause` | `500` | [Milliseconds] Discovery data publishing hsa to be slowed down due to Shelly limitations. This is the pause added to every entry publication |
| `components_refresh` | `["wifi", "temperature:0"]` | Components to periodically refresh. See content of `<mqtt_topic>/status` topic, for reported devices.  The `<mqtt_topic>` topic is configured in MQTT settings of Shelly device.  |
| `components_refresh_period` | `60` | [Seconds] Frequency of publishing selected components data |


## Compatibility

Currently supports following **Shelly Components** (they are building blocks of Shelly devices):
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

<sup>*) WiFi component isn't originally repoted to MQTT. This script adds periodical reporting of Wifi component status to the topic configured in the MQTT configuration</sup>

<sup>**) Shelly devices report temperature only on temperature changes. Once the temperature stabilizes, the MQTT topic is not updated anymore. In conjunction with non-retained topic, it might lead to an unknown value for a long time.</sup>

Compatibility with devices depends on the components that those devices implement. Tested with the following devices:

* Shelly 1 gen3
* Shelly Mini PM gen3
* Shelly Plus 1PM (gen2)
* Shelly Plus 2PM (gen2) - as switch, light, cover incl. position and slat support
* Shelly Pro EM3 (gen2) - both triphase and monophase profiles
* Addon Plus - with 4xDS18B20, DHT22, binary, analog and voltimeter inputs

## Supported devices
✅ - confirmed by comparison of components implemented in the script

☑️ - as above, but support is limited to subset of available device profiles.

✔️ - tested by me

Note, some components provide composite data, for example a switch, besides its state might provide energy and temperature.

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
| Shelly Plus H & T               | humidity, temperature, devicepower |                   |
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
| Shelly I4 / I4DC            | input                              |                    |
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
| Shelly H & T                | humidity, temperature, devicepower |                    |
| Shelly 3 EM                 | em, em1data                        | ✅                 |
| Shelly EM                   | em1, em1data                       | ✅                 |
| Shelly BLU Gateway Gen3     | *(none)*                           |                    |
| Shelly Shutter              | cover                      | | ✅


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
| Shelly Pro Output | switch      | not tested                 |

## Home Assistant Internals

### Naming

**Device**

The device name follows the pattern: : `macaddress-modelname`, for example `b8d6xxxxxxxx-Plus2PM`.\
It can be overriden by setting Device name (Settings / Device Name). To apply changes, the script must be restarted

> Note, the Home Assistant uses device name as a prefix for entity names. Changing device when entities are already registered, affect no entity names

**Entities**

By default **entity name** follows the tracked attribute function, for example: `Switch`, `Frequency`, `Power Factor`, `RSSI`. If the device contains more components of the same type (ie measurement channels), the names are suffixed by oridinal numbers, for example `Switch 1`, `Switch 2`, `Frequency 1`, `Frequency 2`, etc.

If device channel has a custom name configured (as for example, `Output -> Name` in Shelly2PM), all related entity names gets name as follows: `Custom Name Function`, For example `Dryer Socket Frequency`. in this case the oridinal number of Shelly component is not appended.

The **friendly_name** is created by Home Assistant from the device name and the entity name. It might look like `b8d6xxxxxxxx-Plus2PM Active Power 2` or `b8d6xxxxxxxx-Plus2PM Backlight`. Looks horrible, but once device name is changed to something meaningfull, ie AlcoveLight, the friendly name will turn into `AlcoveLight Active Power 2` or `AlcoveLight Backlight` respectively.

The **unique_id** allways follows the pattern: `macaddress-function` or `macaddress-function-number`, for example `macaddress-rssi` or `b8d6xxxxxxxx_power_factor_1`. Unique id never changes and is not influenced by configuration settings.

The **entity_id** is not set by this script. The entity name is generated by Home Assistant from `device_name_entity_name` pattern, for example `sensor.b8d61a89xxxx_plus2pm_active_energy_2`. The `entity_id` may be influenced by the Device name set in Shelly configuration or changed later on in Home Assistant.

### Alternative Device Class
It's often useful to have a switch interpreted by Home Assistant as a light.

It can be achieved in Home Assistant with use of "Change device type of a switch" helper. But it creates additional entity in the system.

Shelly devices allows to enter this information into `(Output Settings -> Consumption Type)`. Entering `light` makes the switch be reported as a light to Home Assistant.

> Currently only `light` as alternative device class is supported

Note, that the change neither influences `unique_id`, `entity_id` or mqtt topic names. But it will change the `entity name` and `friendly name` of the entity.