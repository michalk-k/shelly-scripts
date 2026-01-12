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

  components_refresh: ["wifi"],
  components_refresh_period: 60     // (seconds) how often report components above to mqtt
};

const COMPONENT_TYPES = ["switch", "pm1", "wifi", "em", "em1", "emdata", "em1data", "temperature", "cover", "humidity", "voltmeter", "input"];

// Optimized: combined metadata object (saves ~350 bytes overhead)
// Format: d=devclass, n=name, u=unit, dm=domain, diag=diagnostic, dis=disabled, na=not supported attribute
const META = {
  apower: {d:"power",n:"Active Power",u:"W",dm:"sensor"},
  aprt_power: {d:"apparent_power",n:"Aparent Power",u:"VA",dm:"sensor"},
  voltage: {d:"voltage",n:"Voltage",u:"V",dm:"sensor",dis:1},
  xvoltage: {d:null,n:"X-Voltage",u:null,dm:"sensor",dis:1},
  freq: {d:"frequency",n:"Frequency",u:"Hz",dm:"sensor",dis:1},
  current: {d:"current",n:"Current",u:"A",dm:"sensor",dis:1},
  pf: {d:"power_factor",n:"Power Factor",u:null,dm:"sensor",dis:1},
  aenergy: {d:"energy",n:"Active Energy",u:"Wh",dm:"sensor"},
  ret_aenergy: {d:"energy",n:"Returned Active Energy",u:"Wh",dm:"sensor",dis:1},
  temperature: {d:"temperature",n:"Temperature",u:null,dm:"sensor",diag:1},
  rh: {d:"humidity",n:"Humidity",u:"%",dm:"sensor"},
  switch: {d:"switch",n:"Switch",u:null,dm:"switch", na: 1},
  rssi: {d:"signal_strength",n:"RSSI",u:"dBm",dm:"sensor",diag:1},
  light: {d:"light",n:"Light",u:null,dm:"light", na: 1},
  "state-cover": {d:null,n:"Cover",u:null,dm:"cover"},
  state: {d:null,n:"BinaryIn",u:null,dm:"binary_sensor",dis:1},
  percent: {d:null,n:"AnalogIn",u:null,dm:"sensor"},
  xpercent: {d:null,n:"X-AnalogIn",u:null,dm:"sensor"},
  output: {d:null,n:"Switch",u:null,dm:"switch"},
  tC: {d:null,n:null,u:"°C",dm:"sensor"},
  tF: {d:null,n:null,u:"°F",dm:"sensor"}
}

function isDiagnostic(attr) { let m=META[attr]; return m&&m.diag===1; }
function isDisabled(attr) { let m=META[attr]; return m&&m.dis===1; }
function isSupportedAttr(attr) { let m=META[attr]; return m&&(m.na===undefined||m.na===false||m.na===0); }

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
 * @param {string} mac - MAC address (e.g., "B8:D6:XX:XX:XX:XX")
 * @returns {Object} The device object with the following structure:
 */
function discoveryDevice(mac) {

  let device = {};
  device.name = Shelly.getDeviceInfo().name && CONFIG.custom_names.device ? Shelly.getDeviceInfo().name : mac + "-" + Shelly.getDeviceInfo().app;
  device.ids = [mac + ""];
  device.cns = [["mac", mac + ""]];
  device.mf = "Shelly"
  device.mdl = "Shelly " + Shelly.getDeviceInfo().app;
  device.mdl_id = Shelly.getDeviceInfo().model;
  device.sw = Shelly.getDeviceInfo().ver;
  device.hw = "gen " + Shelly.getDeviceInfo().gen;

  if (CONFIG.report_ip) {
    device.cu = "http://" + Shelly.getComponentStatus("wifi").sta_ip;
  }

  return device;
}

/**
  * Returns a template for value extraction from MQTT message.
  * The template is based on the attribute type.
  *
  * @param {object} info - Object containing information about the entity
  * @returns {string} - template string for extracting value from MQTT message
  */
