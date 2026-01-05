let CONFIG = {

  temperature_unit: "C",            // C or F - Uppercase!!!
  disable_minor_entities: true,     // Entities considered less unimportant will be disabled by default (can be enabled later in HA), see DISABLED_ENTS. It's not applied to addons entities
  custom_names: {                   // Use custom names from Shelly configuration, for:
    device: true,                   // shelly device
    channels: true,                 // shelly device channels
    addons: true                    // addon channels
  },

  report_ip: true,                  // create URL link to open Shelly GUI from HA
  fake_macaddress: "",              // for testing purposes, set alternative macaddress

  publish_init_data: true,          // ask shelly to publish data to MQTT just after discovery is done

  discovery_topic: "homeassistant",
  mqtt_publish_pause: 500,          // (milliseconds) discovery entities will are published to MQTT entry-by-entry with pause inbeetween

  components_refresh: ["wifi", "temperature:0"],
  components_refresh_period: 60     // (seconds) how often report components above to mqtt
};

const COMPONENT_TYPES = ["switch", "pm1", "wifi", "em", "em1", "emdata", "em1data", "temperature", "cover", "humidity", "voltmeter", "input"];
const SUPPORTED_ATTRS = ["apower", "aprt_power", "voltage", "freq", "current", "pf", "aenergy", "ret_aenergy", "output", "rssi", "temperature", "tC", "tF", "state", "rh", "xvoltage", "percent", "xpercent"];

const CAT_DIAGNOSTIC = ["rssi","temperature"];
const DISABLED_ENTS = ["pf", "voltage", "freq", "current", "ret_aenergy", "xvoltage", "state"];

const ALIASES = {
  "a_current": "current",
  "b_current": "current",
  "c_current": "current",
  "a_voltage": "voltage",
  "b_voltage": "voltage",
  "c_voltage": "voltage",
  "a_freq": "freq",
  "b_freq": "freq",
  "c_freq": "freq",
  "a_pf": "pf",
  "b_pf": "pf",
  "c_pf": "pf",
  "act_power": "apower",
  "a_act_power": "apower",
  "b_act_power": "apower",
  "c_act_power": "apower",
  "total_act_power": "apower",
  "a_aprt_power": "aprt_power",
  "b_aprt_power": "aprt_power",
  "c_aprt_power": "aprt_power",
  "total_aprt_power": "aprt_power",
  "total_act_energy": "aenergy",
  "total_act_ret_energy": "ret_aenergy",
  "a_total_act_energy": "aenergy",
  "b_total_act_energy": "aenergy",
  "c_total_act_energy": "aenergy",
  "a_total_act_ret_energy": "ret_aenergy",
  "b_total_act_ret_energy": "ret_aenergy",
  "c_total_act_ret_energy": "ret_aenergy",
  "total_act": "aenergy",
  "total_act_ret": "ret_aenergy",
  "tF": "temperature",
  "tC": "temperature"
}

const DEVCLASSES = {
  "apower": "power",
  "aprt_power": "apparent_power",
  "voltage": "voltage",
  "xvoltage": null, // unknown, units given by Shelly configuration
  "freq": "frequency",
  "current": "current",
  "pf": "power_factor",
  "aenergy": "energy",
  "ret_aenergy": "energy",
  "temperature": "temperature",
  "rh": "humidity",
  "switch": "switch", // from docs: possible none, switch, outlet
  "rssi": "signal_strength",
  "light": "light",
  "state": null,
  "percent": null,
  "xpercent": null
}

const NAMES = {
  "apower": "Active Power",
  "aprt_power": "Aparent Power",
  "voltage": "Voltage",
  "xvoltage": "X-Voltage",
  "freq": "Frequency",
  "current": "Current",
  "pf": "Power Factor",
  "aenergy": "Active Energy",
  "ret_aenergy": "Returned Active Energy",
  "temperature": "Temperature",
  "rh": "Humidity",
  "output": "Switch",
  "switch": "Switch",
  "rssi": "RSSI",
  "light": "Light",
  "cover.state": "Cover",
  "state": "BinaryIn",
  "percent": "AnalogIn",
  "xpercent": "X-AnalogIn"
}

const UNITS = {
  "apower": "W",
  "aprt_power": "VA",
  "voltage": "V",
  "freq": "Hz",
  "current": "A",
  "aenergy": "Wh",
  "ret_aenergy": "Wh",
  "tC": "°C",
  "tF": "°F",
  "rh": "%",
  "rssi": "dBm",
  "percent": "%"
}

