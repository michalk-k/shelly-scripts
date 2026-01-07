# Changelog

## v3.0.0
* Added inputs as `BinaryIn` (note, shelly doesn't report device inputs in button mode; unlike addon binary inputs)
* Added option to publish entities data just after discovery (to avoid unavailable/unknown states)
* Added publishing data on MQTT connect and Shelly config change (ie channel name change)
* Added support for periferals (addon sensor)
  - support for custom expression and units
  - enforces 2 decimals precision in HA
  - Introduced `BinaryIn` (mapps to inary_input) and `AnalogIn`
  - If analog input sensor set custom formula set, original sensor (percentage) is reported to Diagnostics, disabled by default
* Added support for `humidity` component
* Added support for `voltmeter` component, including custom expression and units
* Added support for analog input as `AnalogIn`, including custom expression and units
* Added support for binary input as `BinaryIn`
* Changed `Transformed Voltage` naming to `X-Voltage`, to make it shorter and coherent with other transformed values
* Config changes:
  - removed `ignore_names`, instead
  - added `custom_names` with separate `device`, `channels`, `addons`
* Docs Updated

## v2.0.0
* added scripts monitoring script, adding HA entity using MQTT Discovery.

## v1.0.0
* Initial version