function getValTpl(info) {

  if (info.attr == "aenergy" || info.attr == "ret_aenergy") return "{{ value_json." + info.attr + ".total }}";
  if (info.attr == "output") return "{{ 'on' if value_json.output else 'off' }}";
  if (info.attr == "temperature") return "{{ value_json." + info.attr + ".t" + CONFIG.temperature_unit + " }}";
  if (info.attr == "state") return "{{ value_json." + info.attr + " if value_json." + info.attr + " else false }}";

  return "{{ value_json." + info.attr + " }}";
}

/**
 * Generates a unique identifier for the entity based on its MAC address, attribute, and index.
 * The identifier is formatted as "<macaddress>_<component>_<attribute>", where attribute is Shelly component name, component is instance of the component, ie switch1.
 * This way it never change even if you configure switch to be the light.
 * @param {object} info - Object containing information about the entity, including its MAC address, topic, and attribute
 * @returns {string} - Unique identifier for the entity
 */
function getUniqueId(info) {
  return info.mac + "_" + info.topic.split(":").join("") + "_" + info.attr;
}

/**
 * Returns the unit of measurement for entity.
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
  if (META[attr] && META[attr].u) return META[attr].u;

  return null;
}

/**
  * Returns a name for the entity based on its various attributes.
  * In HA determines a user-friendly name as well as entity_id.
  * @param {Object} info - Object containing information about the entity
  * @returns {string} - Human-readable name for the entity
  */
function getName(info) {

  let name;
  let key = info.attr_common;

  if (META[info.attr_common] && META[info.attr_common].n) name = META[info.attr_common].n;
  else name = info.attr_common;

  if (info.name) name = info.name + " " + name;
  else if (info.addon) name = "Addon " + name + " " + (info.ix-99);
  else if (info.ix >= 0 && !info.issingle) name = name + " " + (info.ix+1);

  if (info.attr != info.attr_common && (info.comp == "em" || info.comp == "emdata")) name = name + " " + info.attr.split("_")["0"].toUpperCase();

  return name;
}

/**
 * Retrieves the common attribute value for the specified attribute name.
 *
 * @param {string} comp - Shelly component name
 * @param {string} attr - Attribute name to be translated
 * @returns {string} The common attribute.
 */
function getCommonAttr(comp, attr) {
  if (attr == "state" && comp == "cover") return "state-cover";

  if (attr==="tF"||attr==="tC") return "temperature";
  if (attr === "total_act") return "aenergy";
  if (attr === "total_act_ret") return "ret_energy";
  if (attr.indexOf("_current") != -1) return "current";
  if (attr.indexOf("_voltage") != -1) return "voltage";
  if (attr.indexOf("_freq") != -1) return "freq";
  if (attr.indexOf("_pf") != -1) return "pf";
  if (attr.indexOf("_act_power") != -1) return "apower";
  if (attr.indexOf("_aprt_power") != -1) return "aprt_power";
  if (attr.indexOf("_act_energy") != -1) return "aenergy";
  if (attr.indexOf("_ret_energy") != -1) return "ret_energy";

  return attr;
}

/**
 * Returns the device class for the given attribute.
 * If the attribute is not recognized, it returns the attribute name itself.
 * This is used to determine how the entity should be represented in Home Assistant.
 * @param {string} attr - Attribute name for which the device class is to be retrieved
 * @returns {string} - Device class for the attribute (can be null), or the attribute name if not recognized
 */
function getDeviceClass(attr) {
  if (META[attr] && META[attr].d !== undefined) return META[attr].d;
  return attr;
}

/**
  * Returns the entity domain for the given attribute.
  * The domain is used to categorize the entity in Home Assistant.
  * If the attribute is not recognized, it returns the attribute name itself.
  * @param {Object} info - See other docs
  * @returns {string} - Domain for the attribute, or the attribute name if not recognized
  */
function getDomain(info) {
  if (META[info.attr_common] && META[info.attr_common].dm) return META[info.attr_common].dm;
  return info.attr_common;
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
  pload["avty"] = {
      "t": topic + "/online",
      "pl_avail": "true",
      "pl_not_avail": "false"
    };

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

  if (info.forcediagnostic || (!info.addon && isDiagnostic(info.attr_common))) {
    pload["ent_cat"] = "diagnostic";
  }

  if (info.forcedisabled || (!info.addon && CONFIG.disable_minor_entities && isDisabled(info.attr_common))) {
    if (!info.forceenabled) pload["en"] = false;
  }
  return { "domain": domain, "subtopic": info.topic.split(":").join("") + "-" + info.attr, "data": pload }
}

