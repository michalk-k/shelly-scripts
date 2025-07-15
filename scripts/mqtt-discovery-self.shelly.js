let CONFIG = {
  debug: true,
  discovery_topic: "homeassistant",
  report_ip: true,
  temperature_unit: "C" // C or F - Uppercase!!!
};

const COMPONENT_TYPES = ["switch", "pm1", "wifi", "em", "em1", "temperature"];
const SUPPORTED_ATTRS = ["apower", "voltage", "freq", "current", "pf", "aenergy", "ret_aenergy", "output", "rssi", "temperature", "tC", "tF"];

const CAT_DIAGNOSTIC = ["rssi","temperature"];
const DISABLED_ENTS = ["pf", "voltage", "freq", "current", "ret_aenergy"];

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
  "a_act_power": "apower",
  "b_act_power": "apower",
  "c_act_power": "apower",
  "a_total_act_energy": "aenergy",
  "b_total_act_energy": "aenergy",
  "c_total_act_energy": "aenergy",
  "a_total_act_ret_energy": "ret_aenergy",
  "b_total_act_ret_energy": "ret_aenergy",
  "c_total_act_ret_energy": "ret_aenergy",
  "total_act": "aenergy",
  "total_act_ret": "ret_aenergy"
}

const DEVCLASSES = {
  "apower": "power",
  "voltage": "voltage",
  "freq": "frequency",
  "current": "current",
  "pf": "power_factor",
  "aenergy": "energy",
  "ret_aenergy": "energy",
  "temperature": "temperature",
  "switch": "switch", // from docs: possible none, switch, outlet
  "rssi": "signal_strength",
  "light": "light"
}

const NAMES = {
  "apower": "Active Power",
  "voltage": "Voltage",
  "freq": "Frequency",
  "current": "Current",
  "pf": "Power Factor",
  "aenergy": "Active Energy",
  "ret_aenergy": "Returned Active Energy",
  "temperature": "Temperature",
  "output": "Switch",
  "rssi": "RSSI",
  "light": "Light"
}

const UNITS = {
  "apower": "W",
  "voltage": "V",
  "freq": "Hz",
  "current": "A",
  "aenergy": "Wh",
  "ret_aenergy": "Wh",
  "tC": "°C",
  "tF": "°F",
  "rssi": "dBm"
}