const DOMAINS = {
  "apower": "sensor",
  "aprt_power": "sensor",
  "voltage": "sensor",
  "xvoltage": "sensor",
  "freq": "sensor",
  "current": "sensor",
  "aenergy": "sensor",
  "ret_aenergy": "sensor",
  "tC": "sensor",
  "tF": "sensor",
  "cover.state": "cover",
  "state": "binary_sensor",
  "output": "switch",
  "pf": "sensor",
  "rssi": "sensor",
  "temperature": "sensor",
  "rh": "sensor",
  "percent": "sensor",
  "xpercent": "sensor"
  // switch and light matches domain name, not here to save memory
}

/**
 * Normalize MAC address removing : and - characters, and making the rest lowercase
 * @param {string} address MAC address
 * @returns {string} normalized MAC address
 */
function normalizeMacAddress(address) {
  return String(address).split("-").join("").split(":").join("").toLowerCase();
}

/**
 * Function creates and returns a device data in format requierd by MQTT discovery.
 *
 * Device name is built from its mac address and model name.
 *
 * @param {Object} deviceInfo - object with device information, including:
 * @param {string} deviceInfo.app - Device application/model name (e.g., "Plus 1PM")
 * @param {string} deviceInfo.model - Device model identifier (e.g., "SHPLG-S")
 * @param {string} deviceInfo.ver - Firmware version (e.g., "1.0.0")
 * @param {number|string} deviceInfo.gen - Device generation (e.g., 2)
 * @param {string} deviceInfo.mac - MAC address (e.g., "B8:D6:XX:XX:XX:XX")
 * @param {string} [deviceInfo.name] - Optional user-defined device name
 * @returns {Object} The device object with the following structure:
 */
function discoveryDevice(deviceInfo) {

  const macaddress = normalizeMacAddress(CONFIG.fake_macaddress ? CONFIG.fake_macaddress : deviceInfo.mac);

  let device = {};
  device.name = deviceInfo.name && CONFIG.custom_names.device ? deviceInfo.name : macaddress + "-" + deviceInfo.app;
  device.ids = [macaddress + ""];
  device.cns = [["mac", macaddress + ""]];
  device.mf = "Shelly"
  device.mdl = "Shelly " + deviceInfo.app;
  device.mdl_id = deviceInfo.model;
  device.sw = deviceInfo.ver;
  device.hw = "gen " + deviceInfo.gen;

  if (CONFIG.report_ip) {
    device.cu = "http://" + Shelly.getComponentStatus("wifi").sta_ip;
  }

  return device;
}

/**
  * Returns a template for value extraction from MQTT message.
  * The template is based on the attribute type and its device class.
  *
  * @param {object} info - attribute name for which the template is to be created
  * @returns {string} - template string for extracting value from MQTT message
  */
function getValTpl(info) {

  if (info.attr == "aenergy") return "{{ value_json." + info.attr + ".total }}";
  if (info.attr == "output") return "{{ 'on' if value_json.output else 'off' }}";
  if (info.attr == "temperature") return "{{ value_json." + info.attr + ".t" + CONFIG.temperature_unit + " }}";
  if (info.attr == "state") return "{{ value_json." + info.attr + " if value_json." + info.attr + " else false }}";

  return "{{ value_json." + info.attr + " }}";
}

/**
 * Generates a unique identifier for the entity based on its MAC address, attribute, and index.
 * The identifier is formatted as "mac_address_attribute_index", where attribute is Shelly component name, and index is optional.
 * This way it never change even if you configure switch to be the light.
 * @param {object} info - Object containing information about the entity, including its MAC address, topic, and attribute
 * @returns {string} - Unique identifier for the entity
 */
function getUniqueId(info) {
  return info.mac + "_" + info.topic.split(":").join("") + "_" + info.attr;
}

/**
 * Returns the unit of measurement for the given attribute.
 * If the attribute is temperature, it appends the configured temperature unit (C or F).
 * If the attribute is not recognized, it returns null.
 * @param {object} info - Object with data
 * @returns {string|null} - Unit of measurement for the attribute, or null if not recognized
 */
function getUnits(info) {

  if (info.attr_common == "xvoltage") {
    return Shelly.getComponentConfig(info.topic).xvoltage.unit;
  }
  if (info.attr_common == "xpercent") {
    return Shelly.getComponentConfig(info.topic).xpercent.unit;
  }

  let attr = info.attr_common;

  if (info.attr_common == "temperature") attr = "t" + CONFIG.temperature_unit;
  if (UNITS[attr] === undefined) return null;

  return UNITS[attr];
}

/**
  * Returns a human-readable name for the entity based on its attribute and index.
  * Determines a user-friendly name for the entity based on its type and available information.
  * @param {Object} info - Object containing information about the entity, including its attribute, index, and name.
  * @returns {string} - Human-readable name for the entity
  */