let report_arr = [];
let comps = [];
let report_arr_idx = 0;
let comp_inst_num = {}; // number of components of the same type, ie switch:0, switch:1 etc

function initGlobals() {
  report_arr = [];
  comps = []
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

  for (let comptype of COMPONENT_TYPES) {

    // create data for single components
    status = Shelly.getComponentStatus(comptype);

    if (status !== null) {

      for (let datattr in status) {
        if (!isSupportedAttr(getCommonAttr(comptype, datattr))) continue;
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
          if (!isSupportedAttr(getCommonAttr(comptype, datattr))) continue;
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
            if (!isSupportedAttr(getCommonAttr(comparr[0], datattr))) continue;
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
  if (!CONFIG.publish_init_data) return true;

    if (!comps[report_arr_idx]) return true;

    mqttPublishComponentData(comps[report_arr_idx]);
    report_arr_idx++;

    return false;
}


/**
 * Processes the next entity in `report_arr` (using `report_arr_idx`), constructs its MQTT discovery payload, and publishes it to the appropriate MQTT discovery topic.
 * @returns
 */
function mqttDiscovery() {
  let info;

  if (report_arr[report_arr_idx] ) {
    info = report_arr[report_arr_idx];
    report_arr[report_arr_idx] = null;
    report_arr_idx++;
  } else {
    report_arr = null;
    report_arr_idx = 0;
    comp_inst_num = null;
    isProcessing = false;
    return true;
  }

  if (CONFIG.custom_names.channels && !info.addons || CONFIG.custom_names.addon && info.addons && Shelly.getComponentConfig(info.topic).name.length > 0) {
    info.name = Shelly.getComponentConfig(info.topic).name;
  }

  info.mac = normalizeMacAddress(CONFIG.fake_macaddress ? CONFIG.fake_macaddress : Shelly.getDeviceInfo().mac);
  info.attr_common = getCommonAttr(info.comp, info.attr);
  if (Shelly.getComponentConfig("sys").ui_data.consumption_types && Shelly.getComponentConfig("sys").ui_data.consumption_types[info.ix]) info.altdomain = Shelly.getComponentConfig("sys").ui_data.consumption_types[info.ix];

  const cfg = Shelly.getComponentConfig(info.topic)["x" + info.attr_common];
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
  data.data.dev = discoveryDevice(info.mac);

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

  if (comps.indexOf(info.topic) == -1 ) comps.push(info.topic);

  data = null;
  info = null;

  return false;
}

/**
 * Execution control variables
 */
let discoverytimer;
let mqttConnected = false;
let isProcessing = false;
let processingPhase;

/**
 * Initialize discovery process.
 * Starts with precollection of source data,
 * then set up a timer to publish one collected entity per time-period.
 * @returns
 */
function onMQTTConnected() {
  if (isProcessing) return;
  isProcessing = true;
  processingPhase = "discovery";
  precollect();
  discoverytimer = Timer.set(CONFIG.mqtt_publish_pause, true, reportingWorker);
}

function reportingWorker() {
  switch (processingPhase)  {
  case "discovery":
    if (mqttDiscovery()) processingPhase = "data";
    break;
  case "data":
    if (mqttForceInitialData()) processingPhase = "finished";
    break;
  case "finished":
    Timer.clear(discoverytimer);
    discoverytimer = null;
    isProcessing = false;
    break;
  }
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

  for (let comp of CONFIG.components_refresh) {
    mqttPublishComponentData(comp);
  }
}


// This will also set up a timer to report WiFi status every 60 seconds
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
        if (event.info.event == "config_changed" &&
          !event.info.restart_required &&
          (COMPONENT_TYPES.indexOf(event.name) !== -1 || event.name == 'sys')) {
          onMQTTConnected();
        }
    }
);

// Report Discovery on the script start
mqttConnected = MQTT.isConnected();
if (mqttConnected) onMQTTConnected();
