let CONFIG = {
  debug: true,
  discovery_topic: "homeassistant_test/",
  report_ip: true
};

const COMPONENT_TYPES = ["switch"];
const SUPPORTED_ATTRS = ["apower", "voltage", "freq", "current", "pf", "aenergy", "ret_aenergy", "output", "rssi", "temperature"];

const DEVCLASSES = {
  "apower": "power",
  "voltage": "voltage",
  "freq": "frequency",
  "current": "current",
  "pf": "power_factor",
  "aenergy": "energy",
  "ret_aenergy": "energy",
  "temperature": "temperature",
  "switch": "switch", // possible none, switch, outlet
  "rssi": "signal_strength",
  // light matches domain name, not here to save memory
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
  "switch": "Switch",
  "rssi": "RSSI",
  "light": "Light",
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
  "pf": "sensor",
  "rssi": "sensor",
  "temperature": "sensor"
  // switch and light matches domain name, not here to save memory
}

const CAT_DIAGNOSTIC = ["rssi", "temperature"];

const DISABLED_ENTS = ["pf"];

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
function discoveryEntity(topic, attr, data, mac) {
  let pload = {};
  let attr_orig = attr;
  
  if (attr == "output") {
    if (data.altdomain) attr = data.altdomain;
    else attr = data.scomp
  }

  let domain = getDomain(attr, data);
  

  pload["name"] = getName(attr, data);
  pload["uniq_id"] = getUniqueId(mac, attr_orig, data);
  pload["stat_t"] = topic + "/status/" + data.stopic;
  pload["val_tpl"] = getValTpl(attr_orig);
  pload.dev_cla = getDeviceClass(attr, data);
  
  if (pload.dev_cla == "energy") {
    pload["stat_cla"] = "total_increasing";
  } else if (domain == "sensor") {
    pload["stat_cla"] = "measurement";
  }

  switch (domain) {
    case "switch":
    case "light":
      pload["cmd_t"] = topic + "/command/" + data.stopic;
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

  if (DISABLED_ENTS.indexOf(attr) != -1) {
    pload["en"] = false;
  }

  // let subt =getAlias(attr, id);
  return { "domain": domain, "subtopic": getName(attr, data).toLowerCase().split(" ").join("_"), "data": pload }
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
function discoveryItems(result, topic, data, mac) {

  for (let attr in data) {
    if (SUPPORTED_ATTRS.indexOf(attr) == -1) continue;
    let d = discoveryEntity(topic, attr, data, mac);
    result.entities[d.data.uniq_id] = d;
    //  push(d);
  }

}


function mqttreport() {
  let mqttConfig = Shelly.getComponentConfig("mqtt");
  let uidata = Shelly.getComponentConfig("sys").ui_data;
  
  // let ploads = [];
  let deviceInfo = Shelly.getDeviceInfo();
  deviceInfo.mac = "B8D61A89XXXX"
  const macaddr = normalizeMacAddress(deviceInfo.mac);
  let device = discoveryDevice(deviceInfo);
  let idents = {"ids": device.ids};
  const mqtt_topic = mqttConfig.topic_prefix;
  // Free memory as soon as possible
  deviceInfo = null;
  mqttConfig = null;
  let data;
  let discoveryTopic;

  // let dummyentity = {
  //   "device": device,
  //   "name": "dummy",
  //   "uniq_id":"temp01ae_t",
  //   "en": false,
  //   "qos": 2,
  //   "dev": "sensor",
  //   "stat_t": mqtt_topic,
  // }

  // let str = JSON.stringify(dummyentity)
  // dummyentity = null;

  // discoveryTopic = CONFIG.discovery_topic + "sensor" + "/" + macaddr + "/" + "dummy" + "/config";
  // MQTT.publish(discoveryTopic, JSON.stringify(str), 0, true);

  // return;
  // device = null;

  device.entities = {};
  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    let comptype = COMPONENT_TYPES[t];

    // create data for single components
    data = Shelly.getComponentStatus(comptype);

    if (data !== null) {
      data.scomp = comptype;
      data.stopic = comptype;
      discoveryItems(device, mqtt_topic, data, macaddr);
      // Free status after use
      data = null;
      continue;
    }
  }

  
  // for (let i = 0; i < ploads.length; i++) {
  //   // ploads[i].data.device = idents;
  //   discoveryTopic = CONFIG.discovery_topic + ploads[i].domain + "/" + macaddr + "/" + ploads[i].subtopic + "/config";
  //   str = JSON.stringify(ploads[i].data);
  //   MQTT.publish(discoveryTopic, str, 0, true);
  //   // Free each pload after publish
  //   str= null;
  //   ploads[i] = null;
  // }
  // discoveryTopic = null;
  // ploads = null;

  
  for (let t = 0; t < COMPONENT_TYPES.length; t++) {
    // ploads = [];
    let comptype = COMPONENT_TYPES[t];

    // create data for multi-components like switch:0, switch:1 etc
    let index = 0;
    let id;
    while (true) {
      
      id = comptype + ":" + index;
      data = Shelly.getComponentStatus(id);
      
      if (data === null) break;

      data.scomp = comptype;
      data.stopic = id;
      data.name = Shelly.getComponentConfig(id).name;
      data.altdomain = uidata.consumption_types[index];

      discoveryItems(device, mqtt_topic, data, macaddr);

    // ploads = null;
    // Free status after use
    data = null;
    index++;
  }


    // for (let i = 0; i < ploads.length; i++) {
    //   ploads[i].data.device = device;
    //   discoveryTopic = CONFIG.discovery_topic + ploads[i].domain + "/" + macaddr + "/" + ploads[i].subtopic + "/config";
    //   MQTT.publish(discoveryTopic, JSON.stringify(ploads[i].data), 1, true);

    //   // Free each pload after publish
    //   ploads[i] = null;
    // }
    // Free ploads array
    
  }

  // discoveryTopic = CONFIG.discovery_topic + "testdata";
  devdata = JSON.stringify(device);
  // device = null;
  
  // MQTT.publish(discoveryTopic, device, 1, true);
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
    case "tC":
      return "{{ value_json." + attr + ".tC }}";
  }

  return "{{ value_json." + attr + " }}";
}

function getName(attr, data) {

  if ( data.name) {
    return data.name;
  }

  let name;
  if (NAMES.attr) name = NAMES.attr;
  else name = attr;
  
  if (data.id !== undefined) name = name + "_" + (data.id+1);
  
  return name;
}

function getUniqueId(mac, attr, data) {
  let ret;

  if (NAMES.attr) ret = NAMES.attr;
  if (data.id !== undefined) ret = NAMES[attr] + "_" + (data.id+1);
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

function getDeviceClass(attr, data) {
  if (DEVCLASSES[attr] === undefined) return attr;
  return DEVCLASSES[attr];
}

function getDomain(attr, data) {
  if (DOMAINS[attr] === undefined) return attr;
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