function getName(info) {

  // if ( info.name && (info.attr_common == 'switch' || info.attr_common == 'light' )) {
  //   return info.name;
  // }

  let name;
  let key = info.attr_common;
  if (info.comp == "cover" && info.attr_common == "state") key = "cover.state";

  if (NAMES[key]) name = NAMES[key];
  else name = key;

  if (info.name) name = info.name + " " + name;
  else if (info.addon) name = "Addon " + name + " " + (info.ix-99);
  else if (info.ix >= 0 && !info.issingle) name = name + " " + (info.ix+1);

  if (info.attr != info.attr_common && (info.comp == "em" || info.comp == "emdata")) name = name + " " + info.attr.split("_")["0"].toUpperCase();

  return name;
}

/**
 * Retrieves the common attribute value for the specified attribute name.
 *
 * @param {string} attr - The name of the attribute to retrieve.
 * @returns {string} The value of the specified common attribute.
 */
function getCommonAttr(attr) {
  if (ALIASES[attr] === undefined) return attr;
  return ALIASES[attr];
}

/**
 * Returns the device class for the given attribute.
 * If the attribute is not recognized, it returns the attribute name itself.
 * This is used to determine how the entity should be represented in Home Assistant.
 * @param {string} attr - Attribute name for which the device class is to be retrieved
 * @returns {string} - Device class for the attribute, or the attribute name if not recognized
 */
function getDeviceClass(attr) {
  if (DEVCLASSES[attr] === undefined) return attr;
  return DEVCLASSES[attr];
}

/**
  * Returns the entity domain for the given attribute.
  * The domain is used to categorize the entity in Home Assistant.
  * If the attribute is not recognized, it returns the attribute name itself.
  * @param {Object} info - See other docs
  * @returns {string} - Domain for the attribute, or the attribute name if not recognized
  */
function getDomain(info) {
  let key = info.attr_common;
  if (info.comp == "cover" && info.attr_common == "state") key = "cover.state";
  if (DOMAINS[key] !== undefined) return DOMAINS[key];
  return key;
}


/**
 * Builds data of single entity to be published to MQTT discovery
 * @param {string} topic Object identifier used for preventing repeating discovery topic creation. Will be returned back in the result struct
 * @param {Object} info Data needed to build the MQTT discovery obejct
 * @param {string} info.attr Attribute of the entity reported by component status (also reported to MQTT), e.g. "apower", "voltage", a_voltage, b_voltage etc.
 * @param {string} info.attr_common Like `attr` but translated to common value, for example `a_voltage`, `b_voltage` translated to `voltage`
 * @param {string} info.comp Component type, e.g. "switch", "pm1", etc.
 * @param {number} info.ix Index of the entity within the component, used for components with multiple instances
 * @param {string} info.topic Topic name the component status data is reported to.
 * @param {string} info.altdomain Alternative domain for the entity, if applicable.
 * @param {string} info.mac MAC address of the device, used for unique identification
 * @returns {Object} Object with data for publishing to MQTT
 */
function discoveryEntity(topic, info) {
  let attr_orig = info.attr_common;

  if (info.attr == "output") {
    if (info.altdomain) info.attr_common = info.altdomain;
    else info.attr_common = info.comp
  }

  let domain = getDomain(info);
  let pload = {};

  pload["name"] = getName(info);
  pload["uniq_id"] = getUniqueId(info);
  pload["stat_t"] = topic + "/status/" + info.topic;
  pload[info.attr_common == "light" ? "stat_val_tpl" : "val_tpl"] = getValTpl(info);
  pload.dev_cla = getDeviceClass(info.attr_common);

  if (pload.dev_cla == "energy") {
    pload["stat_cla"] = "total_increasing";
  } else if (domain == "sensor") {
    pload["stat_cla"] = "measurement";
  }

  switch (domain) {
    case "binary_sensor":
      pload["pl_on"] = true;
      pload["pl_off"] = false;
      break;
    case "switch":
    case "light":
      pload["cmd_t"] = topic + "/command/" + info.topic;
      pload["pl_on"] = "on";
      pload["pl_off"] = "off";
      break;
    case "sensor":
      pload["unit_of_meas"] = getUnits(info);
      break;
    case "cover":
      let slat = Shelly.getComponentConfig(info.topic).slat;
      let pos = Shelly.getComponentStatus(info.topic).pos_control;

      pload["cmd_t"] = topic + "/command/" + info.topic;
      pload["pl_open"] = "open";
      pload["pl_stop"] = "stop";
      pload["pl_cls"] = "close";
      pload["opt"] = false;

      if (pos) {
        pload["pos_t"] = pload["stat_t"];
        pload["pos_tpl"] = "{{ value_json.current_pos }}"
        pload["set_pos_t"] = pload["cmd_t"];
        pload["set_pos_tpl"] = "pos,{{ position }}";
      }

      if (pos && slat && slat.enable) {
        pload["tilt_cmd_tpl"] = "slat_pos,{{ tilt_position }}";
        pload["tilt_cmd_t"] = pload["cmd_t"];
        pload["tilt_cmd_t"] = pload["pos_t"];
        pload["tilt_status_t"] = pload["stat_t"];
        pload["tilt_status_tpl"] = "{{ value_json.slat_pos }}";
        pload["pl_stop_tilt"] = pload["pl_stop"];
        pload["tilt_opt"] = false;
      }

      break;
  }

  if (info.addon && domain == "sensor") {
     pload["sug_dsp_prc"] = 2;
  }

  if (info.forcediagnostic || (!info.addon && CAT_DIAGNOSTIC.indexOf(info.attr_common) != -1)) {
    pload["ent_cat"] = "diagnostic";
  }

  if (info.forcedisabled || (!info.addon && CONFIG.disable_minor_entities && DISABLED_ENTS.indexOf(info.attr_common) != -1)) {
    if (!info.forceenabled) pload["en"] = false;
  }

  return { "domain": domain, "subtopic": info.topic.split(":").join("") + "-" + info.attr, "data": pload }
}

