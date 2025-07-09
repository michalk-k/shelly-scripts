let CONFIG = {
  debug: true,
  discovery_topic: "homeassistant/",
  report_ip: true
};

const COMPONENT_TYPES = ["switch", "pm1", "wifi"];
const SUPPORTED_ATTRS = ["apower", "voltage", "freq", "current", "pf", "aenergy", "ret_aenergy", "output", "rssi"];

const DEVCLASSES = {
  "apower": "power",
  "voltage": "voltage",
  "freq": "frequency",
  "current": "current",
  "pf": "power_factor",
  "aenergy": "energy",
  "ret_aenergy": "energy",
  "temperature": "temperature",
  "output": "switch", // possible none, switch, outlet
  "rssi": "signal_strength"
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
  "rssi": "RSSI"
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
  "rssi": "sensor"
}

const CAT_DIAGNOSTIC = ["rssi"];

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
 * Manufacturer and model are retrieved from CONFIG.allowedMACs global variable.
 * Device name is built from its mac address and model name (if exists)
 * via_device is set to Shelly address the script is run on.
 *
 * @param address {string} - normalized already mac address of the BLE device.
 * @returns {<Object>} device object structured for MQTT discovery
 */
function discoveryDevice(deviceInfo) {

  const macaddress = normalizeMacAddress(deviceInfo.mac);

  let device = {};
  device.name = macaddress + "-" + deviceInfo.app;
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
 * Cretes and publishes discovery topic for single entity
 * @param {string} topic Object identifier used for preventing repeating discovery topic creation. Will be returned back in the result struct
 * @param {string} attr MQTT topic where data are reported to. Needed to include into Discovery definition
 * @param {int} id Name of object type. Mostly it will be borrowed for entity name
 * @return {<Object>} Object with data for publishing to MQTT
 */
function discoveryEntity(topic, devsubt, attr, id, mac) {
  let pload = {};
  let domain = getDomain(attr);

  pload["name"] = getName(attr, id);
  pload["uniq_id"] = getUniqueId(mac, attr, id);
  pload["stat_t"] = topic + "/status/" + devsubt;
  pload["val_tpl"] = getValTpl(attr);
  pload.dev_cla = getDeviceClass(attr);
  
  if (pload.dev_cla == "energy") {
    pload["stat_cla"] = "total_increasing";
  } else if (domain == "sensor") {
    pload["stat_cla"] = "measurement";
  }

  switch (domain) {
    case "switch":
      pload["cmd_t"] = topic + "/command/" + devsubt;
      pload["pl_on"] = "on";
      pload["pl_off"] = "off";
      break;
    case "sensor":
      pload["unit_of_meas"] = getUnits(attr);
      break;
  }

  if (CAT_DIAGNOSTIC.indexOf(attr) != -1) {
    pload["ent_cat"] = "diagnostic";
  }

  // let subt =getAlias(attr, id);
  return { "domain": domain, "subtopic": getName(attr, id).toLowerCase().split(" ").join("_"), "data": pload }
}


/**
 * Appends discovery entity definitions to the result array.
 *
 * Iterates over supported attributes in `data`, generates discovery
 * entities using `discoveryEntity`, and pushes them into `result`.
 *
 * @param {Array} result - [out] The array to which discovery items will be added.
 * @param {string} topic - The MQTT topic where data are found.
 * @param {Object} data - The input data object containing supported attributes.
 * @param {string} mac - The MAC address used in unique IDs.
 */
function discoveryItems(result, topic, devsubt, data, mac) {

  for (let attr in data) {
    if (SUPPORTED_ATTRS.indexOf(attr) == -1) continue;
    let d = discoveryEntity(topic, devsubt, attr, data.id, mac);
    result.push(d);
  }

}


function mqttreport() {
  let mqttConfig = Shelly.getComponentConfig("mqtt");
  let ploads = [];
  let deviceInfo = Shelly.getDeviceInfo();
  deviceInfo.mac = "B8D61A89XXXX"
  const macaddr = normalizeMacAddress(deviceInfo.mac);
  const device = discoveryDevice(deviceInfo);
  const mqtt_topic = mqttConfig.topic_prefix;
  // Free memory as soon as possible
  deviceInfo = null;
  mqttConfig = null;
  let status;

  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    let comptype = COMPONENT_TYPES[t];

    // create data for single components
    status = Shelly.getComponentStatus(comptype);

    if (status !== null) {
      discoveryItems(ploads, mqtt_topic, comptype, status, macaddr);
      // Free status after use
      status = null;
      continue;
    }
  }

  let discoveryTopic;
  for (let i = 0; i < ploads.length; i++) {
    ploads[i].data.device = device;
    discoveryTopic = CONFIG.discovery_topic + ploads[i].domain + "/" + macaddr + "/" + ploads[i].subtopic + "/config";
    MQTT.publish(discoveryTopic, JSON.stringify(ploads[i].data), 1, true);
    // Free each pload after publish
    ploads[i] = null;
  }
  discoveryTopic = null;

  ploads = null;
  ploads = [];
  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    let comptype = COMPONENT_TYPES[t];

    // create data for multi-components like switch:0, switch:1 etc
    let index = 0;
    let id;
    while (true) {
      id = comptype + ":" + index;
      status = Shelly.getComponentStatus(id);

      if (status === null) break;

      discoveryItems(ploads, mqtt_topic, id, status, macaddr);
      // Free status after use
      status = null;
      index++;
    }
  }

  let discoveryTopic;
  for (let i = 0; i < ploads.length; i++) {
    ploads[i].data.device = device;
    discoveryTopic = CONFIG.discovery_topic + ploads[i].domain + "/" + macaddr + "/" + ploads[i].subtopic + "/config";
    MQTT.publish(discoveryTopic, JSON.stringify(ploads[i].data), 1, true);
    // Free each pload after publish
    ploads[i] = null;
  }
  // Free ploads array
  ploads = null;
  discoveryTopic = null;
}

