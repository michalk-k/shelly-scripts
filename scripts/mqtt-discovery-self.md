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
* provides periodic components refresh, ie for WiFi (RSSI) that is not reported by Shelly devices at all.
* Supports custom formulas and units (xvoltage, xpercentage)
* Re-publishes discovery data on Shelly configuration change or MQTT reconnect.
* Re-publishes Shelly data after discovery to avoid unknown values until the first value change comes.

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
| `components_refresh` | `["wifi", "temperature:0"]` | List of components, their data will be periodically refreshed in MQTT. Wifi (this RSSI) is not reported by Shelly at all. Switch temperatures are reported only on switch state change. This setting helps to get these data.<br><br>For exact names of components look at `<mqtt_topic>/status` topic. These topics are not retained so you have to wait for the first change reported to see these topics.<br>The `<mqtt_topic>` topic is configured in MQTT settings of Shelly device.  |
| `components_refresh_period` | `60` | [Seconds] Frequency of publishing selected components data |


## Compatibility

The script supports following **Shelly Components** (they are building blocks of Shelly devices):
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

Note, some components provide not only data related to component name. In addition they may report other values. For example the Switch component, reports switch state, power, energy, voltage, current, power factor and frequency.


## Supported devices

Compatibility with devices depends on the components that those devices implement. Tested with the following devices:

* Shelly 1 gen3
* Shelly Mini PM gen3
* Shelly Plus 1PM (gen2)
* Shelly Plus 2PM (gen2) - as switch, light, cover incl. position and slat support
* Shelly Pro EM3 (gen2) - both triphase and monophase profiles
* Addon Plus - with 4xDS18B20, DHT22, binary, analog and voltimeter inputs


The table below shows *potential* compatibility with devices:

✅ - Confirmed by comparison of components supported by the the script\
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

The device name follows the pattern:\
`<macaddress>-<modelname>`

example: `b8d6xxxxxxxx-Plus2PM`.

The `custom_names.device` script option is set to `true` (default) allows to override the default device name with a device name set in Shelly configuration. It can be found `Settings / Device Name`.

> Note, the Home Assistant uses device name as a prefix for entity names. However changing device name when entities are already registered, affect NO entity names.

#### Entities

##### Entity Name
The entity name follows the tracked attribute function, for example: `Switch`, `Frequency`, `Power Factor`, `RSSI`. If the device contains more components of the same type (ie measurement channels), the names are suffixed by oridinal numbers, for example `Switch 1`, `Switch 2`, `Frequency 1`, `Frequency 2`, etc. The numbers come from component identifiers, being considered as fixed.

Several patterns might be applied for name creation, depending whether entity represents a device component, addon component, there are more components etc.

Examples for device components:\
`<function>`, ie `Switch` - for single switch in the device\
`<function> N`, ie `Switch 1`, `Switch 2` - for multiple switches in the device\
`<customname> <function>`, ie `My Room Switch`, `Pantry Switch` - for two custom named switches\

Entities reflecting an Addon components are prefixed by Addon word, as well as are numbered by number comming from the Shelly addon component identificator.

Examples for add-on components:\
`Addon <function> N`, ie `Addon Humidity 1`

**Custom channel names**

Shelly devices offer option to set up names for channels: for device channels as well as addon ones. It can be found various sections of settings: `Output -> Name`, `Input -> Name`, `Addons -> channel -> Name`.\
If `custom_names.channels`, respectively `custom_names.addons` are set to `true`, then these custom names will be taken for entity name creation, skipping prefixes and suffix numbers.

Examples using custom names:\
`<customname> <function>`, ie `My Room Temperature`, `My Room Humidity`

Note, there is no prefix nor numeric suffixes in the name. But functionality is still reflected. That's needed in case that a channel reports several values (switch, temperature, voltage).

##### Friendly Name

The Home Assistant creates friendly name joinin device name and entity name. The general patterns is:\
`<device name> <entity name>`

Depending custom names usage, it might look like:\
`b8d6xxxxxxxx-Plus2PM Backlight`\
`b8d6xxxxxxxx-Plus2PM Active Power 2`\
`AlcoveLight Active Power 2`\
`AlcoveLight Backlight`

> Note you can change the friendly name in entity settings in Home Assistant. It takes precedence.

##### Unique_ID

The **unique_id** allways follows the pattern: \
`<macaddress>-<function>` or\
`<macaddress-function-number>`

Examples:\
`b8d6xxxxxxxx_power_factor_1`\
`b8d6xxxxxxxx_rssi`

> **Unique id never changes and is not influenced by configuration settings.**

##### Entity_ID

The **entity_id** is not set by this script. The entity name is generated by Home Assistant from the slug of:\
`<device_name>_<entity_name>`

Example:\
`sensor.b8d61a89xxxx_plus2pm_active_energy_2`

The `entity_id` may be influenced by the Device name set in Shelly configuration or changed later on in Home Assistant.

### Alternative Device Class
It's often useful to have a switch interpreted by Home Assistant as a light.

It can be achieved in Home Assistant with use of "Change device type of a switch" helper. But it creates additional entity in the system.

Shelly devices allows to enter this information into `(Output Settings -> Consumption Type)`. Entering `light` makes the switch be reported as a light to Home Assistant.

> Currently only `light` as alternative device class is supported

Note, that the change neither influences `unique_id`, name part of `entity_id` or mqtt topic names. But it will affect the `entity name`, `friendly name` as well as domain of the entity.

### Disabling entities by default

Some measurements are commonly less valuable than others. For example, voltage, provided by all switches in the house would be the same. Tracking voltage from every single Shelly devices might not be useful.

Because of that I've decided to report such entities as disabled by default. Such entities can be enabled in Home Assistant at any time.

Following reported params will cause entity to be disabled by default: `pf`, `voltage`, `freq`, `current`, `ret_aenergy`.

### Diagnostic Category

Some values is easy to define as belonging to diagnostic category. Such entities will be reported this way to Home Assistant. There are `rssi` and `temperature`, but only if not comming from add-ons. Addons values are always reported as measurement.

There is one more situation to mention. Voltimetr and analog inputs (percentage) allows to set up a formula and units. In this case, original entity (volts or %) will be moved to diagnostics category and disabled. The new entities will be created based on values comming from the custom formula.