let report_arr = [];
let report_arr_idx = 0;
let comp_inst_num = {}; // number of components of the same type, ie switch:0, switch:1 etc
let device;

function initGlobals() {
  report_arr = [];
  report_arr_idx = 0;
  comp_inst_num = {}; // number of components of the same type, ie switch:0, switch:1 etc
}

/**
 * Precollects input information needed for creation of MQTT discovery.
 *
 * Data are stored into array, making it possible to track the progress and resume with subsequent Timer calls.
 */
function precollect() {

  initGlobals();
  let status;

  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    let comptype = COMPONENT_TYPES[t];

    // create data for single components
    status = Shelly.getComponentStatus(comptype);

    if (status !== null) {

      for (let datattr in status) {
        if (SUPPORTED_ATTRS.indexOf(getCommonAttr(datattr)) == -1) continue;
        if (datattr == "tC" && CONFIG.temperature_unit != "C") continue;
        if (datattr == "tK" && CONFIG.temperature_unit != "K") continue;
        report_arr.push({comp : comptype, ix: -1, attr: datattr, topic: comptype});
      }

      comp_inst_num[comptype] = 1;
    }
    else {
      let index = 0;

      while (true) {

        let scomp = comptype + ":" + index;
        status = Shelly.getComponentStatus(scomp);

        if (status === null) break;

        for (let datattr in status) {
          if (SUPPORTED_ATTRS.indexOf(getCommonAttr(datattr)) == -1) continue;
          if (datattr == "tC" && CONFIG.temperature_unit != "C") continue;
          if (datattr == "tF" && CONFIG.temperature_unit != "F") continue;
          report_arr.push({comp : comptype, ix: index, attr: datattr, topic: scomp});
        }

        index++;
        comp_inst_num[comptype] = index;

      }
    }
  }

  Shelly.call("SensorAddon.GetPeripherals", {}, function (res) {

    for (let peripheral in res) {
      // Check if first-level element has children
      if (Object.keys(res[peripheral]).length == 0) continue

        for (let scomp in res[peripheral]) {
          let comparr = scomp.split(":");

          status = Shelly.getComponentStatus(scomp);

          if (status === null) break;

          for (let datattr in status) {
            if (SUPPORTED_ATTRS.indexOf(getCommonAttr(datattr)) == -1) continue;
            if (datattr == "tC" && CONFIG.temperature_unit != "C") continue;
            if (datattr == "tF" && CONFIG.temperature_unit != "F") continue;
            report_arr.push({comp : comparr[0], ix: comparr[1], attr: datattr, topic: scomp, addon: true});
          }

          status = null;

        }
    }
  });

}

function mqttPublishComponentData(component) {
    let status = Shelly.getComponentStatus(component);
    if (!status) return;

    MQTT.publish(Shelly.getComponentConfig("mqtt").topic_prefix + "/status/" + component, JSON.stringify(status), 1, false);
}

// Publish data of collected components right after discovery is done
function mqttForceInitialData() {
  if (!CONFIG.publish_init_data) return;

  for (let i = 0; i < report_arr.length; i++) {
    if (report_arr[i] === null) continue;
    mqttPublishComponentData(report_arr[i].topic)
  }
}


