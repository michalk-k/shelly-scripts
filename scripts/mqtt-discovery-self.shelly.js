let CONFIG = {
  debug: true,
  discovery_topic: "homeassistant",
  report_ip: true,
  temperature_unit: "C" // C or F - Uppercase!!!
};

const COMPONENT_TYPES = ["switch", "pm1", "wifi"];
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

const CAT_DIAGNOSTIC = ["rssi","temperature"];
const DISABLED_ENTS = ["pf", "voltage", "freq", "current", "ret_aenergy"];

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
 * @param deviceInfo {Object} - object with device information, including app, model, version, generation, etc.
 * @returns {Object} device object structured for MQTT discovery
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

function getUniqueId(mac, attr, id) {
  let ret;

  if (NAMES[attr] === undefined) ret = attr;
  else if (id >= 0) ret = NAMES[attr] + "_" + (id+1);
  else ret = NAMES[attr];

  return mac + "_" + ret.toLowerCase().split(" ").join("_");
}

function getUnits(attr) {
  if (attr == "temperature") attr = "t" + CONFIG.temperature_unit;
  if (UNITS[attr] === undefined) return null;
  return UNITS[attr];
}

function getName(info) {

  if ( info.name && (info.attr == 'switch' || info.attr == 'light' )) {
    return info.name;
  }

  let name;
  if (NAMES[info.attr]) name = NAMES[info.attr];
  else name = info.attr;

  if ( info.name && !(info.attr == 'switch' || info.attr == 'light' )) name = info.name + " " + name;
  else if (info.ix >= 0) name = name + " " + (info.ix+1);
  
  return name;
}

function getDeviceClass(attr) {
  if (DEVCLASSES[attr] === undefined) return attr;
  return DEVCLASSES[attr];
}

function getDomain(attr) {
  if (DOMAINS[attr] !== undefined) return DOMAINS[attr];
  return attr;
}


/**
 * Builds data of single entity to be published to MQTT discovery
 * @param {string} topic Object identifier used for preventing repeating discovery topic creation. Will be returned back in the result struct
 * @param {Object} info Data needed to build the MQTT discovery obejct
 * @returns {Object} Object with data for publishing to MQTT
 */
function discoveryEntity(topic, info) {
  let attr_orig = info.attr;
  
  if (info.attr == "output") {
    if (info.altdomain) info.attr = info.altdomain;
    else info.attr = info.comp
  }

  let domain = getDomain(info.attr);
  let pload = {};

  pload["name"] = getName(info);
  pload["uniq_id"] = getUniqueId(info.mac, attr_orig, info.ix);
  pload["stat_t"] = topic + "/status/" + info.topic;
  pload[info.attr == "light" ? "stat_val_tpl" : "val_tpl"] = getValTpl(info.attr);
  pload.dev_cla = getDeviceClass(info.attr);
  
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
      pload["unit_of_meas"] = getUnits(info.attr);
      break;
  }

  if (CAT_DIAGNOSTIC.indexOf(info.attr) != -1) {
    pload["ent_cat"] = "diagnostic";
  }


  if (DISABLED_ENTS.indexOf(info.attr) != -1) {
    pload["en"] = "false";
  }

  return { "domain": domain, "subtopic": info.topic.split(":").join("-") + "-" + attr_orig, "data": pload }
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
  let deviceInfo = Shelly.getDeviceInfo();
  deviceInfo.mac = "B8:D6:1A:89:XX:XX";
  macaddr = normalizeMacAddress(deviceInfo.mac);
  device = discoveryDevice(deviceInfo);
  // Free memory as soon as possible
  deviceInfo = null;
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
 * Picks up an item, indexed by `report_arr_idx` from the `report_arr`, builds data out of it and publishes it to MQTT discovery topic.
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

  info.name = Shelly.getComponentConfig(info.topic).name;
  info.altdomain = uidata.consumption_types[info.ix];
  info.mac = macaddr;

  let data = discoveryEntity(devicemqtttopic, info);
  data.data.dev = device;
  let discoveryTopic = CONFIG.discovery_topic + "/" + data.domain + "/" + macaddr + "/" + data.subtopic + "/config";
  MQTT.publish(discoveryTopic, JSON.stringify(data.data), 1, true);
}


precollect();
let schedurelmqtt = Timer.set(1000, true, mqttreport, null);


function reportWifiToMQTT() {
  let topic_prefix = Shelly.getComponentConfig("mqtt").topic_prefix;
  let wifiConfig = Shelly.getComponentStatus("wifi");

  MQTT.publish(topic_prefix + "/status/wifi", JSON.stringify(wifiConfig), 1, false);
  // Free memory
  wifiConfig = null;
}

reportWifiToMQTT();
let timer_handle = Timer.set(60000, true, reportWifiToMQTT, null);