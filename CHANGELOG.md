# Changelog

## W.I.P.
* Added option to publish data entities data just after discovery (to avoid unavailable/unknown states)
* Added publishing data on MQTT connect and Shelly config change (ie channel name change)
* Added support for periferals (addon sensor)
  - support for custom expression and units
  - enforces 2 decimals precision in HA
  - Introduced `BinaryIn` (mapps to inary_input) and `AnalogIn`
  - If analog input sensor set custom formula set, original sensor (percentage) is reported to Diagnostics, disabled by default
* Added support for `humidity` component
* Added support for `voltmeter` component, including custom expression and units
* added support for `input` (as binary sensor)
* Changes naming `Transformed Voltage` to `X-Voltage` to make it shorter and coherent with other transformed values
* Config changes:
  - removed `ignore_names`, instead
  - added `custom_names` with separate `device`, `channels`, `addons`

* Docs Updated

## v1.0.0
* Initial version