function getValTpl(attr) {
  let devclass = getDeviceClass(attr);

  switch (devclass) {
    case "energy":
      return "{{ value_json." + attr + ".total }}";
    case "switch":
      return "{{ 'on' if value_json." + attr + " else 'off' }}";
  }

  return "{{ value_json." + attr + " }}";
}

function getUniqueId(mac, attr, id) {
  let ret;

  if (NAMES[attr] === undefined) ret = attr;
  else if (id !== undefined) ret = NAMES[attr] + "_" + (id+1);
  else ret = NAMES[attr];

  return mac + "_" + ret.toLowerCase().split(" ").join("_");
}

function getSubTopic(attr, id) {
  if (id !== undefined) return "status/" + attr;
  return "status/" + attr + ":" + id;
}

function getUnits(attr) {
  if (attr == "temperature") attr = "tC";
  if (UNITS[attr] === undefined) return null;
  return UNITS[attr];
}

function getName(attr, id) {
  if (NAMES[attr] === undefined) return attr;
  if (id !== undefined) return NAMES[attr] + " " + (id+1);
  return NAMES[attr];
}

function getDeviceClass(attr) {
  if (DEVCLASSES[attr] === undefined) return null;
  return DEVCLASSES[attr];
}

function getDomain(attr) {
  if (DOMAINS[attr] === undefined) return null;
  return DOMAINS[attr];
}


mqttreport();

function reportWifiToMQTT() {
  let mqttConfig = Shelly.getComponentConfig("mqtt");
  let wifiConfig = Shelly.getComponentStatus("wifi");

  MQTT.publish(mqttConfig.topic_prefix + "/status/wifi", JSON.stringify(wifiConfig), 1, false);
  // Free memory
  mqttConfig = null;
  wifiConfig = null;
}

reportWifiToMQTT();
let timer_handle = Timer.set(60000, true, reportWifiToMQTT, null);