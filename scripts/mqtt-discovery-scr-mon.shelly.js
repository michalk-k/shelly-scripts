let CONFIG = {

  custom_names: {                   // Use custom names from Shelly configuration, for:
    device: true,                   // shelly device
  },

  report_ip: true,                  // create URL link to open Shelly GUI from HA
  fake_macaddress: "",              // for testing purposes, set alternative macaddress

  data_topic: "scripts",
  discovery_topic: "homeassistant",

  mqtt_refresh_period: 60
};

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
 * Builds data of single entity to be published to MQTT discovery
 * @param {string} topic Object identifier used for preventing repeating discovery topic creation. Will be returned back in the result struct
 * @param {string} mac MAC address of the device, used for unique identification
 * @returns {Object} Object with data for publishing to MQTT
 */
function discoveryEntity(topic, mac) {
  let pload = {};

  pload["name"] = "Scripts";
  pload["uniq_id"] = mac + "_scripts";
  pload["stat_t"] = topic + "/status/" + CONFIG.data_topic;
  pload["json_attributes_topic"] = topic + "/status/" + CONFIG.data_topic;
  pload["val_tpl"] = "{{ value_json.running_count }}";
  pload["json_attributes_template"] = "{{ {'scripts': value_json.scripts, 'scripts_mem_free': value_json.scripts_mem_free } | tojson }}";
  pload["ent_cat"] = "diagnostic";
  pload["icon"] = "mdi:script-text-outline";
  pload["avty"] = {
      "t": topic + "/online",
      "pl_avail": "true",
      "pl_not_avail": "false"
    };

  return { "domain": "sensor", "subtopic": "scripts_monitor", "data": pload }
}

function mqttDiscovery() {

    if (!MQTT.isConnected()) {
        print ("MQTT not connected, skipping discovery publish");
        return;
    }

    let device = discoveryDevice(Shelly.getDeviceInfo());
    let mac = device.cns[0][1]
    let data = discoveryEntity(Shelly.getComponentConfig("mqtt").topic_prefix, mac);
    data.data.dev = device;

    let discoveryTopic  = CONFIG.discovery_topic + "/sensor/" + mac + "/" + data.subtopic + "/config";
    MQTT.publish(discoveryTopic, "", 1, true);
    MQTT.publish(discoveryTopic, JSON.stringify(data.data), 1, true);
}

function reportScriptsToMQTT() {

  if (!MQTT.isConnected()) {
    print ("MQTT not connected, skipping publish");
    return;
  }

  Shelly.call("Script.List", {}, function (res) {

    res.running_count = 0
    res.scripts_mem_free = null

    for (let stats of res.scripts) {
       stats.running = Shelly.getComponentStatus("script", stats.id).running;
       stats.mem_used = Shelly.getComponentStatus("script", stats.id).mem_used;
       stats.mem_peak = Shelly.getComponentStatus("script", stats.id).mem_peak;
       stats.errors = Shelly.getComponentStatus("script", stats.id).errors;
       stats.error_msg = Shelly.getComponentStatus("script", stats.id).error_msg;

       if (stats.running) res.running_count++;
       res.scripts_mem_free = Shelly.getComponentStatus("script", stats.id).mem_free;
    }

    MQTT.publish(Shelly.getComponentConfig("mqtt").topic_prefix + "/status/" + CONFIG.data_topic, JSON.stringify(res), 1, false);
  });
}

mqttDiscovery();
Timer.set(2000, false, reportScriptsToMQTT, null);
let timer_handle = Timer.set(CONFIG.mqtt_refresh_period * 1000, true, reportScriptsToMQTT, null);