/**
 * Processes the next entity in `report_arr` (using `report_arr_idx`), constructs its MQTT discovery payload, and publishes it to the appropriate MQTT discovery topic.
 * @returns
 */
function mqttreport() {
  let info;

  if (report_arr[report_arr_idx] ) {
    info = report_arr[report_arr_idx];
    // report_arr[report_arr_idx] = null; // cannot free becuase mqttForcePublishData() needs it later.
    report_arr_idx++;
  } else {
    Timer.clear(discoverytimer);
    mqttForceInitialData();
    report_arr = null;
    report_arr_idx = 0;
    comp_inst_num = null;
    device = null;
    isProcessing = false;
    return;
  }

  if (!device) {
    device = discoveryDevice(Shelly.getDeviceInfo());
  }

  const compconfig = Shelly.getComponentConfig(info.topic);

  if (CONFIG.custom_names.channels && !info.addons || CONFIG.custom_names.addon && info.addons && compconfig.name.length > 0) {
    info.name = compconfig.name;
  }

  info.mac = device.cns[0][1];
  info.attr_common = getCommonAttr(info.attr);
  if (Shelly.getComponentConfig("sys").ui_data.consumption_types && Shelly.getComponentConfig("sys").ui_data.consumption_types[info.ix]) info.altdomain = Shelly.getComponentConfig("sys").ui_data.consumption_types[info.ix];

  const cfg = compconfig["x" + info.attr_common];
  if ((info.attr_common === "percent" || info.attr_common === "voltage") && cfg && cfg.expr) {
    info.forcediagnostic = true;
    info.forcedisabled = true;
  }

  // do not hide inputs for input only devices
  if (info.comp == "input" && !comp_inst_num["switch"] && !comp_inst_num["light"] && !comp_inst_num["cover"]) {
    info.forceenabled = true;
  }

  info.issingle = comp_inst_num[info.comp] == 1;

  let data = discoveryEntity(Shelly.getComponentConfig("mqtt").topic_prefix, info);
  data.data.dev = device;

  let doms;

  if (["switch","light", "cover"].indexOf(data.domain) >= 0) doms = ["switch","light", "cover"]
  else doms = [data.domain];

  for (let dom of doms) {
    let discoveryTopic  = CONFIG.discovery_topic + "/" + dom + "/" + info.mac + "/" + data.subtopic + "/config";
    MQTT.publish(discoveryTopic, "", 1, true);

    if (dom == data.domain) {
      MQTT.publish(discoveryTopic, JSON.stringify(data.data), 1, true);
    }
  }

  data = null;
  info = null;
}

/**
 * Execution control variables
 */
let discoverytimer;
let mqttConnected = false;
let isProcessing = false;

/**
 *  Generate MQTT Discovery
 * Initial precollection of entities to be reported.
 * This will also set up a timer to publish one collected entity per per time-period.
 * @returns
 */
function onMQTTConnected() {
  if (isProcessing) return;
  isProcessing = true;
  precollect();
  discoverytimer = Timer.set(CONFIG.mqtt_publish_pause, true, mqttreport);
}


/***************************************
* RSSI (WiFi) reporting
***************************************/

/**
 * Reports the WiFi configuration to MQTT.
 * Publishes the WiFi status to the MQTT topic defined in the Shelly component configuration.
 * The topic is constructed using the MQTT topic prefix and the "status/wifi" suffix.
 */
function reportWifiToMQTT() {
  if (isProcessing) return;
  let components = CONFIG.components_refresh;

  for (let t = 0; t < components.length; t++) {
    mqttPublishComponentData(components[t]);
  }
}

// Initial call to report WiFi status
// This will also set up a timer to report WiFi status every 60 seconds
reportWifiToMQTT();
let timer_handle = Timer.set(CONFIG.components_refresh_period * 1000, true, reportWifiToMQTT, null);




// Report Discovery on MQTT connection
MQTT.setConnectHandler(
    function () {
      if (mqttConnected) return;
      mqttConnected = true;
      onMQTTConnected();
    }
);

// Report Discovery on Shelly config Change
Shelly.addEventHandler(
    function (event) {
        // while we don't have better selectivity for event source
        if (typeof (event) === 'undefined') return;
        if (event.info.event == "config_changed" && !event.info.restart_required) {
          onMQTTConnected();
        }
    }
);

// Report Discovery on the script start
Shelly.call("MQTT.GetStatus", {}, function (res) {
  mqttConnected = res.connected;

  if (mqttConnected) {
    // Treat script start while already connected
    onMQTTConnected();
  }
});