const DOMAINS = {
  "apower": "sensor",
  "voltage": "sensor",
  "freq": "sensor",
  "current": "sensor",
  "aenergy": "sensor",
  "ret_aenergy": "sensor",
  "tC": "sensor",
  "tF": "sensor",
  "state": "binary_sensor",
  "output": "switch",
  "pf": "sensor",
  "rssi": "sensor",
  "temperature": "sensor"
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

  const macaddress = normalizeMacAddress(deviceInfo.mac);

  let device = {};
  device.name = deviceInfo.name ? deviceInfo.name : macaddress + "-" + deviceInfo.app;
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
  * @param {string} attr - attribute name for which the template is to be created
  * @returns {string} - template string for extracting value from MQTT message
  */
function getValTpl(attr) {
  let devclass = getDeviceClass(attr);

  switch (devclass) {
    case "energy":
      return "{{ value_json." + attr + ".total }}";
    case "switch":
    case "light":
      return "{{ 'on' if value_json.output else 'off' }}";
    case "temperature":
      return "{{ value_json." + attr + ".t" + CONFIG.temperature_unit + " }}";
  }

  return "{{ value_json." + attr + " }}";
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
 * @param {string} attr - Attribute name for which the unit is to be retrieved
 * @returns {string|null} - Unit of measurement for the attribute, or null if not recognized
 */
function getUnits(attr) {
  if (attr == "temperature") attr = "t" + CONFIG.temperature_unit;
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

  if ( info.name && (info.attr_common == 'switch' || info.attr_common == 'light' )) {
    return info.name;
  }

  let name;
  if (NAMES[info.attr_common]) name = NAMES[info.attr_common];
  else name = info.attr_common;

  if (info.name) name = info.name + " " + name;
  else if (info.ix >= 0) name = name + " " + (info.ix+1);
  
  if (info.attr != info.attr_common) name =+ " " + info.attr_common.split("_")["0"];
 
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
  * @param {string} attr - Attribute name for which the domain is to be retrieved
  * @returns {string} - Domain for the attribute, or the attribute name if not recognized
  */  
function getDomain(attr) {
  if (DOMAINS[attr] !== undefined) return DOMAINS[attr];
  return attr;
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

  let domain = getDomain(info.attr_common);
  let pload = {};

  pload["name"] = getName(info);
  pload["uniq_id"] = getUniqueId(info);
  pload["stat_t"] = topic + "/status/" + info.topic;
  pload[info.attr_common == "light" ? "stat_val_tpl" : "val_tpl"] = getValTpl(info.attr_common);
  pload.dev_cla = getDeviceClass(info.attr_common);
  
  if (pload.dev_cla == "energy") {
    pload["stat_cla"] = "total_increasing";
  } else if (domain == "sensor") {
    pload["stat_cla"] = "measurement";
  }

  switch (domain) {
    case "switch":
    case "light":
      pload["cmd_t"] = topic + "/command/" + info.topic;
      pload["pl_on"] = "on";
      pload["pl_off"] = "off";
      break;
    case "sensor":
      pload["unit_of_meas"] = getUnits(info.attr_common);
      break;
  }

  if (CAT_DIAGNOSTIC.indexOf(info.attr_common) != -1) {
    pload["ent_cat"] = "diagnostic";
  }


  if (DISABLED_ENTS.indexOf(info.attr_common) != -1) {
    pload["en"] = "false";
  }

  return { "domain": domain, "subtopic": info.topic.split(":").join("-") + "-" + info.attr, "data": pload }
}

let report_arr = [];
let report_arr_idx = 0;
let device;
let macaddr;
let devicemqtttopic = Shelly.getComponentConfig("mqtt").topic_prefix;
let uidata = Shelly.getComponentConfig("sys").ui_data;

/**
 * Precollects input information needed for creation of MQTT discovery.
 * 
 * Data are stored into array, making it possible to track the progress and resume with subsequent Timer calls.
 */
function precollect() {
  let status;

  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    let comptype = COMPONENT_TYPES[t];

    // create data for single components
    status = Shelly.getComponentStatus(comptype);

    if (status !== null) {

      for (let datattr in status) {
        if (SUPPORTED_ATTRS.indexOf(datattr) == -1) continue;

        report_arr.push({comp : comptype, ix: -1, attr: datattr, topic: comptype});
      }
    }
    else {
      let index = 0;
      while (true) {
        
        let scomp = comptype + ":" + index;
        status = Shelly.getComponentStatus(scomp);

        if (status === null) break;

        for (let datattr in status) {
          if (SUPPORTED_ATTRS.indexOf(datattr) == -1) continue;

            report_arr.push({comp : comptype, ix: index, attr: datattr, topic: scomp});
        }

        index++;
      }
    }
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
    report_arr_idx++;
  } else {
    Timer.clear(schedurelmqtt);
    report_arr = null;
    report_arr_idx = null;
    device = null;
    macaddr =null;
    devicemqtttopic = null;
    uidata = null;
    return;
  }

  if (!device === undefined) {
    let deviceInfo = Shelly.getDeviceInfo();
    // deviceInfo.mac = "B8:D6:XX:XX:XX:XX";
    macaddr = normalizeMacAddress(deviceInfo.mac);
    device = discoveryDevice(deviceInfo);
    // Free memory as soon as possible
    deviceInfo = null;
  }
  
  info.name = Shelly.getComponentConfig(info.topic).name;

  info.altdomain = uidata.consumption_types[info.ix];
  info.mac = macaddr;
  info.attr_common = getCommonAttr(info.attr);

  let data = discoveryEntity(devicemqtttopic, info);
  let discoveryTopic = CONFIG.discovery_topic + "/" + data.domain + "/" + macaddr + "/" + data.subtopic + "/config";
  data.data.dev = device;
  MQTT.publish(discoveryTopic, JSON.stringify(data.data), 1, true);
}

/***************************************
* Generate MQTT Discovery
***************************************/

// Initial precollection of entities to be reported
// This will also set up a timer to publish one collected entity per second
precollect();
let schedurelmqtt = Timer.set(1000, true, mqttreport, null);



/***************************************
* RSSI (WiFi) reporting
***************************************/

/**
 * Reports the WiFi configuration to MQTT.
 * Publishes the WiFi status to the MQTT topic defined in the Shelly component configuration.
 * The topic is constructed using the MQTT topic prefix and the "status/wifi" suffix.
 */
function reportWifiToMQTT() {
  let topic_prefix = Shelly.getComponentConfig("mqtt").topic_prefix;
  let wifiConfig = Shelly.getComponentStatus("wifi");

  MQTT.publish(topic_prefix + "/status/wifi", JSON.stringify(wifiConfig), 1, false);
  // Free memory
  wifiConfig = null;
}

// Initial call to report WiFi status
// This will also set up a timer to report WiFi status every 60 seconds
reportWifiToMQTT();
let timer_handle = Timer.set(60000, true, reportWifiToMQTT, null);